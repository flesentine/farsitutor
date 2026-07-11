#!/usr/bin/env python3
"""Generate one MP3 pronunciation clip for every Farsi curriculum entry."""
from __future__ import annotations
import json,re,shutil,subprocess
from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
WORDS_FILES=[ROOT/f"words-part-{i:02}.js" for i in range(1,10)]
AUDIO_DIR=ROOT/"audio";VOICE="fa-IR-DilaraNeural";WORKERS=8
def read_words():
 source="\n".join(p.read_text(encoding="utf-8") for p in WORDS_FILES if p.exists());words=re.findall(r'"fa":"((?:\\.|[^"\\])*)"',source);words=[json.loads(f'"{w}"') for w in words]
 if not words:raise RuntimeError("No Persian words were found in the word data parts")
 return words
def run(c):return subprocess.run(c,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
def edge(word,dst):
 exe=shutil.which("edge-tts")
 if not exe:return False
 tmp=dst.with_suffix(".edge.mp3");tmp.unlink(missing_ok=True);ok=run([exe,"--voice",VOICE,"--rate=-12%","--text",word,"--write-media",str(tmp)]) and tmp.exists() and tmp.stat().st_size>1000
 if ok:tmp.replace(dst)
 else:tmp.unlink(missing_ok=True)
 return ok
def fallback(word,dst):
 wav=dst.with_suffix(".wav");tmp=dst.with_suffix(".fallback.mp3");wav.unlink(missing_ok=True);tmp.unlink(missing_ok=True)
 if not run(["espeak","-v","fa","-s","135","-p","48","-a","180","-w",str(wav),word]):raise RuntimeError(f"eSpeak failed for {word!r}")
 if not run(["ffmpeg","-y","-loglevel","error","-i",str(wav),"-ac","1","-ar","24000","-b:a","48k",str(tmp)]):raise RuntimeError(f"ffmpeg failed for {word!r}")
 wav.unlink(missing_ok=True);tmp.replace(dst)
def one(i,word):
 dst=AUDIO_DIR/f"{i:03}.mp3"
 if dst.exists() and dst.stat().st_size>1000:return i,word,dst.stat().st_size,"kept"
 dst.unlink(missing_ok=True)
 if not edge(word,dst):fallback(word,dst)
 if not dst.exists() or dst.stat().st_size<1000:raise RuntimeError(f"Invalid audio generated for {word!r}")
 return i,word,dst.stat().st_size,"generated"
def main():
 words=read_words();AUDIO_DIR.mkdir(exist_ok=True);expected={f"{i:03}.mp3" for i in range(len(words))}
 with ThreadPoolExecutor(max_workers=WORKERS) as ex:
  for future in as_completed([ex.submit(one,i,w) for i,w in enumerate(words)]):
   i,w,size,action=future.result();print(f"{i:03}: {w} ({size} bytes, {action})")
 for old in AUDIO_DIR.glob("*.mp3"):
  if old.name not in expected:old.unlink()
 (AUDIO_DIR/"README.md").write_text("These numbered MP3 files correspond to the entries in `words-part-*.js` in stable storage order.\n",encoding="utf-8")
 print(f"Prepared {len(words)} pronunciation files.")
if __name__=="__main__":main()
