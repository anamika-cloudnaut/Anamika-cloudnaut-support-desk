import io
import os

from minio import Minio
from minio.error import MinioException, S3Error
from urllib3.exceptions import HTTPError


class StorageConfigurationError(RuntimeError):
    pass


class ObjectStorageError(RuntimeError):
    pass


class ObjectNotFoundError(ObjectStorageError):
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
        try:
            if not self.client.bucket_exists(self.bucket):
                try:
                    self.client.make_bucket(self.bucket)
                except S3Error as error:
                    if error.code not in {
                        "BucketAlreadyExists",
                        "BucketAlreadyOwnedByYou",
                    }:
                        raise
        except (MinioException, HTTPError) as error:
            raise ObjectStorageError("Could not initialize the MinIO bucket.") from error

    def upload(self, object_key: str, content: bytes, content_type: str):
        try:
            self.client.put_object(
                self.bucket,
                object_key,
                io.BytesIO(content),
                length=len(content),
                content_type=content_type,
            )
        except (MinioException, HTTPError) as error:
            raise ObjectStorageError("Could not upload the object to MinIO.") from error

    def download(self, object_key: str) -> bytes:
        try:
            response = self.client.get_object(self.bucket, object_key)
        except S3Error as error:
            if error.code in {"NoSuchKey", "NoSuchObject"}:
                raise ObjectNotFoundError("The MinIO object does not exist.") from error
            raise ObjectStorageError("Could not retrieve the object from MinIO.") from error
        except (MinioException, HTTPError) as error:
            raise ObjectStorageError("Could not retrieve the object from MinIO.") from error

        try:
            return response.read()
        except (MinioException, HTTPError) as error:
            raise ObjectStorageError("Could not read the object from MinIO.") from error
        finally:
            response.close()
            response.release_conn()

    def delete(self, object_key: str):
        try:
            self.client.remove_object(self.bucket, object_key)
        except (MinioException, HTTPError) as error:
            raise ObjectStorageError("Could not delete the object from MinIO.") from error
