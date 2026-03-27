from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml_models.keyword_matching.service import get_dataset_service


def main() -> int:
    parser = argparse.ArgumentParser(description="List practice categories and questions from the dataset.")
    parser.add_argument("--categories", action="store_true")
    parser.add_argument("--questions", action="store_true")
    parser.add_argument("--category")
    parser.add_argument("--limit", type=int, default=20)
    args = parser.parse_args()

    service = get_dataset_service()

    if args.categories:
        json.dump({"categories": service.list_categories()}, sys.stdout)
        sys.stdout.write("\n")
        return 0

    if args.questions:
        json.dump({"questions": service.list_questions(args.category, args.limit)}, sys.stdout)
        sys.stdout.write("\n")
        return 0

    parser.error("Use --categories or --questions.")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
