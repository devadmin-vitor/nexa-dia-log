export type DataSource = "simulated" | "manual" | "csv_import" | "tiktok_api";

export interface Kpis {
  days: number;
  views: number;
  clicks: number;
  orders: number;
  gmv_brl: number;
  commission_brl: number;
  ctr: number;
  conversion_rate: number;
  epc_brl: number;
  avg_order_brl: number;
  data_sources: DataSource[];
}

export interface SeriesPoint {
  day: string;
  views: number;
  clicks: number;
  orders: number;
  gmv_brl: number;
  commission_brl: number;
}

export interface ProductPerf {
  product_id: string;
  product_name: string;
  commission_rate: number | null;
  data_source: DataSource | null;
  views: number;
  clicks: number;
  orders: number;
  gmv_brl: number;
  commission_brl: number;
  ctr: number;
  conversion_rate: number;
  epc_brl: number;
  avg_order_brl: number;
}

export interface Anomaly {
  product_id: string;
  product_name: string;
  previous_brl: number;
  current_brl: number;
  change_pct: number;
  type: "queda" | "alta";
}

export interface AgentRun {
  id: string;
  agent_key: string;
  pipeline_run_id: string | null;
  trigger: string;
  status: "running" | "succeeded" | "failed" | "blocked";
  mode: "live" | "simulated";
  model: string | null;
  input_summary: string | null;
  output?: { result: Record<string, unknown>; effects: Record<string, unknown>; mode: string } | null;
  error: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  started_at: string;
  finished_at: string | null;
}

export interface AuditLog {
  id: string;
  ts: string;
  actor: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  level: "info" | "warning" | "error" | "security";
  details: Record<string, unknown>;
}

export interface KillSwitch {
  kill_switch_active: boolean;
  kill_switch_reason: string | null;
  kill_switch_changed_at: string | null;
  kill_switch_changed_by: string | null;
}

export interface Overview {
  kpis: Kpis;
  series: SeriesPoint[];
  top_products: ProductPerf[];
  anomalies: Anomaly[];
  pending_approvals: number;
  content_next_7d: number;
  recent_runs: AgentRun[];
  failed_runs_recent: number;
  recent_errors: AuditLog[];
  ai_spend_today_usd: number;
  daily_ai_budget_usd: number;
  ai_mode: "live" | "simulated";
  kill_switch: KillSwitch;
  data_sources_present: DataSource[];
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price_brl: number;
  commission_rate: number;
  seller_name: string | null;
  external_product_id: string | null;
  status: "candidate" | "approved" | "active" | "paused" | "rejected";
  classification: "A" | "B" | "C" | null;
  score: number | null;
  verified_claims: string[];
  media_rights_confirmed: boolean;
  sample_received: boolean;
  notes: string | null;
  data_source: DataSource;
}

export interface ComplianceIssue {
  severity: "low" | "medium" | "high";
  rule: string;
  detail: string;
}

export interface Script {
  hook: string;
  body: string[];
  call_to_action: string;
  disclosure: string;
  claims_used: string[];
  shot_list: string[];
}

export interface ContentItem {
  id: string;
  product_id: string;
  product_name: string | null;
  title: string;
  format: "short_video" | "live" | "carousel";
  angle: string | null;
  scheduled_for: string;
  status: "idea" | "scripted" | "in_review" | "blocked" | "approved" | "published_manual";
  script: Script | null;
  compliance_issues: ComplianceIssue[];
  compliance_passed: boolean | null;
  data_source: DataSource;
  created_by_agent: string | null;
}

export interface Approval {
  id: string;
  agent_key: string;
  action_type: string;
  risk_level: "low" | "medium" | "high" | "critical";
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "expired";
  execution_status: string;
  execution_note: string | null;
  requested_at: string;
  decided_at: string | null;
  decided_by: string | null;
  decision_reason: string | null;
  data_source: DataSource;
}

export interface AgentInfo {
  key: string;
  name: string;
  description: string;
  responsibilities: string[];
  allowed_actions: string[];
  output_schema: string;
  last_run: AgentRun | null;
  runs_total: number;
  cost_usd_total: number;
}

export interface Architecture {
  orchestrator: { key: string; name: string; routing: string; guards: string[] };
  agents: AgentInfo[];
  pipelines: { key: string; name: string; steps: string[]; description: string }[];
}

export interface Integration {
  key: string;
  name: string;
  state: string;
  verified: boolean;
  note: string;
  [k: string]: unknown;
}

export interface ScheduledTask {
  id: string;
  key: string;
  name: string;
  pipeline: string;
  cron: string;
  enabled: boolean;
  last_run_at: string | null;
  last_status: string | null;
}

export interface SystemStatus {
  settings: Record<string, string | number | boolean>;
  kill_switch: KillSwitch;
  integrations: Integration[];
  scheduled_tasks: ScheduledTask[];
  storage: string;
}

export interface ImportBatch {
  id: string;
  filename: string;
  kind: string;
  rows_total: number;
  rows_ok: number;
  rows_error: number;
  errors: string[];
  created_at: string;
  data_source: DataSource;
}

export interface Costs {
  today_usd: number;
  daily_budget_usd: number;
  by_agent: Record<string, { runs: number; live_runs: number; input_tokens: number; output_tokens: number; cost_usd: number }>;
}

export interface ActionResult {
  ok: boolean;
  message: string;
}
