"""Project member management API."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import hash_password
from app.schemas.member import MemberCreate, MemberUpdate

router = APIRouter()


async def _default_project(db: AsyncSession, project_id: str | None = None):
    result = await db.execute(
        text(
            """
            SELECT id, team_id
            FROM projects
            WHERE (:project_id IS NULL OR id = CAST(:project_id AS uuid))
              AND COALESCE(status, 'active') <> 'deleted'
            ORDER BY created_at
            LIMIT 1
            """
        ),
        {"project_id": project_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(404, "project not found")
    return row


@router.get("")
async def list_members(project_id: str | None = None, active_only: bool = True, db: AsyncSession = Depends(get_db)):
    filters = ["u.deleted_at IS NULL"]
    params = {"project_id": project_id}
    if project_id:
        filters.append("pm.project_id = CAST(:project_id AS uuid)")
    if active_only:
        filters.append("pm.status = 'active'")
    where_clause = "WHERE " + " AND ".join(filters)
    result = await db.execute(
        text(
            f"""
            SELECT
              pm.id::text AS member_id,
              u.id::text AS user_id,
              u.name,
              u.email,
              u.role AS user_role,
              pm.role AS project_role,
              pm.status,
              pm.project_id::text AS project_id,
              p.name AS project_name,
              pm.team_id::text AS team_id,
              pm.joined_at
            FROM project_members pm
            JOIN users u ON u.id = pm.user_id
            JOIN projects p ON p.id = pm.project_id
            {where_clause}
            ORDER BY u.name
            """
        ),
        params,
    )
    return {"members": [dict(row) for row in result.mappings().all()]}


@router.post("")
async def create_member(body: MemberCreate, db: AsyncSession = Depends(get_db)):
    payload = body.model_dump(exclude_none=True)
    name = payload["name"]
    email = payload.get("email") or ""
    if not name:
        raise HTTPException(400, "name is required")
    if not email:
        email = f"{name}@opsradar.local"
    project = await _default_project(db, payload.get("project_id"))
    user_role = payload.get("user_role") or payload.get("role") or "member"
    project_role = payload.get("project_role") or payload.get("role") or "member"
    username = payload.get("username") or None
    password_hash = hash_password(payload["password"]) if payload.get("password") else None
    result = await db.execute(
        text(
            """
            WITH upsert_user AS (
              INSERT INTO users (id, team_id, name, email, role, username, password_hash, status, created_at, updated_at, deleted_at)
              VALUES (gen_random_uuid(), :team_id, :name, :email, COALESCE(:user_role, 'member'),
                      :username, :password_hash, 'active', now(), now(), NULL)
              ON CONFLICT (email) DO UPDATE
              SET name = EXCLUDED.name,
                  role = EXCLUDED.role,
                  username = COALESCE(EXCLUDED.username, users.username),
                  password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
                  deleted_at = NULL,
                  updated_at = now()
              RETURNING id, team_id
            ), upsert_member AS (
              INSERT INTO project_members (id, team_id, project_id, user_id, role, status, joined_at)
              SELECT gen_random_uuid(), :team_id, :project_id, id, COALESCE(:project_role, 'member'), COALESCE(:status, 'active'), now()
              FROM upsert_user
              ON CONFLICT ON CONSTRAINT uq_project_members_project_user DO UPDATE
              SET role = EXCLUDED.role,
                  status = EXCLUDED.status
              RETURNING id
            )
            SELECT id::text FROM upsert_member
            """
        ),
        {
            "team_id": str(project["team_id"]),
            "project_id": str(project["id"]),
            "name": name,
            "email": email,
            "user_role": user_role,
            "project_role": project_role,
            "status": payload.get("status") or "active",
            "username": username,
            "password_hash": password_hash,
        },
    )
    await db.commit()
    return {"status": "success", "member_id": result.scalar_one()}


@router.patch("/{member_id}")
async def update_member(member_id: str, body: MemberUpdate, db: AsyncSession = Depends(get_db)):
    payload = body.model_dump(exclude_unset=True, exclude_none=True)
    allowed_user = {key: payload[key] for key in ("name", "email", "username") if key in payload}
    if "password" in payload:
        allowed_user["password_hash"] = hash_password(payload["password"])
    if "user_role" in payload:
        allowed_user["role"] = payload["user_role"]
    elif "role" in payload:
        allowed_user["role"] = payload["role"]
    allowed_member = {key: payload[key] for key in ("status",) if key in payload}
    if "project_role" in payload:
        allowed_member["role"] = payload["project_role"]
    elif "role" in payload:
        allowed_member["role"] = payload["role"]
    if not allowed_user and not allowed_member:
        return {"status": "success", "member_id": member_id}

    if allowed_user:
        assignments = ", ".join(f"{key} = :user_{key}" for key in allowed_user)
        result = await db.execute(
            text(
                f"""
                UPDATE users u
                SET {assignments}, updated_at = now()
                FROM project_members pm
                WHERE pm.user_id = u.id
                  AND pm.id = CAST(:member_id AS uuid)
                """
            ),
            {"member_id": member_id, **{f"user_{k}": v for k, v in allowed_user.items()}},
        )
        if result.rowcount == 0:
            raise HTTPException(404, "member not found")
    if allowed_member:
        assignments = ", ".join(f"{key} = :member_{key}" for key in allowed_member)
        result = await db.execute(
            text(f"UPDATE project_members SET {assignments} WHERE id = CAST(:member_id AS uuid)"),
            {"member_id": member_id, **{f"member_{k}": v for k, v in allowed_member.items()}},
        )
        if result.rowcount == 0:
            raise HTTPException(404, "member not found")
    await db.commit()
    return {"status": "success", "member_id": member_id}


@router.delete("/{member_id}")
async def delete_member(member_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("UPDATE project_members SET status = 'inactive' WHERE id = CAST(:member_id AS uuid)"),
        {"member_id": member_id},
    )
    if result.rowcount == 0:
        raise HTTPException(404, "member not found")
    await db.commit()
    return {"status": "success", "member_id": member_id}
