"""Logs estruturados (JSON) com mascaramento de segredos, em console e em logs/api.log."""

from __future__ import annotations

import json
import logging
import re
import sys
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler

from core.config import ROOT_DIR

_PATTERNS = [
    (re.compile(r"sk-ant-[A-Za-z0-9_\-]+"), "sk-ant-***"),
    (re.compile(r"eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]+"), "***jwt***"),
    (re.compile(r"(postgres(?:ql)?|redis)://([^:/@\s]*):([^@\s]+)@"), r"\1://\2:***@"),
    (re.compile(r"(?i)(authorization|x-api-key|x-scheduler-token|token|secret|password|api_key)(\"?\s*[:=]\s*\"?)([^\s\",]+)"),
     r"\1\2***"),
]


def mask_secrets(text: str) -> str:
    for pattern, repl in _PATTERNS:
        text = pattern.sub(repl, text)
    return text


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": mask_secrets(record.getMessage()),
        }
        extra = getattr(record, "fields", None)
        if isinstance(extra, dict):
            payload.update({k: mask_secrets(str(v)) for k, v in extra.items()})
        if record.exc_info:
            payload["exc"] = mask_secrets(self.formatException(record.exc_info))
        return json.dumps(payload, ensure_ascii=False)


def configure_logging(level: str = "INFO", to_file: bool = True) -> None:
    handlers: list[logging.Handler] = [logging.StreamHandler(sys.stdout)]
    if to_file:
        log_dir = ROOT_DIR / "logs"
        log_dir.mkdir(exist_ok=True)
        handlers.append(RotatingFileHandler(log_dir / "api.log", maxBytes=5_000_000, backupCount=5, encoding="utf-8"))
    for h in handlers:
        h.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = handlers
    root.setLevel(level)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


def log_event(logger: logging.Logger, msg: str, **fields) -> None:
    logger.info(msg, extra={"fields": fields})
