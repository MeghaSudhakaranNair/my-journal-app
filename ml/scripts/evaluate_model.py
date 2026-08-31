import argparse
from pathlib import Path

from datasets import load_dataset
from sklearn.metrics import classification_report, confusion_matrix
from setfit import SetFitModel


PROJECT_ROOT = Path(__file__).resolve().parents[2]
LABELS = ["negative", "neutral", "positive"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate a journal sentiment model.")
    parser.add_argument(
        "--version",
        default="v1",
        help="Dataset/model version to evaluate (default: v1).",
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=None,
        help="Evaluate the model saved with this epoch count.",
    )
    parser.add_argument(
        "--test-file",
        type=Path,
        default=None,
        help="Optional JSONL test file; relative paths start at the project root.",
    )
    return parser.parse_args()


def evaluate_test_dataset(model: SetFitModel, test_file: Path) -> None:
    dataset = load_dataset(
        "json",
        data_files={"test": str(test_file)},
    )["test"]

    texts = dataset["text"]
    expected_labels = dataset["label"]

    predicted_labels = model.predict(
        texts,
        use_labels=False,
    ).tolist()

    print("\nClassification report:")
    print(
        classification_report(
            expected_labels,
            predicted_labels,
            target_names=LABELS,
            zero_division=0,
        )
    )

    print("Confusion matrix:")
    print(confusion_matrix(expected_labels, predicted_labels))


def test_manual_examples(model: SetFitModel) -> None:
    examples = [
        "I am excited about everything that happened today.",
        "I completed my normal routine and made dinner.",
        "I feel completely defeated and alone.",
        "Today was difficult, but I am proud that I kept going.",
        "I smiled during the meeting even though I felt empty.",
        "I did not feel as terrible as yesterday.",
    ]

    print("\nManual predictions:")

    for text in examples:
        prediction = model.predict(text)
        probabilities = model.predict_proba(text).tolist()

        probability_map = {
            label: round(float(probability), 4)
            for label, probability in zip(LABELS, probabilities)
        }

        print()
        print(f"Text: {text}")
        print(f"Prediction: {prediction}")
        print(f"Probabilities: {probability_map}")


def main() -> None:
    args = parse_args()
    model_name = f"journal-sentiment-{args.version}"
    if args.epochs is not None:
        model_name = f"{model_name}-e{args.epochs}"
    model_path = PROJECT_ROOT / "ml" / "models" / model_name
    if args.test_file is None:
        test_file = PROJECT_ROOT / "ml" / "data" / args.version / "test.jsonl"
    elif args.test_file.is_absolute():
        test_file = args.test_file
    else:
        test_file = PROJECT_ROOT / args.test_file

    if not model_path.exists():
        raise FileNotFoundError(
            f"Model {model_path} was not found. Train version {args.version} first."
        )
    if not test_file.exists():
        raise FileNotFoundError(f"Test dataset {test_file} was not found.")

    model = SetFitModel.from_pretrained(model_path)

    evaluate_test_dataset(model, test_file)
    test_manual_examples(model)


if __name__ == "__main__":
    main()
