export interface ServiceCheck {
  key: string;
  name: string;
  status: "ok" | "down" | "not_configured" | "warning";
  detail: string;
}

export interface ServicesHealth {
  ok: boolean;
  services: ServiceCheck[];
  project: string;
}

export interface Emergency {
  active: boolean;
  forced_by_env: boolean;
  reason: string | null;
  changed_by: string | null;
  changed_at: string | null;
}

export interface Budget {
  today_brl: number;
  month_brl: number;
  daily_limit_brl: number;
  monthly_limit_brl: number;
  daily_remaining_brl: number;
  monthly_remaining_brl: number;
  usd_brl_rate: number | null;
}

export interface TaskCounts {
  queued: number;
  running: number;
  succeeded: number;
  failed: number;
  blocked: number;
  cancelled: number;
  today: number;
}

export interface Overview {
  emergency: Emergency;
  budget: Budget;
  tasks: TaskCounts;
  pending_approvals: number;
  agents: number;
  products: { real: number; simulated: number };
  settings: Record<string, string | number | boolean | null>;
}

export interface Agent {
  id: string;
  agent_key: string;
  name: string;
  role: string;
  enabled: boolean;
  config: { tools: string[]; approval_required: boolean; is_orchestrator: boolean; daily_task_limit?: number; max_parallel_agents?: number };
  queued: number;
  running: number;
  failed: number;
  last_task_at: string | null;
  cost_brl: number;
  prompt_file: string | null;
}

export interface Task {
  id: string;
  agent_key: string | null;
  task_type: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  status: "queued" | "running" | "succeeded" | "failed" | "blocked" | "cancelled";
  priority: number;
  attempts: number;
  max_attempts: number;
  idempotency_key: string | null;
  requested_by: string | null;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface Approval {
  id: string;
  task_id: string | null;
  agent_key: string | null;
  action_type: string;
  description: string;
  payload: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "expired";
  risk_level: "low" | "medium" | "high" | "critical";
  decided_at: string | null;
  decided_by: string | null;
  decision_reason: string | null;
  execution_status: string;
  execution_note: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  external_id: string | null;
  name: string;
  category: string | null;
  seller_name: string | null;
  product_url: string | null;
  price: number | null;
  commission_rate: number | null;
  commission_value: number | null;
  score: number | null;
  status: string;
  source: string | null;
  is_simulated: boolean;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  level: "info" | "warning" | "error" | "security";
  success: boolean;
  details: Record<string, unknown>;
  agent_key: string | null;
  task_id: string | null;
  created_at: string;
}

export interface Costs {
  budget: Budget;
  daily: { day: string; provider: string; cost_brl: number; input_tokens: number; output_tokens: number; calls: number }[];
  by_agent: { agent_key: string | null; model: string; calls: number; input_tokens: number; output_tokens: number; cost_brl: number }[];
}

export interface Schedule {
  key: string;
  name: string;
  cron: string;
  timezone: string;
  workflow_file: string;
}

export interface ActionResult {
  ok: boolean;
  message: string;
}
