from __future__ import annotations

from typing import Dict, Optional, Union

import httpx
from fastapi import HTTPException, status

from app.auth import AuthenticatedUser
from app.config import get_supabase_config, logger


async def supabase_data_request(
    method: str,
    path: str,
    user: AuthenticatedUser,
    *,
    json: Optional[dict] = None,
    params: Optional[Dict[str, Union[str, int]]] = None,
    prefer: Optional[str] = None,
) -> httpx.Response:
    supabase_url, publishable_key = get_supabase_config()
    headers = {
        "apikey": publishable_key,
        "Authorization": f"Bearer {user.access_token}",
    }
    if prefer:
        headers["Prefer"] = prefer

    logger.info(
        "Supabase data request method=%s path=%s user_id=%s",
        method,
        path,
        user.id,
    )
    logger.debug("Supabase data request payload=%r params=%r", json, params)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.request(
                method,
                f"{supabase_url}/rest/v1/{path}",
                headers=headers,
                json=json,
                params=params,
            )
    except httpx.RequestError as error:
        logger.exception(
            "Supabase data request failed before response method=%s path=%s",
            method,
            path,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Journal storage is unavailable.",
        ) from error

    logger.info(
        "Supabase data response method=%s path=%s status=%s",
        method,
        path,
        response.status_code,
    )
    logger.debug("Supabase data response body=%s", response.text)

    if response.is_error:
        logger.error(
            "Supabase rejected request method=%s path=%s status=%s body=%s",
            method,
            path,
            response.status_code,
            response.text,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase rejected the journal operation.",
        )
    return response
