import os
from pathlib import Path

import boto3


class S3Storage:
    def __init__(self):
        self.bucket_name = os.getenv("S3_BUCKET_NAME")
        self.prefix = os.getenv("S3_DATA_PREFIX", "workforce-data").strip("/")
        self.client = boto3.client("s3") if self.bucket_name else None

    @property
    def enabled(self):
        return bool(self.bucket_name and self.client)

    def upload_file(self, file_path: str | Path, object_name: str | None = None):
        if not self.enabled:
            raise RuntimeError("S3_BUCKET_NAME is not configured")

        path = Path(file_path)
        key = object_name or f"{self.prefix}/{path.name}"
        self.client.upload_file(str(path), self.bucket_name, key)
        return {"bucket": self.bucket_name, "key": key}

    def upload_directory(self, directory: str | Path):
        directory_path = Path(directory)
        uploaded = []
        for file_path in sorted(directory_path.glob("*.csv")):
            uploaded.append(self.upload_file(file_path))
        return uploaded