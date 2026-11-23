-- 0002 — Endurecimento do núcleo inicial.
--
-- * Separação real × simulado (is_simulated) nas tabelas de negócio.
-- * Domínios de status validados por CHECK.
-- * Deduplicação de produtos (external_id e URL).
-- * Aprovações com responsável, risco e regra financeira (nunca executada automaticamente).
-- * Publicação só com aprovação aprovada e divulgação comercial ativa.
-- * Auditoria somente-inserção.
-- * RLS habilitado em todas as tabelas: acesso apenas pelo backend (service role / conexão direta).

-- ------------------------------------------------------------------ updated_at automático
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_products_updated before update on public.products
  for each row execute function public.set_updated_at();
create trigger trg_affiliate_orders_updated before update on public.affiliate_orders
  for each row execute function public.set_updated_at();
create trigger trg_commissions_updated before update on public.commissions
  for each row execute function public.set_updated_at();
create trigger trg_app_settings_updated before update on public.app_settings
  for each row execute function public.set_updated_at();

alter table public.content_ideas add column updated_at timestamptz default now();
create trigger trg_content_ideas_updated before update on public.content_ideas
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------ real × simulado
alter table public.products         add column is_simulated boolean not null default false;
alter table public.product_metrics  add column is_simulated boolean not null default false;
alter table public.content_ideas    add column is_simulated boolean not null default false;
alter table public.publications     add column is_simulated boolean not null default false;
alter table public.content_metrics  add column is_simulated boolean not null default false;
alter table public.affiliate_orders add column is_simulated boolean not null default false;
alter table public.commissions      add column is_simulated boolean not null default false;

-- ------------------------------------------------------------------ validações de domínio
alter table public.products
  add constraint products_status_chk check (status in ('candidate', 'approved', 'active', 'paused', 'rejected')),
  add constraint products_price_chk check (price is null or price >= 0),
  add constraint products_commission_rate_chk check (commission_rate is null or commission_rate between 0 and 1),
  add constraint products_score_chk check (score is null or score between 0 and 100),
  add constraint products_rating_chk check (rating is null or rating between 0 and 5),
  add constraint products_name_chk check (char_length(trim(name)) >= 2);

-- Deduplicação: o mesmo produto externo/URL não entra duas vezes.
create unique index uq_products_external_id on public.products (external_id) where external_id is not null;
create unique index uq_products_url on public.products (lower(product_url)) where product_url is not null;

alter table public.content_ideas
  add constraint content_status_chk check (status in ('idea', 'scripted', 'rendering', 'rendered', 'in_review', 'approved', 'blocked', 'archived')),
  add constraint content_compliance_chk check (compliance_status in ('pending', 'approved', 'blocked'));

alter table public.agent_tasks
  add column agent_key text,
  add column requested_by text,
  add constraint tasks_status_chk check (status in ('queued', 'running', 'succeeded', 'failed', 'blocked', 'cancelled')),
  add constraint tasks_attempts_chk check (attempts >= 0 and max_attempts >= 1);
create index idx_tasks_claim on public.agent_tasks (priority, scheduled_at) where status = 'queued';

alter table public.commissions
  add constraint commissions_status_chk check (status in ('estimated', 'confirmed', 'paid', 'reversed'));

-- ------------------------------------------------------------------ aprovações
alter table public.approvals
  add column agent_key text,
  add column risk_level text not null default 'medium',
  add column decided_by text,
  add column decision_reason text,
  add column execution_status text not null default 'not_executed',
  add column execution_note text,
  add constraint approvals_status_chk check (status in ('pending', 'approved', 'rejected', 'expired')),
  add constraint approvals_risk_chk check (risk_level in ('low', 'medium', 'high', 'critical')),
  add constraint approvals_action_chk check (action_type in ('publish_content', 'change_listing', 'contact_seller', 'spend_money', 'financial', 'external_message')),
  -- Operações financeiras nunca são executadas pelo sistema.
  add constraint approvals_financial_manual_chk check (
    action_type not in ('financial', 'spend_money')
    or execution_status in ('not_executed', 'manual_required', 'manual_done', 'cancelled')),
  add constraint approvals_decision_chk check (
    status in ('pending', 'expired') or (decided_at is not null and decided_by is not null));
create index idx_approvals_pending on public.approvals (created_at) where status = 'pending';

-- ------------------------------------------------------------------ publicações
alter table public.publications
  add column approval_id uuid references public.approvals(id),
  add constraint publications_status_chk check (status in ('draft', 'ready', 'pending_approval', 'approved', 'published_manual', 'published', 'failed', 'cancelled'));

-- Publicar (manual ou via API) exige aprovação aprovada do tipo publish_content e divulgação comercial.
create or replace function public.enforce_publication_approval() returns trigger
language plpgsql as $$
begin
  if new.status in ('approved', 'published_manual', 'published') then
    if new.approval_id is null or not exists (
      select 1 from public.approvals a
      where a.id = new.approval_id and a.status = 'approved' and a.action_type = 'publish_content'
    ) then
      raise exception 'Publicação % exige aprovação aprovada (publish_content)', new.id;
    end if;
    if coalesce(new.disclosure_enabled, false) = false then
      raise exception 'Publicação % exige divulgação comercial ativa', new.id;
    end if;
  end if;
  return new;
end $$;

create trigger trg_publications_approval before insert or update on public.publications
  for each row execute function public.enforce_publication_approval();

-- ------------------------------------------------------------------ auditoria e custos
alter table public.audit_logs
  add column actor text not null default 'system',
  add column level text not null default 'info',
  add constraint audit_level_chk check (level in ('info', 'warning', 'error', 'security'));
create index idx_audit_created on public.audit_logs (created_at desc);

create or replace function public.forbid_audit_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_logs é somente-inserção';
end $$;
create trigger trg_audit_append_only before update or delete on public.audit_logs
  for each row execute function public.forbid_audit_mutation();

alter table public.cost_usage
  add column agent_key text,
  add column estimated_cost_usd numeric(12,6) not null default 0,
  add constraint cost_nonnegative_chk check (estimated_cost_brl >= 0 and input_tokens >= 0 and output_tokens >= 0);

create view public.v_cost_daily as
  select (created_at at time zone 'America/Sao_Paulo')::date as day,
         provider,
         sum(estimated_cost_brl) as cost_brl,
         sum(input_tokens) as input_tokens,
         sum(output_tokens) as output_tokens,
         count(*) as calls
  from public.cost_usage
  group by 1, 2;

-- Comissão estimada, confirmada, paga e estornada separadas.
create view public.v_commission_summary as
  select status, is_simulated, count(*) as items, coalesce(sum(net_commission), 0) as net_commission
  from public.commissions
  group by status, is_simulated;

-- ------------------------------------------------------------------ RLS
alter table public.agents           enable row level security;
alter table public.products         enable row level security;
alter table public.product_metrics  enable row level security;
alter table public.content_ideas    enable row level security;
alter table public.publications     enable row level security;
alter table public.content_metrics  enable row level security;
alter table public.affiliate_orders enable row level security;
alter table public.commissions      enable row level security;
alter table public.agent_tasks      enable row level security;
alter table public.approvals        enable row level security;
alter table public.audit_logs       enable row level security;
alter table public.cost_usage       enable row level security;
alter table public.app_settings     enable row level security;

-- Views executam com as permissões de quem consulta (respeitam RLS).
alter view public.v_cost_daily set (security_invoker = true);
alter view public.v_commission_summary set (security_invoker = true);

-- Nenhuma política para anon/authenticated nesta fase: o dashboard acessa os dados
-- somente pelo backend FastAPI. Políticas por usuário entram com o Supabase Auth.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all tables in schema public from authenticated';
  end if;
end $$;
