import argparse
from pathlib import Path

from datasets import load_dataset
from setfit import SetFitModel, Trainer, TrainingArguments


PROJECT_ROOT = Path(__file__).resolve().parents[2]
LABELS = ["negative", "neutral", "positive"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train a journal sentiment model.")
    parser.add_argument(
        "--version",
        default="v1",
        help="Dataset/model version to train (default: v1).",
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=None,
        help="Number of epochs. When supplied, it is added to the model name.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    data_directory = PROJECT_ROOT / "ml" / "data" / args.version
    train_file = data_directory / "train.jsonl"
    test_file = data_directory / "test.jsonl"
    epochs = args.epochs if args.epochs is not None else 5
    model_name = f"journal-sentiment-{args.version}"
    if args.epochs is not None:
        model_name = f"{model_name}-e{epochs}"
    model_output = (
        PROJECT_ROOT / "ml" / "models" / model_name
    )

    if not train_file.exists() or not test_file.exists():
        raise FileNotFoundError(
            f"Expected {train_file} and {test_file} for version {args.version}."
        )

    # Load your JSONL examples.
    dataset = load_dataset(
        "json",
        data_files={
            "train": str(train_file),
            "test": str(test_file),
        },
    )

    print(dataset)

    # Download a small pretrained sentence-embedding model.
    model = SetFitModel.from_pretrained(
        "BAAI/bge-small-en-v1.5",
        labels=LABELS,
    )

    # Resource-conscious settings for your Mac.
    arguments = TrainingArguments(
        output_dir=str(model_output),
        batch_size=8,
        num_epochs=epochs,
        max_length=128,
        save_strategy="no",
        report_to="none",
        seed=42,
    )

    trainer = Trainer(
        model=model,
        args=arguments,
        train_dataset=dataset["train"],
        eval_dataset=dataset["test"],
        metric="accuracy",
    )

    print("Starting training...")
    trainer.train()

    metrics = trainer.evaluate()
    print("Evaluation results:", metrics)

    model.save_pretrained(model_output)
    print(f"Model saved to: {model_output}")


if __name__ == "__main__":
    main()
