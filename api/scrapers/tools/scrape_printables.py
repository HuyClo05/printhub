"""
Printables.com Web Scraper

This module provides functionality to scrape 3D model data from Printables.com.
It extracts model information including titles, images, authors, links, and statistics
(likes and downloads) from search results.

Dependencies:
    - requests: For making HTTP requests to Printables.com
    - beautifulsoup4: For parsing HTML content

Author: Huy Vo
Date: November 15, 2025
"""

import requests
from bs4 import BeautifulSoup
from api.scrapers.id_generator import generate_model_id


def convert_count_to_int(count_str: str) -> int:
    """
    Convert count strings like '1.2k', '500', '63,219' to integers.
    
    Args:
        count_str (str): Count string that may contain 'k' suffix or commas
    
    Returns:
        int: Integer representation (e.g., '1.2k' -> 1200, '63,219' -> 63219)
    """
    if not count_str:
        return 0

    count_str = count_str.strip().lower()
    # Remove commas first
    count_str = count_str.replace(',', '')

    if 'k' in count_str:
        # Remove 'k' and convert to float, then multiply by 1000
        number = float(count_str.replace('k', ''))
        return int(number * 1000)
    else:
        # Just convert to int
        try:
            return int(count_str)
        except ValueError:
            return 0


def parse_printables_article(html:BeautifulSoup) -> list[dict]:
    """
    Parse HTML content and extract 3D model information from article elements.

    This function searches for all article elements with the data-testid="model" attribute
    and extracts relevant information including title, author, image, and statistics.

    Args:
        html (BeautifulSoup): A BeautifulSoup object containing the parsed Printables HTML page

    Returns:
        list[dict]: A list of dictionaries, each containing model information:
            - title (str|None): The model's title
            - image (str|None): URL to the model's preview image
            - model_link (str|None): Full URL to the model's page
            - author (str|None): The author's username
            - author_link (str|None): Full URL to the author's profile
            - like_count (int): Number of likes as integer
            - download_count (int): Number of downloads as integer
    """
    articles = html.find_all("article", {"data-testid": "model"})
    result = []

    for article in articles:
        # --- Extract title and model link ---
        title_tag = article.select_one("h5 a.h")
        title = title_tag.get_text(strip=True) if title_tag else None
        model_link = "https://www.printables.com" + title_tag["href"] if title_tag else None

        # --- Extract author name and link ---
        author_tag = article.select_one("a.username")
        author = author_tag.get_text(strip=True) if author_tag else None
        author_link = "https://www.printables.com" + author_tag["href"] if author_tag else None

        # --- Extract model image ---
        # First try to get the main image
        img_tag = article.select_one("a.card-image img")
        image_url = img_tag["src"] if img_tag else None

        # If image is a placeholder (data:image), try to find the actual image
        if image_url and image_url.startswith("data:image"):
            second_img = article.select_one("picture.image-inside img")
            if second_img:
                image_url = second_img["src"]

        # --- Extract statistics (likes and downloads) from stats-bar ---
        stats_bar = article.select_one("div.stats-bar")

        like_count = 0
        download_count = 0

        like_span = stats_bar.select_one("span[data-testid='like-count']")
        like_count = convert_count_to_int(like_span.get_text(strip=True)) if like_span else 0

        # Get download count (found next to download icon)
        download_icon = stats_bar.select("div.small-icon i.fa-arrow-down-to-line")
        if download_icon:
            download_span = download_icon[0].find_next_sibling("span")
            download_count = convert_count_to_int(download_span.get_text(strip=True))

        # Add extracted model data to results
        result.append({
            "id": generate_model_id(website="Printables", title=title, author=author),
            "title": title,
            "image": image_url,
            "model_link": model_link,
            "author": author,
            "author_link": author_link,
            "like_count": like_count,
            "download_count": download_count,
        })

    return result


def scrape_printables(query:str, pages:int, headers:dict) -> list[dict]:
    """
    Scrape multiple pages of 3D models from Printables.com based on a search query.

    This function iterates through the specified number of pages, making HTTP requests
    to Printables.com's search endpoint and parsing the results using parse_article().

    Args:
        query (str): The search query string (e.g., "dragon", "car", "miniature")
        pages (int): The number of pages to scrape (each page contains ~36 models)
        headers (dict): HTTP headers to include in the request, typically containing
                       User-Agent to avoid being blocked

    Returns:
        list[dict]: A list of all models found across all pages. Each model is a
                   dictionary with the same structure as returned by parse_article()
    """
    results = []

    # Iterate through each page
    for page in range(1, pages + 1):
        url = f"https://www.printables.com/search/models?ctx=models&q={query}&page={page}"

        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.text, "html.parser")
        models = parse_printables_article(soup)
        # Check first model title to detect if we're getting the same page
        if models:
            print(f"  First model on page {page}: {models[0].get('title')}")
        results.extend(models)

    return results
