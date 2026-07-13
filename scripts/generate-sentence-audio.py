#!/usr/bin/env python3
# This script is intentionally run in GitHub Actions so the generated MP3 files are committed.
import asyncio
import json
import os
import pathlib
import tempfile

import edge_tts

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / "sentence-audio-source.json"
OUTPUT = ROOT / "audio" / "sentences"
MANIFEST = ROOT / "sentence-audio-manifest.js"
CONCURRENCY = max(1, int(os.environ.get("TTS_CONCURRENCY", "3")))


def normalize(value: str) -> str:
    return " ".join(str(value or "").strip().split())


async def choose_voice() -> str:
    requested = os.environ.get("EDGE_TTS_VOICE", "fa-IR-DilaraNeural")
    voices = await edge_tts.list_voices()
    persian = [voice for voice in voices if voice.get("Locale") == "fa-IR"]
    if not persian:
        raise RuntimeError("Microsoft speech returned no fa-IR voices.")
    names = {voice.get("ShortName") for voice in persian}
    if requested in names:
        return requested
    female = next((voice for voice in persian if voice.get("Gender") == "Female"), None)
    return (female or persian[0])["ShortName"]


async def generate_one(entry: dict, voice: str, semaphore: asyncio.Semaphore) -> None:
    target = OUTPUT / f"{entry['id']}.mp3"
    if target.exists() and target.stat().st_size > 1024:
        return

    async with semaphore:
        last_error = None
        for attempt in range(1, 4):
            temporary = None
            try:
                with tempfile.NamedTemporaryFile(dir=OUTPUT, suffix=".mp3", delete=False) as handle:
                    temporary = pathlib.Path(handle.name)
                communicate = edge_tts.Communicate(
                    entry["text"],
                    voice,
                    rate="-5%",
                    volume="+0%",
                    pitch="+0Hz",
                )
                await communicate.save(str(temporary))
                if temporary.stat().st_size <= 1024:
                    raise RuntimeError("Generated audio file was unexpectedly small.")
                temporary.replace(target)
                print(f"Generated {target.relative_to(ROOT)}")
                await asyncio.sleep(0.15)
                return
            except Exception as error:  # noqa: BLE001
                last_error = error
                if temporary and temporary.exists():
                    temporary.unlink()
                await asyncio.sleep(attempt * 1.5)
        raise RuntimeError(f"Could not generate {entry['id']}: {last_error}")


def write_manifest(entries: list[dict], voice: str) -> None:
    mapping = {
        normalize(entry["text"]): f"./audio/sentences/{entry['id']}.mp3"
        for entry in entries
    }
    payload = json.dumps(mapping, ensure_ascii=False, separators=(",", ":"))
    MANIFEST.write_text(
        "// Generated local Persian sentence recordings.\n"
        f"window.FARSI_SENTENCE_AUDIO_VOICE = {json.dumps(voice)};\n"
        f"window.FARSI_SENTENCE_AUDIO = Object.freeze({payload});\n",
        encoding="utf-8",
    )


async def main() -> None:
    entries = json.loads(SOURCE.read_text(encoding="utf-8"))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    voice = await choose_voice()
    print(f"Using Persian neural voice: {voice}")
    semaphore = asyncio.Semaphore(CONCURRENCY)
    await asyncio.gather(*(generate_one(entry, voice, semaphore) for entry in entries))
    write_manifest(entries, voice)
    print(f"Generated {len(entries)} local sentence recordings.")


if __name__ == "__main__":
    asyncio.run(main())
