from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from rate_limit import limiter
import models
import schemas
import auth as auth_utils

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=schemas.Token)
@limiter.limit("5/minute")
async def register(request: Request, body: schemas.UserRegister, db: AsyncSession = Depends(get_db)):
    """註冊新帳號；若 Email 已存在回 400"""
    result = await db.execute(
        select(models.User).where(models.User.email == body.email)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="此 Email 已被註冊，請直接登入")

    user = models.User(
        email=body.email,
        password_hash=auth_utils.hash_password(body.password),
        display_name=body.display_name or body.email.split("@")[0],
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = auth_utils.create_jwt(str(user.id))
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.post("/login", response_model=schemas.Token)
@limiter.limit("5/minute")
async def login(request: Request, body: schemas.UserLogin, db: AsyncSession = Depends(get_db)):
    """以 Email + 密碼登入，成功回傳 JWT"""
    result = await db.execute(
        select(models.User).where(models.User.email == body.email)
    )
    user = result.scalar_one_or_none()

    if not user or not auth_utils.verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email 或密碼錯誤")

    token = auth_utils.create_jwt(str(user.id))
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.get("/me", response_model=schemas.UserOut)
async def me(current_user: models.User = Depends(auth_utils.get_current_user)):
    """取得目前登入用戶資料"""
    return current_user
