from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml_models.config import get_dataset_path, get_semantic_model_path

try:
    import pandas as pd
    from sentence_transformers import SentenceTransformer, util
except ImportError as exc:  # pragma: no cover - optional venv dependency
    raise RuntimeError(
        "Evaluation dependencies are missing. Use the training venv under "
        "'training model/trained model/model/venv'."
    ) from exc


def load_dataset(csv_path: Path) -> pd.DataFrame:
    df = pd.read_csv(csv_path, on_bad_lines="skip", quoting=3, engine="python")
    return df[["Question", "Answer"]].dropna().drop_duplicates()


def build_pairs(df: pd.DataFrame, seed: int) -> list[tuple[str, str, float]]:
    rng = random.Random(seed)
    questions = df["Question"].tolist()
    answers = df["Answer"].tolist()
    all_pairs: list[tuple[str, str, float]] = []
    seen_questions: set[str] = set()

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
    return all_pairs


def get_eval_split(all_pairs: list[tuple[str, str, float]]) -> list[tuple[str, str, float]]:
    split = int(0.9 * len(all_pairs))
    return all_pairs[split:]


def build_records(
    model: SentenceTransformer,
    pairs: list[tuple[str, str, float]],
    label_threshold: float,
) -> list[tuple[int, float]]:
    records: list[tuple[int, float]] = []
    for question, answer, label_score in pairs:
        embeddings = model.encode([question, answer], convert_to_tensor=True, show_progress_bar=False)
        similarity = float(util.cos_sim(embeddings[0], embeddings[1]))
        actual = 1 if float(label_score) >= label_threshold else 0
        records.append((actual, similarity))
    return records


def score_records(
    records: list[tuple[int, float]],
    similarity_threshold: float,
    label_threshold: float,
) -> dict[str, float | int]:
    tp = fp = tn = fn = 0
    similarities = [similarity for _, similarity in records]

    for actual, similarity in records:
        predicted = 1 if similarity >= similarity_threshold else 0

        if actual == 1 and predicted == 1:
            tp += 1
        elif actual == 0 and predicted == 1:
            fp += 1
        elif actual == 0 and predicted == 0:
            tn += 1
        else:
            fn += 1

    total = max(1, len(records))
    accuracy = (tp + tn) / total
    precision = tp / max(1, tp + fp)
    recall = tp / max(1, tp + fn)
    f1 = (2 * precision * recall) / max(1e-12, precision + recall)

    return {
        "samples": total,
        "thresholds": {
            "label_positive_if_gte": label_threshold,
            "similarity_positive_if_gte": similarity_threshold,
        },
        "confusion": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
        "metrics": {
            "accuracy": round(accuracy, 4),
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1, 4),
        },
        "similarity": {
            "min": round(min(similarities), 4) if similarities else 0.0,
            "mean": round(sum(similarities) / max(1, len(similarities)), 4),
            "max": round(max(similarities), 4) if similarities else 0.0,
        },
    }


def search_best_threshold(
    records: list[tuple[int, float]],
    label_threshold: float,
) -> dict[str, float | int]:
    best_result = None
    best_f1 = -1.0
    for i in range(0, 101):
        threshold = i / 100
        result = score_records(records, threshold, label_threshold)
        f1 = float(result["metrics"]["f1"])
        if f1 > best_f1:
            best_f1 = f1
            best_result = result
    return best_result or {}


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate SBERT model with classification metrics.")
    parser.add_argument("--dataset-path", default=str(get_dataset_path()))
    parser.add_argument("--model-path", default=str(get_semantic_model_path()))
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--label-threshold", type=float, default=0.5)
    parser.add_argument("--similarity-threshold", type=float, default=0.5)
    parser.add_argument("--best-threshold", action="store_true")
    args = parser.parse_args()

    dataset_path = Path(args.dataset_path)
    model_path = Path(args.model_path)
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset not found: {dataset_path}")
    if not model_path.exists():
        raise FileNotFoundError(f"Model not found: {model_path}")

    df = load_dataset(dataset_path)
    all_pairs = build_pairs(df, args.seed)
    eval_pairs = get_eval_split(all_pairs)

    model = SentenceTransformer(str(model_path))
    records = build_records(model, eval_pairs, args.label_threshold)
    if args.best_threshold:
        payload = search_best_threshold(records, args.label_threshold)
    else:
        payload = score_records(records, args.similarity_threshold, args.label_threshold)

    payload["meta"] = {
        "dataset_path": str(dataset_path),
        "model_path": str(model_path),
        "seed": args.seed,
        "eval_split_ratio": 0.1,
        "eval_samples": len(eval_pairs),
        "best_threshold_search": bool(args.best_threshold),
    }

    json.dump(payload, sys.stdout)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
