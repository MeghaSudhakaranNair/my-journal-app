import json
import subprocess
import sys
import time
from pathlib import Path

from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    precision_recall_fscore_support,
)
from setfit import SetFitModel


PROJECT_ROOT = Path(__file__).resolve().parents[2]
TRAIN_SCRIPT = PROJECT_ROOT / "ml" / "scripts" / "train.py"
TEST_FILE = PROJECT_ROOT / "ml" / "data" / "v4" / "test.jsonl"
DOCUMENTATION_DIRECTORY = PROJECT_ROOT / "documentation"
EPOCH_COUNTS = (3, 5, 8)
LABELS = ("negative", "neutral", "positive")


def train_models() -> dict[int, float]:
    durations = {}
    for epochs in EPOCH_COUNTS:
        print(f"\n{'=' * 72}\nTraining V4 for {epochs} epochs\n{'=' * 72}")
        started = time.perf_counter()
        subprocess.run(
            [
                sys.executable,
                str(TRAIN_SCRIPT),
                "--version",
                "v4",
                "--epochs",
                str(epochs),
            ],
            cwd=PROJECT_ROOT,
            check=True,
        )
        durations[epochs] = time.perf_counter() - started
    return durations


def load_test_data() -> tuple[list[str], list[int]]:
    rows = [
        json.loads(line)
        for line in TEST_FILE.read_text().splitlines()
        if line.strip()
    ]
    return [row["text"] for row in rows], [row["label"] for row in rows]


def evaluate_models(durations: dict[int, float]) -> list[dict]:
    texts, expected = load_test_data()
    results = []

    for epochs in EPOCH_COUNTS:
        model_path = (
            PROJECT_ROOT
            / "ml"
            / "models"
            / f"journal-sentiment-v4-e{epochs}"
        )
        model = SetFitModel.from_pretrained(model_path)
        predicted = model.predict(texts, use_labels=False).tolist()

        macro_precision, macro_recall, macro_f1, _ = (
            precision_recall_fscore_support(
                expected,
                predicted,
                labels=[0, 1, 2],
                average="macro",
                zero_division=0,
            )
        )
        class_precision, class_recall, class_f1, class_support = (
            precision_recall_fscore_support(
                expected,
                predicted,
                labels=[0, 1, 2],
                zero_division=0,
            )
        )

        result = {
            "epochs": epochs,
            "test_samples": len(expected),
            "training_seconds": round(durations[epochs], 2),
            "accuracy": float(accuracy_score(expected, predicted)),
            "macro_precision": float(macro_precision),
            "macro_recall": float(macro_recall),
            "macro_f1": float(macro_f1),
            "per_class": {
                label: {
                    "precision": float(class_precision[index]),
                    "recall": float(class_recall[index]),
                    "f1": float(class_f1[index]),
                    "support": int(class_support[index]),
                }
                for index, label in enumerate(LABELS)
            },
            "confusion_matrix": confusion_matrix(
                expected, predicted, labels=[0, 1, 2]
            ).tolist(),
        }
        results.append(result)
        print(
            f"{epochs} epochs: accuracy={result['accuracy']:.4f}, "
            f"macro_f1={result['macro_f1']:.4f}"
        )

    return results


def write_svg(results: list[dict]) -> Path:
    colors = {"accuracy": "#5b8def", "macro_f1": "#e08b47"}
    groups = []
    centers = (280, 600, 920)
    for result, center in zip(results, centers):
        accuracy_height = result["accuracy"] * 500
        f1_height = result["macro_f1"] * 500
        groups.append(
            f'<rect x="{center - 58}" y="{600 - accuracy_height:.1f}" '
            f'width="52" height="{accuracy_height:.1f}" rx="7" fill="{colors["accuracy"]}"/>'
            f'<rect x="{center + 6}" y="{600 - f1_height:.1f}" '
            f'width="52" height="{f1_height:.1f}" rx="7" fill="{colors["macro_f1"]}"/>'
            f'<text x="{center}" y="635" text-anchor="middle" class="group">'
            f'{result["epochs"]} epochs</text>'
            f'<text x="{center}" y="657" text-anchor="middle" class="note">'
            f'{result["training_seconds"]:.1f}s training</text>'
        )

    grid = "".join(
        f'<line x1="90" y1="{600 - value * 5}" x2="1135" y2="{600 - value * 5}"/>'
        for value in range(0, 101, 20)
    )
    labels = "".join(
        f'<text x="78" y="{605 - value * 5}" text-anchor="end">{value}%</text>'
        for value in range(0, 101, 20)
    )
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760">
<style>.text{{font:14px system-ui,sans-serif;fill:#78716c}}.group{{font:700 19px system-ui,sans-serif;fill:#292524}}.note{{font:13px system-ui,sans-serif;fill:#78716c}}</style>
<rect width="1200" height="760" rx="24" fill="#fbfaf7"/>
<text x="70" y="58" font="700 30px system-ui,sans-serif" fill="#292524">V4 epoch comparison</text>
<text x="70" y="88" font="16px system-ui,sans-serif" fill="#78716c">Same 212 training and 54 testing examples · seed 42</text>
<g stroke="#dedbd5">{grid}</g><g class="text">{labels}</g>
{''.join(groups)}
<rect x="405" y="702" width="17" height="17" rx="3" fill="{colors['accuracy']}"/><text x="432" y="716" class="text">Accuracy</text>
<rect x="610" y="702" width="17" height="17" rx="3" fill="{colors['macro_f1']}"/><text x="637" y="716" class="text">Macro F1</text>
</svg>'''
    path = DOCUMENTATION_DIRECTORY / "v4-epoch-comparison.svg"
    path.write_text(svg)
    return path


def write_report(results: list[dict]) -> None:
    DOCUMENTATION_DIRECTORY.mkdir(parents=True, exist_ok=True)
    json_path = DOCUMENTATION_DIRECTORY / "v4-epoch-comparison.json"
    json_path.write_text(json.dumps(results, indent=2) + "\n")
    svg_path = write_svg(results)

    rows = "\n".join(
        f'| {result["epochs"]} | {result["training_seconds"]:.2f} | '
        f'{result["accuracy"]:.2%} | {result["macro_precision"]:.2%} | '
        f'{result["macro_recall"]:.2%} | {result["macro_f1"]:.2%} |'
        for result in results
    )
    best = max(results, key=lambda result: result["macro_f1"])
    markdown = f'''# V4 epoch comparison

![V4 epoch comparison]({svg_path.name})

All experiments use the same V4 training set (212 examples), test set (54 examples), base model (`BAAI/bge-small-en-v1.5`), and random seed (42). Only the epoch count changes.

| Epochs | Training seconds | Accuracy | Macro precision | Macro recall | Macro F1 |
|---:|---:|---:|---:|---:|---:|
{rows}

The highest macro F1 in this run was produced by **{best['epochs']} epochs** ({best['macro_f1']:.2%}). With only 54 test examples, treat small score differences cautiously. Repeating each configuration with multiple seeds is required for a stronger statistical conclusion.
'''
    (DOCUMENTATION_DIRECTORY / "v4-epoch-comparison.md").write_text(markdown)


def main() -> None:
    if not TEST_FILE.exists():
        raise FileNotFoundError(
            "V4 data is missing. Run ml/scripts/build_v4_dataset.py first."
        )
    durations = train_models()
    results = evaluate_models(durations)
    write_report(results)
    print(f"\nComparison saved in: {DOCUMENTATION_DIRECTORY}")


if __name__ == "__main__":
    main()
