from ml_models.keyword_matching.service import score_interview_answer


def main() -> None:
    question = input("Question: ").strip()
    answer = input("Your Answer: ").strip()
    result = score_interview_answer(question, answer)
    print(result)


if __name__ == "__main__":
    main()
