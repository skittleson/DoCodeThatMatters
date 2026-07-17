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


SCRIPT_HASHES_PATH = "script-hashes.json"
AUDIO_DIR = "public/audio"
DOCS_AUDIO_DIR = "docs/audio"


def _mirror_to_docs_audio(slug, filename):
    """
    Mirror a generated artifact from public/audio/<slug>/<filename> into
    docs/audio/<slug>/<filename> so the committed build copy (docs/, which the
    live site serves) can never drift stale relative to the source public/ copy.

    Best-effort and guarded: only mirrors when the docs/audio/ tree already
    exists (i.e. a build has populated it). When docs/audio/ is absent — e.g. a
    fresh checkout before `astro build` — this is a no-op, so it never crashes.
    Returns True if the file was mirrored, False otherwise.
    """
    import shutil

    if not os.path.isdir(DOCS_AUDIO_DIR):
        return False
    src = f"{AUDIO_DIR}/{slug}/{filename}"
    if not os.path.exists(src):
        return False
    dest_dir = f"{DOCS_AUDIO_DIR}/{slug}"
    os.makedirs(dest_dir, exist_ok=True)
    shutil.copy2(src, f"{dest_dir}/{filename}")
    return True


def _llm_config():
    """
    Read OpenAI-compatible LLM endpoint settings from the environment (.env
    supported via python-dotenv). Returns (base_url, model, api_key). The
    base_url has any trailing slash stripped so f"{base_url}/chat/completions"
    is always well-formed. An empty api_key means no Authorization header is
    sent (local, auth-less servers such as llama.cpp).
    """
    from dotenv import load_dotenv

    load_dotenv()
    base_url = os.environ.get("LLM_BASE_URL", "http://192.168.4.104:8080/v1").rstrip("/")
    model = os.environ.get("LLM_MODEL", "Qwopus3.6-27B")
    api_key = os.environ.get("LLM_API_KEY", "")
    return base_url, model, api_key


TTS_SYSTEM_PROMPT = (
    "You rewrite a blog post's markdown into a natural, spoken-word script that "
    "a text-to-speech voice will read aloud, as if a person were reading a book "
    "to a friend. Follow these rules exactly:\n"
    "1. Never read a URL aloud. Replace a link with natural phrasing such as "
    '"you can find the link on the blog post", or drop it entirely.\n'
    "2. Deferring to the blog is ONLY for things that literally cannot be "
    "spoken: a raw URL or link, a code block, or an image the listener cannot "
    "see. This is NOT a license to omit prose, sections, or lists — never say "
    '"see the blog for the full post/details" as a way to skip readable text.\n'
    "3. When the post has an image, describe what it depicts verbally from the "
    "alt text and surrounding context, as if describing it to someone who "
    "cannot see it.\n"
    "4. Use a conversational book-narrator tone. Produce no markdown artifacts "
    "(no #, *, backticks, or link/image syntax) and never read code verbatim.\n"
    "5. Preserve the full meaning and structure of the post. Rewrite it to be "
    "speakable; do not summarize or shorten it. Every bulleted or numbered "
    "list MUST be read out in full, item by item, as natural spoken sentences "
    '(for example "First, ... Second, ... Third, ..."). NO list, item, or '
    'section may be replaced with "see the blog for the full list" or any '
    "similar deferral — read the actual items aloud.\n"
    "Output only the spoken script text, with no preamble or commentary."
)


def _build_tts_prompt(markdown):
    """
    Build the user prompt for the LLM request. Supplies the raw markdown
    (title + body) that the system prompt instructs the model to rewrite.
    """
    return "Rewrite the following blog post markdown into a spoken script:\n\n" + markdown


def _request_tts_script(markdown, base_url, model, api_key=""):
    """
    Send the markdown to an OpenAI-compatible /chat/completions endpoint (stream
    disabled) and return the generated spoken script. Raises
    requests.RequestException on connection errors or non-2xx responses (via
    raise_for_status), and ValueError/KeyError on a malformed response body, so
    callers can catch those for fallback handling.

    An Authorization: Bearer header is sent only when api_key is non-empty;
    local auth-less servers (llama.cpp) are called with no auth header.
    """
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    resp = requests.post(
        f"{base_url}/chat/completions",
        headers=headers,
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": TTS_SYSTEM_PROMPT},
                {"role": "user", "content": _build_tts_prompt(markdown)},
            ],
            "stream": False,
            # Recommended sampling for this model (non-thinking preset).
            "temperature": 0.9,
            "top_p": 0.95,
            # Allow long spoken scripts — a full post rewrite can be lengthy.
            # 8192 is ample for a blog post and safer than the model's max.
            "max_tokens": 8192,
        },
        timeout=600,
    )
    resp.raise_for_status()
    content = resp.json()["choices"][0]["message"]["content"].strip()

    # Defensive: some chain-of-thought models wrap output in <think>...</think>.
    # This model has thinking off (verified), but if a </think> marker appears,
    # drop everything up to and including the last one before returning.
    if "</think>" in content:
        content = content.rsplit("</think>", 1)[-1].strip()
    return content


def generate_tts_scripts(slug_filter=None):
    """
    Rewrite each rendered blog post's original markdown into a natural spoken
    script via an OpenAI-compatible LLM endpoint, writing
    public/audio/<slug>/index.script.txt.

    Runs BEFORE text_to_speech_on_plain_text so audio is generated from the
    script rather than the raw .tts plain text. Slug discovery mirrors the audio
    loop: iterate docs/, skip entries containing ".", require docs/<slug>/index.tts,
    and derive the source src/content/blog/<slug>.md. Missing source .md => skip
    (audio then falls back to index.tts).

    Caching: skip the LLM call when script-hashes.json holds the current
    sha256 of the source .md AND index.script.txt already exists.

    Failure handling: any LLM error is caught per-post. A cached script is
    kept as-is; otherwise a warning is logged and no script is written so audio
    falls back to index.tts. This step never aborts the build.

    Args:
        slug_filter: if set, only process the post with this slug name.
    """
    if not os.path.isdir("docs"):
        return

    base_url, model, api_key = _llm_config()
    script_hashes = _load_audio_hashes(SCRIPT_HASHES_PATH)
    updates = {}

    for folder in sorted(os.listdir("docs")):
        if "." in folder:
            continue

        tts_path = f"docs/{folder}/index.tts"
        src_path = f"src/content/blog/{folder}.md"
        script_path = f"{AUDIO_DIR}/{folder}/index.script.txt"

        if not os.path.exists(tts_path):
            continue
        if slug_filter and folder != slug_filter:
            continue
        if not os.path.exists(src_path):
            print(f"Skipping script for {folder} (no source markdown)")
            continue

        with open(src_path, "rb") as f:
            src_bytes = f.read()
        src_hash = hashlib.sha256(src_bytes).hexdigest()

        if script_hashes.get(folder) == src_hash and os.path.exists(script_path):
            print(f"Skipping script for {folder} (source unchanged)")
            continue

        print(f"Generating TTS script for {folder}...")
        markdown = src_bytes.decode("utf-8")
        try:
            script = _request_tts_script(markdown, base_url, model, api_key)
        except (requests.RequestException, ValueError, KeyError) as e:
            if os.path.exists(script_path):
                print(f"  Warning: LLM error ({e!r}); using cached script for {folder}")
            else:
                print(
                    f"  Warning: LLM error ({e!r}); no cached script for {folder}, "
                    "audio will fall back to index.tts"
                )
            continue

        os.makedirs(f"{AUDIO_DIR}/{folder}", exist_ok=True)
        with open(script_path, "w", encoding="utf-8") as f:
            f.write(script)
            if not script.endswith("\n"):
                f.write("\n")
        # Mirror into docs/audio/ (the served build copy) so it can't go
        # stale relative to this freshly generated public/ copy.
        _mirror_to_docs_audio(folder, "index.script.txt")
        updates[folder] = src_hash
        print(f"  -> {script_path}")

    if updates:
        _save_audio_hashes(updates, SCRIPT_HASHES_PATH)
        print(f"Generated {len(updates)} script(s); updated {SCRIPT_HASHES_PATH}")
    else:
        print("Nothing to generate — all TTS scripts up to date.")


def _select_audio_source(slug):
    """
    Choose the text source for audio generation for a slug: prefer the
    LLM-generated spoken script, fall back to the astro-built plain .tts text.
    Returns the path to read, or None if neither exists.
    """
    script_path = f"{AUDIO_DIR}/{slug}/index.script.txt"
    if os.path.exists(script_path):
        return script_path
    tts_path = f"docs/{slug}/index.tts"
    if os.path.exists(tts_path):
        return tts_path
    return None


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

    VOICE = "af_jessica"  # Kokoro American-English female voice

    # Load persisted hashes from sidecar
    audio_hashes = _load_audio_hashes()

    model = None  # lazy-load — only instantiate if something needs generating
    updates = {}  # slugs that were (re)generated this run: { slug: { length, hash } }

    for folder in sorted(os.listdir("docs")):
        # Skip non-post entries (files like rss.xml, feed.json, _astro/, etc.)
        if "." in folder:
            continue

        txt_path = _select_audio_source(folder)
        src_path = f"src/content/blog/{folder}.md"
        mp3_path = f"{AUDIO_DIR}/{folder}/index.mp3"
        opus_path = f"{AUDIO_DIR}/{folder}/index.opus"

        if txt_path is None:
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

            # Mirror both encodings into docs/audio/ (the served build copy) so
            # they can't drift stale relative to these fresh public/ copies.
            _mirror_to_docs_audio(folder, "index.mp3")
            _mirror_to_docs_audio(folder, "index.opus")

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
        help="Only generate script + audio for the post with this slug (e.g. battery-station)",
    )
    args = parser.parse_args()

    generate_tts_scripts(slug_filter=args.slug)
    text_to_speech_on_plain_text(slug_filter=args.slug)
    # check_all_pages_for_broken_links()
