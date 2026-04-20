import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Clock,
  FileText, Calendar, Package, ShieldCheck, List,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_CONFIG = {
  em_conferencia: { label: '1ª Conferência', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  aguardando_2a_conferencia: { label: 'Ag. 2ª Conferência', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  conferido: { label: 'Conferido', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  divergente: { label: 'Divergente', className: 'bg-orange-100 text-orange-700 border-orange-200' },
};

function ItensTable({ itens, titulo, cor }) {
  if (!itens || itens.length === 0) return null;

  const itensBons = itens.filter(i => i.tipo_estoque !== 'AVARIA');
  const itensAvaria = itens.filter(i => i.tipo_estoque === 'AVARIA');

  return (
    <div>
      <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${cor}`}>{titulo}</h3>
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider">EAN</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider">Descrição</th>
              <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider">Validade</th>
              <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider">Qtd Cx</th>
              <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider">Paletes</th>
              <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider">Tipo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {itensBons.map((item, i) => (
              <tr key={i} className="hover:bg-muted/30">
                <td className="px-3 py-2 font-mono text-muted-foreground">{item.ean || '—'}</td>
                <td className="px-3 py-2 font-medium">{item.descricao || '—'}</td>
                <td className="px-3 py-2 text-center tabular-nums">
                  {item.validade
                    ? format(new Date(item.validade), 'dd/MM/yyyy')
                    : <span className="text-muted-foreground/50">—</span>
                  }
                </td>
                <td className="px-3 py-2 text-center font-bold tabular-nums text-foreground">
                  {(item.qtd_caixas || 0).toLocaleString('pt-BR')}
                </td>
                <td className="px-3 py-2 text-center text-muted-foreground">{item.qtd_paletes || '—'}</td>
                <td className="px-3 py-2 text-center">
                  <Badge className="text-[9px] bg-emerald-100 text-emerald-700 border border-emerald-200">BOM</Badge>
                </td>
              </tr>
            ))}
            {itensAvaria.map((item, i) => (
              <tr key={`av_${i}`} className="bg-red-50/50 hover:bg-red-50">
                <td className="px-3 py-2 font-mono text-muted-foreground">{item.ean || '—'}</td>
                <td className="px-3 py-2 font-medium">{item.descricao || '—'}</td>
                <td className="px-3 py-2 text-center tabular-nums">
                  {item.validade
                    ? format(new Date(item.validade), 'dd/MM/yyyy')
                    : <span className="text-muted-foreground/50">—</span>
                  }
                </td>
                <td className="px-3 py-2 text-center font-bold tabular-nums text-red-600">
                  {(item.qtd_caixas || 0).toLocaleString('pt-BR')}
                </td>
                <td className="px-3 py-2 text-center text-muted-foreground">{item.qtd_paletes || '—'}</td>
                <td className="px-3 py-2 text-center">
                  <Badge className="text-[9px] bg-red-100 text-red-700 border border-red-200 gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    AVARIA
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totais */}
        <div className="px-3 py-2 bg-muted/30 border-t border-border flex items-center justify-end gap-6 text-xs">
          <span>
            Total Boas: <span className="font-bold text-foreground">{itensBons.reduce((a, i) => a + (i.qtd_caixas || 0), 0).toLocaleString('pt-BR')} cx</span>
          </span>
          {itensAvaria.length > 0 && (
            <span className="text-red-600">
              Total Avarias: <span className="font-bold">{itensAvaria.reduce((a, i) => a + (i.qtd_caixas || 0), 0).toLocaleString('pt-BR')} cx</span>
            </span>
          )}
          <span className="font-semibold">
            Total Geral: <span className="text-foreground">{itens.reduce((a, i) => a + (i.qtd_caixas || 0), 0).toLocaleString('pt-BR')} cx</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function DivergenciasSection({ bonus }) {
  const conf1 = bonus.itens_conferidos || [];
  const conf2 = bonus.itens_conferidos_2 || [];
  const esperados = bonus.itens_esperados || [];

  if (conf1.length === 0 && conf2.length === 0) return null;

  // Mapa de totais por EAN
  const totais1 = {};
  conf1.forEach(i => { totais1[i.ean] = (totais1[i.ean] || 0) + (i.qtd_caixas || 0); });

  const totais2 = {};
  conf2.forEach(i => { totais2[i.ean] = (totais2[i.ean] || 0) + (i.qtd_caixas || 0); });

  const totaisEsp = {};
  const descMap = {};
  esperados.forEach(i => {
    totaisEsp[i.ean] = (totaisEsp[i.ean] || 0) + (i.qtd_esperada || 0);
    descMap[i.ean] = i.descricao;
  });
  conf1.forEach(i => { descMap[i.ean] = descMap[i.ean] || i.descricao; });
  conf2.forEach(i => { descMap[i.ean] = descMap[i.ean] || i.descricao; });

  // Divergências NF x 1ª conf
  const allEansVsNF = new Set([...Object.keys(totaisEsp), ...Object.keys(totais1)]);
  const divNF = [...allEansVsNF]
    .map(ean => ({ ean, descricao: descMap[ean] || ean, esperado: totaisEsp[ean] || 0, conferido1: totais1[ean] || 0 }))
    .filter(d => d.esperado !== d.conferido1);

  // Divergências 1ª x 2ª conf
  const allEansConf = new Set([...Object.keys(totais1), ...Object.keys(totais2)]);
  const div12 = conf2.length > 0
    ? [...allEansConf]
        .map(ean => ({ ean, descricao: descMap[ean] || ean, conf1: totais1[ean] || 0, conf2: totais2[ean] || 0 }))
        .filter(d => d.conf1 !== d.conf2)
    : [];

  if (divNF.length === 0 && div12.length === 0) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        Nenhuma divergência encontrada — conferência 100% consistente.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {divNF.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-orange-600 mb-2">Divergências NF vs 1ª Conferência</h3>
          <div className="rounded-xl border border-orange-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-orange-50 border-b border-orange-200">
                  <th className="text-left px-3 py-2 font-semibold text-orange-700 uppercase">Produto</th>
                  <th className="text-right px-3 py-2 font-semibold text-orange-700 uppercase">Esperado NF</th>
                  <th className="text-right px-3 py-2 font-semibold text-orange-700 uppercase">1ª Conf.</th>
                  <th className="text-right px-3 py-2 font-semibold text-orange-700 uppercase">Diferença</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-100">
                {divNF.map((d, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">
                      <p className="font-medium">{d.descricao}</p>
                      <p className="text-muted-foreground font-mono">{d.ean}</p>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{d.esperado.toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold">{d.conferido1.toLocaleString('pt-BR')}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-bold ${d.conferido1 - d.esperado > 0 ? 'text-orange-600' : 'text-red-600'}`}>
                      {d.conferido1 - d.esperado > 0 ? '+' : ''}{(d.conferido1 - d.esperado).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {div12.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-red-600 mb-2">Divergências 1ª vs 2ª Conferência</h3>
          <div className="rounded-xl border border-red-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-red-50 border-b border-red-200">
                  <th className="text-left px-3 py-2 font-semibold text-red-700 uppercase">Produto</th>
                  <th className="text-right px-3 py-2 font-semibold text-red-700 uppercase">1ª Conf.</th>
                  <th className="text-right px-3 py-2 font-semibold text-red-700 uppercase">2ª Conf.</th>
                  <th className="text-right px-3 py-2 font-semibold text-red-700 uppercase">Diferença</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {div12.map((d, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">
                      <p className="font-medium">{d.descricao}</p>
                      <p className="text-muted-foreground font-mono">{d.ean}</p>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{d.conf1.toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold">{d.conf2.toLocaleString('pt-BR')}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-bold ${d.conf2 - d.conf1 > 0 ? 'text-orange-600' : 'text-red-600'}`}>
                      {d.conf2 - d.conf1 > 0 ? '+' : ''}{(d.conf2 - d.conf1).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BonusDetalhado({ bonus, onVoltar }) {
  const cfg = STATUS_CONFIG[bonus.status] || STATUS_CONFIG.em_conferencia;

  const itens1 = bonus.itens_conferidos || [];
  const itens2 = bonus.itens_conferidos_2 || [];
  const totalCx1 = itens1.reduce((a, i) => a + (i.qtd_caixas || 0), 0);
  const totalCx2 = itens2.reduce((a, i) => a + (i.qtd_caixas || 0), 0);
  const totalEsp = (bonus.itens_esperados || []).reduce((a, i) => a + (i.qtd_esperada || 0), 0);
  const temAvaria1 = itens1.some(i => i.tipo_estoque === 'AVARIA');
  const temAvaria2 = itens2.some(i => i.tipo_estoque === 'AVARIA');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={onVoltar} className="-ml-1 shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">Bônus #{bonus.numero_bonus}</h1>
            <Badge className={`text-[11px] border ${cfg.className}`}>{cfg.label}</Badge>
            {(temAvaria1 || temAvaria2) && (
              <Badge className="text-[11px] border bg-red-100 text-red-700 border-red-200 gap-1">
                <AlertTriangle className="w-3 h-3" />
                Contém Avarias
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{bonus.emitente_nome || '—'}</p>
        </div>
      </div>

      {/* Metadados */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">NFs Vinculadas</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">{bonus.notas_fiscais_ids?.length || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Total Esperado</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">{totalEsp.toLocaleString('pt-BR')} cx</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">1ª Conferência</p>
            <p className="text-xl font-bold tabular-nums mt-0.5 text-blue-600">
              {totalCx1.toLocaleString('pt-BR')} cx
            </p>
          </CardContent>
        </Card>
        {itens2.length > 0 && (
          <Card className="border-border">
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground">2ª Conferência</p>
              <p className="text-xl font-bold tabular-nums mt-0.5 text-purple-600">
                {totalCx2.toLocaleString('pt-BR')} cx
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Datas */}
      <div className="flex gap-4 flex-wrap text-xs text-muted-foreground">
        {bonus.data_conferencia && (
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            1ª Conf.: <strong className="text-foreground">{format(new Date(bonus.data_conferencia), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</strong>
          </span>
        )}
        {bonus.data_conferencia_2 && (
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            2ª Conf.: <strong className="text-foreground">{format(new Date(bonus.data_conferencia_2), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</strong>
          </span>
        )}
      </div>

      {/* 1ª Conferência */}
      {itens1.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center">
              <List className="w-3.5 h-3.5 text-blue-700" />
            </div>
            <h2 className="font-semibold text-sm">1ª Conferência</h2>
            {bonus.data_conferencia && (
              <span className="text-xs text-muted-foreground">
                — {format(new Date(bonus.data_conferencia), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
          </div>
          <ItensTable itens={itens1} titulo="Itens Conferidos" cor="text-blue-700" />
        </section>
      )}

      {/* 2ª Conferência */}
      {itens2.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-700" />
            </div>
            <h2 className="font-semibold text-sm">2ª Conferência</h2>
            {bonus.data_conferencia_2 && (
              <span className="text-xs text-muted-foreground">
                — {format(new Date(bonus.data_conferencia_2), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
          </div>
          <ItensTable itens={itens2} titulo="Itens Verificados" cor="text-purple-700" />
        </section>
      )}

      {/* Itens Esperados (NFs) */}
      {bonus.itens_esperados?.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <h2 className="font-semibold text-sm">Itens Esperados (NFs)</h2>
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase">EAN</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase">Descrição</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground uppercase">Qtd Esperada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bonus.itens_esperados.map((item, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-muted-foreground">{item.ean || '—'}</td>
                    <td className="px-3 py-2 font-medium">{item.descricao || '—'}</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">
                      {(item.qtd_esperada || 0).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Análise de Divergências */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-orange-100 flex items-center justify-center">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-700" />
          </div>
          <h2 className="font-semibold text-sm">Análise de Divergências</h2>
        </div>
        <DivergenciasSection bonus={bonus} />
      </section>

      {/* Observação */}
      {bonus.observacao && (
        <section className="p-4 rounded-xl bg-muted/50 border border-border text-sm text-muted-foreground">
          <strong className="text-foreground">Observação:</strong> {bonus.observacao}
        </section>
      )}
    </div>
  );
}