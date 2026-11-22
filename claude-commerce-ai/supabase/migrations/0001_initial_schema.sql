-- Claude Commerce AI — esquema inicial (Fase 1)
-- Espelha backend/app/domain/models.py. Aplicar com: supabase db push  (ou psql -f)
--
-- Princípios:
--  * data_source separa dados reais de simulados em TODAS as tabelas de negócio.
--  * RLS habilitado em todas as tabelas; o backend usa a service_role (somente servidor).
--    Políticas para usuários autenticados (operador/gestor) entram na Fase 2 com Supabase Auth.
--  * audit_logs é append-only (sem UPDATE/DELETE).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- tipos
create type data_source as enum ('simulated', 'manual', 'csv_import', 'tiktok_api');
create type product_status as enum ('candidate', 'approved', 'active', 'paused', 'rejected');
create type product_class as enum ('A', 'B', 'C');
create type content_format as enum ('short_video', 'live', 'carousel');
create type content_status as enum ('idea', 'scripted', 'in_review', 'blocked', 'approved', 'published_manual');
create type agent_run_status as enum ('running', 'succeeded', 'failed', 'blocked');
create type action_type as enum ('read', 'internal_write', 'publish_content', 'change_listing', 'contact_seller', 'financial');
create type risk_level as enum ('low', 'medium', 'high', 'critical');
create type approval_status as enum ('pending', 'approved', 'rejected', 'expired');
create type log_level as enum ('info', 'warning', 'error', 'security');

-- ---------------------------------------------------------------- função updated_at
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- perfis (Fase 2: Supabase Auth)
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null default 'operator' check (role in ('operator', 'manager', 'admin')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- produtos
create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 200),
  category text not null,
  price_brl numeric(12, 2) not null check (price_brl >= 0),
  commission_rate numeric(5, 4) not null check (commission_rate between 0 and 1),
  seller_name text,
  external_product_id text,
  status product_status not null default 'candidate',
  classification product_class,
  score numeric(5, 2) check (score between 0 and 100),
  verified_claims text[] not null default '{}',   -- únicas alegações permitidas em roteiros
  media_rights_confirmed boolean not null default false,
  sample_received boolean not null default false,
  notes text,
  data_source data_source not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index products_external_uq on products (external_product_id, data_source) where external_product_id is not null;
create index products_status_idx on products (status);
create trigger products_updated before update on products for each row execute function set_updated_at();

-- ---------------------------------------------------------------- importações
create table import_batches (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  kind text not null check (kind in ('products', 'metrics')),
  rows_total int not null default 0,
  rows_ok int not null default 0,
  rows_error int not null default 0,
  errors jsonb not null default '[]',
  data_source data_source not null default 'csv_import',
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- conteúdo / calendário editorial
create table content_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete restrict,
  title text not null,
  format content_format not null default 'short_video',
  angle text,
  scheduled_for timestamptz not null,
  status content_status not null default 'idea',
  script jsonb,                                   -- {hook, body[], call_to_action, disclosure, claims_used[], shot_list[]}
  compliance_issues jsonb not null default '[]',
  compliance_passed boolean,
  data_source data_source not null default 'manual',
  created_by_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index content_schedule_idx on content_items (scheduled_for);
create index content_status_idx on content_items (status);
create trigger content_updated before update on content_items for each row execute function set_updated_at();

-- ---------------------------------------------------------------- métricas
create table metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  product_id uuid references products (id) on delete set null,
  content_id uuid references content_items (id) on delete set null,
  views int not null default 0 check (views >= 0),
  clicks int not null default 0 check (clicks >= 0),
  orders int not null default 0 check (orders >= 0),
  gmv_brl numeric(14, 2) not null default 0,
  commission_brl numeric(14, 2) not null default 0,
  data_source data_source not null,
  import_batch_id uuid references import_batches (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index metrics_day_idx on metric_snapshots (day);
create index metrics_product_day_idx on metric_snapshots (product_id, day);
create index metrics_source_idx on metric_snapshots (data_source);

-- ---------------------------------------------------------------- agentes
create table pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  pipeline text not null,
  trigger text not null,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_key text not null,
  pipeline_run_id uuid references pipeline_runs (id) on delete set null,
  trigger text not null default 'manual',
  status agent_run_status not null default 'running',
  mode text not null check (mode in ('live', 'simulated')),
  model text,
  input_summary text,
  output jsonb,
  error text,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index agent_runs_started_idx on agent_runs (started_at desc);
create index agent_runs_agent_idx on agent_runs (agent_key, started_at desc);

-- Gasto diário de IA (usado pelo controle de orçamento)
create view ai_daily_spend as
  select date_trunc('day', started_at)::date as day, sum(cost_usd) as cost_usd, count(*) filter (where mode = 'live') as live_runs
  from agent_runs group by 1;

-- ---------------------------------------------------------------- aprovações
create table approval_requests (
  id uuid primary key default gen_random_uuid(),
  agent_key text not null,
  action_type action_type not null check (action_type not in ('read', 'internal_write')),
  risk_level risk_level not null,
  title text not null,
  summary text not null,
  payload jsonb not null default '{}',
  status approval_status not null default 'pending',
  execution_status text not null default 'not_executed',
  execution_note text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text,
  decided_by_user uuid references profiles (id),
  decision_reason text,
  data_source data_source not null default 'manual',
  -- Operação financeira jamais é marcada como executada automaticamente.
  constraint financial_never_auto check (action_type <> 'financial' or execution_status in ('not_executed', 'manual_required', 'manual_done', 'cancelled'))
);
create index approvals_pending_idx on approval_requests (status) where status = 'pending';

-- ---------------------------------------------------------------- auditoria (append-only)
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  actor text not null,
  action text not null,
  entity_type text,
  entity_id text,
  level log_level not null default 'info',
  details jsonb not null default '{}'
);
create index audit_ts_idx on audit_logs (ts desc);
create index audit_level_idx on audit_logs (level, ts desc);

create or replace function forbid_audit_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'audit_logs é somente-inserção';
end $$;
create trigger audit_no_update before update or delete on audit_logs for each row execute function forbid_audit_mutation();

-- ---------------------------------------------------------------- agendamentos e estado do sistema
create table scheduled_tasks (
  key text primary key,
  name text not null,
  pipeline text not null,
  cron text not null,
  enabled boolean not null default true,
  last_run_at timestamptz,
  last_status text
);

create table system_state (
  id smallint primary key default 1 check (id = 1),   -- linha única
  kill_switch_active boolean not null default false,
  kill_switch_reason text,
  kill_switch_changed_at timestamptz,
  kill_switch_changed_by text
);
insert into system_state (id) values (1);

insert into scheduled_tasks (key, name, pipeline, cron) values
  ('daily_cycle', 'Ciclo diário de análise', 'daily_cycle', '0 10 * * *'),
  ('weekly_planning', 'Planejamento editorial semanal', 'weekly_planning', '0 11 * * 1'),
  ('ops_check', 'Verificação de custos e erros', 'ops_check', '0 */6 * * *');

-- ---------------------------------------------------------------- integrações (somente metadados; segredos ficam no Vault/variáveis do servidor)
create table integration_connections (
  key text primary key,                 -- 'tiktok_shop', 'claude', 'n8n'
  state text not null default 'not_configured',
  verified_at timestamptz,
  scopes_granted text[] not null default '{}',
  notes text,
  updated_at timestamptz not null default now()
);
-- Tokens OAuth do TikTok Shop (quando aprovados) devem ser guardados no Supabase Vault
-- (vault.create_secret) e referenciados por id — nunca em colunas de texto comuns.

-- ---------------------------------------------------------------- RLS
alter table profiles enable row level security;
alter table products enable row level security;
alter table import_batches enable row level security;
alter table content_items enable row level security;
alter table metric_snapshots enable row level security;
alter table pipeline_runs enable row level security;
alter table agent_runs enable row level security;
alter table approval_requests enable row level security;
alter table audit_logs enable row level security;
alter table scheduled_tasks enable row level security;
alter table system_state enable row level security;
alter table integration_connections enable row level security;

-- Sem políticas para anon/authenticated nesta fase: acesso apenas pela service_role (backend).
-- Exemplo para Fase 2 (leitura por usuários autenticados):
-- create policy "leitura autenticada" on products for select to authenticated using (true);

-- Defesa adicional: a role anon não acessa nada.
revoke all on all tables in schema public from anon;
