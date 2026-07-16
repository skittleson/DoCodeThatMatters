# LLM TTS Script Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Insert a local-Ollama-driven script-generation step in `main.py` that rewrites each blog post's original markdown into a natural spoken-word script, then generate audio from that script instead of the raw plain text.

**Architecture:** A new `generate_tts_scripts(slug_filter=None)` runs *before* `text_to_speech_on_plain_text(slug_filter=None)` in the `__main__` block. It discovers slugs by iterating `docs/` (identical to the audio loop), reads the original `src/content/blog/<slug>.md`, sends it to a local Ollama server (`requests`, `stream=false`), and writes `public/audio/<slug>/index.script.txt`. A new sidecar `script-hashes.json` gates the LLM call. The audio step then prefers `index.script.txt` and falls back to `docs/<slug>/index.tts`. The LLM step never breaks the build: on any Ollama error it uses a cached script if present, else leaves none so audio falls back.

**Tech Stack:** Python 3.10–3.12, `requests`, `python-dotenv`, `pytest`. Ollama HTTP API (`/api/generate`). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-16-tts-script-generation-design.md`

## Global Constraints

- Do NOT change `package.json` build ordering (`astro build && node scripts/generate-epub.mjs && uv run python main.py && node scripts/validate-xml.mjs`).
- No new Python dependencies — only `requests` and `python-dotenv` (both already present).
- Config via `.env`: `OLLAMA_HOST` default `http://localhost:11434`; `OLLAMA_MODEL` default `llama3.1`.
- Ollama call: `POST {OLLAMA_HOST}/api/generate` with `stream=false`.
- Slug discovery: iterate `docs/`, skip entries whose name contains `.`, require `docs/<slug>/index.tts` to exist, derive source `src/content/blog/<slug>.md`; if the `.md` is missing, skip the LLM step for that slug.
- Script output path: `public/audio/<slug>/index.script.txt` (committed to git; survives `astro build`).
- Sidecar hashes: `script-hashes.json` at repo root, `{ slug: sha256_of_source_md }`. Reuse the `_load_audio_hashes` / `_save_audio_hashes` pattern **parameterised on path** — do not duplicate logic.
- Cache gate: skip the LLM call only when the stored hash matches AND `index.script.txt` already exists.
- The system prompt MUST enforce all FIVE rules (URLs never read aloud; point to the blog; describe images verbally from alt text; conversational book-narrator tone with no markdown/code; preserve meaning, don't summarize).
- Failure handling: catch per-post; on Ollama unreachable / model missing / non-200 / request error, use a cached `index.script.txt` if it exists, else log a warning and leave no script. The build must always succeed.
- Audio-source selection in `text_to_speech_on_plain_text`: prefer `public/audio/<slug>/index.script.txt`, fall back to `docs/<slug>/index.tts`. Chunking, Kokoro, mp3/opus, `audio-hashes.json` all unchanged.
- Tests: match the existing `tests/test_main.py` pytest style (class-grouped, `from main import ...`). Verify with `uv run pytest tests/`.
- Out of scope: cloud LLMs / API keys; new web endpoints/UI; RSS/EPUB changes; changing the `.tts` endpoint (stays as fallback); streaming Ollama responses.

---

## File Structure

- Modify `main.py`
  - Generalise the hashes sidecar helpers to take a path (existing `_load_audio_hashes` / `_save_audio_hashes` already accept `path=`; add a `SCRIPT_HASHES_PATH` constant and reuse).
  - Add module-level constants: `SCRIPT_HASHES_PATH`, `AUDIO_DIR`, `TTS_SYSTEM_PROMPT`.
  - Add `_ollama_config()` — read env with dotenv, return `(host, model)`.
  - Add `_build_tts_prompt(markdown)` — returns the system prompt string (the five rules) used for assertions.
  - Add `_request_tts_script(markdown, host, model)` — one `requests.post`, returns the generated text or raises.
  - Add `generate_tts_scripts(slug_filter=None)` — the orchestrator.
  - Add `_select_audio_source(slug)` — returns the path to read for audio (script preferred, `.tts` fallback) or `None`.
  - Modify `text_to_speech_on_plain_text` to use `_select_audio_source`.
  - Modify `__main__` to call `generate_tts_scripts(...)` before `text_to_speech_on_plain_text(...)`.
- Modify `tests/test_main.py` — add test classes for the new functions (mocked `requests.post`, hash gate, source selection, prompt content).

Each task below produces a self-contained, testable deliverable and ends with a commit.

---

### Task 1: Script-hashes sidecar + Ollama config helpers

**Files:**
- Modify: `main.py` (after `AUDIO_HASHES_PATH`/`_save_audio_hashes`, around `main.py:136-165`)
- Test: `tests/test_main.py`

**Interfaces:**
- Consumes: existing `_load_audio_hashes(path=...)`, `_save_audio_hashes(hashes, path=...)`.
- Produces:
  - `SCRIPT_HASHES_PATH = "script-hashes.json"` (str constant)
  - `AUDIO_DIR = "public/audio"` (str constant, module-level — hoisted out of `text_to_speech_on_plain_text`)
  - `_ollama_config() -> tuple[str, str]` returning `(host, model)`, reading `OLLAMA_HOST` (default `http://localhost:11434`, trailing slash stripped) and `OLLAMA_MODEL` (default `llama3.1`) via `python-dotenv` `load_dotenv()` + `os.environ`.

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_main.py — add near the top imports
from main import SCRIPT_HASHES_PATH, AUDIO_DIR, _ollama_config


class TestOllamaConfig:
    def test_defaults_when_env_unset(self, monkeypatch):
        monkeypatch.delenv("OLLAMA_HOST", raising=False)
        monkeypatch.delenv("OLLAMA_MODEL", raising=False)
        host, model = _ollama_config()
        assert host == "http://localhost:11434"
        assert model == "llama3.1"

    def test_reads_env_overrides(self, monkeypatch):
        monkeypatch.setenv("OLLAMA_HOST", "http://ollama:9999/")
        monkeypatch.setenv("OLLAMA_MODEL", "mistral")
        host, model = _ollama_config()
        # trailing slash stripped so f"{host}/api/generate" is well-formed
        assert host == "http://ollama:9999"
        assert model == "mistral"


class TestScriptHashConstants:
    def test_script_hashes_path(self):
        assert SCRIPT_HASHES_PATH == "script-hashes.json"

    def test_audio_dir_constant(self):
        assert AUDIO_DIR == "public/audio"
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `uv run pytest tests/test_main.py::TestOllamaConfig tests/test_main.py::TestScriptHashConstants -v`
Expected: FAIL — `ImportError: cannot import name 'SCRIPT_HASHES_PATH'` (and the other names).

- [ ] **Step 3: Implement the constants and config helper**

In `main.py`, immediately after the `_save_audio_hashes` definition (around line 165), add:

```python
SCRIPT_HASHES_PATH = "script-hashes.json"
AUDIO_DIR = "public/audio"


def _ollama_config():
    """
    Read Ollama connection settings from the environment (.env supported via
    python-dotenv). Returns (host, model). The host has any trailing slash
    stripped so f"{host}/api/generate" is always well-formed.
    """
    from dotenv import load_dotenv

    load_dotenv()
    host = os.environ.get("OLLAMA_HOST", "http://localhost:11434").rstrip("/")
    model = os.environ.get("OLLAMA_MODEL", "llama3.1")
    return host, model
```

Also update `text_to_speech_on_plain_text` to use the module-level `AUDIO_DIR` instead of its local one: delete the local `AUDIO_DIR = "public/audio"` line inside the function (around `main.py:192`). Leave the local `VOICE` line as-is.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `uv run pytest tests/test_main.py::TestOllamaConfig tests/test_main.py::TestScriptHashConstants -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full suite to confirm nothing regressed**

Run: `uv run pytest tests/`
Expected: PASS (all prior tests still green).

- [ ] **Step 6: Commit**

```bash
git add main.py tests/test_main.py
git commit -m "feat: add script-hashes constant and Ollama config helper"
```

---

### Task 2: System prompt with the five rules

**Files:**
- Modify: `main.py` (add near `_ollama_config`)
- Test: `tests/test_main.py`

**Interfaces:**
- Produces:
  - `TTS_SYSTEM_PROMPT` (module-level str) — the fixed system prompt enforcing the five rules.
  - `_build_tts_prompt(markdown: str) -> str` — returns the **user** prompt (the raw markdown, possibly with a short lead-in). The system prompt is a separate constant so tests can assert its content directly.

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_main.py
from main import TTS_SYSTEM_PROMPT, _build_tts_prompt


class TestTtsPrompt:
    def test_system_prompt_covers_five_rules(self):
        p = TTS_SYSTEM_PROMPT.lower()
        # Rule 1: never read URLs aloud
        assert "url" in p
        assert "you can find the link on the blog post" in p
        # Rule 2: point listeners to the blog
        assert "blog" in p
        # Rule 3: describe images verbally from alt text
        assert "image" in p and "alt" in p
        # Rule 4: conversational narrator tone, no markdown/code
        assert "markdown" in p
        assert "code" in p
        # Rule 5: preserve meaning, do not summarize
        assert "summar" in p  # matches "summarize"/"summary"
        assert "preserve" in p

    def test_user_prompt_contains_markdown_body(self):
        md = "## Heading\n\nSome body text with a [link](https://x.com)."
        user = _build_tts_prompt(md)
        assert md in user
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `uv run pytest tests/test_main.py::TestTtsPrompt -v`
Expected: FAIL — `ImportError: cannot import name 'TTS_SYSTEM_PROMPT'`.

- [ ] **Step 3: Implement the prompt**

In `main.py`, after `_ollama_config`, add:

```python
TTS_SYSTEM_PROMPT = (
    "You rewrite a blog post's markdown into a natural, spoken-word script that "
    "a text-to-speech voice will read aloud, as if a person were reading a book "
    "to a friend. Follow these rules exactly:\n"
    "1. Never read a URL aloud. Replace a link with natural phrasing such as "
    '"you can find the link on the blog post", or drop it entirely.\n'
    "2. Where the post references links, images, or extra material, point the "
    "listener to the blog for the full post and details.\n"
    "3. When the post has an image, describe what it depicts verbally from the "
    "alt text and surrounding context, as if describing it to someone who "
    "cannot see it.\n"
    "4. Use a conversational book-narrator tone. Produce no markdown artifacts "
    "(no #, *, backticks, or link/image syntax) and never read code verbatim.\n"
    "5. Preserve the meaning and structure of the post. Rewrite it to be "
    "speakable; do not summarize or shorten it.\n"
    "Output only the spoken script text, with no preamble or commentary."
)


def _build_tts_prompt(markdown):
    """
    Build the user prompt for the Ollama request. Supplies the raw markdown
    (title + body) that the system prompt instructs the model to rewrite.
    """
    return "Rewrite the following blog post markdown into a spoken script:\n\n" + markdown
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `uv run pytest tests/test_main.py::TestTtsPrompt -v`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add main.py tests/test_main.py
git commit -m "feat: add TTS system prompt enforcing five spoken-script rules"
```

---

### Task 3: Ollama request wrapper

**Files:**
- Modify: `main.py` (add after `_build_tts_prompt`)
- Test: `tests/test_main.py`

**Interfaces:**
- Consumes: `TTS_SYSTEM_PROMPT`, `_build_tts_prompt`, `requests`.
- Produces:
  - `_request_tts_script(markdown: str, host: str, model: str) -> str` — issues one `requests.post(f"{host}/api/generate", json={...}, timeout=...)` with `"stream": False`, `"system": TTS_SYSTEM_PROMPT`, `"prompt": _build_tts_prompt(markdown)`. Calls `resp.raise_for_status()`, then returns `resp.json()["response"].strip()`. Raises `requests.RequestException` on connection errors and non-2xx (via `raise_for_status`).

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_main.py
from unittest.mock import MagicMock, patch
import requests
from main import _request_tts_script


class TestRequestTtsScript:
    def test_success_returns_response_text(self):
        fake_resp = MagicMock()
        fake_resp.raise_for_status.return_value = None
        fake_resp.json.return_value = {"response": "  Spoken script here.  "}
        with patch("main.requests.post", return_value=fake_resp) as post:
            out = _request_tts_script("# md body", "http://localhost:11434", "llama3.1")
        assert out == "Spoken script here."
        # Called the /api/generate endpoint with stream disabled and the system prompt
        args, kwargs = post.call_args
        assert args[0] == "http://localhost:11434/api/generate"
        assert kwargs["json"]["stream"] is False
        assert kwargs["json"]["model"] == "llama3.1"
        from main import TTS_SYSTEM_PROMPT
        assert kwargs["json"]["system"] == TTS_SYSTEM_PROMPT
        assert "# md body" in kwargs["json"]["prompt"]

    def test_connection_error_propagates(self):
        with patch(
            "main.requests.post",
            side_effect=requests.ConnectionError("refused"),
        ):
            try:
                _request_tts_script("md", "http://localhost:11434", "llama3.1")
                assert False, "expected ConnectionError"
            except requests.RequestException:
                pass

    def test_non_200_raises(self):
        fake_resp = MagicMock()
        fake_resp.raise_for_status.side_effect = requests.HTTPError("404")
        with patch("main.requests.post", return_value=fake_resp):
            try:
                _request_tts_script("md", "http://localhost:11434", "llama3.1")
                assert False, "expected HTTPError"
            except requests.RequestException:
                pass
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `uv run pytest tests/test_main.py::TestRequestTtsScript -v`
Expected: FAIL — `ImportError: cannot import name '_request_tts_script'`.

- [ ] **Step 3: Implement the request wrapper**

In `main.py`, after `_build_tts_prompt`, add:

```python
def _request_tts_script(markdown, host, model):
    """
    Send the markdown to Ollama's /api/generate (stream disabled) and return the
    generated spoken script. Raises requests.RequestException on connection
    errors or non-2xx responses (via raise_for_status), so callers can catch a
    single exception type for fallback handling.
    """
    resp = requests.post(
        f"{host}/api/generate",
        json={
            "model": model,
            "system": TTS_SYSTEM_PROMPT,
            "prompt": _build_tts_prompt(markdown),
            "stream": False,
        },
        timeout=600,
    )
    resp.raise_for_status()
    return resp.json()["response"].strip()
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `uv run pytest tests/test_main.py::TestRequestTtsScript -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add main.py tests/test_main.py
git commit -m "feat: add Ollama /api/generate request wrapper for TTS scripts"
```

---

### Task 4: `generate_tts_scripts` orchestrator (discovery, hash gate, write, failure handling)

**Files:**
- Modify: `main.py` (add after `_request_tts_script`)
- Test: `tests/test_main.py`

**Interfaces:**
- Consumes: `_load_audio_hashes(path=SCRIPT_HASHES_PATH)`, `_save_audio_hashes(hashes, path=SCRIPT_HASHES_PATH)`, `_request_tts_script`, `_ollama_config`, `AUDIO_DIR`, `SCRIPT_HASHES_PATH`.
- Produces:
  - `generate_tts_scripts(slug_filter=None) -> None`. For each `docs/<slug>` (skip names containing `.`, require `docs/<slug>/index.tts`), derive `src/content/blog/<slug>.md`. If the `.md` is missing, skip. Compute sha256 of the `.md`. Skip the LLM call when the stored hash matches AND `public/audio/<slug>/index.script.txt` exists. Otherwise call `_request_tts_script`; on success write the script to `public/audio/<slug>/index.script.txt` (creating the dir) and record the hash; on `requests.RequestException` (or missing-model/JSON errors) catch per-post — if a cached script exists, keep it (do not update the hash); else log a warning and leave no script. Persist updated hashes via `_save_audio_hashes(..., path=SCRIPT_HASHES_PATH)`. Never raises out of the loop.

- [ ] **Step 1: Write the failing tests**

These tests drive `generate_tts_scripts` against a temp project layout by monkeypatching `os.getcwd`/`os.listdir` — the simplest match to the existing style is to `chdir` into a tmp dir. Add:

```python
# tests/test_main.py
import json
import os
from unittest.mock import patch
import requests
from main import generate_tts_scripts, SCRIPT_HASHES_PATH


def _make_post(tmp_path, slug, md_body="# Title\n\nBody text.", tts_body="Title Body text."):
    """Create docs/<slug>/index.tts and src/content/blog/<slug>.md under tmp_path."""
    (tmp_path / "docs" / slug).mkdir(parents=True, exist_ok=True)
    (tmp_path / "docs" / slug / "index.tts").write_text(tts_body, encoding="utf-8")
    blog = tmp_path / "src" / "content" / "blog"
    blog.mkdir(parents=True, exist_ok=True)
    (blog / f"{slug}.md").write_text(md_body, encoding="utf-8")


class TestGenerateTtsScripts:
    def test_writes_script_on_success(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        _make_post(tmp_path, "postA")
        with patch("main._request_tts_script", return_value="Spoken script."):
            generate_tts_scripts()
        script = tmp_path / "public" / "audio" / "postA" / "index.script.txt"
        assert script.read_text(encoding="utf-8") == "Spoken script."
        # hash recorded
        hashes = json.loads((tmp_path / SCRIPT_HASHES_PATH).read_text())
        assert "postA" in hashes

    def test_skips_when_hash_matches_and_script_exists(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        _make_post(tmp_path, "postA")
        with patch("main._request_tts_script", return_value="First run.") as gen:
            generate_tts_scripts()
            assert gen.call_count == 1
            # second run: unchanged md + existing script => no LLM call
            generate_tts_scripts()
            assert gen.call_count == 1

    def test_regenerates_when_md_changes(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        _make_post(tmp_path, "postA")
        with patch("main._request_tts_script", return_value="v1") as gen:
            generate_tts_scripts()
            (tmp_path / "src" / "content" / "blog" / "postA.md").write_text(
                "# Title\n\nCHANGED body.", encoding="utf-8"
            )
            generate_tts_scripts()
            assert gen.call_count == 2

    def test_missing_md_skips_slug(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        # only docs/<slug>/index.tts, no source md
        (tmp_path / "docs" / "postB").mkdir(parents=True)
        (tmp_path / "docs" / "postB" / "index.tts").write_text("x", encoding="utf-8")
        with patch("main._request_tts_script", return_value="never") as gen:
            generate_tts_scripts()
            assert gen.call_count == 0
        assert not (tmp_path / "public" / "audio" / "postB" / "index.script.txt").exists()

    def test_connection_error_no_cache_leaves_no_script(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        _make_post(tmp_path, "postA")
        with patch(
            "main._request_tts_script",
            side_effect=requests.ConnectionError("refused"),
        ):
            generate_tts_scripts()  # must not raise
        assert not (
            tmp_path / "public" / "audio" / "postA" / "index.script.txt"
        ).exists()

    def test_connection_error_keeps_cached_script(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        _make_post(tmp_path, "postA")
        cached = tmp_path / "public" / "audio" / "postA"
        cached.mkdir(parents=True)
        (cached / "index.script.txt").write_text("cached script", encoding="utf-8")
        with patch(
            "main._request_tts_script",
            side_effect=requests.ConnectionError("refused"),
        ):
            generate_tts_scripts()  # must not raise
        assert (cached / "index.script.txt").read_text() == "cached script"

    def test_slug_filter_limits_processing(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        _make_post(tmp_path, "postA")
        _make_post(tmp_path, "postB")
        with patch("main._request_tts_script", return_value="s") as gen:
            generate_tts_scripts(slug_filter="postA")
            assert gen.call_count == 1
        assert (tmp_path / "public" / "audio" / "postA" / "index.script.txt").exists()
        assert not (tmp_path / "public" / "audio" / "postB" / "index.script.txt").exists()
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `uv run pytest tests/test_main.py::TestGenerateTtsScripts -v`
Expected: FAIL — `ImportError: cannot import name 'generate_tts_scripts'`.

- [ ] **Step 3: Implement `generate_tts_scripts`**

In `main.py`, after `_request_tts_script`, add:

```python
def generate_tts_scripts(slug_filter=None):
    """
    Rewrite each rendered blog post's original markdown into a natural spoken
    script via a local Ollama server, writing public/audio/<slug>/index.script.txt.

    Runs BEFORE text_to_speech_on_plain_text so audio is generated from the
    script rather than the raw .tts plain text. Slug discovery mirrors the audio
    loop: iterate docs/, skip entries containing ".", require docs/<slug>/index.tts,
    and derive the source src/content/blog/<slug>.md. Missing source .md => skip
    (audio then falls back to index.tts).

    Caching: skip the LLM call when script-hashes.json holds the current
    sha256 of the source .md AND index.script.txt already exists.

    Failure handling: any Ollama error is caught per-post. A cached script is
    kept as-is; otherwise a warning is logged and no script is written so audio
    falls back to index.tts. This step never aborts the build.

    Args:
        slug_filter: if set, only process the post with this slug name.
    """
    if not os.path.isdir("docs"):
        return

    host, model = _ollama_config()
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
            script = _request_tts_script(markdown, host, model)
        except (requests.RequestException, ValueError, KeyError) as e:
            if os.path.exists(script_path):
                print(f"  Warning: Ollama error ({e!r}); using cached script for {folder}")
            else:
                print(
                    f"  Warning: Ollama error ({e!r}); no cached script for {folder}, "
                    "audio will fall back to index.tts"
                )
            continue

        os.makedirs(f"{AUDIO_DIR}/{folder}", exist_ok=True)
        with open(script_path, "w", encoding="utf-8") as f:
            f.write(script)
            if not script.endswith("\n"):
                f.write("\n")
        updates[folder] = src_hash
        print(f"  -> {script_path}")

    if updates:
        _save_audio_hashes(updates, SCRIPT_HASHES_PATH)
        print(f"Generated {len(updates)} script(s); updated {SCRIPT_HASHES_PATH}")
    else:
        print("Nothing to generate — all TTS scripts up to date.")
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `uv run pytest tests/test_main.py::TestGenerateTtsScripts -v`
Expected: PASS (7 tests).

- [ ] **Step 5: Run the full suite**

Run: `uv run pytest tests/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add main.py tests/test_main.py
git commit -m "feat: add generate_tts_scripts with hash gate and per-post failure handling"
```

---

### Task 5: Audio source selection (prefer script, fall back to .tts)

**Files:**
- Modify: `main.py` (add `_select_audio_source`; wire into `text_to_speech_on_plain_text` around `main.py:206-212`)
- Test: `tests/test_main.py`

**Interfaces:**
- Consumes: `AUDIO_DIR`.
- Produces:
  - `_select_audio_source(slug: str) -> str | None`. Returns `public/audio/<slug>/index.script.txt` if it exists, else `docs/<slug>/index.tts` if it exists, else `None`.
- Modifies `text_to_speech_on_plain_text`: replace the `txt_path = f"docs/{folder}/index.tts"` read source with `txt_path = _select_audio_source(folder)` and the existence check with `if txt_path is None: continue`.

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_main.py
from main import _select_audio_source


class TestSelectAudioSource:
    def test_prefers_script_over_tts(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        (tmp_path / "docs" / "postA").mkdir(parents=True)
        (tmp_path / "docs" / "postA" / "index.tts").write_text("tts", encoding="utf-8")
        script_dir = tmp_path / "public" / "audio" / "postA"
        script_dir.mkdir(parents=True)
        (script_dir / "index.script.txt").write_text("script", encoding="utf-8")
        assert _select_audio_source("postA") == "public/audio/postA/index.script.txt"

    def test_falls_back_to_tts_when_no_script(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        (tmp_path / "docs" / "postA").mkdir(parents=True)
        (tmp_path / "docs" / "postA" / "index.tts").write_text("tts", encoding="utf-8")
        assert _select_audio_source("postA") == "docs/postA/index.tts"

    def test_returns_none_when_neither_exists(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        assert _select_audio_source("ghost") is None
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `uv run pytest tests/test_main.py::TestSelectAudioSource -v`
Expected: FAIL — `ImportError: cannot import name '_select_audio_source'`.

- [ ] **Step 3: Implement `_select_audio_source` and wire it in**

In `main.py`, after `generate_tts_scripts`, add:

```python
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
```

Then, inside `text_to_speech_on_plain_text`, replace (currently around `main.py:206-212`):

```python
        txt_path = f"docs/{folder}/index.tts"
        src_path = f"src/content/blog/{folder}.md"
        mp3_path = f"{AUDIO_DIR}/{folder}/index.mp3"
        opus_path = f"{AUDIO_DIR}/{folder}/index.opus"

        if not os.path.exists(txt_path):
            continue
```

with:

```python
        txt_path = _select_audio_source(folder)
        src_path = f"src/content/blog/{folder}.md"
        mp3_path = f"{AUDIO_DIR}/{folder}/index.mp3"
        opus_path = f"{AUDIO_DIR}/{folder}/index.opus"

        if txt_path is None:
            continue
```

(Note: `AUDIO_DIR` is now the module-level constant from Task 1; the function no longer defines a local one.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `uv run pytest tests/test_main.py::TestSelectAudioSource -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full suite**

Run: `uv run pytest tests/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add main.py tests/test_main.py
git commit -m "feat: prefer generated script over index.tts for audio source"
```

---

### Task 6: Wire `generate_tts_scripts` into `__main__`

**Files:**
- Modify: `main.py` (`__main__` block, `main.py:318-329`)

**Interfaces:**
- Consumes: `generate_tts_scripts`, `text_to_speech_on_plain_text`.
- Produces: no new public API — `generate_tts_scripts(slug_filter=args.slug)` runs before `text_to_speech_on_plain_text(slug_filter=args.slug)`.

- [ ] **Step 1: Update the `__main__` block**

Replace the body after `args = parser.parse_args()` (currently `main.py:326-329`):

```python
    args = parser.parse_args()

    generate_tts_scripts(slug_filter=args.slug)
    text_to_speech_on_plain_text(slug_filter=args.slug)
    # check_all_pages_for_broken_links()
```

Also update the `--slug` help text to reflect both steps:

```python
    parser.add_argument(
        "--slug",
        metavar="SLUG",
        default=None,
        help="Only generate script + audio for the post with this slug (e.g. battery-station)",
    )
```

- [ ] **Step 2: Confirm the module still imports and CLI parses**

Run: `uv run python -c "import main; print('ok')"`
Expected: prints `ok` (no import error).

Run: `uv run python main.py --help`
Expected: help text shows the updated `--slug` description; exits 0.

- [ ] **Step 3: Run the full suite**

Run: `uv run pytest tests/`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add main.py
git commit -m "feat: run generate_tts_scripts before audio generation in main"
```

---

### Task 7: Documentation + gitignore hygiene for the new sidecar/output

**Files:**
- Modify: `.gitignore` (verify `script-hashes.json` and `public/audio/**/index.script.txt` are NOT ignored — both are committed)
- Modify: `.env.example` if present, else skip (do NOT create secret files)

**Interfaces:** none (config/docs only).

- [ ] **Step 1: Inspect current ignore rules**

Run: `git check-ignore -v script-hashes.json public/audio/battery-station/index.script.txt || echo "not ignored"`
Expected: `not ignored` (both must be committable, mirroring `audio-hashes.json` and the mp3/opus files).

If either IS ignored, add a negation to `.gitignore` (e.g. `!script-hashes.json`) so it can be committed, mirroring how `audio-hashes.json` is handled.

- [ ] **Step 2: Add Ollama env vars to `.env.example` (only if that file already exists)**

Run: `test -f .env.example && echo exists || echo absent`

If `exists`, append (do NOT create it if absent — no new dotfiles):

```
# Local Ollama server used by generate_tts_scripts in main.py
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.1
```

- [ ] **Step 3: Commit (only if a file changed)**

```bash
git add .gitignore .env.example 2>/dev/null; git commit -m "chore: keep script-hashes.json and index.script.txt tracked; document Ollama env" || echo "nothing to commit"
```

---

### Task 8: Manual verification (documented, run by a human with Ollama up)

**Files:** none (verification only).

This task is a checklist for the operator; it is not automated.

- [ ] **Step 1: Confirm Ollama is reachable**

Run: `curl -s http://localhost:11434/api/tags | head -c 200`
Expected: a JSON blob listing installed models (includes `llama3.1` or your configured `OLLAMA_MODEL`).

- [ ] **Step 2: Generate a script + audio for one post**

Run: `uv run python main.py --slug battery-station`
Expected: log shows `Generating TTS script for battery-station...` then `-> public/audio/battery-station/index.script.txt`, followed by audio generation reading that script.

- [ ] **Step 3: Inspect the generated script**

Run: `sed -n '1,40p' public/audio/battery-station/index.script.txt`
Expected: natural spoken prose — no raw URLs, no markdown symbols, images described verbally, pointers to the blog where appropriate.

- [ ] **Step 4: Confirm the hash gate skips on re-run**

Run: `uv run python main.py --slug battery-station`
Expected: `Skipping script for battery-station (source unchanged)`.

- [ ] **Step 5: Confirm graceful fallback when Ollama is down**

Stop Ollama, delete the generated script, then run:
Run: `rm -f public/audio/battery-station/index.script.txt && uv run python main.py --slug battery-station`
Expected: a warning that Ollama is unreachable and audio falls back to `docs/battery-station/index.tts`; the command exits 0 (build not broken).

---

## Self-Review

**Spec coverage:**
- Pipeline placement / `generate_tts_scripts` before audio → Task 6 (wiring) + Task 4 (function).
- Slug discovery identical to audio loop, missing `.md` skip → Task 4.
- Original markdown as LLM input → Task 4 (`src_bytes.decode`), Task 2 (user prompt).
- SHA-256 + `script-hashes.json` cache gate → Task 1 (constant + reused helpers) + Task 4 (gate logic).
- Ollama client (`/api/generate`, `stream=false`, env config) → Task 1 (config) + Task 3 (request).
- Five-rule system prompt → Task 2 (asserted in tests).
- `public/audio/<slug>/index.script.txt` committed output → Task 4 (write) + Task 7 (gitignore hygiene).
- `text_to_speech_on_plain_text` source selection (script preferred, `.tts` fallback) → Task 5.
- Failure handling never breaks build (cached vs no-script) → Task 4 (per-post catch) + Task 8 (manual verify).
- Testing (mocked requests success/conn-error/non-200, hash gate skip/regen, source selection, prompt directives) → Tasks 1–5.
- Manual verification with `--slug battery-station` → Task 8.
- Out-of-scope items (no cloud LLM, no UI, no RSS/EPUB, `.tts` stays fallback, no streaming) → respected throughout; `stream=false` in Task 3.

**Placeholder scan:** No TBD/TODO/"handle edge cases" placeholders; every code step shows full code.

**Type consistency:** `SCRIPT_HASHES_PATH`, `AUDIO_DIR`, `TTS_SYSTEM_PROMPT`, `_ollama_config`, `_build_tts_prompt`, `_request_tts_script`, `generate_tts_scripts`, `_select_audio_source` are named identically across every task that defines or consumes them. `_load_audio_hashes`/`_save_audio_hashes` are called with the existing `path=` parameter, not duplicated.
