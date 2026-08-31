from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache
from threading import Lock
from typing import Any

import numpy as np
from setfit import SetFitModel

from app.config import (
    HF_TOKEN,
    SENTIMENT_CHUNK_MAX_TOKENS,
    SENTIMENT_MODEL_PATH,
    SENTIMENT_MODEL_REPOSITORY,
    SENTIMENT_MODEL_SOURCE,
    SENTIMENT_MODEL_VERSION,
    logger,
)


LABELS = ("negative", "neutral", "positive")
REQUIRED_MODEL_FILES = (
    "config.json",
    "config_setfit.json",
    "model.safetensors",
    "model_head.pkl",
)
SENTENCE_BOUNDARY = re.compile(r"(?<=[.!?])\s+|\n+")

_inference_lock = Lock()


class SentimentModelError(RuntimeError):
    """Raised when the configured SetFit model cannot perform inference."""


@dataclass(frozen=True)
class SentimentResult:
    label: str
    confidence: float
    scores: dict[str, float]
    model_version: str
    chunks_analyzed: int
    tokens_analyzed: int


@dataclass(frozen=True)
class TextChunk:
    text: str
    token_count: int


def _validate_local_model_files() -> None:
    if not SENTIMENT_MODEL_PATH.is_dir():
        raise SentimentModelError(
            f"Sentiment model directory was not found: {SENTIMENT_MODEL_PATH}"
        )

    missing_files = [
        filename
        for filename in REQUIRED_MODEL_FILES
        if not (SENTIMENT_MODEL_PATH / filename).is_file()
    ]
    if missing_files:
        raise SentimentModelError(
            "Sentiment model is incomplete; missing: " + ", ".join(missing_files)
        )


def _model_source() -> tuple[str, dict[str, str]]:
    if SENTIMENT_MODEL_SOURCE == "local":
        _validate_local_model_files()
        return str(SENTIMENT_MODEL_PATH), {}

    if SENTIMENT_MODEL_SOURCE == "huggingface":
        if not SENTIMENT_MODEL_REPOSITORY:
            raise SentimentModelError(
                "SENTIMENT_MODEL_REPOSITORY is required for Hugging Face loading."
            )
        if not HF_TOKEN:
            raise SentimentModelError(
                "HF_TOKEN is required for the private sentiment model repository."
            )
        return SENTIMENT_MODEL_REPOSITORY, {"token": HF_TOKEN}

    raise SentimentModelError(
        "SENTIMENT_MODEL_SOURCE must be either 'local' or 'huggingface'."
    )


@lru_cache(maxsize=1)
def get_sentiment_model() -> SetFitModel:
    """Load and cache the selected SetFit model for the life of this process."""
    model_source, load_options = _model_source()
    try:
        model = SetFitModel.from_pretrained(model_source, **load_options)
    except Exception as error:
        logger.exception(
            "Could not load sentiment model source=%s location=%s",
            SENTIMENT_MODEL_SOURCE,
            model_source,
        )
        raise SentimentModelError("The sentiment model could not be loaded.") from error

    if tuple(model.labels or ()) != LABELS:
        raise SentimentModelError(
            f"Unexpected model labels: {model.labels!r}; expected {list(LABELS)!r}."
        )

    logger.info(
        "Loaded sentiment model version=%s source=%s location=%s",
        SENTIMENT_MODEL_VERSION,
        SENTIMENT_MODEL_SOURCE,
        model_source,
    )
    return model


def _token_ids(tokenizer: Any, text: str) -> list[int]:
    return tokenizer.encode(text, add_special_tokens=False)


def _split_oversized_unit(
    text: str,
    tokenizer: Any,
    content_token_limit: int,
) -> list[TextChunk]:
    token_ids = _token_ids(tokenizer, text)
    chunks = []
    for start in range(0, len(token_ids), content_token_limit):
        current_ids = token_ids[start : start + content_token_limit]
        decoded_text = tokenizer.decode(
            current_ids,
            skip_special_tokens=True,
            clean_up_tokenization_spaces=True,
        ).strip()
        if decoded_text:
            chunks.append(TextChunk(decoded_text, len(current_ids)))
    return chunks


def chunk_text(
    text: str,
    tokenizer: Any,
    max_sequence_tokens: int = SENTIMENT_CHUNK_MAX_TOKENS,
) -> list[TextChunk]:
    """Create sentence-aware chunks that fit the model's token limit."""
    normalized_text = text.strip()
    if not normalized_text:
        raise ValueError("Sentiment text cannot be empty.")

    special_token_count = tokenizer.num_special_tokens_to_add(pair=False)
    content_token_limit = max_sequence_tokens - special_token_count
    if content_token_limit < 1:
        raise SentimentModelError(
            "SENTIMENT_CHUNK_MAX_TOKENS is too small for the tokenizer."
        )

    units = [
        unit.strip()
        for unit in SENTENCE_BOUNDARY.split(normalized_text)
        if unit.strip()
    ]
    chunks: list[TextChunk] = []
    pending_units: list[str] = []

    def flush_pending() -> None:
        if not pending_units:
            return
        pending_text = " ".join(pending_units)
        chunks.append(TextChunk(pending_text, len(_token_ids(tokenizer, pending_text))))
        pending_units.clear()

    for unit in units:
        unit_token_count = len(_token_ids(tokenizer, unit))
        if unit_token_count > content_token_limit:
            flush_pending()
            chunks.extend(
                _split_oversized_unit(unit, tokenizer, content_token_limit)
            )
            continue

        candidate = " ".join([*pending_units, unit])
        if pending_units and len(_token_ids(tokenizer, candidate)) > content_token_limit:
            flush_pending()
        pending_units.append(unit)

    flush_pending()
    return chunks


def analyze_submitted_sentiment(text: str) -> SentimentResult:
    """Analyze every chunk of a journal entry and aggregate its probabilities."""
    model = get_sentiment_model()
    tokenizer = model.model_body.tokenizer
    chunks = chunk_text(text, tokenizer)
    chunk_texts = [chunk.text for chunk in chunks]
    chunk_weights = np.asarray([chunk.token_count for chunk in chunks], dtype=float)

    try:
        with _inference_lock:
            probabilities = np.asarray(model.predict_proba(chunk_texts), dtype=float)
    except Exception as error:
        logger.exception("Sentiment inference failed")
        raise SentimentModelError("The journal sentiment could not be analyzed.") from error

    if probabilities.shape != (len(chunks), len(LABELS)):
        raise SentimentModelError(
            f"Unexpected probability shape: {probabilities.shape!r}."
        )

    aggregated = np.average(probabilities, axis=0, weights=chunk_weights)
    total_probability = float(aggregated.sum())
    if not np.isfinite(aggregated).all() or total_probability <= 0:
        raise SentimentModelError("The sentiment model returned invalid probabilities.")
    aggregated = aggregated / total_probability

    scores = {
        label: round(float(score), 6)
        for label, score in zip(LABELS, aggregated)
    }
    predicted_index = int(np.argmax(aggregated))
    predicted_label = LABELS[predicted_index]

    return SentimentResult(
        label=predicted_label,
        confidence=scores[predicted_label],
        scores=scores,
        model_version=SENTIMENT_MODEL_VERSION,
        chunks_analyzed=len(chunks),
        tokens_analyzed=int(chunk_weights.sum()),
    )
