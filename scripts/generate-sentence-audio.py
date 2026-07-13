#!/usr/bin/env python3
import asyncio
import hashlib
import json
import os
import pathlib
import re
import tempfile
import unicodedata

import edge_tts

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / "sentence-audio-source.json"
OUTPUT = ROOT / "audio" / "sentences"
MANIFEST = ROOT / "sentence-audio-manifest.js"
HASHES = ROOT / "sentence-audio-hashes.json"
CONCURRENCY = max(1, int(os.environ.get("TTS_CONCURRENCY", "3")))


def normalize(value: str) -> str:
    text = unicodedata.normalize("NFC", str(value or ""))
    text = text.replace("ي", "ی").replace("ك", "ک")
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r" *\u200c *", "\u200c", text)
    return text.strip()


def content_hash(text: str, voice: str) -> str:
    payload = f"{voice}\n{normalize(text)}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def load_previous_hashes() -> dict[str, str]:
    if not HASHES.exists():
        return {}
    try:
        payload = json.loads(HASHES.read_text(encoding="utf-8"))
        entries = payload.get("entries", {})
        return entries if isinstance(entries, dict) else {}
    except (OSError, ValueError, TypeError):
        return {}


def atomic_write_text(target: pathlib.Path, content: str) -> None:
    with tempfile.NamedTemporaryFile(
        dir=target.parent,
        mode="w",
        encoding="utf-8",
        delete=False,
    ) as handle:
        temporary = pathlib.Path(handle.name)
        handle.write(content)
    temporary.replace(target)


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


async def generate_one(
    entry: dict,
    voice: str,
    previous_hashes: dict[str, str],
    semaphore: asyncio.Semaphore,
) -> tuple[str, str]:
    entry_id = entry["id"]
    target = OUTPUT / f"{entry_id}.mp3"
    expected_hash = content_hash(entry["text"], voice)
    if (
        previous_hashes.get(entry_id) == expected_hash
        and target.exists()
        and target.stat().st_size > 1024
    ):
        return entry_id, expected_hash

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
                return entry_id, expected_hash
            except Exception as error:  # noqa: BLE001
                last_error = error
                if temporary and temporary.exists():
                    temporary.unlink()
                await asyncio.sleep(attempt * 1.5)
        raise RuntimeError(f"Could not generate {entry_id}: {last_error}")


def write_manifest(entries: list[dict], voice: str) -> None:
    mapping = {
        normalize(entry["text"]): f"./audio/sentences/{entry['id']}.mp3"
        for entry in entries
    }
    payload = json.dumps(mapping, ensure_ascii=False, separators=(",", ":"))
    content = (
        "// Generated local Persian sentence recordings.\n"
        f"window.FARSI_SENTENCE_AUDIO_VOICE = {json.dumps(voice)};\n"
        f"window.FARSI_SENTENCE_AUDIO = Object.freeze({payload});\n"
    )
    atomic_write_text(MANIFEST, content)


def write_hashes(voice: str, hashes: dict[str, str]) -> None:
    payload = {
        "voice": voice,
        "algorithm": "sha256(voice + newline + normalized Persian sentence)",
        "entries": hashes,
    }
    atomic_write_text(
        HASHES,
        f"{json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True)}\n",
    )


def remove_orphaned_recordings(entries: list[dict]) -> None:
    expected = {f"{entry['id']}.mp3" for entry in entries}
    for recording in OUTPUT.glob("*.mp3"):
        if recording.name not in expected:
            recording.unlink()
            print(f"Removed orphaned recording {recording.relative_to(ROOT)}")


async def main() -> None:
    entries = json.loads(SOURCE.read_text(encoding="utf-8"))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    voice = await choose_voice()
    print(f"Using Persian neural voice: {voice}")
    previous_hashes = load_previous_hashes()
    semaphore = asyncio.Semaphore(CONCURRENCY)
    generated = await asyncio.gather(
        *(
            generate_one(entry, voice, previous_hashes, semaphore)
            for entry in entries
        )
    )
    current_hashes = dict(generated)
    remove_orphaned_recordings(entries)
    write_manifest(entries, voice)
    write_hashes(voice, current_hashes)
    print(f"Verified {len(entries)} local sentence recordings.")


if __name__ == "__main__":
    asyncio.run(main())
