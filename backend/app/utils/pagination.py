"""分页参数与响应包装。"""
from dataclasses import dataclass


@dataclass
class Page:
    items: list
    total: int
    page: int
    page_size: int

    def dict(self) -> dict:
        return {
            "items": self.items,
            "total": self.total,
            "page": self.page,
            "page_size": self.page_size,
        }
