from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import torch
import torchaudio
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor


MODEL_CACHE: dict[str, tuple[Wav2Vec2Processor, Wav2Vec2ForCTC]] = {}


def load_model(model_name: str) -> tuple[Wav2Vec2Processor, Wav2Vec2ForCTC]:
    if model_name in MODEL_CACHE:
        return MODEL_CACHE[model_name]

    processor = Wav2Vec2Processor.from_pretrained(model_name)
    model = Wav2Vec2ForCTC.from_pretrained(model_name)
    model.eval()
    MODEL_CACHE[model_name] = (processor, model)
    return processor, model


def transcribe(audio_path: Path, model_name: str) -> str:
    processor, model = load_model(model_name)

    waveform, sample_rate = torchaudio.load(str(audio_path))

    if sample_rate != 16000:
        resampler = torchaudio.transforms.Resample(sample_rate, 16000)
        waveform = resampler(waveform)

    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)

    inputs = processor(
        waveform.squeeze(),
        sampling_rate=16000,
        return_tensors="pt",
        padding=True,
    )

    with torch.no_grad():
        logits = model(**inputs).logits

    predicted_ids = torch.argmax(logits, dim=-1)
    decoded = processor.batch_decode(predicted_ids)[0]
    return decoded.strip()


def main() -> int:
    parser = argparse.ArgumentParser(description="Transcribe interview audio with a local Wav2Vec2 model.")
    parser.add_argument("--audio-path")
    parser.add_argument("--model-name", default="anish-shilpakar/wav2vec2-nepali")
    parser.add_argument("--health", action="store_true")
    args = parser.parse_args()

    if args.health:
        json.dump({"ok": True, "transcriber": "wav2vec2_local"}, sys.stdout)
        sys.stdout.write("\n")
        return 0

    if not args.audio_path:
        parser.error("--audio-path is required unless --health is used.")

    audio_path = Path(args.audio_path)
    if not audio_path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    text = transcribe(audio_path, args.model_name)
    json.dump({"text": text}, sys.stdout)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
