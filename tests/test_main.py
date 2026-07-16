"""Unit tests for main.py — is_absolute, _split_text_for_tts.

RSS/sitemap audio enclosures are now emitted natively by the Astro feed
(src/pages/rss.xml.ts); the former Python patchers (_load_rss_audio,
_patch_rss_audio, _patch_sitemap_audio) were removed, so their tests are gone.
"""

from main import (
    _split_text_for_tts,
    is_absolute,
)


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
