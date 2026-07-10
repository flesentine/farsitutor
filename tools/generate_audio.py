#!/usr/bin/env python3
"""Generate one MP3 pronunciation clip for every Farsi entry in words.js."""

from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORDS_FILE = ROOT / "words.js"
AUDIO_DIR = ROOT / "audio"
VOICE = "fa-IR-DilaraNeural"


def read_words() -> list[str]:
    source = WORDS_FILE.read_text(encoding="utf-8")
    words = re.findall(r"\{fa:'([^']+)'", source)
    if not words:
        raise RuntimeError("No Persian words were found in words.js")
    return words


def run(command: list[str]) -> bool:
    result = subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return result.returncode == 0


def generate_with_edge_tts(word: str, destination: Path) -> bool:
    edge_tts = shutil.which("edge-tts")
    if not edge_tts:
        return False
    return run([
        edge_tts,
        "--voice",
        VOICE,
        "--rate=-12%",
        "--text",
        word,
        "--write-media",
        str(destination),
    ]) and destination.exists() and destination.stat().st_size > 1000


def generate_with_espeak(word: str, destination: Path) -> None:
    wav = destination.with_suffix(".wav")
    if not run([
        "espeak",
        "-v",
        "fa",
        "-s",
        "135",
        "-p",
        "48",
        "-a",
        "180",
        "-w",
        str(wav),
        word,
    ]):
        raise RuntimeError(f"eSpeak failed for {word!r}")

    if not run([
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
        "-i",
        str(wav),
        "-ac",
        "1",
        "-ar",
        "24000",
        "-b:a",
        "48k",
        str(destination),
    ]):
        raise RuntimeError(f"ffmpeg failed for {word!r}")
    wav.unlink(missing_ok=True)


def main() -> None:
    words = read_words()
    AUDIO_DIR.mkdir(exist_ok=True)

    expected = set()
    for index, word in enumerate(words):
        destination = AUDIO_DIR / f"{index:03}.mp3"
        expected.add(destination.name)
        destination.unlink(missing_ok=True)

        if not generate_with_edge_tts(word, destination):
            generate_with_espeak(word, destination)

        if not destination.exists() or destination.stat().st_size < 1000:
            raise RuntimeError(f"Invalid audio generated for {word!r}")
        print(f"{index:03}: {word} ({destination.stat().st_size} bytes)")

    for old_file in AUDIO_DIR.glob("*.mp3"):
        if old_file.name not in expected:
            old_file.unlink()

    (AUDIO_DIR / "README.md").write_text(
        "These numbered MP3 files correspond to the entries in `words.js` in the same order.\n",
        encoding="utf-8",
    )
    print(f"Generated {len(words)} pronunciation files.")


if __name__ == "__main__":
    main()
