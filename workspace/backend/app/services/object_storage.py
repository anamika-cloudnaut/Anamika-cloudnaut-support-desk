import io
import os

from minio import Minio


class StorageConfigurationError(RuntimeError):
    pass


class ObjectStorage:
    def __init__(self):
        endpoint = os.getenv("MINIO_ENDPOINT", "minio:9000")
        access_key = os.getenv("MINIO_ACCESS_KEY")
        secret_key = os.getenv("MINIO_SECRET_KEY")
        if not access_key or not secret_key:
            raise StorageConfigurationError(
                "MINIO_ACCESS_KEY and MINIO_SECRET_KEY must be configured."
            )

        self.bucket = os.getenv("MINIO_BUCKET", "support-attachments")
        self.client = Minio(
            endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=os.getenv("MINIO_SECURE", "false").lower() == "true",
        )

    def ensure_bucket(self):
        if not self.client.bucket_exists(self.bucket):
            self.client.make_bucket(self.bucket)

    def upload(self, object_key: str, content: bytes, content_type: str):
        self.client.put_object(
            self.bucket,
            object_key,
            io.BytesIO(content),
            length=len(content),
            content_type=content_type,
        )

    def download(self, object_key: str) -> bytes:
        response = self.client.get_object(self.bucket, object_key)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()

    def delete(self, object_key: str):
        self.client.remove_object(self.bucket, object_key)
