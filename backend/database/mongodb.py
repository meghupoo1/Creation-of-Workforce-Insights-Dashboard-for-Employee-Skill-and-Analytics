import os
import logging
from datetime import date, datetime
from enum import Enum

logger = logging.getLogger(__name__)

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DATABASE = os.getenv("MONGODB_DATABASE", "workforce")

try:
    from pymongo import MongoClient
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=2000)
    database = client[MONGODB_DATABASE]
    has_pymongo = True
except Exception:
    has_pymongo = False
    client = None
    database = None

def check_mongodb_connection():
    if not has_pymongo or client is None:
        return {"status": "not_configured", "database": MONGODB_DATABASE, "message": "MongoDB driver not active"}
    try:
        client.admin.command("ping")
        return {"status": "connected", "database": MONGODB_DATABASE}
    except Exception as e:
        return {"status": "disconnected", "database": MONGODB_DATABASE, "error": str(e)}


def _mongo_value(value):
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, dict):
        return {key: _mongo_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_mongo_value(item) for item in value]
    return value


def sync_sql_changes(changes):
    if not has_pymongo or database is None:
        return

    for action, collection_name, key, document in changes:
        try:
            collection = database[collection_name]
            mongo_key = _mongo_value(key)
            if action == "delete":
                collection.delete_one(mongo_key)
            else:
                collection.replace_one(mongo_key, _mongo_value(document), upsert=True)
        except Exception:
            logger.exception("Failed to mirror committed SQL change to MongoDB collection %s", collection_name)