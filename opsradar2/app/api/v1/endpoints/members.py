"""Project member management API."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

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
async def create_member(body: dict, db: AsyncSession = Depends(get_db)):
    name = (body.get("name") or "").strip()
    email = (body.get("email") or "").strip()
    if not name:
        raise HTTPException(400, "name is required")
    if not email:
        email = f"{name}@opsradar.local"
    project = await _default_project(db, body.get("project_id"))
    result = await db.execute(
        text(
            """
            WITH upsert_user AS (
              INSERT INTO users (id, team_id, name, email, role, created_at, updated_at, deleted_at)
              VALUES (gen_random_uuid(), :team_id, :name, :email, COALESCE(:user_role, 'member'), now(), now(), NULL)
              ON CONFLICT (email) DO UPDATE
              SET name = EXCLUDED.name,
                  role = EXCLUDED.role,
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
            "user_role": body.get("user_role") or body.get("role") or "member",
            "project_role": body.get("project_role") or "member",
            "status": body.get("status") or "active",
        },
    )
    await db.commit()
    return {"status": "success", "member_id": result.scalar_one()}


@router.patch("/{member_id}")
async def update_member(member_id: str, body: dict, db: AsyncSession = Depends(get_db)):
    allowed_user = {key: body[key] for key in ("name", "email") if key in body and body[key] is not None}
    if "user_role" in body and body["user_role"] is not None:
        allowed_user["role"] = body["user_role"]
    elif "role" in body and body["role"] is not None:
        allowed_user["role"] = body["role"]
    allowed_member = {key: body[key] for key in ("status",) if key in body and body[key] is not None}
    if "project_role" in body and body["project_role"] is not None:
        allowed_member["role"] = body["project_role"]
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