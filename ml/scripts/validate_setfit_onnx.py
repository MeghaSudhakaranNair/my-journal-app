from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np
from setfit import SetFitModel


PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))
os.environ["SENTIMENT_MODEL_SOURCE"] = "local"

from app.nlp.setfit_analyzer import get_sentiment_model  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Compare SetFit and exported ONNX predictions."
    )
    parser.add_argument("--version", default="v4-e8")
    parser.add_argument(
        "--test-file",
        default="ml/data/challenge-v1/test.jsonl",
    )
    parser.add_argument("--probability-tolerance", type=float, default=1e-4)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    model_directory = (
        PROJECT_ROOT / "ml" / "models" / f"journal-sentiment-{args.version}"
    )
    test_path = PROJECT_ROOT / args.test_file
    records = [
        json.loads(line)
        for line in test_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    texts = [record["text"] for record in records]

    setfit_model = SetFitModel.from_pretrained(model_directory)
    setfit_probabilities = np.asarray(setfit_model.predict_proba(texts), dtype=float)
    onnx_probabilities = np.asarray(
        get_sentiment_model().predict_proba(texts), dtype=float
    )

    setfit_predictions = setfit_probabilities.argmax(axis=1)
    onnx_predictions = onnx_probabilities.argmax(axis=1)
    mismatches = np.flatnonzero(setfit_predictions != onnx_predictions)
    maximum_difference = float(
        np.max(np.abs(setfit_probabilities - onnx_probabilities))
    )

    print(f"Samples compared: {len(texts)}")
    print(f"Label mismatches: {len(mismatches)}")
    print(f"Maximum probability difference: {maximum_difference:.8f}")
    if len(mismatches):
        for index in mismatches:
            print(f"Mismatch at sample {index + 1}: {texts[index]!r}")
        raise SystemExit(1)
    if maximum_difference > args.probability_tolerance:
        raise SystemExit(
            "ONNX probability difference exceeds tolerance "
            f"{args.probability_tolerance}."
        )
    print("Validation passed: ONNX matches the trained SetFit model.")


if __name__ == "__main__":
    main()
