import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Search, Layers, Pencil, PackageSearch, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// Extrai produtos únicos de todas as NFs importadas
function extrairProdutosNFs(notas) {
  const map = {};
  notas.forEach(nf => {
    (nf.itens || []).forEach(item => {
      const key = item.codigo || item.descricao;
      if (!map[key]) {
        map[key] = {
          codigo: item.codigo || '',
          ean: item.ean || '',
          descricao: item.descricao || '',
          unidade: item.unidade || '',
        };
      } else if (!map[key].ean && item.ean) {
        // Preenche EAN se ainda não encontrado
        map[key].ean = item.ean;
      }
    });
  });
  return Object.values(map);
}

// ── Dialog de edição ──────────────────────────────────────────────────────────
function EditarLogisticaDialog({ open, onOpenChange, produto, logisticaExistente, onSalvo }) {
  const [ean, setEan] = useState(logisticaExistente?.ean || '');
  const [lastro, setLastro] = useState(logisticaExistente?.lastro?.toString() || '');
  const [camada, setCamada] = useState(logisticaExistente?.camada?.toString() || '');
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState({});

  const norma = (parseInt(lastro) || 0) * (parseInt(camada) || 0);

  // Resetar ao abrir — pré-preenche EAN do XML se ainda não houver registro
  React.useEffect(() => {
    if (open) {
      setEan(logisticaExistente?.ean || produto?.ean || '');
      setLastro(logisticaExistente?.lastro?.toString() || '');
      setCamada(logisticaExistente?.camada?.toString() || '');
      setErros({});
    }
  }, [open, logisticaExistente, produto]);

  function validar() {
    const e = {};
    if (!ean.trim()) e.ean = 'EAN é obrigatório.';
    const l = parseInt(lastro);
    if (!l || l <= 0 || !Number.isInteger(l)) e.lastro = 'Deve ser inteiro > 0.';
    const c = parseInt(camada);
    if (!c || c <= 0 || !Number.isInteger(c)) e.camada = 'Deve ser inteiro > 0.';
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function handleSalvar() {
    if (!validar()) return;
    setSalvando(true);
    try {
      const payload = {
        ean: ean.trim(),
        descricao: produto.descricao,
        lastro: parseInt(lastro),
        camada: parseInt(camada),
        unidade: produto.unidade || 'CX',
        ativo: true,
      };

      if (logisticaExistente) {
        await base44.entities.ProdutoLogistica.update(logisticaExistente.id, payload);
      } else {
        await base44.entities.ProdutoLogistica.create(payload);
      }

      toast.success(`Logística de "${produto.descricao}" salva!`);
      onSalvo?.();
      onOpenChange(false);
    } catch (err) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dados Logísticos</DialogTitle>
          <DialogDescription className="text-xs truncate max-w-full">
            {produto?.descricao}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Código */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Código / SKU
            </Label>
            <Input value={produto?.codigo || '—'} disabled className="font-mono bg-muted/40" />
          </div>

          {/* EAN */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                EAN / Cód. Barras *
              </Label>
              {produto?.ean && (
                <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Preenchido pelo XML
                </span>
              )}
            </div>
            <Input
              value={ean}
              onChange={e => setEan(e.target.value)}
              placeholder="Ex: 7891234560010"
              className={`font-mono ${erros.ean ? 'border-destructive' : produto?.ean ? 'border-emerald-300 focus-visible:ring-emerald-400/40' : ''}`}
              autoFocus
            />
            {erros.ean && <p className="text-[11px] text-destructive">{erros.ean}</p>}
            {!erros.ean && produto?.ean && (
              <p className="text-[10px] text-muted-foreground">EAN lido do XML. Edite se necessário.</p>
            )}
          </div>

          {/* Lastro + Camada lado a lado */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Lastro (cx/camada) *
              </Label>
              <Input
                type="number"
                min={1}
                value={lastro}
                onChange={e => setLastro(e.target.value)}
                placeholder="Ex: 12"
                className={`tabular-nums ${erros.lastro ? 'border-destructive' : ''}`}
              />
              {erros.lastro && <p className="text-[11px] text-destructive">{erros.lastro}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Camada (alturas) *
              </Label>
              <Input
                type="number"
                min={1}
                value={camada}
                onChange={e => setCamada(e.target.value)}
                placeholder="Ex: 5"
                className={`tabular-nums ${erros.camada ? 'border-destructive' : ''}`}
              />
              {erros.camada && <p className="text-[11px] text-destructive">{erros.camada}</p>}
            </div>
          </div>

          {/* Norma calculada */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-primary">Norma do Palete</span>
              <span className="text-xs text-muted-foreground">(Lastro × Camada)</span>
            </div>
            <Badge className="text-base font-bold px-4 py-1 bg-primary text-primary-foreground tabular-nums">
              {norma > 0 ? `${norma} cx` : '—'}
            </Badge>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={salvando} className="gap-2">
            {salvando ? 'Salvando...' : logisticaExistente ? 'Atualizar' : 'Cadastrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function DadosLogisticos() {
  const [search, setSearch] = useState('');
  const [dialogProduto, setDialogProduto] = useState(null); // { produto, logisticaExistente }
  const queryClient = useQueryClient();

  // Busca todas as NFs para extrair produtos únicos
  const { data: notas = [], isLoading: loadingNotas } = useQuery({
    queryKey: ['notas-fiscais-logistica'],
    queryFn: () => base44.entities.NotaFiscal.list('-created_date', 500),
  });

  // Busca todos os registros logísticos já cadastrados
  const { data: logisticas = [], isLoading: loadingLogisticas } = useQuery({
    queryKey: ['produtos-logistica'],
    queryFn: () => base44.entities.ProdutoLogistica.list('-created_date', 500),
  });

  const isLoading = loadingNotas || loadingLogisticas;

  // Mapa descrição → logística cadastrada
  const logisticaByDescricao = useMemo(() => {
    const m = {};
    logisticas.forEach(l => { m[l.descricao] = l; });
    return m;
  }, [logisticas]);

  // Merge: produtos das NFs + produtos já cadastrados que não estejam mais nas NFs
  const produtosMerged = useMemo(() => {
    const produtosNF = extrairProdutosNFs(notas);
    const descricoesDasNFs = new Set(produtosNF.map(p => p.descricao));

    // Produtos cadastrados que não aparecem mais em nenhuma NF ativa
    const produtosOrfaos = logisticas
      .filter(l => !descricoesDasNFs.has(l.descricao))
      .map(l => ({
        codigo: l.codigo || '',
        ean: l.ean || '',
        descricao: l.descricao,
        unidade: l.unidade || '',
        origem: 'logistica', // veio do cadastro, não de NF ativa
      }));

    return [...produtosNF, ...produtosOrfaos];
  }, [notas, logisticas]);

  // Filtro
  const filtered = useMemo(() =>
    produtosMerged.filter(p =>
      !search ||
      p.descricao?.toLowerCase().includes(search.toLowerCase()) ||
      p.codigo?.toLowerCase().includes(search.toLowerCase()) ||
      (logisticaByDescricao[p.descricao]?.ean || p.ean || '').includes(search)
    ),
    [produtosMerged, search, logisticaByDescricao]
  );

  const totalProdutos = produtosMerged.length;
  const cadastrados = produtosMerged.filter(p => {
    const log = logisticaByDescricao[p.descricao];
    return !!(log?.lastro && log?.camada);
  }).length;
  const pendentes = totalProdutos - cadastrados;

  function handleSalvo() {
    queryClient.invalidateQueries({ queryKey: ['produtos-logistica'] });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cadastro Logístico de Produtos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enriqueça os produtos importados via XML com EAN, lastro e camada para habilitar o motor de paletização
        </p>
      </div>

      {/* Stats */}
      {!isLoading && totalProdutos > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-border">
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground">Total de Produtos</p>
              <p className="text-2xl font-bold tabular-nums mt-0.5 text-foreground">{totalProdutos}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground">Cadastrados</p>
              <p className="text-2xl font-bold tabular-nums mt-0.5 text-emerald-600">{cadastrados}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground">Pendentes</p>
              <p className={`text-2xl font-bold tabular-nums mt-0.5 ${pendentes > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                {pendentes}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Barra de busca */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por descrição, código ou EAN..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <PackageSearch className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm font-medium text-muted-foreground">
              {search ? 'Nenhum produto encontrado.' : 'Nenhum produto importado via XML ainda.'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Importe NFs em XML na aba "Importar XML" para ver os produtos aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="text-xs font-semibold uppercase tracking-wider w-32">Código / SKU</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Descrição</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider w-36">EAN</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-center w-20">Lastro</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-center w-20">Camada</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-center w-32">Norma Palete</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-center w-24">Status</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-center w-20">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((produto, idx) => {
                const log = logisticaByDescricao[produto.descricao];
                const norma = log ? (log.lastro || 0) * (log.camada || 0) : 0;
                const cadastrado = !!(log?.lastro && log?.camada);
                const semNFAtiva = produto.origem === 'logistica';

                return (
                  <TableRow
                    key={produto.codigo + idx}
                    className="group hover:bg-accent/30 transition-colors"
                  >
                    {/* Código */}
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {produto.codigo || '—'}
                    </TableCell>

                    {/* Descrição */}
                    <TableCell>
                      <p className="text-sm font-medium leading-tight">{produto.descricao}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {produto.unidade || ''}
                        {semNFAtiva && (
                          <span className="ml-1 text-blue-500 font-medium">· Cadastrado (sem NF ativa)</span>
                        )}
                      </p>
                    </TableCell>

                    {/* EAN */}
                    <TableCell className="font-mono text-xs">
                      {(log?.ean || produto.ean) || <span className="text-muted-foreground/50">—</span>}
                    </TableCell>

                    {/* Lastro */}
                    <TableCell className="text-center tabular-nums text-sm">
                      {log?.lastro ?? <span className="text-muted-foreground/50">—</span>}
                    </TableCell>

                    {/* Camada */}
                    <TableCell className="text-center tabular-nums text-sm">
                      {log?.camada ?? <span className="text-muted-foreground/50">—</span>}
                    </TableCell>

                    {/* Norma do Palete — destaque visual */}
                    <TableCell className="text-center">
                      {norma > 0 ? (
                        <div className="inline-flex items-center gap-1.5 bg-primary/5 border border-primary/25 rounded-lg px-3 py-1">
                          <Layers className="w-3 h-3 text-primary" />
                          <span className="text-sm font-bold text-primary tabular-nums">{norma}</span>
                          <span className="text-[10px] text-muted-foreground">cx</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="text-center">
                      {cadastrado ? (
                        <div className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">Cadastrado</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">Pendente</span>
                        </div>
                      )}
                    </TableCell>

                    {/* Ação */}
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => setDialogProduto({ produto, logisticaExistente: log || null })}
                      >
                        <Pencil className="w-3 h-3" />
                        {cadastrado ? 'Editar' : 'Cadastrar'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Footer */}
          <div className="px-4 py-3 bg-muted/30 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{filtered.length}</span> produto(s) exibido(s)
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-emerald-600">{cadastrados}</span> com logística ·{' '}
              <span className="font-semibold text-amber-600">{pendentes}</span> pendente(s)
            </p>
          </div>
        </div>
      )}

      {/* Dialog de edição */}
      {dialogProduto && (
        <EditarLogisticaDialog
          open={!!dialogProduto}
          onOpenChange={(o) => !o && setDialogProduto(null)}
          produto={dialogProduto.produto}
          logisticaExistente={dialogProduto.logisticaExistente}
          onSalvo={handleSalvo}
        />
      )}
    </div>
  );
}