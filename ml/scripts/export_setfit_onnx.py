from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import onnx
import torch
from transformers import AutoModel, AutoTokenizer


PROJECT_ROOT = Path(__file__).resolve().parents[2]


class SentenceEmbeddingModel(torch.nn.Module):
    """Export the BGE encoder with SetFit's CLS pooling and normalization."""

    def __init__(self, encoder: torch.nn.Module) -> None:
        super().__init__()
        self.encoder = encoder

    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
        token_type_ids: torch.Tensor,
    ) -> torch.Tensor:
        token_embeddings = self.encoder(
            input_ids=input_ids,
            attention_mask=attention_mask,
            token_type_ids=token_type_ids,
            return_dict=False,
        )[0]
        sentence_embeddings = token_embeddings[:, 0]
        return torch.nn.functional.normalize(sentence_embeddings, p=2, dim=1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export a trained SetFit model for lightweight ONNX inference."
    )
    parser.add_argument("--version", default="v4-e8")
    parser.add_argument("--opset", type=int, default=17)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    model_directory = (
        PROJECT_ROOT / "ml" / "models" / f"journal-sentiment-{args.version}"
    )
    if not model_directory.is_dir():
        raise FileNotFoundError(f"Model directory not found: {model_directory}")
    output_directory = model_directory / "onnx"
    output_directory.mkdir(parents=True, exist_ok=True)

    tokenizer = AutoTokenizer.from_pretrained(model_directory, local_files_only=True)
    encoder = AutoModel.from_pretrained(model_directory, local_files_only=True)
    encoder.eval()
    export_model = SentenceEmbeddingModel(encoder).eval()

    sample = tokenizer(
        ["An ordinary journal entry for ONNX export."],
        padding=True,
        truncation=True,
        max_length=128,
        return_tensors="pt",
    )
    token_type_ids = sample.get(
        "token_type_ids",
        torch.zeros_like(sample["input_ids"]),
    )
    onnx_path = output_directory / "model.onnx"
    with torch.inference_mode():
        torch.onnx.export(
            export_model,
            (sample["input_ids"], sample["attention_mask"], token_type_ids),
            onnx_path,
            input_names=["input_ids", "attention_mask", "token_type_ids"],
            output_names=["sentence_embedding"],
            dynamic_axes={
                "input_ids": {0: "batch", 1: "sequence"},
                "attention_mask": {0: "batch", 1: "sequence"},
                "token_type_ids": {0: "batch", 1: "sequence"},
                "sentence_embedding": {0: "batch"},
            },
            opset_version=args.opset,
            do_constant_folding=True,
            dynamo=False,
        )

    exported = onnx.load(onnx_path)
    onnx.checker.check_model(exported)

    classifier = joblib.load(model_directory / "model_head.pkl")
    labels = json.loads((model_directory / "config_setfit.json").read_text())[
        "labels"
    ]
    if not np.array_equal(classifier.classes_, np.arange(len(labels))):
        raise ValueError(
            f"Unexpected classifier classes: {classifier.classes_.tolist()}"
        )

    classifier_payload = {
        "labels": labels,
        "coefficients": classifier.coef_.tolist(),
        "intercepts": classifier.intercept_.tolist(),
        "embedding_dimension": int(classifier.coef_.shape[1]),
        "pooling": "cls",
        "normalize_embeddings": True,
        "max_sequence_tokens": 128,
    }
    classifier_path = output_directory / "classifier.json"
    classifier_path.write_text(
        json.dumps(classifier_payload, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"ONNX encoder saved to: {onnx_path}")
    print(f"Classifier weights saved to: {classifier_path}")
    print(f"ONNX size: {onnx_path.stat().st_size / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()
