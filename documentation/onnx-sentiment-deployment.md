# ONNX sentiment deployment

The trained SetFit model remains the source model used for training and future
fine-tuning. Its BGE encoder is exported to ONNX for production inference, and
the trained logistic-regression head is stored as JSON. This removes PyTorch,
Transformers, SetFit, and scikit-learn from the deployed API runtime.

## Artifacts

The export creates these ignored local files inside the selected model:

```text
ml/models/journal-sentiment-v4-e8/onnx/model.onnx
ml/models/journal-sentiment-v4-e8/onnx/classifier.json
```

The tokenizer remains at the root of the model directory. Production downloads
only `tokenizer.json` and the two ONNX artifacts from the private Hugging Face
repository.

## Export and validation

Activate the training environment, install `ml/requirements-onnx-export.txt`,
then run:

```bash
python ml/scripts/export_setfit_onnx.py --version v4-e8
python ml/scripts/validate_setfit_onnx.py --version v4-e8
```

Validation compares labels and probabilities from the original SetFit model
with the ONNX model on the challenge dataset. Do not deploy an export with label
mismatches or a probability difference above the configured tolerance.

## Upload

Use a temporary Hugging Face token with write permission to upload the generated
`onnx` directory. Keep the read-only token in Render for runtime downloads.

```bash
hf upload MeghaSN-Projects/journal-sentiment-setfit-v4-e8 \
  ml/models/journal-sentiment-v4-e8/onnx onnx \
  --repo-type model
```

After upload, deploy the backend requirements and runtime changes. Render still
uses `SENTIMENT_MODEL_SOURCE=huggingface` and the existing repository setting.
