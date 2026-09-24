import os

from pymongo import MongoClient


MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DATABASE = os.getenv("MONGODB_DATABASE", "workforce")

client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=2000)
database = client[MONGODB_DATABASE]


def check_mongodb_connection():
    client.admin.command("ping")
    return {"status": "connected", "database": MONGODB_DATABASE}