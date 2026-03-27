from __future__ import annotations

import math
import re
from collections import Counter
from difflib import SequenceMatcher
from typing import Iterable

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:  # pragma: no cover - exercised through fallback paths
    TfidfVectorizer = None
    cosine_similarity = None

try:
    import nltk
    from nltk.corpus import stopwords, wordnet
    from nltk.stem import WordNetLemmatizer
except ImportError:  # pragma: no cover - exercised through fallback paths
    nltk = None
    stopwords = None
    wordnet = None
    WordNetLemmatizer = None

try:
    from rapidfuzz import fuzz
except ImportError:  # pragma: no cover - exercised through fallback paths
    try:
        from fuzzywuzzy import fuzz  # type: ignore
    except ImportError:  # pragma: no cover - exercised through fallback paths
        fuzz = None


DEFAULT_STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how",
    "in", "is", "it", "of", "on", "or", "that", "the", "to", "was", "were",
    "what", "when", "where", "which", "who", "why", "with",
}


def _setup_nltk() -> tuple[object | None, set[str], object | None]:
    if not nltk or not WordNetLemmatizer or not stopwords:
        return None, DEFAULT_STOP_WORDS, None

    for pkg in ("wordnet", "stopwords", "omw-1.4"):
        try:
            nltk.data.find(pkg)
        except LookupError:
            try:
                nltk.download(pkg, quiet=True)
            except Exception:
                return None, DEFAULT_STOP_WORDS, None

    try:
        return WordNetLemmatizer(), set(stopwords.words("english")), wordnet
    except LookupError:
        return None, DEFAULT_STOP_WORDS, None


LEMMATIZER, STOP_WORDS, WORDNET = _setup_nltk()


def preprocess(text: str) -> str:
    text = (text or "").lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    tokens = [token for token in text.split() if token and token not in STOP_WORDS]
    if LEMMATIZER:
        tokens = [LEMMATIZER.lemmatize(token) for token in tokens]
    return " ".join(tokens)


def _similarity_ratio(left: str, right: str) -> int:
    if fuzz:
        return int(fuzz.ratio(left, right))
    return int(SequenceMatcher(a=left, b=right).ratio() * 100)


def _manual_cosine(expected_answer: str, candidate_answer: str, corpus: Iterable[str]) -> float:
    documents = [preprocess(text).split() for text in corpus]
    exp_tokens = preprocess(expected_answer).split()
    can_tokens = preprocess(candidate_answer).split()

    document_count = max(len(documents), 1)
    df_counter: Counter[str] = Counter()
    for doc in documents:
        df_counter.update(set(doc))

    def vectorize(tokens: list[str]) -> dict[str, float]:
        counts = Counter(tokens)
        vector = {}
        for token, count in counts.items():
            idf = math.log((1 + document_count) / (1 + df_counter[token])) + 1
            vector[token] = count * idf
        return vector

    def dot(left: dict[str, float], right: dict[str, float]) -> float:
        return sum(value * right.get(term, 0.0) for term, value in left.items())

    def magnitude(vector: dict[str, float]) -> float:
        return math.sqrt(sum(value * value for value in vector.values()))

    left = vectorize(exp_tokens)
    right = vectorize(can_tokens)
    denom = magnitude(left) * magnitude(right)
    return 0.0 if denom == 0 else dot(left, right) / denom


class TFIDFMatcher:
    def __init__(self) -> None:
        self._corpus: list[str] = []
        self._vectorizer = (
            TfidfVectorizer(
                ngram_range=(1, 3),
                stop_words="english",
                min_df=1,
                sublinear_tf=True,
            )
            if TfidfVectorizer
            else None
        )
        self.is_fitted = False

    def fit_corpus(self, all_answers: list[str]) -> None:
        if not all_answers:
            raise ValueError("all_answers list is empty.")
        self._corpus = [answer for answer in all_answers if answer]
        if self._vectorizer:
            cleaned = [preprocess(answer) for answer in self._corpus]
            self._vectorizer.fit(cleaned)
        self.is_fitted = True

    def compute_score(self, expected_answer: str, candidate_answer: str) -> float:
        self._check_fitted()
        if self._vectorizer and cosine_similarity:
            expected_vec, candidate_vec = self._vectorizer.transform(
                [preprocess(expected_answer), preprocess(candidate_answer)]
            )
            score = cosine_similarity(expected_vec, candidate_vec)[0][0]
        else:
            score = _manual_cosine(expected_answer, candidate_answer, self._corpus)
        return round(float(score), 3)

    def extract_keywords(
        self,
        expected_answer: str,
        candidate_answer: str,
        expected_tokens: list[str],
        fuzzy_threshold: int = 78,
    ) -> dict:
        del expected_answer
        self._check_fitted()

        candidate_clean = preprocess(candidate_answer)
        words = candidate_clean.split()
        candidate_ngrams = set(words)
        candidate_ngrams.update(" ".join(words[i : i + 2]) for i in range(len(words) - 1))
        candidate_ngrams.update(" ".join(words[i : i + 3]) for i in range(len(words) - 2))

        matched = []
        missed = []
        match_details = []

        for keyword in expected_tokens:
            keyword_clean = keyword.strip().lower()
            keyword_lemma = preprocess(keyword_clean)
            matched_flag = False
            match_type = None

            if keyword_lemma and keyword_lemma in candidate_ngrams:
                matched_flag = True
                match_type = "exact"

            if not matched_flag and keyword_lemma:
                best_score = 0
                for ngram in candidate_ngrams:
                    ratio = _similarity_ratio(keyword_lemma, ngram)
                    if ratio >= fuzzy_threshold and ratio > best_score:
                        best_score = ratio
                        matched_flag = True
                        match_type = f"fuzzy({ratio})"

            if not matched_flag and WORDNET and keyword_lemma:
                synonyms = set()
                for syn in WORDNET.synsets(keyword_lemma.replace(" ", "_")):
                    for lemma in syn.lemmas():
                        synonyms.add(lemma.name().replace("_", " ").lower())
                for synonym in synonyms:
                    if synonym in candidate_ngrams:
                        matched_flag = True
                        match_type = f"synonym({synonym})"
                        break

            if matched_flag:
                matched.append(keyword_clean)
                match_details.append({"keyword": keyword_clean, "match_type": match_type})
            else:
                missed.append(keyword_clean)

        total = len(expected_tokens)
        keyword_score = round((len(matched) / total) * 100, 1) if total else 0.0
        return {
            "matched": matched,
            "missed": missed,
            "keyword_score": keyword_score,
            "match_details": match_details,
            "total": total,
        }

    def _check_fitted(self) -> None:
        if not self.is_fitted:
            raise RuntimeError("TFIDFMatcher is not fitted. Call fit_corpus() first.")
