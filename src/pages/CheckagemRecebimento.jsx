import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search, ClipboardList, ChevronRight, AlertTriangle, CheckCircle2,
  Clock, ArrowLeft, Package, Calendar, FileText, Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import BonusDetalhado from '@/components/checagem/BonusDetalhado';

const STATUS_CONFIG = {
  em_conferencia: {
    label: '1ª Conferência',
    className: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: Clock,
  },
  aguardando_2a_conferencia: {
    label: 'Ag. 2ª Conf.',
    className: 'bg-purple-100 text-purple-700 border-purple-200',
    icon: Clock,
  },
  conferido: {
    label: 'Conferido',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: CheckCircle2,
  },
  divergente: {
    label: 'Divergente',
    className: 'bg-orange-100 text-orange-700 border-orange-200',
    icon: AlertTriangle,
  },
};

export default function CheckagemRecebimento() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [bonusSelecionado, setBonusSelecionado] = useState(null);

  const { data: bonusList = [], isLoading } = useQuery({
    queryKey: ['checagem-bonus'],
    queryFn: () => base44.entities.BonusRecebimento.list('-created_date', 500),
  });

  const filtered = useMemo(() => {
    return bonusList.filter(b => {
      const matchStatus = filterStatus === 'todos' || b.status === filterStatus;
      const matchSearch = !search ||
        b.numero_bonus?.toLowerCase().includes(search.toLowerCase()) ||
        b.emitente_nome?.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [bonusList, search, filterStatus]);

  // Stats
  const stats = useMemo(() => ({
    total: bonusList.length,
    conferido: bonusList.filter(b => b.status === 'conferido').length,
    divergente: bonusList.filter(b => b.status === 'divergente').length,
    em_andamento: bonusList.filter(b => ['em_conferencia', 'aguardando_2a_conferencia'].includes(b.status)).length,
  }), [bonusList]);

  if (bonusSelecionado) {
    return (
      <BonusDetalhado
        bonus={bonusSelecionado}
        onVoltar={() => setBonusSelecionado(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Checagem de Recebimento</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Relatório completo de todos os bônus — itens conferidos, validades, avarias e divergências
        </p>
      </div>

      {/* Stats */}
      {!isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-border">
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground">Total de Bônus</p>
              <p className="text-2xl font-bold tabular-nums mt-0.5">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground">Conferidos</p>
              <p className="text-2xl font-bold tabular-nums mt-0.5 text-emerald-600">{stats.conferido}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground">Divergentes</p>
              <p className="text-2xl font-bold tabular-nums mt-0.5 text-orange-600">{stats.divergente}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground">Em Andamento</p>
              <p className="text-2xl font-bold tabular-nums mt-0.5 text-blue-600">{stats.em_andamento}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por número ou emitente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'todos', label: 'Todos' },
            { key: 'conferido', label: 'Conferidos' },
            { key: 'divergente', label: 'Divergentes' },
            { key: 'aguardando_2a_conferencia', label: 'Ag. 2ª Conf.' },
            { key: 'em_conferencia', label: 'Em Conferência' },
          ].map(({ key, label }) => (
            <Button
              key={key}
              variant={filterStatus === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus(key)}
              className="text-xs h-9"
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm font-medium text-muted-foreground">Nenhum bônus encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(bonus => {
            const cfg = STATUS_CONFIG[bonus.status] || STATUS_CONFIG.em_conferencia;
            const Icon = cfg.icon;

            // Usa itens_conferidos_2 se existir (bônus finalizado), senão itens_conferidos
            const itensFinais = bonus.itens_conferidos_2?.length
              ? bonus.itens_conferidos_2
              : (bonus.itens_conferidos || []);

            const totalCaixas = itensFinais.reduce((acc, i) => acc + (i.qtd_caixas || 0), 0);
            const totalEsperado = (bonus.itens_esperados || []).reduce((acc, i) => acc + (i.qtd_esperada || 0), 0);
            const temAvaria = itensFinais.some(i => i.tipo_estoque === 'AVARIA');
            const totalAvarias = itensFinais.filter(i => i.tipo_estoque === 'AVARIA').reduce((acc, i) => acc + (i.qtd_caixas || 0), 0);

            const dataFinal = bonus.data_conferencia_2 || bonus.data_conferencia;

            return (
              <Card
                key={bonus.id}
                className="border-border hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group"
                onClick={() => setBonusSelecionado(bonus)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">Bônus #{bonus.numero_bonus}</span>
                        <Badge className={`text-[10px] border ${cfg.className}`}>{cfg.label}</Badge>
                        {temAvaria && (
                          <Badge className="text-[10px] border bg-red-100 text-red-700 border-red-200 gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Avaria
                          </Badge>
                        )}
                        {bonus.itens_conferidos_2?.length > 0 && (
                          <Badge className="text-[10px] border bg-emerald-50 text-emerald-700 border-emerald-200">
                            Dupla conf.
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {bonus.emitente_nome || 'Emitente não informado'}
                      </p>

                      <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[11px] text-muted-foreground">
                        {totalCaixas > 0 && (
                          <span>
                            <span className="font-semibold text-foreground">{totalCaixas.toLocaleString('pt-BR')}</span> cx conferidas
                          </span>
                        )}
                        {totalEsperado > 0 && (
                          <span>
                            Esperado: <span className="font-semibold text-foreground">{totalEsperado.toLocaleString('pt-BR')}</span> cx
                          </span>
                        )}
                        {totalAvarias > 0 && (
                          <span className="text-red-600 font-medium">
                            {totalAvarias.toLocaleString('pt-BR')} cx avariadas
                          </span>
                        )}
                        {bonus.notas_fiscais_ids?.length > 0 && (
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {bonus.notas_fiscais_ids.length} NF(s)
                          </span>
                        )}
                        {dataFinal && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(dataFinal), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="ghost" size="sm" className="gap-1.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye className="w-3.5 h-3.5" />
                        Ver detalhes
                      </Button>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-center pb-4">
          {filtered.length} bônus exibido(s) de {bonusList.length} total
        </p>
      )}
    </div>
  );
}