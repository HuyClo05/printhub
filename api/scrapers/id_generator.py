"""
ID Generator Module

This module provides functionality to generate deterministic unique identifiers 
for 3D models scraped from various websites. Each ID is generated based on the 
website, model title, and author to ensure consistency across scrapes.

Functions:
    generate_model_id: Creates a deterministic unique identifier for a 3D model

Dependencies:
    - hashlib: For generating deterministic hashes

Author: Huy Vo
Date: November 16, 2025
"""

import hashlib

def generate_model_id(website: str, title: str, author: str) -> str:
    """
    Generate a deterministic unique identifier for a 3D model.
    
    This function creates a consistent ID by hashing the combination of website,
    title, and author. The same inputs will always produce the same ID, allowing
    for deduplication and consistent identification across multiple scrapes.
    
    Args:
        website (str): The name of the website/source (e.g., 'Printables', 'Thingiverse')
        title (str): The model's title
        author (str): The author's username
    
    Returns:
        str: A deterministic identifier string in the format: website_hash
            Example: 'Printables_3f5a9b2c8d4e4f7a9c1b6e8a2d5f4c3b'
    """
    
    website_formatted = website.capitalize()
    unique_string = f"{website_formatted}_{title}_{author}".lower()
    hash_object = hashlib.md5(unique_string.encode())
    hash_hex = hash_object.hexdigest()
    
    return f"{website_formatted}_{hash_hex}"