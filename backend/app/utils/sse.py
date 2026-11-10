"""SSE 事件格式化（backend 的 /api/runs/{id}/events 使用）。"""
import json


def sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


def sse_comment(text: str = "ping") -> str:
    return f": {text}\n\n"
