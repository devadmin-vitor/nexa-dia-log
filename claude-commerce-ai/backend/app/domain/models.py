"""Modelos de domínio. Espelham o esquema em supabase/migrations/0001_initial_schema.sql.

Toda entidade com dados de negócio carrega `data_source`, que separa dados reais de simulações:
- simulated   → gerado pelo seed/demonstração. Nunca usar para decisões reais.
- manual      → cadastrado por um operador.
- csv_import  → importado de relatório CSV/XLSX exportado pelo operador.
- tiktok_api  → obtido pela API oficial do TikTok Shop (ainda não habilitado).
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from enum import StrEnum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


def now() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid4())


class DataSource(StrEnum):
    simulated = "simulated"
    manual = "manual"
    csv_import = "csv_import"
    tiktok_api = "tiktok_api"


class ProductStatus(StrEnum):
    candidate = "candidate"
    approved = "approved"
    active = "active"
    paused = "paused"
    rejected = "rejected"


class ProductClass(StrEnum):
    A = "A"  # prioridade alta
    B = "B"  # testar
    C = "C"  # baixa prioridade / evitar


class Product(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    category: str
    price_brl: float = Field(ge=0)
    commission_rate: float = Field(ge=0, le=1, description="0.12 = 12%")
    seller_name: str | None = None
    external_product_id: str | None = None
    status: ProductStatus = ProductStatus.candidate
    classification: ProductClass | None = None
    score: float | None = Field(default=None, ge=0, le=100)
    # Fatos verificados do produto — únicas afirmações permitidas em roteiros.
    verified_claims: list[str] = Field(default_factory=list)
    # O afiliado tem direito de uso das mídias do vendedor? (regra: não usar conteúdo de terceiros sem direitos)
    media_rights_confirmed: bool = False
    sample_received: bool = False  # demonstrações só com produto físico real
    notes: str | None = None
    data_source: DataSource = DataSource.manual
    created_at: datetime = Field(default_factory=now)
    updated_at: datetime = Field(default_factory=now)


class ProductCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    category: str = Field(min_length=2, max_length=80)
    price_brl: float = Field(ge=0)
    commission_rate: float = Field(ge=0, le=1)
    seller_name: str | None = None
    external_product_id: str | None = None
    verified_claims: list[str] = Field(default_factory=list)
    media_rights_confirmed: bool = False
    sample_received: bool = False
    notes: str | None = None


class ContentFormat(StrEnum):
    short_video = "short_video"
    live = "live"
    carousel = "carousel"


class ContentStatus(StrEnum):
    idea = "idea"
    scripted = "scripted"
    in_review = "in_review"
    blocked = "blocked"
    approved = "approved"
    published_manual = "published_manual"


class ComplianceIssue(BaseModel):
    severity: str  # low | medium | high
    rule: str
    detail: str


class Script(BaseModel):
    hook: str
    body: list[str]
    call_to_action: str
    disclosure: str
    claims_used: list[str] = Field(default_factory=list)
    shot_list: list[str] = Field(default_factory=list)


class ContentItem(BaseModel):
    id: str = Field(default_factory=new_id)
    product_id: str
    title: str
    format: ContentFormat = ContentFormat.short_video
    angle: str | None = None
    scheduled_for: datetime
    status: ContentStatus = ContentStatus.idea
    script: Script | None = None
    compliance_issues: list[ComplianceIssue] = Field(default_factory=list)
    compliance_passed: bool | None = None
    data_source: DataSource = DataSource.manual
    created_by_agent: str | None = None
    created_at: datetime = Field(default_factory=now)
    updated_at: datetime = Field(default_factory=now)


class MetricSnapshot(BaseModel):
    id: str = Field(default_factory=new_id)
    day: date
    product_id: str | None = None
    content_id: str | None = None
    views: int = 0
    clicks: int = 0
    orders: int = 0
    gmv_brl: float = 0.0
    commission_brl: float = 0.0
    data_source: DataSource = DataSource.manual
    import_batch_id: str | None = None


class AgentRunStatus(StrEnum):
    running = "running"
    succeeded = "succeeded"
    failed = "failed"
    blocked = "blocked"


class AgentRun(BaseModel):
    id: str = Field(default_factory=new_id)
    agent_key: str
    pipeline_run_id: str | None = None
    trigger: str = "manual"  # manual | scheduler | orchestrator
    status: AgentRunStatus = AgentRunStatus.running
    mode: str = "simulated"  # live | simulated
    model: str | None = None
    input_summary: str | None = None
    output: dict[str, Any] | None = None
    error: str | None = None
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    started_at: datetime = Field(default_factory=now)
    finished_at: datetime | None = None


class ActionType(StrEnum):
    read = "read"
    internal_write = "internal_write"
    publish_content = "publish_content"
    change_listing = "change_listing"
    contact_seller = "contact_seller"
    financial = "financial"


class RiskLevel(StrEnum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class ApprovalStatus(StrEnum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    expired = "expired"


class ApprovalRequest(BaseModel):
    id: str = Field(default_factory=new_id)
    agent_key: str
    action_type: ActionType
    risk_level: RiskLevel
    title: str
    summary: str
    payload: dict[str, Any] = Field(default_factory=dict)
    status: ApprovalStatus = ApprovalStatus.pending
    execution_status: str = "not_executed"
    execution_note: str | None = None
    requested_at: datetime = Field(default_factory=now)
    decided_at: datetime | None = None
    decided_by: str | None = None
    decision_reason: str | None = None
    data_source: DataSource = DataSource.manual


class ApprovalDecision(BaseModel):
    approve: bool
    decided_by: str = Field(min_length=2, max_length=120)
    reason: str | None = Field(default=None, max_length=1000)


class LogLevel(StrEnum):
    info = "info"
    warning = "warning"
    error = "error"
    security = "security"


class AuditLog(BaseModel):
    id: str = Field(default_factory=new_id)
    ts: datetime = Field(default_factory=now)
    actor: str
    action: str
    entity_type: str | None = None
    entity_id: str | None = None
    level: LogLevel = LogLevel.info
    details: dict[str, Any] = Field(default_factory=dict)


class ScheduledTask(BaseModel):
    id: str = Field(default_factory=new_id)
    key: str
    name: str
    pipeline: str
    cron: str
    enabled: bool = True
    last_run_at: datetime | None = None
    last_status: str | None = None


class ImportBatch(BaseModel):
    id: str = Field(default_factory=new_id)
    filename: str
    kind: str  # products | metrics
    rows_total: int = 0
    rows_ok: int = 0
    rows_error: int = 0
    errors: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=now)
    data_source: DataSource = DataSource.csv_import


class SystemState(BaseModel):
    kill_switch_active: bool = False
    kill_switch_reason: str | None = None
    kill_switch_changed_at: datetime | None = None
    kill_switch_changed_by: str | None = None


class KillSwitchUpdate(BaseModel):
    active: bool
    reason: str = Field(min_length=3, max_length=500)
    changed_by: str = Field(min_length=2, max_length=120)
