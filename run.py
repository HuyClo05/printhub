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
