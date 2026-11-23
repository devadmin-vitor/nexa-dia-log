# Supabase

O backend acessa o PostgreSQL do Supabase local diretamente (`DATABASE_URL`, porta 54322) via `core/db.py`.
O cliente `supabase-py` não é necessário nesta fase. Saúde da API do Supabase: `core/health.py`.
Migrações: `supabase/migrations/` (aplicadas por `npx supabase start` / `npx supabase db reset`).
