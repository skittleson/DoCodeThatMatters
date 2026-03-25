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


def _load_rss_audio(rss_path="docs/rss.xml"):
    """
    Parse docs/rss.xml and return a dict of:
        { slug: { 'hash': str, 'length': str } }
    extracted from <enclosure type="audio/mpeg" hash="..." length="..."> attributes.
    Returns an empty dict if the file doesn't exist or has no audio enclosures.
    """
    if not os.path.exists(rss_path):
        return {}

    with open(rss_path, "r", encoding="utf-8") as f:
        content = f.read()

    soup = BeautifulSoup(content, "xml")
    result = {}
    for item in soup.find_all("item"):
        link = item.find("link")
        if not link:
            continue
        # link text e.g. https://docodethatmatters.com/onboarding-devs/
        slug = link.get_text(strip=True).rstrip("/").rsplit("/", 1)[-1]
        enclosure = item.find("enclosure", attrs={"type": "audio/mpeg"})
        if enclosure and enclosure.get("hash"):
            result[slug] = {
                "hash": enclosure["hash"],
                "length": enclosure.get("length", "0"),
            }
    return result


def _patch_rss_audio(updates, rss_path="docs/rss.xml"):
    """
    For each slug in `updates` ({ slug: { 'length': int, 'hash': str } }),
    inject or replace the <enclosure type="audio/mpeg"> element inside the
    matching <item> in docs/rss.xml, then write the file back.

    The site base URL is inferred from the existing text enclosure URLs so
    no hardcoded domain is needed.
    """
    with open(rss_path, "r", encoding="utf-8") as f:
        content = f.read()

    soup = BeautifulSoup(content, "xml")

    for item in soup.find_all("item"):
        link = item.find("link")
        if not link:
            continue
        slug = link.get_text(strip=True).rstrip("/").rsplit("/", 1)[-1]
        if slug not in updates:
            continue

        info = updates[slug]

        # Infer base URL from the existing text enclosure
        txt_enclosure = item.find("enclosure", attrs={"type": "text/plain"})
        if txt_enclosure:
            base_url = txt_enclosure["url"].rsplit("/", 2)[0]  # strip /<slug>/index.txt
        else:
            base_url = ""

        audio_url = f"{base_url}/{slug}/index.mp3"

        # Remove existing audio enclosure if present
        existing = item.find("enclosure", attrs={"type": "audio/mpeg"})
        if existing:
            existing.decompose()

        # Build and append the new audio enclosure tag
        new_tag = soup.new_tag(
            "enclosure",
            url=audio_url,
            type="audio/mpeg",
            length=str(info["length"]),
            hash=info["hash"],
        )
        item.append(new_tag)

    with open(rss_path, "w", encoding="utf-8") as f:
        f.write(str(soup))


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
    Split text into paragraph-sized chunks safe for the KittenTTS BERT encoder.

    KittenTTS internally splits on sentence endings (.!?) with max_len=400, but
    long list items and run-on sentences can still exceed the ONNX model's
    sequence limit, causing an 'invalid expand shape' error at the BERT node.

    This pre-splits on paragraph/newline boundaries first, then falls back to
    splitting on sentence endings for any paragraph that is still too long.
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
                    # If a single sentence exceeds max_chars, let KittenTTS
                    # handle it — it has its own word-level fallback
                    current = sentence
            if current:
                chunks.append(current.strip())
    return chunks


def _wav_to_mp3(wav_buf, mp3_path):
    """
    Convert a WAV BytesIO buffer to an MP3 file using ffmpeg directly.
    Requires ffmpeg to be installed on the system.
    """
    import subprocess
    import tempfile

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(wav_buf.read())
        tmp_path = tmp.name

    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", tmp_path, mp3_path],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    finally:
        os.unlink(tmp_path)


def text_to_speech_on_plain_text(slug_filter=None):
    """
    For each docs/<slug>/index.txt, generate docs/<slug>/index.mp3 using
    KittenTTS kitten-tts-mini (80M, best quality) with Hugo voice.

    Skip regeneration if the SHA-256 hash of index.txt matches the hash
    stored in the <enclosure type="audio/mpeg" hash="..."> attribute in
    docs/rss.xml (written by the previous run of this script).

    After processing, patches docs/rss.xml in-place to inject or update
    <enclosure type="audio/mpeg" url="..." length="..." hash="..." />
    for every post that was (re)generated.

    Args:
        slug_filter: if set, only process the post with this slug name.
    """
    import soundfile as sf
    from kittentts import KittenTTS

    RSS_PATH = "docs/rss.xml"

    # Read existing audio enclosures from rss.xml — { slug: { hash, length } }
    rss_audio = _load_rss_audio(RSS_PATH)

    model = None  # lazy-load — only instantiate if something needs generating
    updates = {}  # slugs that were (re)generated this run: { slug: { length, hash } }

    for folder in sorted(os.listdir("docs")):
        # Skip non-post entries (files like rss.xml, feed.json, _astro/, etc.)
        if "." in folder:
            continue

        txt_path = f"docs/{folder}/index.txt"
        mp3_path = f"docs/{folder}/index.mp3"

        if not os.path.exists(txt_path):
            continue

        # Apply slug filter when testing a single post
        if slug_filter and folder != slug_filter:
            continue

        with open(txt_path, "r", encoding="utf-8") as f:
            text = f.read().strip()

        if not text:
            continue

        txt_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()

        # Skip if the hash in rss.xml matches — content unchanged
        if rss_audio.get(folder, {}).get("hash") == txt_hash:
            print(f"Skipping {folder} (content unchanged)")
            continue

        print(f"Generating audio for {folder}...")

        if model is None:
            print("Loading KittenTTS model (kitten-tts-mini-0.8)...")
            model = KittenTTS(_resolve_model("KittenML/kitten-tts-mini-0.8"))

        audio_chunks = []
        for chunk in _split_text_for_tts(text):
            # Skip chunks with no real word content — URLs, punctuation-only
            # lines, or code remnants produce no phonemes and cause KittenTTS
            # to return an empty array, crashing numpy.concatenate.
            if not any(c.isalpha() for c in chunk):
                continue
            try:
                result = model.generate(chunk, voice="Hugo", clean_text=True)
                if result is not None and result.size > 0:
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
        _wav_to_mp3(buf, mp3_path)

        size = os.path.getsize(mp3_path)
        updates[folder] = {"length": size, "hash": txt_hash}
        print(f"  -> {mp3_path} ({size:,} bytes)")

    if updates:
        _patch_rss_audio(updates, RSS_PATH)
        print(f"Patched {RSS_PATH} with {len(updates)} audio enclosure(s)")
    else:
        print("Nothing to generate.")


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
