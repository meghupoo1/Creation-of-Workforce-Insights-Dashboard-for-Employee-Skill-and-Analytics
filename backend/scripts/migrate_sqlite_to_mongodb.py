import os
import sqlite3
from pathlib import Path

from pymongo import MongoClient


BASE_DIR = Path(__file__).resolve().parent.parent
SQLITE_DB_PATH = BASE_DIR / "workforce_db.db"
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DATABASE = os.getenv("MONGODB_DATABASE", "workforce")


def migrate():
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=2000)
    client.admin.command("ping")
    database = client[MONGODB_DATABASE]

    connection = sqlite3.connect(SQLITE_DB_PATH)
    connection.row_factory = sqlite3.Row
    tables = connection.execute(
        "SELECT name FROM sqlite_master "
        "WHERE type = 'table' AND name NOT LIKE 'sqlite_%' "
        "ORDER BY name"
    ).fetchall()

    migrated = 0
    documents = 0
    try:
        for (table_name,) in tables:
            rows = connection.execute(f'SELECT * FROM "{table_name}"').fetchall()
            if not rows:
                continue

            collection = database[table_name]
            for row in rows:
                document = dict(row)
                record_id = document.get("id")
                if record_id is None:
                    collection.insert_one(document)
                else:
                    collection.replace_one({"id": record_id}, document, upsert=True)
                documents += 1
            migrated += 1
            print(f"{table_name}: {len(rows)} documents")
    finally:
        connection.close()
        client.close()

    print(f"Migrated {documents} documents across {migrated} collections into {MONGODB_DATABASE}.")


if __name__ == "__main__":
    migrate()