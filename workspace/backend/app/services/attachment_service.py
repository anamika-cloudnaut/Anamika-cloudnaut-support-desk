import logging
import re
import uuid
from io import BytesIO
from zipfile import BadZipFile, ZipFile

from PIL import Image, UnidentifiedImageError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from database.app.models import RequestAttachment, SupportRequest
from app.services.object_storage import (
    ObjectNotFoundError,
    ObjectStorage,
    ObjectStorageError,
    StorageConfigurationError,
)


logger = logging.getLogger(__name__)
MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024
SUPPORTED_FILES = {
    ".jpg": {"image/jpeg"},
    ".jpeg": {"image/jpeg"},
    ".png": {"image/png"},
    ".webp": {"image/webp"},
    ".pdf": {"application/pdf"},
    ".doc": {"application/msword"},
    ".docx": {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    },
    ".xls": {"application/vnd.ms-excel"},
    ".xlsx": {
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    },
    ".csv": {"text/csv", "application/csv", "application/vnd.ms-excel"},
    ".txt": {"text/plain"},
}
IMAGE_FORMATS = {
    ".jpg": "JPEG",
    ".jpeg": "JPEG",
    ".png": "PNG",
    ".webp": "WEBP",
}
OLE_SIGNATURE = bytes.fromhex("D0CF11E0A1B11AE1")


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


class AttachmentDeletionError(AttachmentError):
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
    def validate_file(filename: str | None, content: bytes, content_type: str):
        if not content:
            raise InvalidAttachment("Empty files are not allowed.")
        if len(content) > MAX_ATTACHMENT_SIZE:
            raise AttachmentTooLarge("Files must be 5 MB or smaller.")
        sanitized_filename = safe_filename(filename)
        suffix = sanitized_filename.rsplit(".", 1)[-1].lower()
        extension = f".{suffix}" if "." in sanitized_filename else ""
        allowed_mime_types = SUPPORTED_FILES.get(extension)
        declared_type = (content_type or "").split(";", 1)[0].strip().lower()
        if not allowed_mime_types:
            raise UnsupportedAttachmentType(
                "This file extension is not supported."
            )
        if declared_type not in allowed_mime_types:
            raise UnsupportedAttachmentType(
                "The file content type does not match its extension."
            )

        if extension in IMAGE_FORMATS:
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
            if image_format != IMAGE_FORMATS[extension]:
                raise InvalidAttachment(
                    "The image content does not match its file extension."
                )
        elif extension == ".pdf":
            if not content.startswith(b"%PDF-"):
                raise InvalidAttachment("The uploaded file is not a valid PDF.")
        elif extension in {".docx", ".xlsx"}:
            try:
                with ZipFile(BytesIO(content)) as archive:
                    entries = set(archive.namelist())
            except (BadZipFile, OSError) as error:
                raise InvalidAttachment(
                    "The uploaded Office document is not a valid file."
                ) from error
            required_entries = (
                {"[Content_Types].xml", "word/document.xml"}
                if extension == ".docx"
                else {"[Content_Types].xml", "xl/workbook.xml"}
            )
            if not required_entries.issubset(entries):
                raise InvalidAttachment(
                    "The Office document content does not match its extension."
                )
        elif extension in {".doc", ".xls"}:
            if not content.startswith(OLE_SIGNATURE):
                raise InvalidAttachment(
                    "The legacy Office document has an invalid file signature."
                )
        else:
            try:
                text = content.decode("utf-8-sig")
            except UnicodeDecodeError as error:
                raise InvalidAttachment(
                    "CSV and TXT files must contain valid UTF-8 text."
                ) from error
            if "\x00" in text:
                raise InvalidAttachment(
                    "CSV and TXT files cannot contain binary data."
                )
        return extension

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
        extension = self.validate_file(filename, content, content_type)
        object_key = f"requests/{request.id}/{uuid.uuid4().hex}{extension}"

        try:
            storage = self._get_storage()
            storage.ensure_bucket()
            storage.upload(object_key, content, content_type.lower())
        except (ObjectStorageError, OSError, StorageConfigurationError) as error:
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
            except (ObjectStorageError, OSError, StorageConfigurationError):
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
        except ObjectNotFoundError as error:
            raise AttachmentNotFound("Attachment content was not found.") from error
        except ObjectStorageError as error:
            raise AttachmentStorageUnavailable(
                "Attachment storage is unavailable."
            ) from error
        except (OSError, StorageConfigurationError) as error:
            raise AttachmentStorageUnavailable(
                "Attachment storage is unavailable."
            ) from error
        return attachment, content

    def delete(self, attachment_id: int, user: dict):
        attachment = self._get_attachment(attachment_id, user)
        storage = self._get_storage()
        try:
            original_content = storage.download(attachment.object_key)
        except ObjectNotFoundError:
            original_content = None
        except ObjectStorageError as error:
            raise AttachmentStorageUnavailable(
                "Attachment storage is unavailable."
            ) from error

        try:
            storage.delete(attachment.object_key)
        except ObjectStorageError as error:
            raise AttachmentStorageUnavailable(
                "Could not delete the attachment from storage."
            ) from error

        try:
            self.db.delete(attachment)
            self.db.commit()
        except SQLAlchemyError as error:
            self.db.rollback()
            if original_content is not None:
                try:
                    storage.upload(
                        attachment.object_key,
                        original_content,
                        attachment.content_type,
                    )
                except ObjectStorageError:
                    logger.exception(
                        "Could not restore MinIO object after attachment metadata deletion failed"
                    )
            raise AttachmentDeletionError(
                "Could not delete attachment metadata."
            ) from error
