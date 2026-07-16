"""Unit tests for main.py — is_absolute, _split_text_for_tts.

RSS/sitemap audio enclosures are now emitted natively by the Astro feed
(src/pages/rss.xml.ts); the former Python patchers (_load_rss_audio,
_patch_rss_audio, _patch_sitemap_audio) were removed, so their tests are gone.
"""

from main import (
    _split_text_for_tts,
    is_absolute,
    SCRIPT_HASHES_PATH,
    AUDIO_DIR,
    _ollama_config,
    TTS_SYSTEM_PROMPT,
    _build_tts_prompt,
    _request_tts_script,
    generate_tts_scripts,
)
from unittest.mock import MagicMock, patch
import json
import requests


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
        assert script.read_text(encoding="utf-8").strip() == "Spoken script."
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


# ── is_absolute ───────────────────────────────────────────────────────────────


class TestIsAbsolute:
    def test_https_url_is_absolute(self):
        assert is_absolute("https://example.com/page") is True

    def test_http_url_is_absolute(self):
        assert is_absolute("http://foo.bar/path") is True

    def test_root_relative_is_not_absolute(self):
        assert is_absolute("/relative/path") is False

    def test_relative_path_is_not_absolute(self):
        assert is_absolute("relative/path") is False

    def test_empty_string_is_not_absolute(self):
        assert is_absolute("") is False

    def test_anchor_is_not_absolute(self):
        assert is_absolute("#section") is False


# ── _split_text_for_tts ───────────────────────────────────────────────────────


class TestSplitTextForTts:
    def test_short_text_returned_as_single_chunk(self):
        text = "Hello world. This is a short post."
        chunks = _split_text_for_tts(text, max_chars=300)
        assert len(chunks) == 1
        assert chunks[0] == text

    def test_paragraphs_split_into_separate_chunks(self):
        text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph."
        chunks = _split_text_for_tts(text, max_chars=300)
        assert len(chunks) == 3

    def test_no_chunk_exceeds_max_chars_unless_single_sentence(self):
        # Each sentence is 40 chars; max_chars=80 should pair them
        sentence = "The quick brown fox jumps lazily now.  "
        text = "\n\n".join([sentence * 3] * 4)
        chunks = _split_text_for_tts(text, max_chars=80)
        # Single sentences that exceed max are passed through as-is
        for chunk in chunks:
            assert len(chunk) <= 80 or "." not in chunk[:-1]

    def test_empty_lines_ignored(self):
        text = "\n\nHello world.\n\n\n\nAnother line.\n\n"
        chunks = _split_text_for_tts(text, max_chars=300)
        assert len(chunks) == 2

    def test_long_paragraph_split_on_sentences(self):
        # One long paragraph with multiple sentences, no newlines
        text = "First sentence here. Second sentence here. Third sentence here. Fourth one."
        chunks = _split_text_for_tts(text, max_chars=30)
        assert len(chunks) > 1
        for chunk in chunks:
            assert len(chunk) <= 30 or " " not in chunk

    def test_list_items_each_become_own_chunk(self):
        text = (
            "Intro line.\n"
            "- First list item that is reasonably long.\n"
            "- Second list item that is also reasonably long.\n"
            "- Third list item."
        )
        chunks = _split_text_for_tts(text, max_chars=60)
        assert len(chunks) >= 3

    def test_no_empty_chunks_returned(self):
        text = "  \n\n  \n\nActual content here.\n\n  \n\n"
        chunks = _split_text_for_tts(text, max_chars=300)
        assert all(c.strip() for c in chunks)
