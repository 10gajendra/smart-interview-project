import unittest

from ml_models.keyword_matching.service import (
    build_feedback_payload,
    compute_dynamic_total_score,
    normalize_question,
    parse_tokens,
)


class NLPServiceTests(unittest.TestCase):
    def test_parse_tokens_handles_serialized_list(self):
        raw = "['python', 'api', 'testing']"
        self.assertEqual(parse_tokens(raw), ["python", "api", "testing"])

    def test_normalize_question_is_stable(self):
        self.assertEqual(normalize_question("What is REST API?"), "rest api")

    def test_build_feedback_payload_returns_expected_shape(self):
        payload = build_feedback_payload(
            question="What is overfitting?",
            candidate_answer="Overfitting happens when a model memorizes training data and generalizes poorly.",
            ideal_answer="Overfitting occurs when a model learns training data too well and performs poorly on new data.",
            tfidf_score=0.71,
            keyword_result={
                "matched": ["overfitting", "model", "training data"],
                "missed": ["generalization"],
                "keyword_score": 75.0,
                "match_details": [],
                "total": 4,
            },
        )
        self.assertEqual(payload["keywordScore"], 75.0)
        self.assertEqual(payload["semanticScore"], 71.0)
        self.assertGreater(payload["totalScore"], 70)
        self.assertTrue(payload["strengths"])
        self.assertTrue(payload["improvements"])

    def test_dynamic_total_score_uses_semantic_as_weight(self):
        self.assertEqual(compute_dynamic_total_score(40.0, 80.0), 72.0)


if __name__ == "__main__":
    unittest.main()
