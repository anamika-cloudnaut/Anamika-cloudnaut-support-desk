from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.auth import require_roles
from app.services.attachment_service import (
    AttachmentNotFound,
    AttachmentPersistenceError,
    AttachmentService,
    AttachmentStorageUnavailable,
    AttachmentTooLarge,
    InvalidAttachment,
    UnsupportedAttachmentType,
)
from database.app.database import get_db


router = APIRouter(tags=["Attachments"])
ATTACHMENT_ROLES = ("employee", "support", "admin")


def get_attachment_service(db: Session) -> AttachmentService:
    return AttachmentService(db)


def raise_attachment_error(error: Exception):
    if isinstance(error, AttachmentNotFound):
        raise HTTPException(status_code=404, detail=str(error)) from error
    if isinstance(error, AttachmentTooLarge):
        raise HTTPException(status_code=413, detail=str(error)) from error
    if isinstance(error, UnsupportedAttachmentType):
        raise HTTPException(status_code=415, detail=str(error)) from error
    if isinstance(error, InvalidAttachment):
        raise HTTPException(status_code=400, detail=str(error)) from error
    if isinstance(error, AttachmentStorageUnavailable):
        raise HTTPException(status_code=503, detail=str(error)) from error
    if isinstance(error, AttachmentPersistenceError):
        raise HTTPException(status_code=500, detail=str(error)) from error
    raise error


@router.post(
    "/internal/requests/{request_id}/attachments",
    status_code=status.HTTP_201_CREATED,
)
async def upload_request_attachment(
    request_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(require_roles(*ATTACHMENT_ROLES)),
):
    content = await file.read(5 * 1024 * 1024 + 1)
    try:
        return get_attachment_service(db).upload(
            request_id,
            user,
            file.filename,
            file.content_type or "",
            content,
        )
    except (
        AttachmentNotFound,
        AttachmentPersistenceError,
        AttachmentStorageUnavailable,
        AttachmentTooLarge,
        InvalidAttachment,
        UnsupportedAttachmentType,
    ) as error:
        raise_attachment_error(error)
    finally:
        await file.close()


@router.get(
    "/internal/requests/{request_id}/attachments",
)
def list_request_attachments(
    request_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*ATTACHMENT_ROLES)),
):
    try:
        return get_attachment_service(db).list_for_request(request_id, user)
    except AttachmentNotFound as error:
        raise_attachment_error(error)


@router.get("/internal/attachments/{attachment_id}")
def download_request_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*ATTACHMENT_ROLES)),
):
    try:
        attachment, content = get_attachment_service(db).download(
            attachment_id, user
        )
    except (AttachmentNotFound, AttachmentStorageUnavailable) as error:
        raise_attachment_error(error)

    return Response(
        content=content,
        media_type=attachment.content_type,
        headers={
            "Content-Disposition": (
                "inline; filename*=UTF-8''"
                f"{quote(attachment.original_filename, safe='')}"
            ),
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
