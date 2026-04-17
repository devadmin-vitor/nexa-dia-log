import React, { useState, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ScanBarcode, Plus, CheckCheck, ArrowLeft, ClipboardList,
  FileText, AlertTriangle, FileDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import EanInputField from './EanInputField';
import ItensConferidosTable from './ItensConferidosTable';
import DivergenciaDialog from './DivergenciaDialog';
import { gerarTermoAvariaPdf } from '@/lib/termoAvariaPdf';

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
  const is2aConferencia = bonus?.status === 'aguardando_2a_conferencia';
  // Estados do formulário
  const [currentEan, setCurrentEan] = useState('');
  const [currentQtdBoa, setCurrentQtdBoa] = useState('');
  const [currentQtdAvaria, setCurrentQtdAvaria] = useState('');
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
  const qtdBoaRef = useRef(null);
  const qtdAvariaRef = useRef(null);

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
        setTimeout(() => qtdBoaRef.current?.focus(), 80);
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
    const qtdBoa = parseInt(currentQtdBoa, 10) || 0;
    const qtdAvaria = parseInt(currentQtdAvaria, 10) || 0;

    if (!ean) {
      toast.error('Informe o código EAN.');
      eanRef.current?.focus();
      return;
    }
    if (qtdBoa <= 0 && qtdAvaria <= 0) {
      toast.error('Informe ao menos Qtd Boa ou Qtd Avariada.');
      qtdBoaRef.current?.focus();
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

    const novosItens = [];

    // ── Item BOM: passa pelo cálculo de paletização ──────────────────────
    if (qtdBoa > 0) {
      const norma = (produto.lastro || 0) * (produto.camada || 0);
      const { paletes_cheios, caixas_soltas, qtd_paletes } = calcularPaletes(qtdBoa, norma);
      novosItens.push({
        id: gerarId(),
        ean,
        descricao: produto.descricao,
        validade: currentValidade,
        qtd_caixas: qtdBoa,
        norma_palete: norma,
        paletes_cheios,
        caixas_soltas,
        qtd_paletes,
        tipo_estoque: 'BOM',
        endereco_id: null,
      });
    }

    // ── Item AVARIA: sem paletização, destino fixo de quarentena ────────
    if (qtdAvaria > 0) {
      novosItens.push({
        id: gerarId(),
        ean,
        descricao: produto.descricao,
        validade: currentValidade,
        qtd_caixas: qtdAvaria,
        norma_palete: 0,
        paletes_cheios: 0,
        caixas_soltas: qtdAvaria,
        qtd_paletes: `${qtdAvaria} cx`,
        tipo_estoque: 'AVARIA',
        endereco_id: 'DOCA-AVARIAS',
      });
    }

    setItensConferidos(prev => [...prev, ...novosItens]);

    const partes = [];
    if (qtdBoa > 0) partes.push(`${qtdBoa} boas`);
    if (qtdAvaria > 0) partes.push(`${qtdAvaria} avariadas`);
    toast.success(`${produto.descricao} — ${partes.join(' + ')}`, { duration: 2500 });

    // Limpar e retornar foco ao EAN
    setCurrentEan('');
    setCurrentQtdBoa('');
    setCurrentQtdAvaria('');
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

    // Soma TOTAL (boas + avariadas) por EAN
    const totalConferido = {};
    itensConferidos.forEach(item => {
      totalConferido[item.ean] = (totalConferido[item.ean] || 0) + item.qtd_caixas;
    });

    const divs = [];

    if (is2aConferencia) {
      // 2ª conferência: compara com a 1ª conferência
      const totalConferido1 = {};
      const descricaoMap = {};
      (bonus?.itens_conferidos || []).forEach(item => {
        totalConferido1[item.ean] = (totalConferido1[item.ean] || 0) + item.qtd_caixas;
        descricaoMap[item.ean] = item.descricao;
      });

      const allEans = new Set([...Object.keys(totalConferido), ...Object.keys(totalConferido1)]);
      allEans.forEach(ean => {
        const conf2 = totalConferido[ean] || 0;
        const conf1 = totalConferido1[ean] || 0;
        if (conf2 !== conf1) {
          divs.push({
            ean,
            descricao: descricaoMap[ean] || itensConferidos.find(i => i.ean === ean)?.descricao || ean,
            esperado: conf1,
            conferido: conf2,
          });
        }
      });
    } else {
      // 1ª conferência: compara com o esperado das NFs
      const totalEsperado = {};
      const descricaoMap = {};
      (bonus?.itens_esperados || []).forEach(item => {
        totalEsperado[item.ean] = (totalEsperado[item.ean] || 0) + item.qtd_esperada;
        descricaoMap[item.ean] = item.descricao;
      });

      const allEans = new Set([...Object.keys(totalConferido), ...Object.keys(totalEsperado)]);
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
    }

    setDivergencias(divs);
    setDialogAberto(true);
  };

  // ── Confirmar fechamento ─────────────────────────────────────────────────
  const handleConfirmarFechamento = async () => {
    setSalvando(true);
    try {
      let updatePayload;

      if (is2aConferencia) {
        // 2ª conferência: finaliza o bônus
        const status = divergencias.length > 0 ? 'divergente' : 'conferido';
        updatePayload = {
          status,
          itens_conferidos_2: itensConferidos,
          data_conferencia_2: new Date().toISOString(),
        };
      } else {
        // 1ª conferência: aguarda a 2ª
        updatePayload = {
          status: 'aguardando_2a_conferencia',
          itens_conferidos: itensConferidos,
          data_conferencia: new Date().toISOString(),
        };
      }

      await base44.entities.BonusRecebimento.update(bonus.id, updatePayload);
      setDialogAberto(false);

      if (is2aConferencia) {
        if (divergencias.length > 0) {
          toast.warning('2ª conferência com divergências. Bônus salvo como divergente.', { duration: 4000 });
        } else {
          toast.success('Dupla conferência concluída com sucesso!', { duration: 3000 });
        }
      } else {
        toast.success('1ª conferência concluída! Aguardando 2ª conferência.', { duration: 3500 });
      }

      onConferenciaConcluida?.(itensConferidos, updatePayload.status);
    } catch (err) {
      toast.error('Erro ao salvar conferência: ' + err.message);
    } finally {
      setSalvando(false);
    }
  };

  // ── Gerar PDF do Termo de Avaria ─────────────────────────────────────────
  const handleGerarTermoPdf = () => {
    const itensAvariados = itensConferidos.filter(i => i.tipo_estoque === 'AVARIA');
    if (itensAvariados.length === 0) return;

    const doc = gerarTermoAvariaPdf({ bonus, itensAvariados });
    doc.save(`Termo_Avaria_Bonus_${bonus?.numero_bonus || 'SN'}.pdf`);
    toast.success('Termo de Avaria gerado com sucesso!');
  };

  // ── Totais rápidos ───────────────────────────────────────────────────────
  const totalBoas = itensConferidos.filter(i => i.tipo_estoque === 'BOM').reduce((acc, i) => acc + i.qtd_caixas, 0);
  const totalAvarias = itensConferidos.filter(i => i.tipo_estoque === 'AVARIA').reduce((acc, i) => acc + i.qtd_caixas, 0);
  const totalCaixas = totalBoas + totalAvarias;
  const totalEsperadoGeral = (bonus?.itens_esperados || []).reduce((acc, i) => acc + i.qtd_esperada, 0);
  const temAvaria = itensConferidos.some(i => i.tipo_estoque === 'AVARIA');

  return (
    <div className="flex flex-col gap-0 min-h-full">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onVoltar} className="shrink-0 -ml-1">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight">
                {is2aConferencia ? '2ª Conferência Cega' : '1ª Conferência Cega'}
              </h1>
              <Badge variant="outline" className="font-mono text-xs">
                Bônus #{bonus?.numero_bonus}
              </Badge>
              {is2aConferencia && (
                <Badge className="text-[10px] bg-purple-100 text-purple-700 border border-purple-300 dark:bg-purple-900/30 dark:text-purple-400">
                  Verificação dupla
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {bonus?.emitente_nome} — {bonus?.notas_fiscais_ids?.length || 0} NF(s) vinculada(s)
            </p>
          </div>
        </div>

        {/* Mini estatísticas */}
        <div className="hidden sm:flex items-center gap-4 text-right">
          <div>
            <p className="text-xs text-muted-foreground">Boas</p>
            <p className="text-lg font-bold tabular-nums text-primary">
              {totalBoas.toLocaleString('pt-BR')}
              <span className="text-xs font-normal text-muted-foreground ml-1">cx</span>
            </p>
          </div>
          {totalAvarias > 0 && (
            <>
              <div className="w-px h-8 bg-border" />
              <div>
                <p className="text-xs text-muted-foreground">Avarias</p>
                <p className="text-lg font-bold tabular-nums text-red-600">
                  {totalAvarias.toLocaleString('pt-BR')}
                  <span className="text-xs font-normal text-muted-foreground ml-1">cx</span>
                </p>
              </div>
            </>
          )}
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

      {/* ── Formulário de leitura ───────────────────────────────── */}
      <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background shadow-lg shadow-primary/5 mb-6">
        <CardHeader className="pb-3 pt-4 px-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <ScanBarcode className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <p className="font-semibold text-sm">Leitura de Produto</p>
            <Badge className={`ml-auto text-[10px] border hover:bg-transparent ${is2aConferencia ? 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-primary/10 text-primary border-primary/20'}`}>
              {is2aConferencia ? '2ª Conferência' : '1ª Conferência'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {/* Linha 1: EAN + Qtd Boa + Qtd Avariada */}
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

            {/* Qtd Boa */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Qtd Boa <span className="text-primary">(Vendável)</span>
              </Label>
              <Input
                ref={qtdBoaRef}
                type="number"
                min={0}
                value={currentQtdBoa}
                onChange={(e) => setCurrentQtdBoa(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    qtdAvariaRef.current?.focus();
                  }
                }}
                placeholder="Ex: 98"
                className="h-11 tabular-nums text-sm"
              />
            </div>

            {/* Qtd Avariada + Botão */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Qtd Avariada <span className="text-red-500">(Opcional)</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  ref={qtdAvariaRef}
                  type="number"
                  min={0}
                  value={currentQtdAvaria}
                  onChange={(e) => setCurrentQtdAvaria(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      // avança para validade se vazio, senão fica na avaria
                      document.getElementById('input-validade')?.focus();
                    }
                  }}
                  placeholder="Ex: 2"
                  className="h-11 tabular-nums text-sm border-red-200 focus-visible:ring-red-400/40 flex-1"
                />
              </div>
            </div>
          </div>

          {/* Linha 2: Validade + Botão Incluir */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end mt-4">
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Data de Validade
              </Label>
              <Input
                id="input-validade"
                type="date"
                value={currentValidade}
                onChange={(e) => setCurrentValidade(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleIncluir()}
                className="h-11 text-sm"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleIncluir}
                className="h-11 w-full gap-2 bg-primary hover:bg-primary/90 shadow-md shadow-primary/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                Incluir
              </Button>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground/60 mt-3">
            💡 Pressione <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[9px] font-mono">Enter</kbd> para navegar entre campos.
            Qtd Avariada é opcional — deixe em branco se não houver dano.
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
          {temAvaria && (
            <Badge className="text-[10px] bg-red-100 text-red-700 border border-red-300 dark:bg-red-900/30 dark:text-red-400 gap-1">
              <AlertTriangle className="w-2.5 h-2.5" />
              Avarias detectadas
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Botão Termo de Avaria */}
          {temAvaria && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGerarTermoPdf}
              className="gap-2 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <FileDown className="w-3.5 h-3.5" />
              Termo de Avaria (PDF)
            </Button>
          )}

          {totalCaixas > 0 && (
            <p className="text-xs text-muted-foreground tabular-nums">
              Total: <span className="font-bold text-foreground">{totalCaixas.toLocaleString('pt-BR')}</span> cx
            </p>
          )}
        </div>
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
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-4">
            {itensConferidos.length > 0 ? (
              <>
                <span>
                  <span className="font-semibold text-foreground">{itensConferidos.length}</span> linha(s)
                </span>
                <span>
                  Boas: <span className="font-semibold text-foreground">{totalBoas.toLocaleString('pt-BR')} cx</span>
                </span>
                {totalAvarias > 0 && (
                  <span className="text-red-600 dark:text-red-400">
                    Avarias: <span className="font-semibold">{totalAvarias.toLocaleString('pt-BR')} cx</span>
                  </span>
                )}
              </>
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
            {salvando ? 'Salvando...' : is2aConferencia ? 'Finalizar 2ª Conferência' : 'Finalizar 1ª Conferência'}
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
        is2aConferencia={is2aConferencia}
      />
    </div>
  );
}