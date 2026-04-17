import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  Weight, Truck, Users, ChevronRight,
  TrendingUp, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const hoje = format(new Date(), 'yyyy-MM-dd');

export default function DashboardExpedicao() {
  const { data: notas = [], isLoading: loadingNotas } = useQuery({
    queryKey: ['notas-expedicao-all'],
    queryFn: () => base44.entities.NotaFiscal.list('-created_date', 9999),
  });

  const { data: configs = [], isLoading: loadingConfig } = useQuery({
    queryKey: ['dashboard-config'],
    queryFn: () => base44.entities.DashboardConfig.list(),
  });

  const { data: expedicoes = [], isLoading: loadingExp } = useQuery({
    queryKey: ['expedicoes-hoje', hoje],
    queryFn: () => base44.entities.ExpedicaoVeiculo.filter({ data_expedicao: hoje }),
  });

  // Bônus conferidos hoje (qualquer status que não seja em_conferencia)
  const { data: bonusHoje = [], isLoading: loadingBonus } = useQuery({
    queryKey: ['bonus-conferidos-hoje', hoje],
    queryFn: async () => {
      const todos = await base44.entities.BonusRecebimento.list('-created_date', 9999);
      const inicioDia = startOfDay(new Date()).toISOString();
      const fimDia = endOfDay(new Date()).toISOString();
      return todos.filter(b => {
        const conferidoEm = b.data_conferencia || b.data_conferencia_2 || b.created_date;
        return (
          (b.status === 'conferido' || b.status === 'divergente' || b.status === 'aguardando_2a_conferencia') &&
          conferidoEm >= inicioDia && conferidoEm <= fimDia
        );
      });
    },
  });

  const isLoading = loadingNotas || loadingConfig || loadingExp || loadingBonus;
  const config = configs[0] || { valor_por_kg: 0.01, meta_veiculos_dia: 8 };

  // Cálculos gerais (todas as NFs)
  const pesoTotalKg = notas.reduce((acc, nf) => acc + (nf.peso_bruto || 0), 0);
  const valorPremiacao = pesoTotalKg * (config.valor_por_kg || 0.01);

  // Veículos = bônus conferidos hoje
  const veiculosHoje = bonusHoje.length;
  const metaVeiculos = config.meta_veiculos_dia || 8;
  const acimaMeta = veiculosHoje > metaVeiculos;
  const atingiuMetaVeiculos = veiculosHoje >= metaVeiculos;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard de Expedição</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" asChild className="gap-2">
            <Link to="/expedicoes">
              <Truck className="w-4 h-4" />
              Nova Expedição
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* Cards de KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Card 1: Peso / Premiação */}
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Weight className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-muted-foreground">Peso & Premiação</p>
                </div>
                <p className="text-3xl font-bold tabular-nums">
                  {pesoTotalKg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                  <span className="text-base font-normal text-muted-foreground ml-1">kg</span>
                </p>
                <p className="text-lg font-semibold text-primary mt-1 tabular-nums">
                  {valorPremiacao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  <span className="text-xs font-normal text-muted-foreground ml-1">acumulado</span>
                </p>
                <p className="text-[10px] text-muted-foreground mt-2">
                  {(config.valor_por_kg || 0.01).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/kg
                </p>
              </CardContent>
            </Card>

            {/* Card 2: Bônus conferidos hoje (= veículos) */}
            <Card className={`border-2 ${acimaMeta ? 'border-orange-400/50 bg-gradient-to-br from-orange-50 to-background dark:from-orange-950/20' : atingiuMetaVeiculos ? 'border-emerald-400/50 bg-gradient-to-br from-emerald-50 to-background dark:from-emerald-950/20' : 'border-border'}`}>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${acimaMeta ? 'bg-orange-100 dark:bg-orange-900/30' : atingiuMetaVeiculos ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-muted'}`}>
                    <Truck className={`w-4 h-4 ${acimaMeta ? 'text-orange-600' : atingiuMetaVeiculos ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                  </div>
                  <p className="text-sm font-semibold text-muted-foreground">Bônus Conferidos Hoje</p>
                  </div>
                  <p className="text-3xl font-bold tabular-nums">
                  {veiculosHoje}
                  <span className="text-base font-normal text-muted-foreground ml-1">/ {metaVeiculos}</span>
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">meta do dia</p>
                <Badge className={`mt-2 text-xs gap-1 ${acimaMeta
                  ? 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400'
                  : atingiuMetaVeiculos
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-secondary text-secondary-foreground border-border'}`}>
                  {acimaMeta ? <AlertTriangle className="w-3 h-3" /> : atingiuMetaVeiculos ? <CheckCircle2 className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                  {acimaMeta ? 'Acima da meta' : atingiuMetaVeiculos ? 'Meta atingida' : 'Em andamento'}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Lista de bônus conferidos hoje */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Bônus Conferidos Hoje</h2>
              <Button variant="ghost" size="sm" asChild className="gap-1 text-xs">
                <Link to="/bonus">
                  Ver todos <ChevronRight className="w-3 h-3" />
                </Link>
              </Button>
            </div>

            {bonusHoje.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <Truck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhum bônus conferido hoje.</p>
                  <Button size="sm" className="mt-4 gap-2" asChild>
                    <Link to="/bonus">
                      <Truck className="w-4 h-4" />
                      Ir para Bônus
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {bonusHoje.map(b => (
                  <Card key={b.id} className="border-border hover:border-primary/30 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center shrink-0">
                          <Truck className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm">Bônus #{b.numero_bonus}</span>
                            <Badge variant="secondary" className="text-[10px]">
                              {b.status === 'conferido' ? 'Conferido' : b.status === 'divergente' ? 'Divergente' : '2ª Conf.'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {b.emitente_nome || '—'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">
                            {b.notas_fiscais_ids?.length || 0} NF(s)
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}