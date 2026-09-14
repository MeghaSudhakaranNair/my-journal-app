from __future__ import annotations

from typing import Annotated, Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import AuthenticatedUser, require_user
from app.config import get_supabase_config, logger
from app.models import Profile, ProfileUpdate


router = APIRouter(prefix="/profile", tags=["profile"])


def clean(value: str) -> str:
    return value.strip()


def metadata_text(metadata: dict[str, Any], key: str) -> str:
    value = metadata.get(key)
    return value if isinstance(value, str) else ""


def profile_from_supabase_user(payload: dict[str, Any]) -> Profile:
    metadata_value = payload.get("user_metadata")
    metadata = metadata_value if isinstance(metadata_value, dict) else {}
    email = payload.get("email")
    return Profile(
        id=str(payload.get("id", "")),
        email=email if isinstance(email, str) else "",
        firstName=metadata_text(metadata, "first_name"),
        lastName=metadata_text(metadata, "last_name"),
        username=metadata_text(metadata, "username"),
        phone=metadata_text(metadata, "phone"),
        addressLine1=metadata_text(metadata, "address_line_1"),
        addressLine2=metadata_text(metadata, "address_line_2"),
        city=metadata_text(metadata, "city"),
        region=metadata_text(metadata, "region"),
        postalCode=metadata_text(metadata, "postal_code"),
        country=metadata_text(metadata, "country"),
        emailChangePending=bool(payload.get("new_email")),
    )


@router.patch("", response_model=Profile)
async def update_profile(
    body: ProfileUpdate,
    user: Annotated[AuthenticatedUser, Depends(require_user)],
) -> Profile:
    username = clean(body.username)
    if not username:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Username is required.",
        )

    supabase_url, publishable_key = get_supabase_config()
    update_payload = {
        "data": {
            "first_name": clean(body.firstName) or None,
            "last_name": clean(body.lastName) or None,
            "username": username,
            "phone": clean(body.phone) or None,
            "address_line_1": clean(body.addressLine1) or None,
            "address_line_2": clean(body.addressLine2) or None,
            "city": clean(body.city) or None,
            "region": clean(body.region) or None,
            "postal_code": clean(body.postalCode) or None,
            "country": clean(body.country) or None,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.put(
                f"{supabase_url}/auth/v1/user",
                headers={
                    "apikey": publishable_key,
                    "Authorization": f"Bearer {user.access_token}",
                },
                json=update_payload,
            )
    except httpx.RequestError as error:
        logger.exception("Profile update could not reach Supabase user_id=%s", user.id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The profile service is unavailable.",
        ) from error

    if response.is_error:
        try:
            error_payload = response.json()
        except ValueError:
            error_payload = {}
        message = error_payload.get("msg") or error_payload.get("message")
        logger.warning(
            "Supabase rejected profile update user_id=%s status=%s",
            user.id,
            response.status_code,
        )
        raise HTTPException(
            status_code=(
                response.status_code
                if 400 <= response.status_code < 500
                else status.HTTP_502_BAD_GATEWAY
            ),
            detail=message if isinstance(message, str) else "Supabase rejected the profile update.",
        )

    payload = response.json()
    if not isinstance(payload, dict) or payload.get("id") != user.id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase returned an invalid profile response.",
        )

    logger.info("Profile updated user_id=%s", user.id)
    return profile_from_supabase_user(payload)
