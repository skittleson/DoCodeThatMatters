"""Tools for content"""

import argparse
import hashlib
import io
import os
import requests
import numpy
from bs4 import BeautifulSoup


def is_absolute(url):
    return bool(requests.utils.urlparse(url).netloc)


def check_links(file_path):
    import mechanicalsoup

    with open(file_path, "r", encoding="utf-8") as file:
        content = file.read()

    soup = BeautifulSoup(content, "html.parser")
    links = soup.find_all("a", href=True)

    browser = mechanicalsoup.StatefulBrowser()
    broken_links = []
    for link in links:
        url = link.attrs["href"]
        if (
            is_absolute(url)
            and "https://amzn.to" not in url
            and "https://www.amazon" not in url
        ):
            try:
                response = browser.session.head(url, allow_redirects=True)
                if response.status_code >= 400:
                    broken_links.append((url, response.status_code))
            except requests.RequestException as e:
                broken_links.append((url, str(e)))

    return broken_links


def check_all_pages_for_broken_links():
    """
    Checks all pages for broken links then reports it to a file
    """
    import csv

    with open("reports/broken_links.csv", "w", encoding="utf-8") as csvfile:
        writer = csv.writer(csvfile)
        for folder in os.listdir("docs"):
            index_html_root = f"docs/{folder}/index.html"
            if "." not in folder and os.path.exists(index_html_root):
                broken_links = check_links(index_html_root)
                for broken_link in broken_links:
                    writer.writerow([folder, broken_link])


def _resolve_model(repo_id):
    """
    Ensure the model is cached locally, then set HF_HUB_OFFLINE=1 so
    subsequent HF hub calls use the local cache without emitting
    unauthenticated-request warnings or hitting the network.
    """
    from huggingface_hub import snapshot_download

    snapshot_download(repo_id)
    os.environ["HF_HUB_OFFLINE"] = "1"
    return repo_id


def _split_text_for_tts(text, max_chars=300):
    """
    Split text into paragraph-sized chunks safe for the TTS model.

    Long list items and run-on sentences can exceed the model's practical
    sequence length (Kokoro warns that long texts may be truncated unless
    split), so we pre-split on paragraph/newline boundaries first, then fall
    back to splitting on sentence endings for any paragraph still too long.
    """
    import re

    paragraphs = [p.strip() for p in re.split(r"\n+", text) if p.strip()]
    chunks = []
    for para in paragraphs:
        if len(para) <= max_chars:
            chunks.append(para)
        else:
            # Further split on sentence endings
            sentences = re.split(r"(?<=[.!?])\s+", para)
            current = ""
            for sentence in sentences:
                if len(current) + len(sentence) + 1 <= max_chars:
                    current = current + " " + sentence if current else sentence
                else:
                    if current:
                        chunks.append(current.strip())
                    # If a single sentence exceeds max_chars, let the model
                    # handle it — Kokoro chunks internally as a fallback.
                    current = sentence
            if current:
                chunks.append(current.strip())
    return chunks


def _wav_to_audio(wav_buf, outputs):
    """
    Encode a WAV BytesIO buffer into one or more audio files using ffmpeg.

    `outputs` is a list of (out_path, ffmpeg_codec_args) tuples, e.g.
        [("a.mp3", []), ("a.opus", ["-c:a", "libopus", "-b:a", "32k"])]
    The WAV is written to a single temp file and each output is encoded from
    it, so the source is only materialised once. Requires ffmpeg on PATH.
    """
    import subprocess
    import tempfile

    data = wav_buf.read()
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name

    try:
        for out_path, codec_args in outputs:
            subprocess.run(
                ["ffmpeg", "-y", "-i", tmp_path, *codec_args, out_path],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
    finally:
        os.unlink(tmp_path)


AUDIO_HASHES_PATH = "audio-hashes.json"


def _load_audio_hashes(path=AUDIO_HASHES_PATH):
    """
    Load the sidecar audio-hashes.json file.
    Returns a dict of { slug: sha256_hash_of_index_txt } or {} if not found.
    This file lives outside docs/ so astro build cannot delete it.
    """
    import json

    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_audio_hashes(hashes, path=AUDIO_HASHES_PATH):
    """
    Persist the audio-hashes.json sidecar file.
    Merges `hashes` into any existing entries so unmodified slugs are retained.
    """
    import json

    existing = _load_audio_hashes(path)
    existing.update(hashes)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(existing, f, indent=2, sort_keys=True)
        f.write("\n")


def text_to_speech_on_plain_text(slug_filter=None):
    """
    For each docs/<slug>/index.tts, generate docs/<slug>/index.mp3 using
    Kokoro-82M with the af_jessica voice. Runs on CUDA if a GPU is
    available, otherwise falls back to CPU.

    Skip regeneration if BOTH conditions are true:
      - The SHA-256 hash of src/content/blog/<slug>.md matches the hash stored
        in audio-hashes.json (a sidecar file that survives astro build wiping docs/)
      - both audio/<slug>/index.mp3 and index.opus already exist on disk
        (audio/ is committed to git and never touched by astro build/dev)

    Two encodings are written to public/audio/<slug>/ (committed to git): an
    MP3 (universal fallback + the RSS <enclosure type="audio/mpeg"> source) and
    a smaller Opus file (the preferred modern <audio> source). Astro copies
    public/ into the build output, and the RSS feed emits the MP3 enclosure for
    each post natively. This function only generates audio and maintains
    audio-hashes.json.

    Args:
        slug_filter: if set, only process the post with this slug name.
    """
    import soundfile as sf
    from kokoro import KPipeline

    AUDIO_DIR = "public/audio"
    VOICE = "af_jessica"  # Kokoro American-English female voice

    # Load persisted hashes from sidecar
    audio_hashes = _load_audio_hashes()

    model = None  # lazy-load — only instantiate if something needs generating
    updates = {}  # slugs that were (re)generated this run: { slug: { length, hash } }

    for folder in sorted(os.listdir("docs")):
        # Skip non-post entries (files like rss.xml, feed.json, _astro/, etc.)
        if "." in folder:
            continue

        txt_path = f"docs/{folder}/index.tts"
        src_path = f"src/content/blog/{folder}.md"
        mp3_path = f"{AUDIO_DIR}/{folder}/index.mp3"
        opus_path = f"{AUDIO_DIR}/{folder}/index.opus"

        if not os.path.exists(txt_path):
            continue

        # Apply slug filter when testing a single post
        if slug_filter and folder != slug_filter:
            continue

        with open(txt_path, "r", encoding="utf-8") as f:
            text = f.read().strip()

        if not text:
            continue

        # Hash the SOURCE markdown file — stable across builds, not the build output.
        # Falls back to hashing the .tts content if no source file is found.
        if os.path.exists(src_path):
            with open(src_path, "rb") as f:
                txt_hash = hashlib.sha256(f.read()).hexdigest()
        else:
            txt_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()

        # Skip only if hash matches the sidecar AND BOTH encodings exist in
        # audio/ (permanent store). Requiring the .opus too means existing posts
        # regenerate once to gain the Opus file, then skip thereafter.
        if (
            audio_hashes.get(folder) == txt_hash
            and os.path.exists(mp3_path)
            and os.path.exists(opus_path)
        ):
            print(f"Skipping {folder} (content unchanged)")
        else:
            print(f"Generating audio for {folder}...")

            if model is None:
                # Prefer the GPU (Kokoro is ~16x faster on CUDA); fall back to CPU.
                try:
                    import torch

                    device = "cuda" if torch.cuda.is_available() else "cpu"
                except ImportError:
                    device = "cpu"
                _resolve_model("hexgrad/Kokoro-82M")
                print(f"Loading Kokoro-82M model on {device}...")
                model = KPipeline(lang_code="a", device=device)

            audio_chunks = []
            for chunk in _split_text_for_tts(text):
                # Skip chunks with no real word content — URLs, punctuation-only
                # lines, or code remnants produce no phonemes and cause the model
                # to return no audio, crashing numpy.concatenate.
                if not any(c.isalpha() for c in chunk):
                    continue
                try:
                    for _, _, result in model(chunk, voice=VOICE):
                        if result is None:
                            continue
                        # Kokoro yields a torch tensor; convert to numpy.
                        result = numpy.asarray(result)
                        if result.size > 0:
                            audio_chunks.append(result)
                except Exception as e:
                    print(f"  Warning: skipping chunk ({e!r}): {chunk[:60]!r}")

            if not audio_chunks:
                print(f"  Warning: no audio generated for {folder}, skipping.")
                continue

            audio = numpy.concatenate(audio_chunks, axis=-1)

            buf = io.BytesIO()
            sf.write(buf, audio, 24000, format="WAV")
            buf.seek(0)
            os.makedirs(f"{AUDIO_DIR}/{folder}", exist_ok=True)
            # MP3 for the RSS enclosure + universal fallback; Opus (speech-tuned
            # 24 kbps, ~25% smaller than the 32 kbps MP3) as the modern web
            # source. -application voip optimises libopus for single-voice speech.
            _wav_to_audio(
                buf,
                [
                    (mp3_path, []),
                    (
                        opus_path,
                        ["-c:a", "libopus", "-b:a", "24k", "-application", "voip"],
                    ),
                ],
            )

            # RSS enclosure length is the MP3 byte size (see rss.xml.ts).
            mp3_size = os.path.getsize(mp3_path)
            opus_size = os.path.getsize(opus_path)
            updates[folder] = {"length": mp3_size, "hash": txt_hash}
            print(
                f"  -> {mp3_path} ({mp3_size:,} bytes), "
                f"{opus_path} ({opus_size:,} bytes)"
            )

    if updates:
        # Persist hashes so the next build can skip unchanged posts.
        # RSS <enclosure type="audio/mpeg"> elements are emitted natively by the
        # Astro feed (src/pages/rss.xml.ts) from the mp3s in public/audio/, so
        # nothing here patches docs/rss.xml or the sitemap anymore.
        _save_audio_hashes({slug: info["hash"] for slug, info in updates.items()})
        print(f"Generated audio for {len(updates)} post(s); updated audio-hashes.json")
    else:
        print("Nothing to generate — all audio up to date.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Blog post content tools")
    parser.add_argument(
        "--slug",
        metavar="SLUG",
        default=None,
        help="Only generate audio for the post with this slug (e.g. onboarding-devs)",
    )
    args = parser.parse_args()

    text_to_speech_on_plain_text(slug_filter=args.slug)
    # check_all_pages_for_broken_links()
