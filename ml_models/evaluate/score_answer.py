from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml_models.keyword_matching.service import score_interview_answer


def main() -> int:
    parser = argparse.ArgumentParser(description="Score an interview answer against the dataset.")
    parser.add_argument("--question")
    parser.add_argument("--answer")
    parser.add_argument("--health", action="store_true")
    args = parser.parse_args()

    if args.health:
        json.dump({"ok": True, "scorer": "keyword_matching"}, sys.stdout)
        sys.stdout.write("\n")
        return 0

    if not args.question or not args.answer:
        parser.error("--question and --answer are required unless --health is used.")

    payload = score_interview_answer(args.question, args.answer)
    json.dump(payload, sys.stdout)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
