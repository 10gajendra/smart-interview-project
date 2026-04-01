from __future__ import annotations

import csv
import os
import random
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml_models.config import get_dataset_path, get_semantic_model_path

try:
    import pandas as pd
    from sentence_transformers import InputExample, SentenceTransformer, evaluation, losses
    from torch.utils.data import DataLoader
    from torch.utils.tensorboard import SummaryWriter
    import torch
except ImportError as exc:  # pragma: no cover - optional training dependencies
    raise RuntimeError(
        "Training dependencies are not installed in the active interpreter. "
        "Use the training venv under 'training model/trained model/model/venv'."
    ) from exc


@dataclass
class TrainConfig:
    csv_path: Path = get_dataset_path()
    output_model_path: Path = get_semantic_model_path()
    tensorboard_dir: Path = Path("runs/sbert_training")
    loss_log_csv: Path = Path("training_losses.csv")
    batch_size: int = 64
    epochs: int = 65
    warmup_steps: int = 100
    log_every_steps: int = 100
    random_seed: int = 42
    early_stop_patience: int = 5
    early_stop_min_delta: float = 0.001


class CSVLossLogger:
    def __init__(self, csv_path: Path):
        self.csv_path = csv_path
        self._batch_losses = []
        with csv_path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(
                [
                    "epoch",
                    "avg_batch_loss",
                    "min_batch_loss",
                    "max_batch_loss",
                    "eval_spearman",
                    "best_score",
                    "improved",
                    "timestamp",
                ]
            )

    def log_batch(self, loss: float) -> None:
        self._batch_losses.append(loss)

    def log_epoch(self, epoch: int, eval_score: float, best_score: float, improved: bool) -> None:
        if self._batch_losses:
            avg_loss = round(sum(self._batch_losses) / len(self._batch_losses), 6)
            min_loss = round(min(self._batch_losses), 6)
            max_loss = round(max(self._batch_losses), 6)
        else:
            avg_loss = min_loss = max_loss = None
        self._batch_losses.clear()

        with self.csv_path.open("a", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(
                [
                    epoch,
                    avg_loss,
                    min_loss,
                    max_loss,
                    round(eval_score, 6),
                    round(best_score, 6),
                    "yes" if improved else "no",
                    datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                ]
            )


def load_dataset(csv_path: Path):
    df = pd.read_csv(csv_path, on_bad_lines="skip", quoting=3, engine="python")
    return df[["Question", "Answer"]].dropna().drop_duplicates()


def generate_training_pairs(df, seed: int):
    rng = random.Random(seed)
    questions = df["Question"].tolist()
    answers = df["Answer"].tolist()
    all_pairs = []
    seen_questions = set()

    for question, correct_answer in zip(questions, answers):
        normalized_question = question.strip().lower()
        if normalized_question in seen_questions:
            continue
        seen_questions.add(normalized_question)

        all_pairs.append((question, correct_answer, 1.0))

        words = correct_answer.split()
        short_answer = " ".join(words[: min(12, len(words))])
        partial_score = round(min(1.0, len(short_answer.split()) / max(len(words), 1)) * 0.8, 2)
        all_pairs.append((question, short_answer, partial_score))

        negatives = [answer for answer in answers if answer != correct_answer]
        for negative in rng.sample(negatives, k=min(3, len(negatives))):
            all_pairs.append((question, negative, 0.0))

    rng.shuffle(all_pairs)
    split = int(0.9 * len(all_pairs))
    train_pairs = all_pairs[:split]
    eval_pairs = all_pairs[split:]
    return (
        pd.DataFrame(train_pairs, columns=["question", "answer", "score"]),
        pd.DataFrame(eval_pairs, columns=["question", "answer", "score"]),
    )


class TensorBoardCallback:
    def __init__(self, log_dir: Path, csv_logger: CSVLossLogger, config: TrainConfig):
        self.writer = SummaryWriter(log_dir=str(log_dir))
        self.csv_logger = csv_logger
        self.config = config
        self.global_step = 0
        self.best_score = -float("inf")
        self.no_improve = 0
        self.should_stop = False

    def __call__(self, score, epoch, steps):
        improved = (score - self.best_score) > self.config.early_stop_min_delta
        if improved:
            self.best_score = score
            self.no_improve = 0
        else:
            self.no_improve += 1
            if self.no_improve >= self.config.early_stop_patience:
                self.should_stop = True

        self.writer.add_scalar("eval/spearman_correlation", score, self.global_step)
        self.csv_logger.log_epoch(epoch, score, self.best_score, improved)
        self.global_step += 1

    def close(self):
        self.writer.flush()
        self.writer.close()


class LoggedCosineLoss(losses.CosineSimilarityLoss):
    def __init__(self, model, writer: SummaryWriter, csv_logger: CSVLossLogger):
        super().__init__(model)
        self.writer = writer
        self.csv_logger = csv_logger
        self._step = 0

    def forward(self, sentence_features, labels):
        loss = super().forward(sentence_features, labels)
        self.writer.add_scalar("train/batch_loss", loss.item(), self._step)
        self.csv_logger.log_batch(loss.item())
        self._step += 1
        return loss


def train(config: TrainConfig | None = None):
    config = config or TrainConfig()
    random.seed(config.random_seed)

    df = load_dataset(config.csv_path)
    train_df, eval_df = generate_training_pairs(df, config.random_seed)
    train_examples = [
        InputExample(texts=[row["question"], row["answer"]], label=float(row["score"]))
        for _, row in train_df.iterrows()
    ]

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = SentenceTransformer("all-mpnet-base-v2", device=device)
    train_dataloader = DataLoader(
        train_examples,
        shuffle=True,
        batch_size=config.batch_size,
        num_workers=0,
        pin_memory=(device == "cuda"),
    )

    csv_logger = CSVLossLogger(config.loss_log_csv)
    tb_callback = TensorBoardCallback(config.tensorboard_dir, csv_logger, config)
    cosine_loss = LoggedCosineLoss(model, tb_callback.writer, csv_logger)

    evaluator = evaluation.EmbeddingSimilarityEvaluator(
        sentences1=eval_df["question"].tolist(),
        sentences2=eval_df["answer"].tolist(),
        scores=eval_df["score"].tolist(),
        name="eval",
    )

    config.output_model_path.mkdir(parents=True, exist_ok=True)
    for epoch in range(1, config.epochs + 1):
        if tb_callback.should_stop:
            break
        model.fit(
            train_objectives=[(train_dataloader, cosine_loss)],
            evaluator=evaluator,
            epochs=1,
            warmup_steps=config.warmup_steps if epoch == 1 else 0,
            evaluation_steps=config.log_every_steps,
            output_path=str(config.output_model_path),
            save_best_model=True,
            show_progress_bar=True,
            callback=tb_callback,
            use_amp=(device == "cuda"),
        )
    tb_callback.close()
    return model


if __name__ == "__main__":
    train()
