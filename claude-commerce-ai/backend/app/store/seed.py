"""Dados SIMULADOS para demonstração do dashboard.

Todos os registros criados aqui têm `data_source=simulated`. Produtos e vendedores são fictícios.
"""

from __future__ import annotations

import random
from datetime import date, datetime, time, timedelta, timezone

from app.domain.models import (
    ActionType,
    ApprovalRequest,
    ContentFormat,
    ContentItem,
    ContentStatus,
    DataSource,
    MetricSnapshot,
    Product,
    ProductStatus,
    RiskLevel,
    ScheduledTask,
)
from app.store.memory import MemoryStore

SIM = DataSource.simulated

_PRODUCTS = [
    ("Garrafa Térmica Inox 750ml", "Casa e Cozinha", 89.9, 0.12, ["Aço inoxidável", "Capacidade de 750 ml"]),
    ("Organizador de Gaveta Modular (6 peças)", "Casa e Cozinha", 49.9, 0.15, ["6 peças encaixáveis"]),
    ("Luminária LED de Mesa Recarregável", "Casa e Decoração", 119.0, 0.10, ["Bateria recarregável via USB-C", "3 temperaturas de cor"]),
    ("Escova Secadora Compacta", "Beleza", 159.9, 0.08, ["Bivolt", "2 níveis de temperatura"]),
    ("Kit Pincéis de Maquiagem (12 un.)", "Beleza", 59.9, 0.18, ["12 pincéis", "Estojo incluso"]),
    ("Fone Bluetooth Esportivo", "Eletrônicos", 139.0, 0.07, ["Bluetooth 5.3", "Gancho de orelha"]),
    ("Suporte Articulado para Celular", "Eletrônicos", 39.9, 0.20, ["Compatível com celulares de 4 a 7 polegadas"]),
    ("Tapete de Yoga Antiderrapante 6mm", "Esporte e Lazer", 99.9, 0.11, ["Espessura de 6 mm"]),
    ("Mochila Impermeável para Notebook 15,6\"", "Moda e Acessórios", 179.0, 0.09, ["Compartimento para notebook de até 15,6 polegadas"]),
    ("Kit Potes Herméticos de Vidro (5 un.)", "Casa e Cozinha", 129.9, 0.13, ["Vidro borossilicato", "5 tamanhos"]),
    ("Mini Processador de Alimentos", "Casa e Cozinha", 74.9, 0.14, ["Capacidade de 250 ml"]),
    ("Sérum Facial Vitamina C 30ml", "Beleza", 69.9, 0.16, ["Frasco de 30 ml"]),
]


def seed_simulated(store: MemoryStore, *, days: int = 30, rng_seed: int = 42) -> None:
    rng = random.Random(rng_seed)
    today = date.today()

    products: list[Product] = []
    for i, (name, cat, price, rate, claims) in enumerate(_PRODUCTS):
        p = Product(
            name=name,
            category=cat,
            price_brl=price,
            commission_rate=rate,
            seller_name=f"Loja Demonstração {chr(65 + i % 5)}",
            external_product_id=f"SIM-{1000 + i}",
            status=ProductStatus.active if i < 7 else ProductStatus.candidate,
            verified_claims=claims,
            media_rights_confirmed=i % 3 != 0,
            sample_received=i % 2 == 0,
            data_source=SIM,
            notes="Produto fictício para demonstração.",
        )
        products.append(store.upsert_product(p))

    # Métricas diárias (somente produtos ativos geram vendas)
    snapshots: list[MetricSnapshot] = []
    for p in products:
        if p.status != ProductStatus.active:
            continue
        base_views = rng.randint(800, 6000)
        ctr = rng.uniform(0.015, 0.06)
        cvr = rng.uniform(0.02, 0.09)
        trend = rng.uniform(-0.015, 0.02)
        for d in range(days, 0, -1):
            day = today - timedelta(days=d)
            factor = max(0.2, 1 + trend * (days - d)) * rng.uniform(0.7, 1.3)
            views = int(base_views * factor)
            clicks = int(views * ctr * rng.uniform(0.8, 1.2))
            orders = int(clicks * cvr * rng.uniform(0.6, 1.4))
            gmv = round(orders * p.price_brl, 2)
            snapshots.append(
                MetricSnapshot(
                    day=day,
                    product_id=p.id,
                    views=views,
                    clicks=clicks,
                    orders=orders,
                    gmv_brl=gmv,
                    commission_brl=round(gmv * p.commission_rate, 2),
                    data_source=SIM,
                )
            )
    store.add_metrics(snapshots)

    # Calendário editorial para os próximos 7 dias
    angles = ["Rotina real de uso", "Comparativo honesto", "3 usos práticos", "Unboxing com amostra", "Dúvidas frequentes"]
    for d in range(7):
        for slot, hour in enumerate((12, 19)):
            p = products[(d * 2 + slot) % 7]
            dt = datetime.combine(today + timedelta(days=d), time(hour, 0), tzinfo=timezone.utc)
            store.upsert_content(
                ContentItem(
                    product_id=p.id,
                    title=f"{angles[(d + slot) % len(angles)]}: {p.name}",
                    format=ContentFormat.live if (d == 5 and slot == 1) else ContentFormat.short_video,
                    angle=angles[(d + slot) % len(angles)],
                    scheduled_for=dt,
                    status=ContentStatus.idea,
                    data_source=SIM,
                    created_by_agent="content_planner",
                )
            )

    # Solicitações de aprovação de exemplo
    store.save_approval(
        ApprovalRequest(
            agent_key="content_planner",
            action_type=ActionType.publish_content,
            risk_level=RiskLevel.medium,
            title="Publicar vídeo: Rotina real de uso — Garrafa Térmica",
            summary="Roteiro aprovado pelo revisor de conformidade. Publicação manual pelo operador após aprovação.",
            payload={"content_title": "Rotina real de uso: Garrafa Térmica Inox 750ml"},
            data_source=SIM,
        )
    )
    store.save_approval(
        ApprovalRequest(
            agent_key="commission_analyst",
            action_type=ActionType.financial,
            risk_level=RiskLevel.critical,
            title="Investir R$ 150,00 em impulsionamento",
            summary="Sugestão do analista: produto com EPC acima da média. Operação financeira — requer aprovação humana e execução manual.",
            payload={"amount_brl": 150.0, "product": "Suporte Articulado para Celular"},
            data_source=SIM,
        )
    )

    # Tarefas agendadas (executadas via n8n → endpoint /scheduler)
    for key, name, pipeline, cron in [
        ("daily_cycle", "Ciclo diário de análise", "daily_cycle", "0 7 * * *"),
        ("weekly_planning", "Planejamento editorial semanal", "weekly_planning", "0 8 * * 1"),
        ("ops_check", "Verificação de custos e erros", "ops_check", "0 */6 * * *"),
    ]:
        store.tasks[key] = ScheduledTask(key=key, name=name, pipeline=pipeline, cron=cron)

    store.log("system", "seed.simulated_data_loaded", details={"products": len(products), "metrics": len(snapshots)})
