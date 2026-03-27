from __future__ import annotations

import io
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

from ml_models.config import get_dataset_path, get_semantic_model_path
from ml_models.keyword_matching.service import InterviewScoringService, compute_dynamic_total_score

try:
    from sentence_transformers import SentenceTransformer, util
except ImportError:  # pragma: no cover - depends on optional venv
    SentenceTransformer = None
    util = None


class SemanticAnswerScorer:
    def __init__(self, model_path: Path | None = None, dataset_path: Path | None = None) -> None:
        self.model_path = model_path or get_semantic_model_path()
        self.dataset_service = InterviewScoringService(dataset_path or get_dataset_path())
        self._model = None

    def is_available(self) -> bool:
        return bool(SentenceTransformer and self.model_path.exists())

    def load_model(self):
        if not self.is_available():
            raise RuntimeError(
                "SentenceTransformer dependencies or model files are unavailable. "
                "Use the training venv or set INTERVIEW_SEMANTIC_MODEL_PATH."
            )
        if self._model is None:
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                self._model = SentenceTransformer(str(self.model_path))
        return self._model

    def score(self, question: str, candidate_answer: str) -> dict:
        row = self.dataset_service.find_row(question)
        if not row:
            return self.dataset_service.score(question, candidate_answer)

        ideal_answer = row.get("Answer", "")
        model = self.load_model()
        embeddings = model.encode([ideal_answer, candidate_answer], convert_to_tensor=True)
        similarity = float(util.cos_sim(embeddings[0], embeddings[1]))
        lexical = self.dataset_service.score(question, candidate_answer)
        lexical["idealAnswer"] = ideal_answer
        lexical["semanticScore"] = round(similarity * 100, 1)
        lexical["totalScore"] = compute_dynamic_total_score(lexical["keywordScore"], lexical["semanticScore"])
        lexical["source"] = "semantic_matching"
        return lexical
