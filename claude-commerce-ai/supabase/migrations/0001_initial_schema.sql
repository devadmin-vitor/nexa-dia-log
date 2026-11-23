-- 0001 — Núcleo inicial (conforme a especificação técnica do Claude Commerce AI).
-- Endurecimento (RLS, validações, auditoria, aprovações) em 0002_hardening.sql.

create extension if not exists pgcrypto;

create table public.agents (
    id uuid primary key default gen_random_uuid(),
    agent_key text unique not null,
    name text not null,
    role text not null,
    system_prompt text not null,
    enabled boolean not null default true,
    config jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table public.products (
    id uuid primary key default gen_random_uuid(),
    external_id text,
    name text not null,
    category text,
    seller_name text,
    product_url text,
    image_url text,
    price numeric(12,2),
    commission_rate numeric(7,4),
    commission_value numeric(12,2),
    rating numeric(4,2),
    review_count integer default 0,
    availability_status text default 'unknown',
    source text,
    source_updated_at timestamptz,
    score numeric(5,2),
    score_details jsonb default '{}'::jsonb,
    status text default 'candidate',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table public.product_metrics (
    id uuid primary key default gen_random_uuid(),
    product_id uuid references public.products(id),
    metric_date date not null default current_date,
    demand_score numeric(5,2),
    commission_score numeric(5,2),
    reputation_score numeric(5,2),
    content_score numeric(5,2),
    competition_score numeric(5,2),
    source_data jsonb default '{}'::jsonb,
    created_at timestamptz default now()
);

create table public.content_ideas (
    id uuid primary key default gen_random_uuid(),
    product_id uuid references public.products(id),
    title text not null,
    hook text,
    script text,
    caption text,
    hashtags text[],
    duration_seconds integer,
    format text,
    scenes jsonb default '[]'::jsonb,
    asset_manifest jsonb default '[]'::jsonb,
    compliance_status text default 'pending',
    status text default 'idea',
    created_at timestamptz default now()
);

create table public.publications (
    id uuid primary key default gen_random_uuid(),
    content_id uuid references public.content_ideas(id),
    platform text default 'tiktok',
    platform_post_id text,
    post_url text,
    scheduled_at timestamptz,
    published_at timestamptz,
    status text default 'draft',
    disclosure_enabled boolean default false,
    created_at timestamptz default now()
);

create table public.content_metrics (
    id uuid primary key default gen_random_uuid(),
    publication_id uuid references public.publications(id),
    collected_at timestamptz default now(),
    views bigint default 0,
    likes bigint default 0,
    comments bigint default 0,
    shares bigint default 0,
    saves bigint default 0,
    profile_visits bigint default 0,
    product_clicks bigint default 0,
    attributed_orders integer default 0,
    average_watch_seconds numeric(10,2),
    completion_rate numeric(7,4),
    source text
);

create table public.affiliate_orders (
    id uuid primary key default gen_random_uuid(),
    external_order_id text unique,
    product_id uuid references public.products(id),
    publication_id uuid references public.publications(id),
    order_status text,
    sale_value numeric(12,2),
    currency text default 'BRL',
    ordered_at timestamptz,
    updated_at timestamptz default now()
);

create table public.commissions (
    id uuid primary key default gen_random_uuid(),
    order_id uuid references public.affiliate_orders(id),
    gross_commission numeric(12,2),
    adjustments numeric(12,2) default 0,
    net_commission numeric(12,2),
    status text default 'estimated',
    expected_payment_at timestamptz,
    paid_at timestamptz,
    updated_at timestamptz default now()
);

create table public.agent_tasks (
    id uuid primary key default gen_random_uuid(),
    agent_id uuid references public.agents(id),
    task_type text not null,
    payload jsonb not null default '{}'::jsonb,
    result jsonb,
    status text not null default 'queued',
    priority integer default 5,
    attempts integer default 0,
    max_attempts integer default 3,
    idempotency_key text unique,
    scheduled_at timestamptz default now(),
    started_at timestamptz,
    completed_at timestamptz,
    error_message text,
    created_at timestamptz default now()
);

create table public.approvals (
    id uuid primary key default gen_random_uuid(),
    task_id uuid references public.agent_tasks(id),
    action_type text not null,
    description text not null,
    payload jsonb not null default '{}'::jsonb,
    status text not null default 'pending',
    decided_at timestamptz,
    created_at timestamptz default now()
);

create table public.audit_logs (
    id uuid primary key default gen_random_uuid(),
    agent_id uuid references public.agents(id),
    task_id uuid references public.agent_tasks(id),
    action text not null,
    details jsonb default '{}'::jsonb,
    success boolean default true,
    created_at timestamptz default now()
);

create table public.cost_usage (
    id uuid primary key default gen_random_uuid(),
    provider text not null,
    model text,
    task_id uuid references public.agent_tasks(id),
    input_tokens bigint default 0,
    output_tokens bigint default 0,
    estimated_cost_brl numeric(12,4) default 0,
    created_at timestamptz default now()
);

create table public.app_settings (
    key text primary key,
    value jsonb not null,
    updated_at timestamptz default now()
);

create index idx_products_status
    on public.products(status);

create index idx_products_score
    on public.products(score desc);

create index idx_tasks_status
    on public.agent_tasks(status, priority);

create index idx_publications_status
    on public.publications(status);

create index idx_metrics_publication
    on public.content_metrics(publication_id, collected_at);

create index idx_cost_usage_date
    on public.cost_usage(created_at);
