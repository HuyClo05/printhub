"""
Flask Application Entry Point

This is the main entry point for running the PrintHub Flask API.
Run this file directly to start the development server.

Usage:
    python run.py
"""

import sys
import os

# Add the project root directory to Python path
project_root = os.path.dirname(os.path.abspath(__file__))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Now we can import from api package
from api.scrapers import app

if __name__ == "__main__":
    print("Starting PrintHub API Server...")
    print(f"Project root: {project_root}")
    app.run(debug=True, host="0.0.0.0", port=5000)
