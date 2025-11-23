"""
PrintHub Scraper API

This module provides a Flask-based REST API for scraping 3D model data from various
websites and storing the results in Firebase Firestore. It supports multiple 3D model
repositories and automatically handles data deduplication using unique model IDs.

The API exposes a single endpoint that accepts a website name, search query, and number
of pages to scrape, returning JSON responses with operation status and statistics.

Dependencies:
    - flask: Web framework for the REST API
    - api.scrapers.tools.scrape_printables: Printables.com scraper implementation
    - api.firebaseData: Firebase Firestore database client

Supported Websites:
    - Printables: Printables.com 3D model repository

API Endpoints:
    GET /scrape/<website>/<query>/<pages>
        Scrapes models from the specified website and saves to Firestore
        
        Parameters:
            website (str): Website name (e.g., "Printables")
            query (str): Search query string
            pages (int): Number of pages to scrape
            
        Returns:
            JSON response with success status, count of saved models, and skipped count

Example Usage:
    # Start the Flask server
    $ python scraper_api.py
    
    # Make a request to scrape 2 pages of "dragon" models from Printables
    $ curl http://localhost:5000/scrape/Printables/dragon/2
    
    Response:
    {
        "success": true,
        "count": 72,
        "skipped": 0
    }

Author: PrintHub Team
Date: November 2025
"""

from flask import Flask, jsonify
from api.scrapers.tools.scrape_printables import scrape_printables
from api.firebase_data import models_db


class ScraperAPI:
    """
    Main scraper API class that coordinates web scraping operations and database storage.
    
    This class manages a collection of website-specific scrapers and provides a unified
    interface for scraping 3D models from supported websites. It handles HTTP headers,
    error management, and automatic storage in Firebase Firestore with deduplication.
    
    Attributes:
        headers (dict): HTTP headers sent with scraping requests to avoid blocking
        scrapers (dict): Mapping of website names to their scraper functions
        
    Methods:
        scrape: Scrapes models from a website and saves to Firebase
    """

    def __init__(self):
        """
        Initialize the ScraperAPI with default headers and available scrapers.
        
        Sets up a User-Agent header to mimic browser requests and registers all
        available website scrapers in the scrapers dictionary.
        """
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        }
        self.scrapers = {
            "Printables": scrape_printables
        }

    def scrape(self, website: str, query: str, pages: int) -> jsonify:
        """
        Scrape 3D models from a specified website and save to Firebase Firestore.
        
        This method validates the website, executes the appropriate scraper, and stores
        all scraped models in Firestore. Each model is saved with a unique ID to prevent
        duplicates. Models without IDs are skipped and logged.
        
        Args:
            website (str): Name of the website to scrape (case-insensitive)
                        Must be one of the supported websites (e.g., "Printables")
            query (str): Search query string for finding models (e.g., "dragon", "car")
            pages (int): Number of result pages to scrape (typically 36 models per page)
        
        Returns:
            tuple: JSON response and HTTP status code
                - Success (200): {"success": True, "count": int, "skipped": int}
                - Invalid website (400): {"success": False, "error": "Invalid website"}
                - Error (500): {"success": False, "error": str(error_message)}
        
        Raises:
            Exception: Catches all exceptions during scraping and returns as JSON error
        
        Side Effects:
            - Prints progress messages to console
            - Saves model data to Firestore collection named after the website
            - Uses document IDs from model data for deduplication
        
        Example:
            >>> scraper = ScraperAPI()
            >>> result = scraper.scrape("Printables", "dragon", 2)
            >>> print(result)
            ({"success": True, "count": 72, "skipped": 0}, 200)
        """
        print(f"Extracting from {website} with query: {query} in {pages} pages")

        try:
            # Get the appropriate scraper for the website
            scraper = self.scrapers.get(website.capitalize())
            if not scraper:
                return jsonify({"success": False, "error": "Invalid website"}), 400

            # Execute the scraper to get model data
            results = scraper(query=query, pages=pages, headers=self.headers)
            saved_count = 0
            skipped_count = 0

            # Save each model to Firestore
            for item in results:
                model_id = item.get('id')
                if not model_id:
                    print(f"Warning: Item missing ID, skipping: {item.get('title', 'Unknown')}")
                    skipped_count += 1
                    continue
                # Use .set() to overwrite existing documents with same ID (deduplication)
                models_db.collection(f"{website.lower()}").document(model_id).set(item)
                saved_count += 1

            print(f"Saved {saved_count} models from {website} to Firebase")
            return jsonify({"success": True, "count": saved_count, "skipped": skipped_count})

        except (ValueError, KeyError, TypeError, ConnectionError, TimeoutError) as e:
            print(f"Error scraping {website}: {str(e)}")
            return jsonify({"success": False, "error": str(e)}), 500


# Flask application instance
app = Flask(__name__)

# Global ScraperAPI instance for handling requests
scraper_api = ScraperAPI()


@app.route("/scrape/<string:website>/<string:query>/<int:pages>")
def scrape_endpoint(website, query, pages):
    """
    Flask route endpoint for the scraping API.
    
    This endpoint receives HTTP GET requests with URL parameters and delegates
    the scraping operation to the ScraperAPI instance.
    
    URL Parameters:
        website (str): Name of the website to scrape (e.g., "Printables")
        query (str): Search query string (URL-encoded)
        pages (int): Number of pages to scrape (must be positive integer)
    
    Returns:
        JSON response: Result from ScraperAPI.scrape() method
    
    Example Requests:
        GET /scrape/Printables/dragon/2
        GET /scrape/Printables/sci-fi/5
        GET /scrape/Printables/miniature/1
    
    Example Response:
        {
            "success": true,
            "count": 72,
            "skipped": 0
        }
    """
    return scraper_api.scrape(website, query, pages)
