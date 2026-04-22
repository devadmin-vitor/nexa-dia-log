import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, TriangleAlert, CircleCheck, Clock,
  FileText, List, FileDown, Trash2, SquareCheck
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';

const STATUS_CONFIG = {
  em_conferencia: { label: '1ª Conferência', className: 'bg-blue-100 text-blue-700 border-blue-200', icon: Clock },
  aguardando_2a_conferencia: { label: 'Ag. 2ª Conferência', className: 'bg-purple-100 text-purple-700 border-purple-200', icon: Clock },
  conferido: { label: 'Conferido', className: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CircleCheck },
  divergente: { label: 'Divergente', className: 'bg-orange-100 text-orange-700 border-orange-200', icon: TriangleAlert },
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

  const solicitarSenha = (acao) => {
    setAuthAcao(acao);
    setAuthOpen(true);
  };

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
          onVoltar();
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