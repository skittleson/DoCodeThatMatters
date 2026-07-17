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
    _llm_config,
    TTS_SYSTEM_PROMPT,
    _build_tts_prompt,
    _request_tts_script,
    generate_tts_scripts,
    _select_audio_source,
    _mirror_to_docs_audio,
    DOCS_AUDIO_DIR,
)


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


class TestMirrorToDocsAudio:
    def test_mirrors_when_docs_audio_exists(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        # public source copy
        pub = tmp_path / "public" / "audio" / "postA"
        pub.mkdir(parents=True)
        (pub / "index.script.txt").write_text("hello script", encoding="utf-8")
        # docs/audio tree present => a build has populated docs/
        (tmp_path / "docs" / "audio").mkdir(parents=True)

        assert _mirror_to_docs_audio("postA", "index.script.txt") is True
        mirrored = tmp_path / "docs" / "audio" / "postA" / "index.script.txt"
        assert mirrored.read_text(encoding="utf-8") == "hello script"

    def test_noop_when_docs_audio_absent(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        pub = tmp_path / "public" / "audio" / "postA"
        pub.mkdir(parents=True)
        (pub / "index.script.txt").write_text("hello", encoding="utf-8")
        # no docs/audio tree at all
        assert _mirror_to_docs_audio("postA", "index.script.txt") is False
        assert not (tmp_path / "docs" / "audio").exists()

    def test_noop_when_source_missing(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        (tmp_path / "docs" / "audio").mkdir(parents=True)
        # no public source file to mirror
        assert _mirror_to_docs_audio("postA", "index.script.txt") is False

    def test_generate_scripts_mirrors_into_docs_audio(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        _make_post(tmp_path, "postA")
        # docs/audio tree present so mirroring activates
        (tmp_path / "docs" / "audio").mkdir(parents=True)
        with patch("main._request_tts_script", return_value="Spoken script."):
            generate_tts_scripts()
        pub = tmp_path / "public" / "audio" / "postA" / "index.script.txt"
        docs = tmp_path / "docs" / "audio" / "postA" / "index.script.txt"
        assert pub.read_text(encoding="utf-8") == docs.read_text(encoding="utf-8")


class TestDocsAudioConstant:
    def test_docs_audio_dir_constant(self):
        assert DOCS_AUDIO_DIR == "docs/audio"


class TestRequestTtsScript:
    def _resp(self, content):
        fake_resp = MagicMock()
        fake_resp.raise_for_status.return_value = None
        fake_resp.json.return_value = {
            "choices": [{"message": {"content": content}}]
        }
        return fake_resp

    def test_success_returns_message_content(self):
        with patch(
            "main.requests.post", return_value=self._resp("  Spoken script here.  ")
        ) as post:
            out = _request_tts_script(
                "# md body", "http://192.168.4.104:8080/v1", "Qwopus3.6-27B"
            )
        assert out == "Spoken script here."
        # Hits the OpenAI-compatible chat-completions endpoint, stream disabled,
        # with the system prompt and the markdown in the user message.
        args, kwargs = post.call_args
        assert args[0] == "http://192.168.4.104:8080/v1/chat/completions"
        assert kwargs["json"]["stream"] is False
        assert kwargs["json"]["model"] == "Qwopus3.6-27B"
        msgs = kwargs["json"]["messages"]
        assert msgs[0]["role"] == "system"
        assert msgs[0]["content"] == TTS_SYSTEM_PROMPT
        assert msgs[1]["role"] == "user"
        assert "# md body" in msgs[1]["content"]
        # Sampling + a generous output budget so full posts aren't truncated.
        assert kwargs["json"]["temperature"] == 0.9
        assert kwargs["json"]["top_p"] == 0.95
        assert kwargs["json"]["max_tokens"] >= 2048

    def test_authorization_header_present_with_key(self):
        with patch("main.requests.post", return_value=self._resp("ok")) as post:
            _request_tts_script(
                "md", "http://host/v1", "m", api_key="secret-key"
            )
        _, kwargs = post.call_args
        assert kwargs["headers"]["Authorization"] == "Bearer secret-key"

    def test_authorization_header_absent_without_key(self):
        with patch("main.requests.post", return_value=self._resp("ok")) as post:
            _request_tts_script("md", "http://host/v1", "m", api_key="")
        _, kwargs = post.call_args
        assert "Authorization" not in kwargs["headers"]

    def test_strips_think_block_prefix(self):
        content = "<think>internal reasoning here</think>\nActual spoken script."
        with patch("main.requests.post", return_value=self._resp(content)):
            out = _request_tts_script("md", "http://host/v1", "m")
        assert out == "Actual spoken script."
        assert "<think>" not in out and "</think>" not in out

    def test_connection_error_propagates(self):
        with patch(
            "main.requests.post",
            side_effect=requests.ConnectionError("refused"),
        ):
            try:
                _request_tts_script("md", "http://host/v1", "m")
                assert False, "expected ConnectionError"
            except requests.RequestException:
                pass

    def test_non_200_raises(self):
        fake_resp = MagicMock()
        fake_resp.raise_for_status.side_effect = requests.HTTPError("404")
        with patch("main.requests.post", return_value=fake_resp):
            try:
                _request_tts_script("md", "http://host/v1", "m")
                assert False, "expected HTTPError"
            except requests.RequestException:
                pass


class TestTtsPrompt:
    def test_system_prompt_covers_five_rules(self):
        p = TTS_SYSTEM_PROMPT.lower()
        # Rule 1: never read URLs aloud
        assert "url" in p
        assert "you can find the link on the blog post" in p
        # Rule 2: blog deferral scoped to unspeakable content only (URLs/code/images),
        # never a license to drop prose or lists
        assert "blog" in p
        assert "not a license to omit" in p
        # Rule 5: lists must be read out in full, item by item
        assert "read out in full" in p
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


class TestLlmConfig:
    def test_defaults_when_env_unset(self, monkeypatch):
        # Patch load_dotenv to a no-op so a real repo-root .env cannot leak in;
        # this isolates the pure env-var -> default resolution logic.
        monkeypatch.setattr("dotenv.load_dotenv", lambda *a, **k: False)
        monkeypatch.delenv("LLM_BASE_URL", raising=False)
        monkeypatch.delenv("LLM_MODEL", raising=False)
        monkeypatch.delenv("LLM_API_KEY", raising=False)
        base_url, model, api_key = _llm_config()
        assert base_url == "http://192.168.4.104:8080/v1"
        assert model == "Qwopus3.6-27B"
        assert api_key == ""

    def test_reads_env_overrides(self, monkeypatch):
        monkeypatch.setattr("dotenv.load_dotenv", lambda *a, **k: False)
        monkeypatch.setenv("LLM_BASE_URL", "http://gpu:9999/v1/")
        monkeypatch.setenv("LLM_MODEL", "some-model")
        monkeypatch.setenv("LLM_API_KEY", "abc123")
        base_url, model, api_key = _llm_config()
        # trailing slash stripped so f"{base_url}/chat/completions" is well-formed
        assert base_url == "http://gpu:9999/v1"
        assert model == "some-model"
        assert api_key == "abc123"


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
