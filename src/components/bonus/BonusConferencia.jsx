import React, { useState, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ScanBarcode, Plus, CheckCheck, ArrowLeft, ClipboardList,
  FileText, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import EanInputField from './EanInputField';
import ItensConferidosTable from './ItensConferidosTable';
import DivergenciaDialog from './DivergenciaDialog';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function calcularPaletes(qtd, norma) {
  if (!norma || norma <= 0) return { paletes_cheios: 0, caixas_soltas: qtd, qtd_paletes: `${qtd} cx soltas` };
  const paletes_cheios = Math.floor(qtd / norma);
  const caixas_soltas = qtd % norma;
  const partes = [];
  if (paletes_cheios > 0) partes.push(`${paletes_cheios} pal.`);
  if (caixas_soltas > 0) partes.push(`${caixas_soltas} cx`);
  return {
    paletes_cheios,
    caixas_soltas,
    qtd_paletes: partes.length > 0 ? partes.join(' + ') : '0',
  };
}

function gerarId() {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Componente Principal ────────────────────────────────────────────────────
export default function BonusConferencia({ bonus, onConferenciaConcluida, onVoltar }) {
  // Estados do formulário
  const [currentEan, setCurrentEan] = useState('');
  const [currentQtd, setCurrentQtd] = useState('');
  const [currentValidade, setCurrentValidade] = useState('');

  // Produto encontrado pelo EAN
  const [produto, setProduto] = useState(null);
  const [buscandoProduto, setBuscandoProduto] = useState(false);
  const [erroEan, setErroEan] = useState('');

  // Lista de itens bipados
  const [itensConferidos, setItensConferidos] = useState([]);

  // Dialog de divergência
  const [dialogAberto, setDialogAberto] = useState(false);
  const [divergencias, setDivergencias] = useState([]);
  const [salvando, setSalvando] = useState(false);

  const eanRef = useRef(null);
  const qtdRef = useRef(null);

  // ── Busca produto pelo EAN ───────────────────────────────────────────────
  const buscarProduto = useCallback(async (ean) => {
    const trimmed = ean?.trim();
    if (!trimmed) return;

    setBuscandoProduto(true);
    setErroEan('');
    setProduto(null);

    try {
      const resultados = await base44.entities.ProdutoLogistica.filter({ ean: trimmed });
      if (resultados && resultados.length > 0) {
        setProduto(resultados[0]);
        // Foca no campo de quantidade
        setTimeout(() => qtdRef.current?.focus(), 80);
      } else {
        setErroEan('Produto não cadastrado. Verifique o EAN.');
      }
    } catch {
      setErroEan('Erro ao buscar produto. Tente novamente.');
    } finally {
      setBuscandoProduto(false);
    }
  }, []);

  // ── Incluir item ────────────────────────────────────────────────────────
  const handleIncluir = () => {
    const ean = currentEan.trim();
    const qtd = parseInt(currentQtd, 10);

    if (!ean) {
      toast.error('Informe o código EAN.');
      eanRef.current?.focus();
      return;
    }
    if (!qtd || qtd <= 0) {
      toast.error('Informe uma quantidade válida.');
      qtdRef.current?.focus();
      return;
    }
    if (!currentValidade) {
      toast.error('Informe a data de validade.');
      return;
    }
    if (!produto) {
      toast.error('EAN não encontrado. Confirme o produto antes de incluir.');
      eanRef.current?.focus();
      return;
    }

    const norma = (produto.lastro || 0) * (produto.camada || 0);
    const { paletes_cheios, caixas_soltas, qtd_paletes } = calcularPaletes(qtd, norma);

    const novoItem = {
      id: gerarId(),
      ean,
      descricao: produto.descricao,
      validade: currentValidade,
      qtd_caixas: qtd,
      norma_palete: norma,
      paletes_cheios,
      caixas_soltas,
      qtd_paletes,
    };

    setItensConferidos(prev => [...prev, novoItem]);
    toast.success(`${produto.descricao} — ${qtd} cx incluídas`, { duration: 2000 });

    // Limpar e retornar foco ao EAN
    setCurrentEan('');
    setCurrentQtd('');
    setCurrentValidade('');
    setProduto(null);
    setErroEan('');
    setTimeout(() => eanRef.current?.focus(), 60);
  };

  // ── Remover item ────────────────────────────────────────────────────────
  const handleRemover = (id) => {
    setItensConferidos(prev => prev.filter(i => i.id !== id));
    toast.info('Item removido da conferência.');
  };

  // ── Finalizar conferência ────────────────────────────────────────────────
  const handleFinalizar = () => {
    if (itensConferidos.length === 0) {
      toast.error('Confira ao menos um item antes de finalizar.');
      return;
    }

    // Agrupar conferidos por EAN
    const totalConferido = {};
    itensConferidos.forEach(item => {
      totalConferido[item.ean] = (totalConferido[item.ean] || 0) + item.qtd_caixas;
    });

    // Montar mapa de esperado a partir do bonus
    const totalEsperado = {};
    const descricaoMap = {};
    (bonus?.itens_esperados || []).forEach(item => {
      totalEsperado[item.ean] = (totalEsperado[item.ean] || 0) + item.qtd_esperada;
      descricaoMap[item.ean] = item.descricao;
    });

    // Detectar divergências
    const allEans = new Set([...Object.keys(totalConferido), ...Object.keys(totalEsperado)]);
    const divs = [];
    allEans.forEach(ean => {
      const conf = totalConferido[ean] || 0;
      const esp = totalEsperado[ean] || 0;
      if (conf !== esp) {
        divs.push({
          ean,
          descricao: descricaoMap[ean] || itensConferidos.find(i => i.ean === ean)?.descricao || ean,
          esperado: esp,
          conferido: conf,
        });
      }
    });

    setDivergencias(divs);
    setDialogAberto(true);
  };

  // ── Confirmar fechamento ─────────────────────────────────────────────────
  const handleConfirmarFechamento = async () => {
    setSalvando(true);
    try {
      const status = divergencias.length > 0 ? 'divergente' : 'conferido';

      await base44.entities.BonusRecebimento.update(bonus.id, {
        status,
        itens_conferidos: itensConferidos,
        data_conferencia: new Date().toISOString(),
      });

      setDialogAberto(false);

      if (divergencias.length > 0) {
        toast.warning('Bônus finalizado com divergências e registrado para auditoria.', { duration: 4000 });
      } else {
        toast.success('Conferência concluída com sucesso!', { duration: 3000 });
      }

      onConferenciaConcluida?.(itensConferidos, status);
    } catch (err) {
      toast.error('Erro ao salvar conferência: ' + err.message);
    } finally {
      setSalvando(false);
    }
  };

  // ── Totais rápidos ───────────────────────────────────────────────────────
  const totalCaixas = itensConferidos.reduce((acc, i) => acc + i.qtd_caixas, 0);
  const totalEsperadoGeral = (bonus?.itens_esperados || []).reduce((acc, i) => acc + i.qtd_esperada, 0);

  return (
    <div className="flex flex-col gap-0 min-h-full">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onVoltar} className="shrink-0 -ml-1">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">Conferência Cega</h1>
              <Badge variant="outline" className="font-mono text-xs">
                Bônus #{bonus?.numero_bonus}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {bonus?.emitente_nome} — {bonus?.notas_fiscais_ids?.length || 0} NF(s) vinculada(s)
            </p>
          </div>
        </div>

        {/* Mini estatísticas */}
        <div className="hidden sm:flex items-center gap-4 text-right">
          <div>
            <p className="text-xs text-muted-foreground">Conferido</p>
            <p className="text-lg font-bold tabular-nums text-primary">
              {totalCaixas.toLocaleString('pt-BR')}
              <span className="text-xs font-normal text-muted-foreground ml-1">cx</span>
            </p>
          </div>
          {totalEsperadoGeral > 0 && (
            <>
              <div className="w-px h-8 bg-border" />
              <div>
                <p className="text-xs text-muted-foreground">Esperado</p>
                <p className="text-lg font-bold tabular-nums text-muted-foreground">
                  {totalEsperadoGeral.toLocaleString('pt-BR')}
                  <span className="text-xs font-normal ml-1">cx</span>
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Formulário de leitura FIXO ─────────────────────────── */}
      <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background shadow-lg shadow-primary/5 mb-6">
        <CardHeader className="pb-3 pt-4 px-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <ScanBarcode className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <p className="font-semibold text-sm">Leitura de Produto</p>
            <Badge className="ml-auto text-[10px] bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
              Conferência Cega
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">

            {/* EAN */}
            <div className="sm:col-span-1">
              <EanInputField
                value={currentEan}
                onChange={(val) => {
                  setCurrentEan(val);
                  setProduto(null);
                  setErroEan('');
                }}
                onBlur={() => currentEan.trim() && buscarProduto(currentEan)}
                onEnter={() => buscarProduto(currentEan)}
                produto={produto}
                buscando={buscandoProduto}
                erroEan={erroEan}
                autoFocus
                inputRef={eanRef}
              />
            </div>

            {/* Quantidade */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Quantidade Conferida
              </Label>
              <Input
                ref={qtdRef}
                type="number"
                min={1}
                value={currentQtd}
                onChange={(e) => setCurrentQtd(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleIncluir()}
                placeholder="Ex: 120"
                className="h-11 tabular-nums text-sm"
              />
            </div>

            {/* Validade */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Data de Validade
              </Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={currentValidade}
                  onChange={(e) => setCurrentValidade(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleIncluir()}
                  className="h-11 flex-1 text-sm"
                />
                <Button
                  onClick={handleIncluir}
                  className="h-11 px-5 gap-2 shrink-0 bg-primary hover:bg-primary/90 shadow-md shadow-primary/20 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Incluir</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Dica de atalho */}
          <p className="text-[10px] text-muted-foreground/60 mt-3">
            💡 Pressione <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[9px] font-mono">Enter</kbd> em qualquer campo para avançar ou incluir.
          </p>
        </CardContent>
      </Card>

      {/* ── Tabela de conferidos ──────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Itens Conferidos</p>
          {itensConferidos.length > 0 && (
            <Badge variant="secondary" className="text-xs tabular-nums">
              {itensConferidos.length}
            </Badge>
          )}
        </div>
        {totalCaixas > 0 && (
          <p className="text-xs text-muted-foreground tabular-nums">
            Total: <span className="font-bold text-foreground">{totalCaixas.toLocaleString('pt-BR')}</span> cx
          </p>
        )}
      </div>

      <ItensConferidosTable itens={itensConferidos} onRemover={handleRemover} />

      {/* ── NFs vinculadas (colapsável) ────────────────────────── */}
      {bonus?.itens_esperados?.length > 0 && (
        <div className="mt-4">
          <details className="group">
            <summary className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors py-2">
              <FileText className="w-3.5 h-3.5" />
              <span>Ver itens esperados das NFs ({bonus.itens_esperados.length} produto(s))</span>
              <span className="ml-auto group-open:rotate-180 transition-transform">▾</span>
            </summary>
            <div className="mt-2 rounded-xl border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider">EAN</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider">Descrição</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider">Qtd Esperada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {bonus.itens_esperados.map((item, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-muted-foreground">{item.ean}</td>
                      <td className="px-3 py-2">{item.descricao}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">
                        {item.qtd_esperada?.toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}

      {/* ── Rodapé fixo ──────────────────────────────────────── */}
      <div className="sticky bottom-0 mt-6 -mx-4 lg:-mx-8 px-4 lg:px-8 py-4 bg-background/95 backdrop-blur border-t border-border">
        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-muted-foreground hidden sm:block">
            {itensConferidos.length > 0 ? (
              <span>
                <span className="font-semibold text-foreground">{itensConferidos.length}</span> linha(s) ·{' '}
                <span className="font-semibold text-foreground">{totalCaixas.toLocaleString('pt-BR')}</span> caixas conferidas
              </span>
            ) : (
              'Nenhum item conferido ainda'
            )}
          </div>
          <Button
            size="lg"
            onClick={handleFinalizar}
            disabled={itensConferidos.length === 0 || salvando}
            className="gap-2.5 px-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all ml-auto"
          >
            <CheckCheck className="w-5 h-5" />
            {salvando ? 'Salvando...' : 'Finalizar Conferência'}
          </Button>
        </div>
      </div>

      {/* ── Dialog de divergência ────────────────────────────── */}
      <DivergenciaDialog
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        divergencias={divergencias}
        onConfirmar={handleConfirmarFechamento}
        onCancelar={() => setDialogAberto(false)}
      />
    </div>
  );
}