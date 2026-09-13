from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from threading import Lock
from typing import Any

import numpy as np

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
REQUIRED_ONNX_FILES = (
    "tokenizer.json",
    "onnx/model.onnx",
    "onnx/classifier.json",
)
SENTENCE_BOUNDARY = re.compile(r"(?<=[.!?])\s+|\n+")

_inference_lock = Lock()


class SentimentModelError(RuntimeError):
    """Raised when the configured ONNX model cannot perform inference."""


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


@dataclass(frozen=True)
class OnnxSentimentModel:
    tokenizer: Any
    session: Any
    coefficients: np.ndarray
    intercepts: np.ndarray
    labels: tuple[str, ...]
    pad_token_id: int

    def predict_proba(self, texts: list[str]) -> np.ndarray:
        encodings = [self.tokenizer.encode(text) for text in texts]
        max_length = max(len(encoding.ids) for encoding in encodings)
        batch_size = len(encodings)
        input_ids = np.full(
            (batch_size, max_length), self.pad_token_id, dtype=np.int64
        )
        attention_mask = np.zeros((batch_size, max_length), dtype=np.int64)
        token_type_ids = np.zeros((batch_size, max_length), dtype=np.int64)

        for index, encoding in enumerate(encodings):
            length = len(encoding.ids)
            input_ids[index, :length] = encoding.ids
            attention_mask[index, :length] = encoding.attention_mask
            token_type_ids[index, :length] = encoding.type_ids

        embeddings = self.session.run(
            ["sentence_embedding"],
            {
                "input_ids": input_ids,
                "attention_mask": attention_mask,
                "token_type_ids": token_type_ids,
            },
        )[0]
        logits = embeddings @ self.coefficients.T + self.intercepts
        logits -= logits.max(axis=1, keepdims=True)
        exponentials = np.exp(logits)
        return exponentials / exponentials.sum(axis=1, keepdims=True)


def _validate_model_files(model_directory: Path) -> None:
    if not model_directory.is_dir():
        raise SentimentModelError(
            f"Sentiment model directory was not found: {model_directory}"
        )
    missing_files = [
        filename
        for filename in REQUIRED_ONNX_FILES
        if not (model_directory / filename).is_file()
    ]
    if missing_files:
        raise SentimentModelError(
            "ONNX sentiment model is incomplete; missing: "
            + ", ".join(missing_files)
        )


def _model_directory() -> Path:
    if SENTIMENT_MODEL_SOURCE == "local":
        model_directory = SENTIMENT_MODEL_PATH
    elif SENTIMENT_MODEL_SOURCE == "huggingface":
        if not SENTIMENT_MODEL_REPOSITORY:
            raise SentimentModelError(
                "SENTIMENT_MODEL_REPOSITORY is required for Hugging Face loading."
            )
        if not HF_TOKEN:
            raise SentimentModelError(
                "HF_TOKEN is required for the private sentiment model repository."
            )
        try:
            from huggingface_hub import snapshot_download

            model_directory = Path(
                snapshot_download(
                    repo_id=SENTIMENT_MODEL_REPOSITORY,
                    token=HF_TOKEN,
                    allow_patterns=list(REQUIRED_ONNX_FILES),
                )
            )
        except Exception as error:
            logger.exception(
                "Could not download ONNX sentiment model repository=%s",
                SENTIMENT_MODEL_REPOSITORY,
            )
            raise SentimentModelError(
                "The ONNX sentiment model could not be downloaded."
            ) from error
    else:
        raise SentimentModelError(
            "SENTIMENT_MODEL_SOURCE must be either 'local' or 'huggingface'."
        )

    _validate_model_files(model_directory)
    return model_directory


@lru_cache(maxsize=1)
def get_sentiment_model() -> OnnxSentimentModel:
    """Load and cache the lightweight ONNX model for this process."""
    try:
        import onnxruntime as ort
        from tokenizers import Tokenizer

        model_directory = _model_directory()
        classifier = json.loads(
            (model_directory / "onnx" / "classifier.json").read_text(
                encoding="utf-8"
            )
        )
        labels = tuple(classifier["labels"])
        if labels != LABELS:
            raise SentimentModelError(
                f"Unexpected model labels: {labels!r}; expected {LABELS!r}."
            )

        coefficients = np.asarray(classifier["coefficients"], dtype=np.float32)
        intercepts = np.asarray(classifier["intercepts"], dtype=np.float32)
        expected_shape = (len(LABELS), int(classifier["embedding_dimension"]))
        if coefficients.shape != expected_shape or intercepts.shape != (len(LABELS),):
            raise SentimentModelError("The ONNX classifier weights are invalid.")

        tokenizer = Tokenizer.from_file(str(model_directory / "tokenizer.json"))
        tokenizer.no_truncation()
        tokenizer.no_padding()
        pad_token_id = tokenizer.token_to_id("[PAD]")
        if pad_token_id is None:
            raise SentimentModelError("The tokenizer does not define a [PAD] token.")

        options = ort.SessionOptions()
        options.intra_op_num_threads = 1
        options.inter_op_num_threads = 1
        session = ort.InferenceSession(
            str(model_directory / "onnx" / "model.onnx"),
            sess_options=options,
            providers=["CPUExecutionProvider"],
        )
        model = OnnxSentimentModel(
            tokenizer=tokenizer,
            session=session,
            coefficients=coefficients,
            intercepts=intercepts,
            labels=labels,
            pad_token_id=pad_token_id,
        )
    except SentimentModelError:
        raise
    except Exception as error:
        logger.exception("Could not load the ONNX sentiment model")
        raise SentimentModelError(
            "The ONNX sentiment model could not be loaded."
        ) from error

    logger.info(
        "Loaded ONNX sentiment model version=%s source=%s",
        SENTIMENT_MODEL_VERSION,
        SENTIMENT_MODEL_SOURCE,
    )
    return model


def _token_ids(tokenizer: Any, text: str) -> list[int]:
    return tokenizer.encode(text, add_special_tokens=False).ids


def _split_oversized_unit(
    text: str,
    tokenizer: Any,
    content_token_limit: int,
) -> list[TextChunk]:
    token_ids = _token_ids(tokenizer, text)
    chunks = []
    for start in range(0, len(token_ids), content_token_limit):
        current_ids = token_ids[start : start + content_token_limit]
        decoded_text = tokenizer.decode(current_ids, skip_special_tokens=True).strip()
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

    special_token_count = len(tokenizer.encode("", add_special_tokens=True).ids)
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
            chunks.extend(_split_oversized_unit(unit, tokenizer, content_token_limit))
            continue

        candidate = " ".join([*pending_units, unit])
        if pending_units and len(_token_ids(tokenizer, candidate)) > content_token_limit:
            flush_pending()
        pending_units.append(unit)

    flush_pending()
    return chunks


def analyze_submitted_sentiment(text: str) -> SentimentResult:
    """Analyze every chunk and aggregate its ONNX classifier probabilities."""
    model = get_sentiment_model()
    chunks = chunk_text(text, model.tokenizer)
    chunk_texts = [chunk.text for chunk in chunks]
    chunk_weights = np.asarray([chunk.token_count for chunk in chunks], dtype=float)

    try:
        with _inference_lock:
            probabilities = np.asarray(model.predict_proba(chunk_texts), dtype=float)
    except Exception as error:
        logger.exception("ONNX sentiment inference failed")
        raise SentimentModelError(
            "The journal sentiment could not be analyzed."
        ) from error

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
        label: round(float(score), 6) for label, score in zip(LABELS, aggregated)
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
