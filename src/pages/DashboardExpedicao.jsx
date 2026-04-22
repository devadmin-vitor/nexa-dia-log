import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, Calendar, Trash2, PackageCheck, FilterX, Truck, 
  AlertTriangle, Trophy, Scale, CheckSquare
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import AdminAuthDialog from '@/components/admin/AdminAuthDialog';

export default function DashboardExpedicao() {
  const queryClient = useQueryClient();

  // ─── ESTADOS DOS CAMPOS DE INPUT E FILTROS ────────────────────────────
  const [inputFornecedor, setInputFornecedor] = useState('');
  const [inputDataInicial, setInputDataInicial] = useState('');
  const [inputDataFinal, setInputDataFinal] = useState('');

  const [filtrosAtivos, setFiltrosAtivos] = useState({
    busca: '',
    dataInicial: '',
    dataFinal: '',
  });

  const [authOpen, setAuthOpen] = useState(false);
  const [expedicaoSelecionada, setExpedicaoSelecionada] = useState(null);

  // ─── BUSCA: CONFIGURAÇÕES DA PREMIAÇÃO E META ─────────────────────────
  const { data: config = null } = useQuery({
    queryKey: ['configuracoes-metas'],
    queryFn: async () => {
      try {
        const res = await base44.entities.Configuracao.list();
        return res?.[0] || null; 
      } catch (err) {
        return null;
      }
    },
  });

  // ─── BUSCA: BÔNUS / EXPEDIÇÕES ────────────────────────────────────────
  const { data: expedicoes = [], isLoading, isError, error } = useQuery({
    queryKey: ['lista-expedicoes-bonus'],
    queryFn: async () => {
      try {
        const resposta = await base44.entities.BonusRecebimento.list('-created_date', 500);
        return resposta || [];
      } catch (err) {
        throw err;
      }
    },
  });

  // ─── LÓGICA DOS FILTROS (TELA) ────────────────────────────────────────
  const filtradas = useMemo(() => {
    if (!Array.isArray(expedicoes)) return [];
    
    return expedicoes.filter((exp) => {
      const termo = filtrosAtivos.busca.toLowerCase();
      const nomeDestino = String(exp.emitente_nome || exp.fornecedor_nome || '').toLowerCase();
      const matchFornecedor = !filtrosAtivos.busca || nomeDestino.includes(termo);

      let matchDataInicial = true;
      let matchDataFinal = true;
      
      const dataString = exp.created_date || exp.data_conferencia;

      if (dataString) {
        const expData = new Date(dataString);
        if (!isNaN(expData.getTime())) {
          if (filtrosAtivos.dataInicial) {
            matchDataInicial = expData >= new Date(filtrosAtivos.dataInicial + 'T00:00:00');
          }
          if (filtrosAtivos.dataFinal) {
            matchDataFinal = expData <= new Date(filtrosAtivos.dataFinal + 'T23:59:59');
          }
        }
      } else if (filtrosAtivos.dataInicial || filtrosAtivos.dataFinal) {
        return false;
      }

      return matchFornecedor && matchDataInicial && matchDataFinal;
    });
  }, [expedicoes, filtrosAtivos]);

  // ─── CÁLCULOS DOS CARDS (BASEADOS APENAS NO QUE FOI FILTRADO) ─────────
  const kpis = useMemo(() => {
    // Pega APENAS o que passou no filtro da tela e está com status 'conferido'
    const conferidosFiltrados = filtradas.filter(exp => exp.status === 'conferido');

    // Soma as caixas para calcular o peso total
    let volumesTotal = 0;
    conferidosFiltrados.forEach(exp => {
      let itens = [];
      if (Array.isArray(exp.itens_conferidos_2) && exp.itens_conferidos_2.length > 0) {
         itens = exp.itens_conferidos_2;
      } else if (Array.isArray(exp.itens_conferidos) && exp.itens_conferidos.length > 0) {
         itens = exp.itens_conferidos;
      } else if (Array.isArray(exp.itens_esperados)) {
         itens = exp.itens_esperados;
      }
      
      volumesTotal += itens.reduce((acc, i) => acc + (Number(i.qtd_caixas || i.qtd_esperada) || 0), 0);
    });

    // Pega as configurações baseadas na sua imagem de "Parâmetros de Premiação"
    const valorPorKg = Number(config?.valor_por_kg) || 0.01;
    const metaBonus = Number(config?.meta_bonus_dia || config?.meta_bonus_diario) || 8;
    const pesoPorCaixa = Number(config?.peso_medio || config?.peso_caixa) || 12.5;

    // Novos Cálculos
    const qtdBonus = conferidosFiltrados.length;
    const pesoTotal = volumesTotal * pesoPorCaixa;
    const premiacaoTotal = pesoTotal * valorPorKg;
    
    // Progresso da Meta de Bônus (0 a 100%)
    const progresso = Math.min(Math.round((qtdBonus / metaBonus) * 100), 100) || 0;

    return {
      qtdBonus,
      metaBonus,
      progresso,
      peso: pesoTotal,
      premiacao: premiacaoTotal,
    };
  }, [filtradas, config]);

  // ─── HANDLERS E FUNÇÕES AUXILIARES ────────────────────────────────────
  const handlePesquisar = () => {
    setFiltrosAtivos({ 
      busca: inputFornecedor, 
      dataInicial: inputDataInicial, 
      dataFinal: inputDataFinal 
    });
  };

  const limparFiltros = () => { 
    setInputFornecedor(''); 
    setInputDataInicial(''); 
    setInputDataFinal(''); 
    setFiltrosAtivos({ busca: '', dataInicial: '', dataFinal: '' }); 
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handlePesquisar();
  };

  const abrirModalExclusao = (expedicao) => { 
    setExpedicaoSelecionada(expedicao); 
    setAuthOpen(true); 
  };

  const handleExcluirAutorizado = async () => {
    try {
      if (!expedicaoSelecionada?.id) throw new Error("ID inválido");
      await base44.entities.BonusRecebimento.delete(expedicaoSelecionada.id);
      toast.success('Registro excluído com sucesso pelo Administrador.');
      queryClient.invalidateQueries({ queryKey: ['lista-expedicoes-bonus'] });
      queryClient.invalidateQueries({ queryKey: ['checagem-bonus'] });
    } catch (error) { 
      toast.error('Erro ao excluir: ' + (error.message || 'Desconhecido')); 
    } finally { 
      setAuthOpen(false); 
      setExpedicaoSelecionada(null); 
    }
  };

  const formatarDataSegura = (dataString) => {
    if (!dataString) return 'Data Indisponível';
    try { 
      const d = new Date(dataString);
      if (isNaN(d.getTime())) return String(dataString);
      return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); 
    } catch (e) {
      return String(dataString);
    }
  };

  const STATUS_CONFIG = {
    em_conferencia: { label: '1ª Conferência', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    aguardando_2a_conferencia: { label: 'Ag. 2ª Conferência', className: 'bg-purple-100 text-purple-700 border-purple-200' },
    conferido: { label: 'Conferido', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    divergente: { label: 'Divergente', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  };

  return (
    <div className="space-y-6">
      {/* ─── CABEÇALHO ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Truck className="w-6 h-6 text-primary" />
          Dashboard de Expedição
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acompanhamento dinâmico de saídas e recebimentos com base nos filtros.
        </p>
      </div>

      {/* ─── PAINEL DE INDICADORES (KPIs FILTRADOS) ──────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Card 1: Bônus Conferidos / Meta */}
        <Card className="border-border bg-gradient-to-br from-background to-muted/20">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium uppercase tracking-wider">
                <CheckSquare className="w-4 h-4 text-blue-500" /> Bônus / Meta
              </div>
              <span className="font-bold text-sm text-blue-600">{kpis.progresso}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5 mb-2 overflow-hidden border border-border/50">
              <div 
                className={`h-2.5 rounded-full transition-all duration-500 ${kpis.progresso >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                style={{ width: `${kpis.progresso}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">
              <span className="font-bold text-foreground text-xl">{kpis.qtdBonus}</span> de {kpis.metaBonus} bônus
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Peso Total */}
        <Card className="border-border bg-gradient-to-br from-background to-muted/20">
          <CardContent className="p-4 flex items-center gap-4 h-full">
            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
              <Scale className="w-6 h-6" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider truncate">Peso Total</p>
              <div className="flex items-baseline gap-1">
                <p className="text-2xl font-bold tabular-nums">
                  {kpis.peso.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-muted-foreground font-medium">kg</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Premiação */}
        <Card className="border-border bg-gradient-to-br from-background to-muted/20">
          <CardContent className="p-4 flex items-center gap-4 h-full">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <Trophy className="w-6 h-6" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider truncate">Valor da Premiação</p>
              <p className="text-2xl font-bold tabular-nums text-emerald-600">
                {Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpis.premiacao)}
              </p>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* ─── BARRA DE FILTROS ──────────────────────────────────────────── */}
      <Card className="bg-muted/30 border-border">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fornecedor / Emitente</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Digite o nome..." className="pl-9 bg-background" value={inputFornecedor} onChange={(e) => setInputFornecedor(e.target.value)} onKeyDown={handleKeyDown} />
              </div>
            </div>
            <div className="w-full md:w-40 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data Inicial</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="date" className="pl-9 bg-background" value={inputDataInicial} onChange={(e) => setInputDataInicial(e.target.value)} onKeyDown={handleKeyDown} />
              </div>
            </div>
            <div className="w-full md:w-40 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data Final</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="date" className="pl-9 bg-background" value={inputDataFinal} onChange={(e) => setInputDataFinal(e.target.value)} onKeyDown={handleKeyDown} />
              </div>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Button onClick={handlePesquisar} className="w-full md:w-auto gap-2 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"><Search className="w-4 h-4" /> Pesquisar</Button>
              <Button variant="outline" className="w-full md:w-auto text-muted-foreground hover:text-foreground gap-2 shrink-0" onClick={limparFiltros}><FilterX className="w-4 h-4" /> Limpar</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── LISTAGEM DE DADOS ────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : isError ? (
        <Card className="border-red-200 bg-red-50"><CardContent className="py-12 text-center text-red-600"><AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" /><p className="font-bold text-lg">Erro de conexão</p><p className="text-sm mt-1">{error?.message || 'Falha ao buscar os dados.'}</p></CardContent></Card>
      ) : filtradas.length === 0 ? (
        <Card className="border-dashed"><CardContent className="py-16 text-center"><PackageCheck className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" /><p className="text-sm font-medium text-muted-foreground">Nenhum registro encontrado para os filtros aplicados.</p></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtradas.map(exp => {
            const statusConfig = STATUS_CONFIG[exp.status] || { label: exp.status || 'Concluído', className: 'bg-muted text-muted-foreground' };
            const arrayVolumes = Array.isArray(exp.itens_esperados) ? exp.itens_esperados : [];
            const totalVolumes = arrayVolumes.reduce((acc, i) => acc + (Number(i.qtd_esperada) || 0), 0);
            
            const identificador = exp.numero_bonus || (exp.id ? String(exp.id).slice(0,6).toUpperCase() : 'N/A');

            return (
              <Card key={exp.id} className="group overflow-hidden hover:shadow-md transition-all border-border">
                <CardContent className="p-5 flex flex-col md:flex-row items-center gap-4">
                  <div className="flex-1 space-y-1 w-full">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-lg">#{identificador}</span>
                      <Badge variant="outline" className={`border ${statusConfig.className}`}>{statusConfig.label}</Badge>
                    </div>
                    <p className="text-sm font-medium">Fornecedor: <span className="text-muted-foreground">{exp.emitente_nome || 'N/A'}</span></p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{formatarDataSegura(exp.created_date || exp.data_conferencia)}</p>
                  </div>
                  <div className="text-left md:text-right px-0 md:px-4 border-l-0 md:border-l border-border w-full md:w-auto mt-4 md:mt-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-semibold">Volumes</p>
                    <p className="text-xl font-bold tabular-nums">{totalVolumes} <span className="text-sm font-normal text-muted-foreground">cx</span></p>
                  </div>
                  <div className="flex items-center gap-2 mt-4 md:mt-0 border-t md:border-t-0 border-border pt-4 md:pt-0 w-full md:w-auto justify-end">
                    <Button variant="destructive" size="sm" className="gap-2 w-full md:w-auto" onClick={() => abrirModalExclusao(exp)}><Trash2 className="w-4 h-4" /> Excluir</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── MODAL DE EXCLUSÃO ────────────────────────────────────────── */}
      <AdminAuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        title="Autorizar Exclusão"
        description="Por favor, insira as credenciais de administrador para excluir este registro permanentemente."
        onAuthorized={handleExcluirAutorizado}
      />
    </div>
  );
}