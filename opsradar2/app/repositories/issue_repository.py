"""
Issue DB 쿼리
담당: 박주원
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from app.models.issue import Issue


class IssueRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all(
        self,
        status: Optional[str] = None,
        risk_level: Optional[str] = None
    ) -> list[Issue]:
        query = select(Issue)
        if status:
            query = query.where(Issue.status == status)
        if risk_level:
            query = query.where(Issue.risk_level == risk_level)
        result = await self.db.execute(
            query.order_by(Issue.created_at.desc())
        )
        return result.scalars().all()

    async def get_by_id(self, issue_id: str) -> Optional[Issue]:
        result = await self.db.execute(
            select(Issue).where(Issue.id == issue_id)
        )
        return result.scalar_one_or_none()

    async def create(self, data: dict) -> Issue:
        issue = Issue(**data)
        self.db.add(issue)
        await self.db.commit()
        await self.db.refresh(issue)
        return issue

    async def update(self, issue: Issue, data: dict) -> Issue:
        for key, value in data.items():
            setattr(issue, key, value)
        await self.db.commit()
        await self.db.refresh(issue)
        return issue