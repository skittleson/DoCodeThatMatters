"""Unit tests for main.py — _load_rss_audio, _patch_rss_audio, _patch_sitemap_audio, _patch_html_audio, is_absolute, _split_text_for_tts."""

import textwrap
from pathlib import Path

import pytest
from bs4 import BeautifulSoup

from main import (
    _load_rss_audio,
    _patch_rss_audio,
    _patch_sitemap_audio,
    _patch_html_audio,
    _split_text_for_tts,
    is_absolute,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

BASE_URL = "https://docodethatmatters.com"


def _rss(items_xml: str) -> str:
    """Wrap item fragments in a minimal valid RSS envelope."""
    return textwrap.dedent(f"""\
        <?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <title>Test Blog</title>
            {items_xml}
          </channel>
        </rss>
    """)


def _item(
    slug: str, *, audio: bool = False, hash_val: str = "abc123", length: str = "99999"
) -> str:
    """Build an RSS <item> with a text enclosure and an optional audio enclosure."""
    audio_tag = (
        f'<enclosure url="{BASE_URL}/{slug}/index.mp3" type="audio/mpeg" '
        f'length="{length}" hash="{hash_val}"/>'
        if audio
        else ""
    )
    return textwrap.dedent(f"""\
        <item>
          <title>{slug} title</title>
          <link>{BASE_URL}/{slug}/</link>
          <enclosure url="{BASE_URL}/{slug}/index.txt" type="text/plain" length="1000"/>
          {audio_tag}
        </item>
    """)


def _write_rss(tmp_path: Path, content: str) -> Path:
    rss_file = tmp_path / "rss.xml"
    rss_file.write_text(content, encoding="utf-8")
    return rss_file


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


# ── _load_rss_audio ───────────────────────────────────────────────────────────


class TestLoadRssAudio:
    def test_returns_empty_when_file_missing(self, tmp_path):
        result = _load_rss_audio(str(tmp_path / "nonexistent.xml"))
        assert result == {}

    def test_returns_empty_when_no_audio_enclosures(self, tmp_path):
        rss_file = _write_rss(tmp_path, _rss(_item("my-post", audio=False)))
        result = _load_rss_audio(str(rss_file))
        assert result == {}

    def test_returns_hash_and_length_for_audio_enclosure(self, tmp_path):
        rss_file = _write_rss(
            tmp_path,
            _rss(_item("my-post", audio=True, hash_val="deadbeef", length="12345")),
        )
        result = _load_rss_audio(str(rss_file))
        assert result == {"my-post": {"hash": "deadbeef", "length": "12345"}}

    def test_only_returns_items_with_audio_enclosure(self, tmp_path):
        items = _item("has-audio", audio=True, hash_val="aaa", length="111")
        items += _item("no-audio", audio=False)
        rss_file = _write_rss(tmp_path, _rss(items))
        result = _load_rss_audio(str(rss_file))
        assert "has-audio" in result
        assert "no-audio" not in result

    def test_returns_multiple_audio_entries(self, tmp_path):
        items = _item("post-one", audio=True, hash_val="hash1", length="100")
        items += _item("post-two", audio=True, hash_val="hash2", length="200")
        rss_file = _write_rss(tmp_path, _rss(items))
        result = _load_rss_audio(str(rss_file))
        assert result["post-one"] == {"hash": "hash1", "length": "100"}
        assert result["post-two"] == {"hash": "hash2", "length": "200"}

    def test_ignores_audio_enclosure_without_hash_attribute(self, tmp_path):
        # Audio enclosure present but no hash attr — should be ignored
        no_hash_item = textwrap.dedent(f"""\
            <item>
              <link>{BASE_URL}/my-post/</link>
              <enclosure url="{BASE_URL}/my-post/index.mp3" type="audio/mpeg" length="5000"/>
            </item>
        """)
        rss_file = _write_rss(tmp_path, _rss(no_hash_item))
        result = _load_rss_audio(str(rss_file))
        assert result == {}

    def test_slug_extracted_from_trailing_slash_url(self, tmp_path):
        rss_file = _write_rss(
            tmp_path,
            _rss(_item("trailing-slash-post", audio=True, hash_val="xyz")),
        )
        result = _load_rss_audio(str(rss_file))
        assert "trailing-slash-post" in result


# ── _patch_rss_audio ──────────────────────────────────────────────────────────


class TestPatchRssAudio:
    def _read_soup(self, path: Path) -> BeautifulSoup:
        return BeautifulSoup(path.read_text(encoding="utf-8"), "xml")

    def test_injects_audio_enclosure_into_correct_item(self, tmp_path):
        rss_file = _write_rss(tmp_path, _rss(_item("my-post", audio=False)))
        _patch_rss_audio(
            {"my-post": {"length": 55000, "hash": "newhash"}},
            str(rss_file),
        )
        soup = self._read_soup(rss_file)
        enc = soup.find("enclosure", attrs={"type": "audio/mpeg"})
        assert enc is not None

    def test_audio_enclosure_has_correct_attributes(self, tmp_path):
        rss_file = _write_rss(tmp_path, _rss(_item("my-post", audio=False)))
        _patch_rss_audio(
            {"my-post": {"length": 55000, "hash": "newhash"}},
            str(rss_file),
        )
        soup = self._read_soup(rss_file)
        enc = soup.find("enclosure", attrs={"type": "audio/mpeg"})
        assert enc["length"] == "55000"
        assert enc["hash"] == "newhash"
        assert enc["type"] == "audio/mpeg"

    def test_audio_url_inferred_from_text_enclosure(self, tmp_path):
        rss_file = _write_rss(tmp_path, _rss(_item("my-post", audio=False)))
        _patch_rss_audio(
            {"my-post": {"length": 1, "hash": "h"}},
            str(rss_file),
        )
        soup = self._read_soup(rss_file)
        enc = soup.find("enclosure", attrs={"type": "audio/mpeg"})
        assert enc["url"] == f"{BASE_URL}/my-post/index.mp3"

    def test_leaves_other_items_untouched(self, tmp_path):
        items = _item("updated-post", audio=False)
        items += _item("unchanged-post", audio=False)
        rss_file = _write_rss(tmp_path, _rss(items))
        _patch_rss_audio(
            {"updated-post": {"length": 1000, "hash": "h"}},
            str(rss_file),
        )
        soup = self._read_soup(rss_file)
        items_soup = soup.find_all("item")
        unchanged = next(
            i
            for i in items_soup
            if i.find("link").get_text(strip=True).rstrip("/").rsplit("/", 1)[-1]
            == "unchanged-post"
        )
        assert unchanged.find("enclosure", attrs={"type": "audio/mpeg"}) is None

    def test_replaces_existing_audio_enclosure(self, tmp_path):
        rss_file = _write_rss(
            tmp_path,
            _rss(_item("my-post", audio=True, hash_val="oldhash", length="11111")),
        )
        _patch_rss_audio(
            {"my-post": {"length": 22222, "hash": "newhash"}},
            str(rss_file),
        )
        soup = self._read_soup(rss_file)
        audio_encs = soup.find_all("enclosure", attrs={"type": "audio/mpeg"})
        assert len(audio_encs) == 1
        assert audio_encs[0]["hash"] == "newhash"
        assert audio_encs[0]["length"] == "22222"

    def test_patches_multiple_slugs_in_one_call(self, tmp_path):
        items = _item("post-a", audio=False)
        items += _item("post-b", audio=False)
        rss_file = _write_rss(tmp_path, _rss(items))
        _patch_rss_audio(
            {
                "post-a": {"length": 111, "hash": "hash-a"},
                "post-b": {"length": 222, "hash": "hash-b"},
            },
            str(rss_file),
        )
        soup = self._read_soup(rss_file)
        all_items = soup.find_all("item")

        def audio_enc_for(slug):
            item = next(
                i
                for i in all_items
                if i.find("link").get_text(strip=True).rstrip("/").rsplit("/", 1)[-1]
                == slug
            )
            return item.find("enclosure", attrs={"type": "audio/mpeg"})

        assert audio_enc_for("post-a")["hash"] == "hash-a"
        assert audio_enc_for("post-b")["hash"] == "hash-b"

    def test_writes_changes_back_to_file(self, tmp_path):
        rss_file = _write_rss(tmp_path, _rss(_item("my-post", audio=False)))
        _patch_rss_audio(
            {"my-post": {"length": 9999, "hash": "writtenback"}},
            str(rss_file),
        )
        # Read raw file content — not via soup — to confirm disk write
        raw = rss_file.read_text(encoding="utf-8")
        assert "writtenback" in raw
        assert "9999" in raw

    def test_text_enclosure_is_preserved(self, tmp_path):
        rss_file = _write_rss(tmp_path, _rss(_item("my-post", audio=False)))
        _patch_rss_audio(
            {"my-post": {"length": 1, "hash": "h"}},
            str(rss_file),
        )
        soup = self._read_soup(rss_file)
        txt_enc = soup.find("enclosure", attrs={"type": "text/plain"})
        assert txt_enc is not None
        assert "index.txt" in txt_enc["url"]


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


# ── _patch_sitemap_audio ──────────────────────────────────────────────────────

SITEMAP_BASE_URL = "https://docodethatmatters.com"


def _sitemap(extra_urls: str = "") -> str:
    """Minimal sitemap with one existing post URL."""
    return textwrap.dedent(f"""\
        <?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url>
            <loc>{SITEMAP_BASE_URL}/existing-post/</loc>
            <changefreq>weekly</changefreq>
            <priority>0.9</priority>
          </url>
          {extra_urls}
        </urlset>
    """)


def _write_sitemap(tmp_path: Path, content: str) -> Path:
    f = tmp_path / "sitemap-0.xml"
    f.write_text(content, encoding="utf-8")
    return f


class TestPatchSitemapAudio:
    def test_injects_mp3_url_for_slug(self, tmp_path):
        sitemap_file = _write_sitemap(tmp_path, _sitemap())
        _patch_sitemap_audio({"my-post": {"length": 1, "hash": "h"}}, str(sitemap_file))
        raw = sitemap_file.read_text(encoding="utf-8")
        assert f"{SITEMAP_BASE_URL}/my-post/index.mp3" in raw

    def test_injected_entry_has_changefreq_and_priority(self, tmp_path):
        sitemap_file = _write_sitemap(tmp_path, _sitemap())
        _patch_sitemap_audio({"my-post": {"length": 1, "hash": "h"}}, str(sitemap_file))
        soup = BeautifulSoup(sitemap_file.read_text(encoding="utf-8"), "xml")
        mp3_url = f"{SITEMAP_BASE_URL}/my-post/index.mp3"
        url_tag = next(
            u
            for u in soup.find_all("url")
            if u.find("loc").get_text(strip=True) == mp3_url
        )
        assert url_tag.find("changefreq").get_text(strip=True) == "monthly"
        assert url_tag.find("priority").get_text(strip=True) == "0.5"

    def test_does_not_duplicate_existing_mp3_entry(self, tmp_path):
        existing = textwrap.dedent(f"""\
            <url>
              <loc>{SITEMAP_BASE_URL}/my-post/index.mp3</loc>
              <changefreq>monthly</changefreq>
              <priority>0.5</priority>
            </url>
        """)
        sitemap_file = _write_sitemap(tmp_path, _sitemap(existing))
        _patch_sitemap_audio({"my-post": {"length": 1, "hash": "h"}}, str(sitemap_file))
        soup = BeautifulSoup(sitemap_file.read_text(encoding="utf-8"), "xml")
        mp3_locs = [
            u.find("loc").get_text(strip=True)
            for u in soup.find_all("url")
            if "index.mp3" in u.find("loc").get_text(strip=True)
        ]
        assert mp3_locs.count(f"{SITEMAP_BASE_URL}/my-post/index.mp3") == 1

    def test_leaves_existing_post_urls_untouched(self, tmp_path):
        sitemap_file = _write_sitemap(tmp_path, _sitemap())
        _patch_sitemap_audio({"my-post": {"length": 1, "hash": "h"}}, str(sitemap_file))
        soup = BeautifulSoup(sitemap_file.read_text(encoding="utf-8"), "xml")
        locs = [u.find("loc").get_text(strip=True) for u in soup.find_all("url")]
        assert f"{SITEMAP_BASE_URL}/existing-post/" in locs

    def test_injects_multiple_slugs(self, tmp_path):
        sitemap_file = _write_sitemap(tmp_path, _sitemap())
        _patch_sitemap_audio(
            {
                "post-a": {"length": 1, "hash": "ha"},
                "post-b": {"length": 2, "hash": "hb"},
            },
            str(sitemap_file),
        )
        raw = sitemap_file.read_text(encoding="utf-8")
        assert f"{SITEMAP_BASE_URL}/post-a/index.mp3" in raw
        assert f"{SITEMAP_BASE_URL}/post-b/index.mp3" in raw

    def test_no_op_when_sitemap_missing(self, tmp_path):
        # Should not raise — just return silently
        _patch_sitemap_audio(
            {"my-post": {"length": 1, "hash": "h"}}, str(tmp_path / "missing.xml")
        )


# ── _patch_html_audio ─────────────────────────────────────────────────────────


def _html(slug: str, *, existing_player: bool = False) -> str:
    """Minimal post HTML with an <article> element."""
    player = (
        '<div class="audio-player mt-6"><audio src="/old/index.mp3"></audio></div>'
        if existing_player
        else ""
    )
    return textwrap.dedent(f"""\
        <!DOCTYPE html>
        <html>
          <body>
            <article class="article-body">
              <p>Post content here.</p>
              {player}
            </article>
          </body>
        </html>
    """)


def _write_html(tmp_path: Path, slug: str, content: str) -> Path:
    post_dir = tmp_path / slug
    post_dir.mkdir()
    f = post_dir / "index.html"
    f.write_text(content, encoding="utf-8")
    return tmp_path


class TestPatchHtmlAudio:
    def test_injects_audio_player_into_article(self, tmp_path):
        _write_html(tmp_path, "my-post", _html("my-post"))
        _patch_html_audio({"my-post": {"length": 1, "hash": "h"}}, str(tmp_path))
        soup = BeautifulSoup(
            (tmp_path / "my-post" / "index.html").read_text(), "html.parser"
        )
        assert soup.find("audio") is not None

    def test_audio_src_points_to_slug_mp3(self, tmp_path):
        _write_html(tmp_path, "my-post", _html("my-post"))
        _patch_html_audio({"my-post": {"length": 1, "hash": "h"}}, str(tmp_path))
        soup = BeautifulSoup(
            (tmp_path / "my-post" / "index.html").read_text(), "html.parser"
        )
        assert soup.find("audio")["src"] == "/my-post/index.mp3"

    def test_audio_has_controls_and_preload(self, tmp_path):
        _write_html(tmp_path, "my-post", _html("my-post"))
        _patch_html_audio({"my-post": {"length": 1, "hash": "h"}}, str(tmp_path))
        soup = BeautifulSoup(
            (tmp_path / "my-post" / "index.html").read_text(), "html.parser"
        )
        audio = soup.find("audio")
        assert audio.has_attr("controls")
        assert audio.get("preload") == "metadata"

    def test_download_link_present_and_correct(self, tmp_path):
        _write_html(tmp_path, "my-post", _html("my-post"))
        _patch_html_audio({"my-post": {"length": 1, "hash": "h"}}, str(tmp_path))
        soup = BeautifulSoup(
            (tmp_path / "my-post" / "index.html").read_text(), "html.parser"
        )
        link = soup.find("a", href="/my-post/index.mp3")
        assert link is not None
        assert link.has_attr("download")

    def test_player_is_inside_article(self, tmp_path):
        _write_html(tmp_path, "my-post", _html("my-post"))
        _patch_html_audio({"my-post": {"length": 1, "hash": "h"}}, str(tmp_path))
        soup = BeautifulSoup(
            (tmp_path / "my-post" / "index.html").read_text(), "html.parser"
        )
        article = soup.find("article")
        assert article.find("audio") is not None

    def test_replaces_existing_player_not_duplicates(self, tmp_path):
        _write_html(tmp_path, "my-post", _html("my-post", existing_player=True))
        _patch_html_audio({"my-post": {"length": 1, "hash": "h"}}, str(tmp_path))
        soup = BeautifulSoup(
            (tmp_path / "my-post" / "index.html").read_text(), "html.parser"
        )
        assert len(soup.find_all("audio")) == 1
        assert soup.find("audio")["src"] == "/my-post/index.mp3"

    def test_leaves_post_without_html_file_untouched(self, tmp_path):
        # slug in updates but no html file — should not raise
        _patch_html_audio({"ghost-post": {"length": 1, "hash": "h"}}, str(tmp_path))

    def test_original_article_content_preserved(self, tmp_path):
        _write_html(tmp_path, "my-post", _html("my-post"))
        _patch_html_audio({"my-post": {"length": 1, "hash": "h"}}, str(tmp_path))
        raw = (tmp_path / "my-post" / "index.html").read_text()
        assert "Post content here." in raw
