#!/usr/bin/env python3
import base64
import io
import tarfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parts_dir = root / "tools" / "upgrade_payload"
payload = "".join(path.read_text(encoding="utf-8") for path in sorted(parts_dir.glob("part-*.txt")))

with tarfile.open(fileobj=io.BytesIO(base64.b64decode(payload)), mode="r:gz") as archive:
    for member in archive.getmembers():
        target = (root / member.name).resolve()
        if root.resolve() not in target.parents and target != root.resolve():
            raise RuntimeError(f"Unsafe archive path: {member.name}")
    archive.extractall(root)

print("Applied Farsi tutor curriculum UI upgrade.")
