import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  Weight, Trophy, Truck, Users, ChevronRight,
  TrendingUp, CheckCircle2, XCircle, AlertTriangle, Settings,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ConfiguracaoDialog from '@/components/expedicao/ConfiguracaoDialog';

const hoje = format(new Date(), 'yyyy-MM-dd');

export default function DashboardExpedicao() {
  const [configOpen, setConfigOpen] = useState(false);

  const { data: notas = [], isLoading: loadingNotas } = useQuery({
    queryKey: ['notas-expedicao-all'],
    queryFn: () => base44.entities.NotaFiscal.list('-created_date', 9999),
  });

  const { data: configs = [], isLoading: loadingConfig, refetch: refetchConfig } = useQuery({
    queryKey: ['dashboard-config'],
    queryFn: () => base44.entities.DashboardConfig.list(),
  });

  const { data: expedicoes = [], isLoading: loadingExp } = useQuery({
    queryKey: ['expedicoes-hoje', hoje],
    queryFn: () => base44.entities.ExpedicaoVeiculo.filter({ data_expedicao: hoje }),
  });

  const isLoading = loadingNotas || loadingConfig || loadingExp;
  const config = configs[0] || { valor_por_kg: 0.01, meta_premiacao: null, meta_veiculos_dia: 8 };

  // Cálculos gerais (todas as NFs)
  const pesoTotalKg = notas.reduce((acc, nf) => acc + (nf.peso_bruto || 0), 0);
  const valorPremiacao = pesoTotalKg * (config.valor_por_kg || 0.01);
  const metaAtingida = config.meta_premiacao != null && valorPremiacao >= config.meta_premiacao;

  // Veículos do dia
  const veiculosHoje = expedicoes.length;
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
          <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)} className="gap-2">
            <Settings className="w-4 h-4" />
            Configurar
          </Button>
          <Button size="sm" asChild className="gap-2">
            <Link to="/expedicoes">
              <Truck className="w-4 h-4" />
              Nova Expedição
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* Cards de KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

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

            {/* Card 2: Meta de Premiação */}
            <Card className={`border-2 ${metaAtingida ? 'border-emerald-400/50 bg-gradient-to-br from-emerald-50 to-background dark:from-emerald-950/20' : 'border-border'}`}>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${metaAtingida ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-muted'}`}>
                    <Trophy className={`w-4 h-4 ${metaAtingida ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                  </div>
                  <p className="text-sm font-semibold text-muted-foreground">Meta de Premiação</p>
                </div>

                {config.meta_premiacao != null ? (
                  <>
                    <p className="text-3xl font-bold tabular-nums">
                      {config.meta_premiacao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                    <div className="mt-2">
                      {/* Barra de progresso */}
                      <div className="w-full bg-muted rounded-full h-2 mt-2 mb-1">
                        <div
                          className={`h-2 rounded-full transition-all ${metaAtingida ? 'bg-emerald-500' : 'bg-primary'}`}
                          style={{ width: `${Math.min(100, (valorPremiacao / config.meta_premiacao) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {Math.min(100, (valorPremiacao / config.meta_premiacao) * 100).toFixed(1)}% da meta
                      </p>
                    </div>
                    <Badge className={`mt-2 text-xs gap-1 ${metaAtingida
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {metaAtingida ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {metaAtingida ? 'Premiação Liberada!' : 'Não Atingida'}
                    </Badge>
                  </>
                ) : (
                  <div className="mt-2">
                    <p className="text-sm text-muted-foreground">Meta não configurada</p>
                    <Button variant="outline" size="sm" className="mt-3 gap-1.5 text-xs" onClick={() => setConfigOpen(true)}>
                      <Settings className="w-3 h-3" />
                      Definir meta
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Card 3: Veículos do dia */}
            <Card className={`border-2 ${acimaMeta ? 'border-orange-400/50 bg-gradient-to-br from-orange-50 to-background dark:from-orange-950/20' : atingiuMetaVeiculos ? 'border-emerald-400/50 bg-gradient-to-br from-emerald-50 to-background dark:from-emerald-950/20' : 'border-border'}`}>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${acimaMeta ? 'bg-orange-100 dark:bg-orange-900/30' : atingiuMetaVeiculos ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-muted'}`}>
                    <Truck className={`w-4 h-4 ${acimaMeta ? 'text-orange-600' : atingiuMetaVeiculos ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                  </div>
                  <p className="text-sm font-semibold text-muted-foreground">Veículos Hoje</p>
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

          {/* Lista de veículos do dia */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Veículos Expedidos Hoje</h2>
              <Button variant="ghost" size="sm" asChild className="gap-1 text-xs">
                <Link to="/expedicoes">
                  Ver todas <ChevronRight className="w-3 h-3" />
                </Link>
              </Button>
            </div>

            {expedicoes.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <Truck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma expedição registrada hoje.</p>
                  <Button size="sm" className="mt-4 gap-2" asChild>
                    <Link to="/expedicoes">
                      <Truck className="w-4 h-4" />
                      Registrar Expedição
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {expedicoes.map(exp => (
                  <Card key={exp.id} className="border-border hover:border-primary/30 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center shrink-0">
                          <Truck className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm font-mono uppercase">{exp.placa}</span>
                            {exp.nota_fiscal_ids?.length > 0 && (
                              <Badge variant="secondary" className="text-[10px]">
                                {exp.nota_fiscal_ids.length} NF(s)
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-muted-foreground">
                            {exp.peso_total_kg > 0 && (
                              <span className="flex items-center gap-1">
                                <Weight className="w-3 h-3" />
                                {exp.peso_total_kg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg
                              </span>
                            )}
                            {exp.participantes?.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {exp.participantes.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-primary tabular-nums">
                            {((exp.peso_total_kg || 0) * (config.valor_por_kg || 0.01)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                          <p className="text-[10px] text-muted-foreground">premiação</p>
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

      <ConfiguracaoDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        config={config}
        configId={configs[0]?.id}
        onSalvo={() => refetchConfig()}
      />
    </div>
  );
}