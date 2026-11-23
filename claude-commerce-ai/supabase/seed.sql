-- Configurações iniciais da operação (sem dados de negócio fictícios).
-- Os sete agentes são sincronizados pelo backend a partir de agents/registry.yaml
-- e agents/*/system_prompt.md na inicialização da API.

insert into public.app_settings (key, value) values
  ('emergency_stop', '{"active": false, "reason": null, "changed_by": null, "changed_at": null}'),
  ('budget', '{"monthly_brl": 150, "daily_api_brl": 4}'),
  ('brand', '{"name": "BRAND_NAME", "niche": "technology", "country": "BR", "currency": "BRL", "content_style": "faceless"}')
on conflict (key) do nothing;
