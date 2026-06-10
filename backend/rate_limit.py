from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request


def _client_ip(request: Request) -> str:
    """
    Render/Vercel 等 PaaS 都在反向代理後，request.client.host 會固定是 proxy IP。
    優先讀 X-Forwarded-For 第一段（最原始的 client IP），否則 fallback 到 remote address。
    """
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()
    return get_remote_address(request)


# 共用 Limiter；main.py 與各 router 都從這裡 import 同一個 instance
limiter = Limiter(key_func=_client_ip)
