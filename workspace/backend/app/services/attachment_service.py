import logging
import re
import uuid
from io import BytesIO

from minio.error import MinioException, S3Error
from PIL import Image, UnidentifiedImageError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from database.app.models import RequestAttachment, SupportRequest
from app.services.object_storage import ObjectStorage, StorageConfigurationError


logger = logging.getLogger(__name__)
MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024
IMAGE_TYPES = {
    "image/jpeg": ("JPEG", ".jpg"),
    "image/png": ("PNG", ".png"),
    "image/webp": ("WEBP", ".webp"),
}


class AttachmentError(Exception):
    pass


class InvalidAttachment(AttachmentError):
    pass


class UnsupportedAttachmentType(AttachmentError):
    pass


class AttachmentTooLarge(AttachmentError):
    pass


class AttachmentNotFound(AttachmentError):
    pass


class AttachmentStorageUnavailable(AttachmentError):
    pass


class AttachmentPersistenceError(AttachmentError):
    pass


def safe_filename(filename: str | None) -> str:
    name = (filename or "").replace("\\", "/").rsplit("/", 1)[-1]
    name = re.sub(r"[\x00-\x1f\x7f]", "", name).strip()
    if not name:
        return "attachment"
    return name[:255]


class AttachmentService:
    def __init__(self, db: Session, storage: ObjectStorage | None = None):
        self.db = db
        self.storage = storage

    def _get_storage(self) -> ObjectStorage:
        if self.storage is None:
            self.storage = ObjectStorage()
        return self.storage

    @staticmethod
    def validate_file(content: bytes, content_type: str):
        if not content:
            raise InvalidAttachment("Empty files are not allowed.")
        if len(content) > MAX_ATTACHMENT_SIZE:
            raise AttachmentTooLarge("Files must be 5 MB or smaller.")
        expected = IMAGE_TYPES.get(content_type.lower())
        if not expected:
            raise UnsupportedAttachmentType(
                "Only JPEG, PNG, and WebP images are supported."
            )

        try:
            with Image.open(BytesIO(content)) as image:
                image_format = image.format
                image.verify()
        except (
            Image.DecompressionBombError,
            UnidentifiedImageError,
            OSError,
            ValueError,
        ) as error:
            raise InvalidAttachment("The uploaded file is not a valid image.") from error

        if image_format != expected[0]:
            raise UnsupportedAttachmentType(
                "The image content does not match its declared content type."
            )
        return expected[1]

    def _get_request(self, request_id: int, user: dict) -> SupportRequest:
        request = (
            self.db.query(SupportRequest)
            .filter(SupportRequest.id == request_id)
            .first()
        )
        if not request:
            raise AttachmentNotFound("Request not found.")
        if (
            user["role"] == "employee"
            and request.requester_email.lower() != user["email"].lower()
        ):
            raise AttachmentNotFound("Request not found.")
        return request

    def _get_attachment(self, attachment_id: int, user: dict):
        attachment = (
            self.db.query(RequestAttachment)
            .filter(RequestAttachment.id == attachment_id)
            .first()
        )
        if not attachment:
            raise AttachmentNotFound("Attachment not found.")
        self._get_request(attachment.request_id, user)
        return attachment

    @staticmethod
    def _metadata(attachment: RequestAttachment) -> dict:
        return {
            "id": attachment.id,
            "request_id": attachment.request_id,
            "uploaded_by_id": attachment.uploaded_by_id,
            "original_filename": attachment.original_filename,
            "content_type": attachment.content_type,
            "size_bytes": attachment.size_bytes,
            "created_at": attachment.created_at,
        }

    def upload(
        self,
        request_id: int,
        user: dict,
        filename: str | None,
        content_type: str,
        content: bytes,
    ) -> dict:
        request = self._get_request(request_id, user)
        extension = self.validate_file(content, content_type)
        object_key = f"requests/{request.id}/{uuid.uuid4().hex}{extension}"

        try:
            storage = self._get_storage()
            storage.ensure_bucket()
            storage.upload(object_key, content, content_type.lower())
        except (MinioException, OSError, StorageConfigurationError) as error:
            raise AttachmentStorageUnavailable(
                "Attachment storage is unavailable."
            ) from error

        attachment = RequestAttachment(
            request_id=request.id,
            uploaded_by_id=user["id"],
            original_filename=safe_filename(filename),
            object_key=object_key,
            content_type=content_type.lower(),
            size_bytes=len(content),
        )
        self.db.add(attachment)
        try:
            self.db.flush()
            self.db.refresh(attachment)
            self.db.commit()
        except SQLAlchemyError as error:
            self.db.rollback()
            try:
                storage.delete(object_key)
            except (MinioException, OSError, StorageConfigurationError):
                logger.exception(
                    "Failed to clean up MinIO object after attachment metadata failure"
                )
            raise AttachmentPersistenceError(
                "Could not save attachment metadata."
            ) from error

        return self._metadata(attachment)

    def list_for_request(self, request_id: int, user: dict) -> list[dict]:
        self._get_request(request_id, user)
        attachments = (
            self.db.query(RequestAttachment)
            .filter(RequestAttachment.request_id == request_id)
            .order_by(RequestAttachment.created_at.desc(), RequestAttachment.id.desc())
            .all()
        )
        return [self._metadata(attachment) for attachment in attachments]

    def download(self, attachment_id: int, user: dict):
        attachment = self._get_attachment(attachment_id, user)
        try:
            content = self._get_storage().download(attachment.object_key)
        except S3Error as error:
            if error.code == "NoSuchKey":
                raise AttachmentNotFound("Attachment content was not found.") from error
            raise AttachmentStorageUnavailable(
                "Attachment storage is unavailable."
            ) from error
        except (MinioException, OSError, StorageConfigurationError) as error:
            raise AttachmentStorageUnavailable(
                "Attachment storage is unavailable."
            ) from error
        return attachment, content
