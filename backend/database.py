import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

# 將 Neon 標準連線字串轉換為 asyncpg 格式
_raw_url = os.getenv("DATABASE_URL", "")
DATABASE_URL = (
    _raw_url
    .replace("postgresql://", "postgresql+asyncpg://", 1)
    .replace("sslmode=require", "ssl=require")
)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """在應用啟動時建立所有資料表（若不存在）"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
