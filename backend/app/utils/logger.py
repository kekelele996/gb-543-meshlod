"""统一日志入口：所有日志必须引用 constants/log_templates.py 的模板。"""
import logging

from app.constants.log_templates import LOG_TEMPLATES

_logger = logging.getLogger("meshlod")


def template(template_name: str) -> str:
    return LOG_TEMPLATES[template_name]


def emit(level: str, template_name: str, **kwargs) -> str:
    """按模板格式化并输出，返回格式化后的文本（worker 也会写进 run_logs）。"""
    text = LOG_TEMPLATES[template_name].format(**kwargs)
    getattr(_logger, level, _logger.info)(text)
    return text


def info(template_name: str, **kwargs) -> str:
    return emit("info", template_name, **kwargs)


def warn(template_name: str, **kwargs) -> str:
    return emit("warning", template_name, **kwargs)


def error(template_name: str, **kwargs) -> str:
    return emit("error", template_name, **kwargs)


def exception(template_name: str, **kwargs) -> str:
    text = LOG_TEMPLATES[template_name].format(**kwargs)
    _logger.exception(text)
    return text
