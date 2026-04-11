from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from database import get_db
import models
import schemas
import auth as auth_utils

router = APIRouter(prefix="/api/user", tags=["user"])


@router.post("/recommendations/{game_id}", response_model=schemas.RecommendationOut)
async def save_recommendation(
    game_id: str,
    body: schemas.RecommendationCreate,
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """儲存一筆 AI 推薦紀錄"""
    rec = models.Recommendation(
        user_id=current_user.id,
        game_id=game_id,
        numbers=body.numbers,
        special=body.special,
        exclude_nums=body.exclude_nums,
        exclude_sp=body.exclude_sp,
        ratio=body.ratio,
        limit_used=body.limit_used,
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return rec


@router.get("/recommendations", response_model=list[schemas.RecommendationOut])
async def get_recommendations(
    game_id: Optional[str] = Query(None, description="篩選彩種（不填=全部）"),
    limit: int = Query(50, le=200),
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """查詢登入用戶的 AI 推薦歷史紀錄"""
    q = select(models.Recommendation).where(
        models.Recommendation.user_id == current_user.id
    )
    if game_id:
        q = q.where(models.Recommendation.game_id == game_id)
    q = q.order_by(desc(models.Recommendation.created_at)).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/preferences/{game_id}", response_model=Optional[schemas.PreferenceOut])
async def get_preferences(
    game_id: str,
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """取得該彩種的偏好設定（無設定回 null）"""
    result = await db.execute(
        select(models.Preference).where(
            models.Preference.user_id == current_user.id,
            models.Preference.game_id == game_id,
        )
    )
    return result.scalar_one_or_none()


@router.put("/preferences/{game_id}", response_model=schemas.PreferenceOut)
async def save_preferences(
    game_id: str,
    body: schemas.PreferenceUpdate,
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """新增或更新該彩種的偏好設定（upsert）"""
    result = await db.execute(
        select(models.Preference).where(
            models.Preference.user_id == current_user.id,
            models.Preference.game_id == game_id,
        )
    )
    pref = result.scalar_one_or_none()

    if pref:
        pref.exclude_nums = body.exclude_nums
        pref.exclude_sp = body.exclude_sp
        pref.ratio = body.ratio
        pref.updated_at = datetime.now(timezone.utc)
    else:
        pref = models.Preference(
            user_id=current_user.id,
            game_id=game_id,
            exclude_nums=body.exclude_nums,
            exclude_sp=body.exclude_sp,
            ratio=body.ratio,
        )
        db.add(pref)

    await db.commit()
    await db.refresh(pref)
    return pref
