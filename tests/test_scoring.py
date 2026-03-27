import unittest

from ml_models.keyword_matching.matcher import TFIDFMatcher


class ScoringTests(unittest.TestCase):
    def test_matcher_scores_similar_answer_higher(self):
        matcher = TFIDFMatcher()
        corpus = [
            "supervised learning uses labeled data",
            "unsupervised learning finds patterns in unlabeled data",
        ]
        matcher.fit_corpus(corpus)

        strong = matcher.compute_score(
            "supervised learning uses labeled data",
            "supervised learning trains on labeled data",
        )
        weak = matcher.compute_score(
            "supervised learning uses labeled data",
            "database indexes improve query speed",
        )

        self.assertGreater(strong, weak)

    def test_keyword_extraction_finds_exact_matches(self):
        matcher = TFIDFMatcher()
        matcher.fit_corpus(["react state and props"])

        result = matcher.extract_keywords(
            expected_answer="State stores local data while props pass data from parent components.",
            candidate_answer="State handles local component data and props pass data from the parent.",
            expected_tokens=["state", "props", "parent"],
        )

        self.assertEqual(result["matched"], ["state", "props", "parent"])
        self.assertEqual(result["missed"], [])


if __name__ == "__main__":
    unittest.main()
