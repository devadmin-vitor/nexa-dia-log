import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, FileText, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function NovoBonusDialog({ open, onOpenChange, onCriado }) {
  const [numeroBonus, setNumeroBonus] = useState('');
  const [search, setSearch] = useState('');
  const [selectedNfIds, setSelectedNfIds] = useState([]);
  const [criando, setCriando] = useState(false);

  // Busca apenas NFs ainda não vinculadas a um bônus
  const { data: notasDisponiveis = [], isLoading } = useQuery({
    queryKey: ['notas-disponiveis-bonus'],
    queryFn: async () => {
      const todasNFs = await base44.entities.NotaFiscal.list('-created_date', 500);
      // Busca todos os bônus existentes para saber quais chaves já foram usadas
      const bonusExistentes = await base44.entities.BonusRecebimento.list('-created_date', 500);
      const chavesUsadas = new Set(
        bonusExistentes.flatMap(b => b.chaves_acesso || [])
      );
      return todasNFs.filter(nf => !chavesUsadas.has(nf.chave_acesso));
    },
    enabled: open,
  });

  const filtered = notasDisponiveis.filter(nf =>
    !search ||
    nf.numero_nf?.includes(search) ||
    nf.emitente_nome?.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(id) {
    setSelectedNfIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }

  async function handleCriar() {
    if (!numeroBonus.trim()) {
      toast.error('Informe o número do bônus.');
      return;
    }
    if (selectedNfIds.length === 0) {
      toast.error('Selecione ao menos uma nota fiscal.');
      return;
    }

    setCriando(true);
    try {
      const nfsSelecionadas = notasDisponiveis.filter(nf => selectedNfIds.includes(nf.id));

      // Verificar novamente se alguma chave já foi usada (dupla proteção)
      const bonusExistentes = await base44.entities.BonusRecebimento.list('-created_date', 500);
      const chavesUsadas = new Set(bonusExistentes.flatMap(b => b.chaves_acesso || []));
      const conflito = nfsSelecionadas.find(nf => chavesUsadas.has(nf.chave_acesso));
      if (conflito) {
        toast.error(`A NF #${conflito.numero_nf} já foi usada em outro bônus!`);
        setCriando(false);
        return;
      }

      // Montar itens esperados unificando itens de todas as NFs
      const itensMap = {};
      nfsSelecionadas.forEach(nf => {
        (nf.itens || []).forEach(item => {
          const key = item.codigo || item.descricao;
          if (!itensMap[key]) {
            itensMap[key] = { ean: item.codigo || '', descricao: item.descricao, qtd_esperada: 0 };
          }
          itensMap[key].qtd_esperada += item.quantidade || 0;
        });
      });

      const bonus = await base44.entities.BonusRecebimento.create({
        numero_bonus: numeroBonus.trim(),
        status: 'em_conferencia',
        notas_fiscais_ids: selectedNfIds,
        chaves_acesso: nfsSelecionadas.map(nf => nf.chave_acesso).filter(Boolean),
        emitente_nome: nfsSelecionadas[0]?.emitente_nome || '',
        itens_esperados: Object.values(itensMap),
      });

      toast.success(`Bônus #${numeroBonus} criado com ${selectedNfIds.length} NF(s)!`);
      setNumeroBonus('');
      setSelectedNfIds([]);
      setSearch('');
      onCriado?.(bonus);
      onOpenChange(false);
    } catch (err) {
      toast.error('Erro ao criar bônus: ' + err.message);
    } finally {
      setCriando(false);
    }
  }

  function handleClose() {
    if (!criando) {
      setNumeroBonus('');
      setSelectedNfIds([]);
      setSearch('');
      onOpenChange(false);
    }
  }

  const totalSelecionado = selectedNfIds.reduce((acc, id) => {
    const nf = notasDisponiveis.find(n => n.id === id);
    return acc + (nf?.valor_total || 0);
  }, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Novo Bônus de Recebimento</DialogTitle>
          <DialogDescription>
            Vincule as notas fiscais ao bônus. Cada NF só pode pertencer a um único bônus.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Número do bônus */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Número do Bônus *
            </Label>
            <Input
              value={numeroBonus}
              onChange={(e) => setNumeroBonus(e.target.value)}
              placeholder="Ex: BON-2024-001"
              className="font-mono"
              autoFocus
            />
          </div>

          {/* Busca de NFs */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Notas Fiscais Disponíveis *
              </Label>
              {selectedNfIds.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {selectedNfIds.length} selecionada(s)
                </Badge>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                className="pl-9 h-9 text-sm"
                placeholder="Buscar NF por número ou emitente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="border border-border rounded-xl overflow-hidden max-h-72 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <FileText className="w-8 h-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {search ? 'Nenhuma NF encontrada.' : 'Todas as NFs já foram vinculadas a bônus.'}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Importe novas NFs via XML para criar novos bônus.
                  </p>
                </div>
              ) : (
                filtered.map(nf => (
                  <label
                    key={nf.id}
                    className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-accent/40 border-b border-border last:border-0 transition-colors"
                  >
                    <Checkbox
                      checked={selectedNfIds.includes(nf.id)}
                      onCheckedChange={() => toggle(nf.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">NF #{nf.numero_nf}</span>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {nf.serie ? `Série ${nf.serie}` : 'S/S'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{nf.emitente_nome}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          {nf.itens?.length || 0} iten(s)
                        </span>
                        <span className="text-[10px] font-semibold text-primary">
                          R$ {nf.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Aviso de duplicata */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              NFs já vinculadas a outros bônus <strong>não aparecem</strong> nesta lista e não podem ser reutilizadas.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={handleClose} disabled={criando}>Cancelar</Button>
          <Button onClick={handleCriar} disabled={criando || selectedNfIds.length === 0 || !numeroBonus.trim()} className="gap-2">
            {criando ? 'Criando...' : `Criar Bônus com ${selectedNfIds.length} NF(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}