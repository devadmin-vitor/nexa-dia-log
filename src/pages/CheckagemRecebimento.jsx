import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  AlertCircle,
  CheckCircle,
  Clock,
  Package,
  Calendar,
  FileText,
  Eye,
  Trash,
  Check
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import BonusDetalhado from '@/components/checagem/BonusDetalhado';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
    icon: CheckCircle,
  },
  divergente: {
    label: 'Divergente',
    className: 'bg-orange-100 text-orange-700 border-orange-200',
    icon: AlertCircle,
  },
};

export default function CheckagemRecebimento() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [bonusSelecionado, setBonusSelecionado] = useState(null);
  
  // Controlo de Autenticação
  const [authOpen, setAuthOpen] = useState(false);
  const [authLogin, setAuthLogin] = useState('');
  const [authSenha, setAuthSenha] = useState('');
  const [authAcao, setAuthAcao] = useState(null);
  const [authBonus, setAuthBonus] = useState(null);

  const queryClient = useQueryClient();

  const { data: bonusList = [], isLoading } = useQuery({
    queryKey: ['checagem-bonus'],
    queryFn: () => base44.entities.BonusRecebimento.list('-created_date', 500),
  });

  function handleRequestDelete(bonus) {
    setAuthBonus(bonus);
    setAuthAcao('excluir');
    setAuthOpen(true);
  }

  function handleRequestForceComplete(bonus) {
    setAuthBonus(bonus);
    setAuthAcao('forcar_conclusao');
    setAuthOpen(true);
  }

  async function handleConfirmAuth(e) {
    e.preventDefault();

    if (authLogin.trim() === 'admin' && authSenha === 'amintor') {
      setAuthOpen(false);
      setAuthLogin('');
      setAuthSenha('');
      
      try {
        if (authAcao === 'excluir') {
          await base44.entities.BonusRecebimento.delete(authBonus.id);
          toast.success('Bônus excluído com sucesso.');
        } 
        else if (authAcao === 'forcar_conclusao') {
          const itensConferidosForcados = (authBonus.itens_esperados || []).map((item) => ({
            id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            ean: item.ean || 'SEM-EAN',
            descricao: item.descricao,
            qtd_caixas: item.qtd_esperada,
            tipo_estoque: 'BOM',
            norma_palete: 0,
            paletes_cheios: 0,
            caixas_soltas: item.qtd_esperada,
            qtd_paletes: `${item.qtd_esperada} cx`,
            endereco_id: null,
            validade: format(new Date(), 'yyyy-MM-dd')
          }));

          const payload = {
            status: 'conferido',
            itens_conferidos: itensConferidosForcados,
            data_conferencia: new Date().toISOString()
          };

          await base44.entities.BonusRecebimento.update(authBonus.id, payload);
          toast.success(`Bônus forçado como Conferido!`);
        }

        queryClient.invalidateQueries({ queryKey: ['checagem-bonus'] });
      } catch (error) {
        toast.error('Erro ao executar ação no banco de dados.');
      } finally {
        setAuthBonus(null);
        setAuthAcao(null);
      }
    } else {
      toast.error('Credenciais inválidas.');
    }
  }

  function handleCancelAuth() {
    setAuthOpen(false);
    setAuthLogin('');
    setAuthSenha('');
    setAuthAcao(null);
    setAuthBonus(null);
  }

  const filtered = useMemo(() => {
    return bonusList.filter((b) => {
      const termo = search.toLowerCase();
      const matchSearch = !search || 
        String(b.numero_bonus || '').toLowerCase().includes(termo) ||
        String(b.emitente_nome || '').toLowerCase().includes(termo);
        
      const matchStatus = filterStatus === 'todos' || b.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [bonusList, search, filterStatus]);

  if (bonusSelecionado) {
    return (
      <BonusDetalhado 
        bonusId={bonusSelecionado.id} 
        onVoltar={() => setBonusSelecionado(null)} 
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Checagem de Recebimento</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acompanhamento e auditoria dos bônus gerados.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por Nº Bônus ou Fornecedor..." 
            className="pl-9" 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
          <Button 
            variant={filterStatus === 'todos' ? 'default' : 'outline'} 
            onClick={() => setFilterStatus('todos')} 
            size="sm" 
            className="rounded-full"
          >
            Todos
          </Button>
          <Button 
            variant={filterStatus === 'em_conferencia' ? 'secondary' : 'outline'} 
            onClick={() => setFilterStatus('em_conferencia')} 
            size="sm" 
            className="rounded-full"
          >
            Pendentes
          </Button>
          <Button 
            variant={filterStatus === 'divergente' ? 'secondary' : 'outline'} 
            onClick={() => setFilterStatus('divergente')} 
            size="sm" 
            className="rounded-full text-orange-600 hover:text-orange-700"
          >
            Divergentes
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm font-medium text-muted-foreground">
              Nenhum bônus encontrado.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((bonus) => {
            const statusObj = STATUS_CONFIG[bonus.status] || { 
              label: bonus.status, 
              className: 'bg-muted text-muted-foreground', 
              icon: Clock 
            };
            const StatusIcon = statusObj.icon;
            
            const totalEsperado = (bonus.itens_esperados || []).reduce(
              (acc, i) => acc + (Number(i.qtd_esperada) || 0), 0
            );

            return (
              <Card key={bonus.id} className="group overflow-hidden hover:shadow-md transition-all border-border">
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row items-stretch">
                    
                    <div className={`hidden sm:block w-2 ${statusObj.className.split(' ')[0]}`} />

                    <div className="flex-1 p-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                      <div className="md:col-span-5 space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-lg">#{bonus.numero_bonus}</span>
                          <Badge variant="outline" className={`${statusObj.className} border flex gap-1.5 py-0.5`}>
                            <StatusIcon className="w-3.5 h-3.5" /> 
                            {statusObj.label}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium leading-none truncate">{bonus.emitente_nome}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {format(new Date(bonus.created_date), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" />
                            {bonus.notas_fiscais_ids?.length || 0} NFs
                          </span>
                        </div>
                      </div>

                      <div className="md:col-span-3">
                        <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">Volume Esperado</p>
                        <p className="text-xl font-semibold tabular-nums text-foreground">
                          {totalEsperado} <span className="text-sm font-normal text-muted-foreground">cx</span>
                        </p>
                      </div>

                      <div className="md:col-span-4 flex items-center justify-end gap-2 mt-4 md:mt-0">
                        {bonus.status !== 'conferido' && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200 gap-1.5" 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              handleRequestForceComplete(bonus); 
                            }}
                          >
                            <Check className="w-4 h-4" /> 
                            Finalizar
                          </Button>
                        )}
                        
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            handleRequestDelete(bonus); 
                          }}
                        >
                          <Trash className="w-4 h-4" />
                        </Button>

                        <Button 
                          className="gap-2 shrink-0 ml-2" 
                          onClick={() => setBonusSelecionado(bonus)}
                        >
                          <Eye className="w-4 h-4" /> 
                          Auditar
                        </Button>
                      </div>

                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={authOpen} onOpenChange={setAuthOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {authAcao === 'excluir' ? 'Autorizar Exclusão' : 'Forçar Conclusão'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Insira as credenciais de administrador para continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            <Input 
              placeholder="Login" 
              value={authLogin} 
              onChange={(e) => setAuthLogin(e.target.value)} 
              autoComplete="off" 
            />
            <Input 
              type="password" 
              placeholder="Senha" 
              value={authSenha} 
              onChange={(e) => setAuthSenha(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmAuth(e)} 
            />
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelAuth}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmAuth} 
              className={authAcao === 'excluir' ? 'bg-destructive text-white' : 'bg-emerald-600 text-white'}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}