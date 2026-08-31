import json
import random
from collections import defaultdict
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SOURCE_VERSIONS = ("v1", "v2", "v3")
SEED = 42
TEST_FRACTION = 0.20


def load_unique_records() -> list[dict]:
    records_by_text = {}

    for version in SOURCE_VERSIONS:
        for split in ("train", "test"):
            path = PROJECT_ROOT / "ml" / "data" / version / f"{split}.jsonl"
            for line in path.read_text().splitlines():
                if not line.strip():
                    continue
                record = json.loads(line)
                key = record["text"].strip().casefold()
                existing = records_by_text.get(key)
                if existing and existing["label"] != record["label"]:
                    raise ValueError(f"Conflicting labels for: {record['text']}")
                records_by_text[key] = {
                    "text": record["text"].strip(),
                    "label": record["label"],
                }

    return list(records_by_text.values())


def stratified_split(records: list[dict]) -> tuple[list[dict], list[dict]]:
    rng = random.Random(SEED)
    records_by_label = defaultdict(list)
    for record in records:
        records_by_label[record["label"]].append(record)

    train_records = []
    test_records = []
    for label in sorted(records_by_label):
        label_records = records_by_label[label]
        rng.shuffle(label_records)
        test_count = round(len(label_records) * TEST_FRACTION)
        test_records.extend(label_records[:test_count])
        train_records.extend(label_records[test_count:])

    rng.shuffle(train_records)
    rng.shuffle(test_records)
    return train_records, test_records


def write_jsonl(path: Path, records: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    content = "\n".join(json.dumps(record, ensure_ascii=False) for record in records)
    path.write_text(f"{content}\n")


def main() -> None:
    records = load_unique_records()
    train_records, test_records = stratified_split(records)
    output_directory = PROJECT_ROOT / "ml" / "data" / "v4"

    write_jsonl(output_directory / "train.jsonl", train_records)
    write_jsonl(output_directory / "test.jsonl", test_records)

    print(f"Unique combined records: {len(records)}")
    print(f"Training records: {len(train_records)}")
    print(f"Testing records: {len(test_records)}")
    print(f"V4 dataset saved to: {output_directory}")


if __name__ == "__main__":
    main()
