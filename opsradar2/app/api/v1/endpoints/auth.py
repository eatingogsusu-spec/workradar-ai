"""Authentication endpoints - login only, no self-registration."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import create_access_token, verify_password
from app.schemas.auth import LoginRequest, LoginResponse, UserInfo

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text(
            """
            SELECT id::text, username, name, role, password_hash, status, deleted_at
            FROM users
            WHERE username = :username
            LIMIT 1
            """
        ),
        {"username": body.username},
    )
    row = result.mappings().one_or_none()

    if not row:
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다.")

    if row["deleted_at"] is not None or row.get("status") == "inactive":
        raise HTTPException(status_code=403, detail="비활성화된 계정입니다. 관리자에게 문의하세요.")

    if not row["password_hash"] or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다.")

    user = UserInfo(
        id=row["id"],
        username=row["username"],
        name=row["name"] or row["username"],
        role=row["role"] or "member",
    )
    token = create_access_token({"sub": user.id, "username": user.username, "role": user.role})
    return LoginResponse(access_token=token, user=user)
