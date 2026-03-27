from __future__ import annotations

import os
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
LEGACY_MODEL_DIR = REPO_ROOT / "training model" / "trained model" / "model"
DEFAULT_DATASET_PATH = LEGACY_MODEL_DIR / "final_dataset_output.csv"
DEFAULT_SEMANTIC_MODEL_PATH = LEGACY_MODEL_DIR / "interview_sbert_model_v2"
DEFAULT_TRAINING_VENV_PYTHON = LEGACY_MODEL_DIR / "venv" / "bin" / "python"


def _resolve_path(env_name: str, default: Path) -> Path:
    configured = os.getenv(env_name)
    return Path(configured).expanduser().resolve() if configured else default


def get_dataset_path() -> Path:
    return _resolve_path("INTERVIEW_DATASET_PATH", DEFAULT_DATASET_PATH)


def get_semantic_model_path() -> Path:
    return _resolve_path("INTERVIEW_SEMANTIC_MODEL_PATH", DEFAULT_SEMANTIC_MODEL_PATH)


def get_python_scorer_bin() -> Path:
    return _resolve_path("INTERVIEW_SCORER_PYTHON", DEFAULT_TRAINING_VENV_PYTHON)
