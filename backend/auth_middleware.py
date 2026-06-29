from fastapi import Header, HTTPException, Security
from fastapi.security import APIKeyHeader
from services.auth_service import validate_api_key
import os

# API key header — standard pattern
API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)

# master key for admin operations
MASTER_KEY = os.getenv("MASTER_API_KEY", "cortexops-master-key")


def get_api_key(api_key: str = Security(API_KEY_HEADER)) -> dict:
    """
    Dependency — validates API key on every request!
    Use: @app.get("/endpoint", dependencies=[Depends(get_api_key)])
    """
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="API key required. Pass X-API-Key header.",
            headers={"WWW-Authenticate": "ApiKey"}
        )

    # master key check
    if api_key == MASTER_KEY:
        return {"id": 0, "name": "master"}

    # validate against DB
    key_info = validate_api_key(api_key)
    if not key_info:
        raise HTTPException(
            status_code=403,
            detail="Invalid or revoked API key."
        )

    return key_info


def get_optional_api_key(api_key: str = Security(API_KEY_HEADER)) -> dict | None:
    """
    Optional auth — returns None if no key, validates if provided
    Use for public endpoints that benefit from auth context
    """
    if not api_key:
        return None

    if api_key == MASTER_KEY:
        return {"id": 0, "name": "master"}

    return validate_api_key(api_key)