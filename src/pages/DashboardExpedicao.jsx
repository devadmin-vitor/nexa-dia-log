import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, Calendar, Trash2, PackageCheck, FilterX, Truck, AlertTriangle
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import AdminAuthDialog from '@/components/admin/AdminAuthDialog';

export default function DashboardExpedicao() {
  const queryClient = useQueryClient();

  // ─── ESTADOS DOS CAMPOS DE INPUT ──────────────────────────────────────
  const [inputFornecedor, setInputFornecedor] = useState('');
  const [inputDataInicial, setInputDataInicial] = useState('');
  const [inputDataFinal, setInputDataFinal] = useState('');

  // ─── ESTADOS DOS FILTROS APLICADOS ────────────────────────────────────
  const [filtrosAtivos, setFiltrosAtivos] = useState({
    busca: '',
    dataInicial: '',
    dataFinal: '',
  });

  // ─── ESTADOS DE AUTENTICAÇÃO (EXCLUSÃO) ──────────────────────────────
  const [authOpen, setAuthOpen] = useState(false);
  const [expedicaoSelecionada, setExpedicaoSelecionada] = useState(null);

  // ─── BUSCA DE DADOS NO BANCO (Agora apontando para BonusRecebimento) ─
  const { data: expedicoes = [], isLoading, isError, error } = useQuery({
    queryKey: ['lista-expedicoes-bonus'],
    queryFn: async () => {
      try {
        const resposta = await base44.entities.BonusRecebimento.list('-created_date', 500);
        return resposta || [];
      } catch (err) {
        console.error("Erro ao buscar dados:", err);
        throw err;
      }
    },
  });

  // ─── LÓGICA DOS FILTROS ──────────────────────────────────────────────
  const filtradas = useMemo(() => {
    return expedicoes.filter((exp) => {
      // Filtro por Fornecedor (Emitente)
      const termo = filtrosAtivos.busca.toLowerCase();
      const nomeDestino = String(exp.emitente_nome || '').toLowerCase();
      const matchFornecedor = !filtrosAtivos.busca || nomeDestino.includes(termo);

      // Filtro por Data
      let matchDataInicial = true;
      let matchDataFinal = true;

      const dataString = exp.created_date;

      if (dataString) {
        const expData = new Date(dataString);
        
        if (filtrosAtivos.dataInicial) {
           const dtInicial = new Date(filtrosAtivos.dataInicial + 'T00:00:00');
           matchDataInicial = expData >= dtInicial;
        }
        
        if (filtrosAtivos.dataFinal) {
           const dtFinal = new Date(filtrosAtivos.dataFinal + 'T23:59:59');
           matchDataFinal = expData <= dtFinal;
        }
      } else if (filtrosAtivos.dataInicial || filtrosAtivos.dataFinal) {
        return false;
      }

      return matchFornecedor && matchDataInicial && matchDataFinal;
    });
  }, [expedicoes, filtrosAtivos]);

  // Aplicar Filtros (Botão Pesquisar)
  const handlePesquisar = () => {
    setFiltrosAtivos({
      busca: inputFornecedor,
      dataInicial: inputDataInicial,
      dataFinal: inputDataFinal,
    });
  };

  // Limpar Filtros
  const limparFiltros = () => {
    setInputFornecedor('');
    setInputDataInicial('');
    setInputDataFinal('');
    setFiltrosAtivos({
      busca: '',
      dataInicial: '',
      dataFinal: '',
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handlePesquisar();
  };

  // ─── LÓGICA DE EXCLUSÃO ──────────────────────────────────────────────
  const abrirModalExclusao = (expedicao) => {
    setExpedicaoSelecionada(expedicao);
    setAuthOpen(true);
  };

  const handleExcluirAutorizado = async () => {
    try {
      // Exclui da entidade BonusRecebimento
      await base44.entities.BonusRecebimento.delete(expedicaoSelecionada.id);
      toast.success('Registro excluído com sucesso pelo Administrador.');
      queryClient.invalidateQueries({ queryKey: ['lista-expedicoes-bonus'] });
      // Invalida também a query da checagem para manter os dois sincronizados
      queryClient.invalidateQueries({ queryKey: ['checagem-bonus'] });
    } catch (error) {
      toast.error('Erro ao excluir: ' + error.message);
    } finally {
      setAuthOpen(false);
      setExpedicaoSelecionada(null);
    }
  };

  const formatarDataSegura = (dataString) => {
    if (!dataString) return 'Data Indisponível';
    try {
      return format(parseISO(dataString), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
    } catch (e) {
       try { return format(new Date(dataString), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR }); } 
       catch (e2) { return dataString; }
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
          Gerencie e acompanhe as saídas e recebimentos.
        </p>
      </div>

      {/* ─── BARRA DE FILTROS ──────────────────────────────────────────── */}
      <Card className="bg-muted/30 border-border">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            
            <div className="flex-1 w-full space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Fornecedor / Destino
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Digite o nome do fornecedor..."
                  className="pl-9 bg-background"
                  value={inputFornecedor}
                  onChange={(e) => setInputFornecedor(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
            </div>

            <div className="w-full md:w-40 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Data Inicial
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  className="pl-9 bg-background"
                  value={inputDataInicial}
                  onChange={(e) => setInputDataInicial(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
            </div>

            <div className="w-full md:w-40 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Data Final
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  className="pl-9 bg-background"
                  value={inputDataFinal}
                  onChange={(e) => setInputDataFinal(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              <Button 
                onClick={handlePesquisar}
                className="w-full md:w-auto gap-2 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Search className="w-4 h-4" />
                Pesquisar
              </Button>

              <Button 
                variant="outline" 
                className="w-full md:w-auto text-muted-foreground hover:text-foreground gap-2 shrink-0"
                onClick={limparFiltros}
              >
                <FilterX className="w-4 h-4" />
                Limpar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── LISTAGEM DE DADOS ────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : isError ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-12 text-center text-red-600">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="font-bold text-lg">Erro ao conectar com a base de dados</p>
            <p className="text-sm mt-1">{error?.message}</p>
          </CardContent>
        </Card>
      ) : filtradas.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <PackageCheck className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm font-medium text-muted-foreground">
              Nenhum registro encontrado para os filtros aplicados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtradas.map(exp => {
            const statusConfig = STATUS_CONFIG[exp.status] || { label: exp.status || 'Concluído', className: 'bg-muted text-muted-foreground' };
            const totalVolumes = (exp.itens_esperados || []).reduce((acc, i) => acc + (Number(i.qtd_esperada) || 0), 0);

            return (
              <Card key={exp.id} className="group overflow-hidden hover:shadow-md transition-all border-border">
                <CardContent className="p-5 flex flex-col md:flex-row items-center gap-4">
                  
                  {/* Info Principal */}
                  <div className="flex-1 space-y-1 w-full">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-lg">
                        #{exp.numero_bonus || exp.id?.slice(0,6).toUpperCase()}
                      </span>
                      <Badge variant="outline" className={`border ${statusConfig.className}`}>
                        {statusConfig.label}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">
                      Fornecedor: <span className="text-muted-foreground">{exp.emitente_nome || 'N/A'}</span>
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatarDataSegura(exp.created_date)}
                    </p>
                  </div>

                  {/* Volumes */}
                  <div className="text-left md:text-right px-0 md:px-4 border-l-0 md:border-l border-border w-full md:w-auto mt-4 md:mt-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-semibold">
                      Volumes
                    </p>
                    <p className="text-xl font-bold tabular-nums">
                      {totalVolumes} <span className="text-sm font-normal text-muted-foreground">cx</span>
                    </p>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2 mt-4 md:mt-0 border-t md:border-t-0 border-border pt-4 md:pt-0 w-full md:w-auto justify-end">
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="gap-2 w-full md:w-auto"
                      onClick={() => abrirModalExclusao(exp)}
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir
                    </Button>
                  </div>

                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── MODAL DE AUTENTICAÇÃO DO ADMIN ────────────────────────────── */}
      <AdminAuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        title="Autorizar Exclusão"
        description={`Por favor, insira as credenciais de administrador para excluir este registro permanentemente.`}
        onAuthorized={handleExcluirAutorizado}
      />
      
    </div>
  );
}