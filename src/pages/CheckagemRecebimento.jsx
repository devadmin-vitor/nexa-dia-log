import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Clock,
  FileText, Calendar, List, FileDown, Trash2, CheckSquare
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { jsPDF } from 'jspdf';

const STATUS_CONFIG = {
  em_conferencia: { label: '1ª Conferência', className: 'bg-blue-100 text-blue-700 border-blue-200', icon: Clock },
  aguardando_2a_conferencia: { label: 'Ag. 2ª Conferência', className: 'bg-purple-100 text-purple-700 border-purple-200', icon: Clock },
  conferido: { label: 'Conferido', className: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  divergente: { label: 'Divergente', className: 'bg-orange-100 text-orange-700 border-orange-200', icon: AlertTriangle },
};

export default function BonusDetalhado({ bonusId, onVoltar }) {
  const [bonus, setBonus] = useState(null);
  const [loading, setLoading] = useState(true);

  // Estados de Autenticação Inline
  const [authOpen, setAuthOpen] = useState(false);
  const [authLogin, setAuthLogin] = useState('');
  const [authSenha, setAuthSenha] = useState('');
  const [authAcao, setAuthAcao] = useState(null);

  useEffect(() => {
    async function loadBonus() {
      try {
        const data = await base44.entities.BonusRecebimento.get(bonusId);
        setBonus(data);
      } catch (err) {
        toast.error('Erro ao carregar detalhes do bônus.');
      } finally {
        setLoading(false);
      }
    }
    loadBonus();
  }, [bonusId]);

  // Função para abrir modal de senha
  const solicitarSenha = (acao) => {
    setAuthAcao(acao);
    setAuthOpen(true);
  };

  // Validação e Execução das Credenciais
  const handleConfirmAuth = async (e) => {
    e.preventDefault();

    if (authLogin.trim() === 'admin' && authSenha === 'amintor') {
      setAuthOpen(false);
      setAuthLogin('');
      setAuthSenha('');

      try {
        if (authAcao === 'excluir') {
          await base44.entities.BonusRecebimento.delete(bonus.id);
          toast.success('Bônus excluído pelo Administrador.');
          onVoltar(); // Volta pra lista
        } 
        else if (authAcao === 'forcar_conclusao') {
          const itensForcados = (bonus.itens_esperados || []).map(item => ({
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
            itens_conferidos: itensForcados,
            data_conferencia: new Date().toISOString()
          };

          const updated = await base44.entities.BonusRecebimento.update(bonus.id, payload);
          setBonus(updated);
          toast.success('Bônus forçado como Conferido pelo Admin!');
        }
      } catch (error) {
        toast.error('Erro ao executar ação no banco de dados.');
      }
    } else {
      toast.error('Acesso negado: Credenciais inválidas.');
    }
  };

  // Geração de PDF Simples
  const handleGerarPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Relatorio de Bonus - #${bonus.numero_bonus}`, 14, 20);
    doc.setFontSize(12);
    doc.text(`Emitente: ${bonus.emitente_nome}`, 14, 30);
    doc.text(`Status: ${STATUS_CONFIG[bonus.status]?.label || bonus.status}`, 14, 40);
    doc.save(`Bonus_${bonus.numero_bonus}.pdf`);
    toast.success('PDF gerado com sucesso!');
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando detalhes do Bônus...</div>;
  }

  if (!bonus) {
    return <div className="p-8 text-center text-red-500">Bônus não encontrado.</div>;
  }

  const statusObj = STATUS_CONFIG[bonus.status] || { label: bonus.status, className: 'bg-muted text-muted-foreground', icon: Clock };
  const StatusIcon = statusObj.icon;

  const itensConferidos = bonus.status === 'conferido' || bonus.status === 'divergente' 
    ? (bonus.itens_conferidos_2 || bonus.itens_conferidos || []) 
    : (bonus.itens_conferidos || []);

  const totalEsperado = (bonus.itens_esperados || []).reduce((acc, i) => acc + i.qtd_esperada, 0);
  const totalConferidoBoas = itensConferidos.filter(i => i.tipo_estoque === 'BOM').reduce((acc, i) => acc + i.qtd_caixas, 0);
  const totalConferidoAvarias = itensConferidos.filter(i => i.tipo_estoque === 'AVARIA').reduce((acc, i) => acc + i.qtd_caixas, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onVoltar} className="-ml-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">Bônus #{bonus.numero_bonus}</h1>
              <Badge className={`${statusObj.className} border gap-1`}>
                <StatusIcon className="w-3.5 h-3.5" />
                {statusObj.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{bonus.emitente_nome}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {bonus.status !== 'conferido' && (
            <Button variant="outline" size="sm" className="text-emerald-600 border-emerald-200 gap-2 hover:bg-emerald-50" onClick={() => solicitarSenha('forcar_conclusao')}>
              <CheckSquare className="w-4 h-4" />
              Forçar Conclusão
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-2" onClick={handleGerarPdf}>
            <FileDown className="w-4 h-4" />
            Exportar PDF
          </Button>
          <Button variant="destructive" size="sm" className="gap-2" onClick={() => solicitarSenha('excluir')}>
            <Trash2 className="w-4 h-4" />
            Excluir Bônus
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg text-primary">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Volume Esperado</p>
              <p className="text-2xl font-bold">{totalEsperado} <span className="text-sm font-normal text-muted-foreground">cx</span></p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Qtd Conferida (Boa)</p>
              <p className="text-2xl font-bold text-emerald-700">{totalConferidoBoas} <span className="text-sm font-normal text-muted-foreground">cx</span></p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-red-100 text-red-700 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avarias</p>
              <p className="text-2xl font-bold text-red-700">{totalConferidoAvarias} <span className="text-sm font-normal text-muted-foreground">cx</span></p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Itens */}
      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b border-border bg-muted/30">
            <h3 className="font-semibold flex items-center gap-2">
              <List className="w-4 h-4" /> Relatório de Produtos Conferidos
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">EAN / Código</th>
                  <th className="px-4 py-3 font-medium">Descrição</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Qtd</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {itensConferidos.length === 0 ? (
                  <tr><td colSpan="4" className="p-4 text-center text-muted-foreground">Nenhum item conferido ainda.</td></tr>
                ) : (
                  itensConferidos.map((item, index) => (
                    <tr key={index} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono text-muted-foreground">{item.ean}</td>
                      <td className="px-4 py-3">{item.descricao}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={item.tipo_estoque === 'AVARIA' ? 'text-red-600 border-red-200 bg-red-50' : 'text-emerald-600 border-emerald-200 bg-emerald-50'}>
                          {item.tipo_estoque}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{item.qtd_caixas}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Inline de Autenticação */}
      <AlertDialog open={authOpen} onOpenChange={setAuthOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {authAcao === 'excluir' ? 'Autorizar Exclusão' : 'Forçar Conclusão de Bônus'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {authAcao === 'excluir'
                ? `Por favor, insira credenciais de administrador para excluir permanentemente o bônus.`
                : `Atenção: Ao confirmar, o bônus será marcado como 100% conferido (sem avarias).`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Login de Administrador"
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
            <AlertDialogCancel onClick={() => setAuthOpen(false)}>Cancelar</AlertDialogCancel>
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