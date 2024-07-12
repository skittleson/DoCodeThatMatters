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
                for a in soup.find_all('a'):
                    a.replace_with(f"{a.get_text()}({a['href']}) ")
                with open(index_text_root,'w', encoding='utf-8') as f:
                    plain_text = soup.get_text()
                    plain_text = re.sub(r'\n{3,}', '\n', plain_text)
                    f.write(plain_text)

def update_rss_feed_text_version_lengths():

    import xml.etree.ElementTree as ET
    # Save the updated RSS feed to a file
    updated_rss_feed = ""
    ET.register_namespace("atom", "http://www.w3.org/2005/Atom")
    tree = ET.parse('docs/rss.xml')
    root = tree.getroot()
    # with open('docs/rss.xml', 'r', encoding='utf-8') as f:
        # Parse the RSS feed
        # root = ET.fromstring(f.read())
        # root.attrib['xmlns:atom'] = 'http://www.w3.org/2005/Atom' 
        # namespace = {'atom': 'http://www.w3.org/2005/Atom'}

        # Iterate through each item in the RSS feed
    for item in root.findall('.//item'):
        enclosure = item.find('enclosure')
        if enclosure is not None:
            enclosure_url = enclosure.attrib['url']
            
            # Fetch the content from the enclosure URL
            response = requests.get(enclosure_url)
            content = response.text
            
            # Determine the length of the text
            text_length = len(content)
            
            # Create a new element for the text length
            enclosure.attrib['length'] = str(text_length)

    # Write the updated RSS feed back to a string
    updated_rss_feed = ET.tostring(root, encoding='utf-8').decode("utf-8")

    with open('docs/rss.xml', 'w', encoding='utf-8') as f:
        f.write(f'<?xml version="1.0" encoding="utf-8" ?>\n{updated_rss_feed}')

    


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
    update_rss_feed_text_version_lengths()
    # check_all_pages_for_broken_links()