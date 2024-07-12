import os
from bs4 import BeautifulSoup
import re
import requests

def convert_html_to_text():
    """
    Provides an alternative text based version of a blog post
    """
  
    for folder in os.listdir('docs'):
        index_html_root = f'docs/{folder}/index.html'
        index_text_root = index_html_root.replace('.html','.txt')
        if '.' not in folder and os.path.exists(index_html_root):
            with open(index_html_root,'r', encoding='utf-8') as r:
                html_content = r.read()           
                soup = BeautifulSoup(html_content, 'html.parser')
                with open(index_text_root,'w', encoding='utf-8') as f:
                    plain_text = soup.get_text()
                    plain_text = re.sub(r'\n{3,}', '\n', plain_text)
                    f.write(plain_text)

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
    with open('reports/broken_links.csv', 'w') as csvfile:
        writer = csv.writer(csvfile)
        for folder in os.listdir('docs'):
            index_html_root = f'docs/{folder}/index.html'
            if '.' not in folder and os.path.exists(index_html_root):
                broken_links = check_links(index_html_root)      
                for broken_link in broken_links:
                    writer.writerow([folder, broken_link])





if __name__ == '__main__':
    convert_html_to_text()
    check_all_pages_for_broken_links()