"""Tools for content"""

import os
import requests
from bs4 import BeautifulSoup



def is_absolute(url):
    return bool(requests.utils.urlparse(url).netloc)


def check_links(file_path):
    import mechanicalsoup
    with open(file_path, 'r', encoding='utf-8') as file:
        content = file.read()

    soup = BeautifulSoup(content, 'html.parser')
    links = soup.find_all('a', href=True)

    browser = mechanicalsoup.StatefulBrowser()
    broken_links = []
    for link in links:
        url = link.attrs['href']
        if is_absolute(url) and 'https://amzn.to' not in url and 'https://www.amazon' not in url:
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
    with open('reports/broken_links.csv', 'w', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        for folder in os.listdir('docs'):
            index_html_root = f'docs/{folder}/index.html'
            if '.' not in folder and os.path.exists(index_html_root):
                broken_links = check_links(index_html_root)
                for broken_link in broken_links:
                    writer.writerow([folder, broken_link])


def text_to_speech_on_plain_text():
    """Create audio files for all blog posts using googles tts"""

    from gtts import gTTS
    language = 'en'
    for folder in os.listdir('docs'):
        index_txt = f'docs/{folder}/index.txt'
        index_mp3 = f'docs/{folder}/index.mp3'
        if '.' not in folder and os.path.exists(index_txt):
            print(f'creating audio file for {folder}')
            with open(index_txt, 'r', encoding='utf-8') as r:
                googleTTSService = gTTS(text=r.read(), lang=language)
                googleTTSService.save(index_mp3)

from pybars import Compiler
import os
import shutil
from rich.console import Console
from dotenv import dotenv_values
import datetime

console = Console()
target_dir = "docs"
source_dir = "src"


def get_partials(compiler):
    partial_files = [file for file in os.listdir(os.path.join(source_dir, "partials"))]
    partials = {}
    for partial_file in partial_files:
        with open(
            os.path.join(source_dir, "partials", partial_file), "r", encoding="utf-8"
        ) as file:
            partials[partial_file.replace(".hbs", "")] = compiler.compile(file.read())
    return partials


if __name__ == '__main__':
    # text_to_speech_on_plain_text()
    # check_all_pages_for_broken_links()
    pass
