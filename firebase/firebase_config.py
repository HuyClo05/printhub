"""
Firebase Firestore Configuration

This module initializes and configures the Firebase Admin SDK connection to Firestore.
It handles authentication using a service account key and provides a global database
client for accessing the Firestore database.

The module automatically locates the serviceAccountKey.json file in the same directory
and prevents duplicate initialization when imported multiple times.

Dependencies:
    - firebase_admin: Firebase Admin SDK for Python
    - credentials: Firebase authentication credentials
    - firestore: Firestore database client

Environment:
    - serviceAccountKey.json: Must be present in the same directory as this file

Exports:
    models_db: Firestore client instance for database operations

Author: PrintHub Team
Date: November 2025
"""
import os
import firebase_admin
from firebase_admin import credentials, firestore

# Get the directory where this file is located
current_dir = os.path.dirname(os.path.abspath(__file__))
# Build path to serviceAccountKey.json in the same directory
key_path = os.path.join(current_dir, "serviceAccountKey.json")


# Only initialize if not already initialized
try:
    firebase_admin.get_app()
except ValueError:
    cred = credentials.Certificate(key_path)
    firebase_admin.initialize_app(cred)

# Connect to the default Firestore database
# If you have a named database called "models", use: firestore.client(database="models")
# Otherwise, just use the default database
db = firestore.client()
