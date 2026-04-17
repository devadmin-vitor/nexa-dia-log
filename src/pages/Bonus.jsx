import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Plus, Search, Package, ClipboardCheck, AlertTriangle,
  Clock, ChevronRight, Trash2,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import BonusConferencia from '@/components/bonus/BonusConferencia';
import NovoBonusDialog from '@/components/bonus/NovoBonusDialog';

const STATUS_CONFIG = {
  em_conferencia: {
    label: 'Em Conferência',
    className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
    icon: Clock,
  },
  conferido: {
    label: 'Conferido',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
    icon: ClipboardCheck,
  },
  divergente: {
    label: 'Divergente',
    className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
    icon: AlertTriangle,
  },
};

export default function Bonus() {
  const [search, setSearch] = useState('');
  const [bonusAberto, setBonusAberto] = useState(null);
  const [novoDialogOpen, setNovoDialogOpen] = useState(false);
  const [deletandoId, setDeletandoId] = useState(null);
  const queryClient = useQueryClient();

  const { data: bonusList = [], isLoading } = useQuery({
    queryKey: ['bonus-recebimento'],
    queryFn: () => base44.entities.BonusRecebimento.list('-created_date', 200),
  });

  const filtered = bonusList.filter(b =>
    !search ||
    b.numero_bonus?.toLowerCase().includes(search.toLowerCase()) ||
    b.emitente_nome?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleDelete(id) {
    await base44.entities.BonusRecebimento.delete(id);
    queryClient.invalidateQueries({ queryKey: ['bonus-recebimento'] });
    queryClient.invalidateQueries({ queryKey: ['notas-disponiveis-bonus'] });
    setDeletandoId(null);
    toast.success('Bônus removido.');
  }

  function handleConferenciaConcluida(itens, status) {
    queryClient.invalidateQueries({ queryKey: ['bonus-recebimento'] });
    setBonusAberto(null);
  }

  function handleCriado(bonus) {
    queryClient.invalidateQueries({ queryKey: ['bonus-recebimento'] });
    queryClient.invalidateQueries({ queryKey: ['notas-disponiveis-bonus'] });
    // Abre diretamente para conferência
    setTimeout(() => setBonusAberto(bonus), 300);
  }

  // ── Se há um bônus aberto, exibe a tela de conferência ──────────────────
  if (bonusAberto) {
    return (
      <BonusConferencia
        bonus={bonusAberto}
        onConferenciaConcluida={handleConferenciaConcluida}
        onVoltar={() => setBonusAberto(null)}
      />
    );
  }

  // ── Listagem ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bônus de Recebimento</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie as conferências cegas de mercadorias recebidas via XML
          </p>
        </div>
        <Button onClick={() => setNovoDialogOpen(true)} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          Novo Bônus
        </Button>
      </div>

      {/* Stats rápidas */}
      {bonusList.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Em Conferência', status: 'em_conferencia', color: 'text-blue-600' },
            { label: 'Conferidos', status: 'conferido', color: 'text-emerald-600' },
            { label: 'Divergentes', status: 'divergente', color: 'text-orange-600' },
          ].map(({ label, status, color }) => (
            <Card key={status} className="border-border">
              <CardContent className="py-3 px-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-2xl font-bold tabular-nums mt-0.5 ${color}`}>
                  {bonusList.filter(b => b.status === status).length}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Busca */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por número ou emitente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm font-medium text-muted-foreground">
              {search ? 'Nenhum bônus encontrado.' : 'Nenhum bônus criado ainda.'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Clique em "Novo Bônus" para iniciar uma conferência.
            </p>
            {!search && (
              <Button className="mt-4 gap-2" onClick={() => setNovoDialogOpen(true)}>
                <Plus className="w-4 h-4" /> Criar Primeiro Bônus
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(bonus => {
            const cfg = STATUS_CONFIG[bonus.status] || STATUS_CONFIG.em_conferencia;
            const Icon = cfg.icon;
            const totalConferido = (bonus.itens_conferidos || []).reduce((acc, i) => acc + (i.qtd_caixas || 0), 0);
            const totalEsperado = (bonus.itens_esperados || []).reduce((acc, i) => acc + (i.qtd_esperada || 0), 0);

            return (
              <div key={bonus.id} className="relative group">
                <Card
                  className="border-border hover:border-primary/30 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => {
                    // Recarrega o bônus atualizado antes de abrir
                    base44.entities.BonusRecebimento.filter({ id: bonus.id })
                      .then(res => setBonusAberto(res?.[0] || bonus))
                      .catch(() => setBonusAberto(bonus));
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm">Bônus #{bonus.numero_bonus}</span>
                          <Badge className={`text-[10px] border ${cfg.className}`}>
                            {cfg.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {bonus.emitente_nome || 'Emitente não informado'}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span className="text-[10px] text-muted-foreground">
                            <span className="font-semibold text-foreground">{bonus.notas_fiscais_ids?.length || 0}</span> NF(s)
                          </span>
                          {totalConferido > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              Conferido: <span className="font-semibold text-foreground">{totalConferido.toLocaleString('pt-BR')} cx</span>
                            </span>
                          )}
                          {totalEsperado > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              Esperado: <span className="font-semibold text-foreground">{totalEsperado.toLocaleString('pt-BR')} cx</span>
                            </span>
                          )}
                          {bonus.data_conferencia && (
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(bonus.data_conferencia), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-1 group-hover:text-primary transition-colors" />
                    </div>
                  </CardContent>
                </Card>

                {/* Botão de excluir */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-3 right-9 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10 z-10"
                  onClick={(e) => { e.stopPropagation(); setDeletandoId(bonus.id); }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <NovoBonusDialog
        open={novoDialogOpen}
        onOpenChange={setNovoDialogOpen}
        onCriado={handleCriado}
      />

      <AlertDialog open={!!deletandoId} onOpenChange={(o) => !o && setDeletandoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este bônus?</AlertDialogTitle>
            <AlertDialogDescription>
              O bônus e sua conferência serão removidos. As notas fiscais vinculadas ficarão disponíveis novamente para um novo bônus. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => handleDelete(deletandoId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}