from __future__ import annotations

import ast
import csv
import random
import sys
from functools import lru_cache
from pathlib import Path

from ml_models.config import get_dataset_path
from ml_models.keyword_matching.matcher import TFIDFMatcher, preprocess

try:
    csv.field_size_limit(sys.maxsize)
except OverflowError:
    csv.field_size_limit(10**7)

PRACTICE_SUBCATEGORIES = [
    ("general software engineering", "Software Engineering"),
    ("sql", "SQL"),
    ("devops", "DevOps"),
    ("containers and cloud", "Containers & Cloud"),
    ("data science", "Data Science"),
    ("ai (data science)", "AI (Data Science)"),
    ("machine learning", "Machine Learning"),
]

DOMAIN_KEYWORDS = {
    "sql": {
        "sql", "database", "databases", "table", "tables", "query", "queries", "join",
        "joins", "index", "indexes", "primary key", "foreign key", "schema", "schemas",
        "normalization", "transaction", "transactions", "stored procedure", "view",
        "views", "aggregate", "group by", "having", "where", "select", "insert",
        "update", "delete", "union", "cte", "subquery", "mysql", "postgresql",
        "postgres", "oracle", "nosql", "acid"
    },
    "devops": {
        "devops", "ci/cd", "ci", "cd", "pipeline", "pipelines", "deployment",
        "deployments", "infrastructure", "terraform", "ansible", "jenkins", "gitlab",
        "github actions", "monitoring", "observability", "incident", "rollback",
        "automation", "server", "servers", "configuration", "release", "releases",
        "sre", "site reliability", "scaling", "load balancer", "logging"
    },
    "containers and cloud": {
        "docker", "kubernetes", "container", "containers", "cloud", "aws", "azure",
        "gcp", "pod", "pods", "cluster", "clusters", "ecs", "eks", "aks", "gke",
        "virtual machine", "vm", "serverless", "lambda", "cloudformation", "helm",
        "image", "images", "orchestration", "microservices", "storage bucket", "vpc"
    },
    "data science": {
        "data science", "statistics", "statistical", "regression", "classification",
        "clustering", "feature", "features", "dataset", "datasets", "outlier",
        "normal distribution", "distribution", "hypothesis", "sampling", "variance",
        "bias", "p-value", "correlation", "visualization", "dimensionality reduction",
        "preprocessing", "categorical", "numerical", "eda", "analysis"
    },
    "ai (data science)": {
        "artificial intelligence", "ai", "neural network", "deep learning", "nlp",
        "computer vision", "transformer", "embedding", "llm", "machine learning",
        "supervised", "unsupervised", "reinforcement learning", "model", "models",
        "training", "inference", "overfitting", "underfitting", "confusion matrix"
    },
    "machine learning": {
        "machine learning", "model", "models", "training", "validation", "test set",
        "cross-validation", "overfitting", "underfitting", "bias", "variance",
        "gradient descent", "feature engineering", "regularization", "classification",
        "regression", "clustering", "supervised", "unsupervised", "reinforcement",
        "hyperparameter", "loss function", "accuracy", "precision", "recall", "f1"
    },
}


def normalize_question(text: str) -> str:
    return preprocess(text)


def parse_tokens(raw: str | list[str] | None) -> list[str]:
    if isinstance(raw, list):
        return raw
    if not raw:
        return []
    try:
        parsed = ast.literal_eval(raw)
        if isinstance(parsed, (list, tuple, set)):
            return [str(token).strip() for token in parsed if str(token).strip()]
    except (ValueError, SyntaxError):
        pass
    return [token.strip() for token in str(raw).split(",") if token.strip()]


def load_dataset_rows(dataset_path: Path | None = None) -> list[dict[str, str]]:
    path = dataset_path or get_dataset_path()
    with path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def compute_dynamic_total_score(keyword_score: float, semantic_score: float) -> float:
    weight_semantic = semantic_score / 100
    weight_keyword = 1 - weight_semantic
    return round((weight_keyword * keyword_score) + (weight_semantic * semantic_score), 1)


def format_structured_feedback(strengths: list[str], weaknesses: list[str], suggestions: list[str]) -> str:
    strength_text = strengths[0] if strengths else "The answer addresses the question and shows some relevant understanding."
    weakness_text = weaknesses[0] if weaknesses else "The response could be clearer and more complete in covering the core concepts."
    suggestion_text = suggestions[0] if suggestions else "Open with a direct answer, then support it with one clear example or key detail."
    return " ".join([
        f"Strengths: {strength_text}",
        f"Weaknesses: {weakness_text}",
        f"Suggestions: {suggestion_text}",
    ])


def is_question_relevant_to_domain(question: str, subcategory: str) -> bool:
    normalized_subcategory = (subcategory or "").strip().lower()
    keywords = DOMAIN_KEYWORDS.get(normalized_subcategory)
    if not keywords:
        return True

    normalized_question = normalize_question(question)
    return any(keyword in normalized_question for keyword in keywords)


@lru_cache(maxsize=1)
def get_dataset_service() -> "InterviewScoringService":
    return InterviewScoringService(get_dataset_path())


class InterviewScoringService:
    def __init__(self, dataset_path: Path) -> None:
        self.dataset_path = dataset_path
        self.rows = load_dataset_rows(dataset_path)
        self.matcher = TFIDFMatcher()
        self.matcher.fit_corpus([row.get("Answer", "") for row in self.rows if row.get("Answer")])
        self._question_index = {}
        for row in self.rows:
            normalized = normalize_question(row.get("Question", ""))
            if normalized and normalized not in self._question_index:
                self._question_index[normalized] = row

    def list_categories(self) -> list[dict[str, str | int]]:
        counts: dict[str, int] = {}
        for row in self.rows:
            subcategory = (row.get("Subcategory") or "").strip()
            if not subcategory:
                continue
            counts[subcategory] = counts.get(subcategory, 0) + 1

        return [
            {"id": subcategory, "label": label, "count": counts.get(subcategory, 0)}
            for subcategory, label in PRACTICE_SUBCATEGORIES
            if counts.get(subcategory, 0) > 0
        ]

    def list_questions(self, category: str | None = None, limit: int = 20) -> list[dict[str, str]]:
        selected = []
        normalized_subcategory = (category or "").strip().lower()
        seen_questions = set()

        for row in self.rows:
            row_subcategory = (row.get("Subcategory") or "").strip().lower()
            if normalized_subcategory and row_subcategory != normalized_subcategory:
                continue

            question = (row.get("Question") or "").strip()
            if not question or question in seen_questions:
                continue
            if normalized_subcategory and not is_question_relevant_to_domain(question, row_subcategory):
                continue

            seen_questions.add(question)
            selected.append(
                {
                    "id": str(row.get("Question Number") or len(selected) + 1),
                    "category": (row.get("Category") or "").strip().title() or "General",
                    "subcategory": (row.get("Subcategory") or "").strip().title(),
                    "prompt": question,
                }
            )

        if len(selected) <= limit:
            return selected

        return random.sample(selected, k=limit)

    def find_row(self, question: str) -> dict[str, str] | None:
        normalized = normalize_question(question)
        if normalized in self._question_index:
            return self._question_index[normalized]

        query_terms = set(normalized.split())
        best_row = None
        best_score = -1
        for row in self.rows:
            candidate = normalize_question(row.get("Question", ""))
            candidate_terms = set(candidate.split())
            overlap = len(query_terms & candidate_terms)
            if overlap > best_score:
                best_score = overlap
                best_row = row
        return best_row if best_score > 0 else None

    def score(self, question: str, candidate_answer: str) -> dict:
        row = self.find_row(question)
        if not row:
            return build_generic_feedback(question, candidate_answer)

        ideal_answer = row.get("Answer", "")
        expected_tokens = parse_tokens(row.get("Answer_Tokens"))
        tfidf_score = self.matcher.compute_score(ideal_answer, candidate_answer)
        keyword_result = self.matcher.extract_keywords(
            expected_answer=ideal_answer,
            candidate_answer=candidate_answer,
            expected_tokens=expected_tokens,
        )
        return build_feedback_payload(
            question=question,
            candidate_answer=candidate_answer,
            ideal_answer=ideal_answer,
            tfidf_score=tfidf_score,
            keyword_result=keyword_result,
        )


def build_feedback_payload(
    question: str,
    candidate_answer: str,
    ideal_answer: str,
    tfidf_score: float,
    keyword_result: dict,
) -> dict:
    word_count = len(candidate_answer.split()) if candidate_answer.strip() else 0
    keyword_score = round(float(keyword_result["keyword_score"]), 1)
    semantic_score = round(tfidf_score * 100, 1)
    total_score = compute_dynamic_total_score(keyword_score, semantic_score)

    matched = keyword_result["matched"]
    missed = keyword_result["missed"]
    strengths = []
    improvements = []

    if matched:
        strengths.append(
            f"Covered {len(matched)} expected keyword{'s' if len(matched) != 1 else ''}: {', '.join(matched[:5])}."
        )
    if tfidf_score >= 0.6:
        strengths.append("Your wording stays close to the expected answer's core meaning.")
    if word_count >= 35:
        strengths.append("The answer has enough detail to show reasoning instead of only keywords.")

    if missed:
        improvements.append(
            f"Add missing concepts such as {', '.join(missed[:5])}."
        )
    if tfidf_score < 0.45:
        improvements.append("Lead with a more direct explanation before adding supporting detail.")
    if word_count < 25:
        improvements.append("Add one short example or tradeoff to make the answer more complete.")

    if not strengths:
        strengths.append("The answer addresses the question and gives the scorer enough content to evaluate.")
    if not improvements:
        improvements.append("Tighten the opening so your strongest point appears in the first sentence.")

    weaknesses = []
    if missed:
        weaknesses.append(
            f"The answer misses some important concepts, such as {', '.join(missed[:5])}."
        )
    if tfidf_score < 0.45:
        weaknesses.append("The explanation does not stay closely aligned with the core meaning of the expected answer.")
    if word_count < 25:
        weaknesses.append("The response is a bit brief and does not provide enough supporting detail.")

    if not weaknesses:
        weaknesses.append("The answer is relevant overall, but a few ideas could be explained more precisely.")

    feedback = format_structured_feedback(
        strengths=strengths,
        weaknesses=weaknesses,
        suggestions=improvements,
    )

    improved_answer = " ".join(
        part
        for part in [
            "Start with a direct answer to the question.",
            f"Include ideas like {', '.join((matched + missed)[:3])}." if (matched or missed) else "",
            f"Reference the core answer: {ideal_answer[:140]}{'...' if len(ideal_answer) > 140 else ''}",
        ]
        if part
    )

    return {
        "question": question,
        "candidateAnswer": candidate_answer,
        "idealAnswer": ideal_answer,
        "keywordScore": keyword_score,
        "semanticScore": semantic_score,
        "totalScore": total_score,
        "feedback": feedback,
        "improvedAnswer": improved_answer,
        "strengths": strengths[:3],
        "improvements": improvements[:3],
        "matchedKeywords": matched,
        "missedKeywords": missed,
        "matchDetails": keyword_result["match_details"],
        "source": "keyword_matching",
    }


def build_generic_feedback(question: str, candidate_answer: str) -> dict:
    del question
    word_count = len(candidate_answer.split()) if candidate_answer.strip() else 0
    keyword_score = min(100.0, round(word_count * 2.2, 1))
    semantic_score = min(100.0, round(word_count * 1.8, 1))
    total_score = compute_dynamic_total_score(keyword_score, semantic_score)
    return {
        "question": "",
        "candidateAnswer": candidate_answer,
        "idealAnswer": "",
        "keywordScore": keyword_score,
        "semanticScore": semantic_score,
        "totalScore": total_score,
        "feedback": format_structured_feedback(
            strengths=["The answer provides enough content to evaluate the overall response."],
            weaknesses=["No close reference answer was available, so the evaluation cannot fully verify coverage of key concepts."],
            suggestions=["Answer more directly, include role-specific terms, and add one brief example or tradeoff."],
        ),
        "improvedAnswer": "Start with a direct answer, then add one example and one tradeoff.",
        "strengths": ["The answer provides enough text to give baseline feedback."] if word_count else [],
        "improvements": ["Answer the question more directly and add role-specific terminology."],
        "matchedKeywords": [],
        "missedKeywords": [],
        "matchDetails": [],
        "source": "generic_fallback",
    }


def score_interview_answer(question: str, candidate_answer: str) -> dict:
    return get_dataset_service().score(question, candidate_answer)
