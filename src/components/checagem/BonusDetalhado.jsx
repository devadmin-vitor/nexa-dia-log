import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Clock,
  FileText, Calendar, ShieldCheck, List, FileDown, Trash2,
  Copy, CheckSquare, Map
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import AdminAuthDialog from '@/components/admin/AdminAuthDialog';

const STATUS_CONFIG = {
  em_conferencia: { label: '1ª Conferência', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  aguardando_2a_conferencia: { label: 'Ag. 2ª Conferência', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  conferido: { label: 'Conferido', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  divergente: { label: 'Divergente', className: 'bg-orange-100 text-orange-700 border-orange-200' },
};

// ─── Decodificador de Caracteres Especiais HTML ─────────────────────────────
function decodeHTML(text) {
  if (!text) return '';
  return String(text)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// ─── Toggle checkbox redondo ────────────────────────────────────────────────
function RoundToggle({ checked, onChange, label, colorClass }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all select-none ${
        checked
          ? `${colorClass} border-current shadow-sm`
          : 'bg-muted/50 border-border text-muted-foreground hover:border-muted-foreground'
      }`}
    >
      <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${
        checked ? 'border-current bg-current' : 'border-current/40 bg-transparent'
      }`}>
        {checked && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
      </span>
      {label}
    </button>
  );
}

// ─── Tabela de itens na tela ─────────────────────────────────────────────────
function ItensTable({ itens, titulo, cor }) {
  if (!itens || itens.length === 0) return null;
  const itensBons = itens.filter(i => i.tipo_estoque !== 'AVARIA');
  const itensAvaria = itens.filter(i => i.tipo_estoque === 'AVARIA');

  return (
    <div>
      <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${cor}`}>{titulo}</h3>
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider">EAN</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider">Descrição</th>
              <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider">Validade</th>
              <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider">Qtd Cx</th>
              <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider">Paletes</th>
              <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider">Tipo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {itensBons.map((item, i) => (
              <tr key={i} className="hover:bg-muted/30">
                <td className="px-3 py-2 font-mono text-muted-foreground">{item.ean || '—'}</td>
                <td className="px-3 py-2 font-medium">{decodeHTML(item.descricao) || '—'}</td>
                <td className="px-3 py-2 text-center tabular-nums">
                  {item.validade ? format(new Date(item.validade), 'dd/MM/yyyy') : <span className="text-muted-foreground/50">—</span>}
                </td>
                <td className="px-3 py-2 text-center font-bold tabular-nums">{(item.qtd_caixas || item.qtd_esperada || 0).toLocaleString('pt-BR')}</td>
                <td className="px-3 py-2 text-center text-muted-foreground">{item.qtd_paletes || '—'}</td>
                <td className="px-3 py-2 text-center">
                  <Badge className="text-[9px] bg-emerald-100 text-emerald-700 border border-emerald-200">BOM</Badge>
                </td>
              </tr>
            ))}
            {itensAvaria.map((item, i) => (
              <tr key={`av_${i}`} className="bg-red-50/50 hover:bg-red-50">
                <td className="px-3 py-2 font-mono text-muted-foreground">{item.ean || '—'}</td>
                <td className="px-3 py-2 font-medium">{decodeHTML(item.descricao) || '—'}</td>
                <td className="px-3 py-2 text-center tabular-nums">
                  {item.validade ? format(new Date(item.validade), 'dd/MM/yyyy') : <span className="text-muted-foreground/50">—</span>}
                </td>
                <td className="px-3 py-2 text-center font-bold tabular-nums text-red-600">{(item.qtd_caixas || item.qtd_esperada || 0).toLocaleString('pt-BR')}</td>
                <td className="px-3 py-2 text-center text-muted-foreground">{item.qtd_paletes || '—'}</td>
                <td className="px-3 py-2 text-center">
                  <Badge className="text-[9px] bg-red-100 text-red-700 border border-red-200 gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" />AVARIA
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-3 py-2 bg-muted/30 border-t border-border flex items-center justify-end gap-6 text-xs">
          <span>Total Boas: <span className="font-bold">{itensBons.reduce((a, i) => a + (Number(i.qtd_caixas) || Number(i.qtd_esperada) || 0), 0).toLocaleString('pt-BR')} cx</span></span>
          {itensAvaria.length > 0 && (
            <span className="text-red-600">Total Avarias: <span className="font-bold">{itensAvaria.reduce((a, i) => a + (Number(i.qtd_caixas) || Number(i.qtd_esperada) || 0), 0).toLocaleString('pt-BR')} cx</span></span>
          )}
          <span className="font-semibold">Total Geral: <span>{itens.reduce((a, i) => a + (Number(i.qtd_caixas) || Number(i.qtd_esperada) || 0), 0).toLocaleString('pt-BR')} cx</span></span>
        </div>
      </div>
    </div>
  );
}

// ─── Seção de divergências na tela ───────────────────────────────────────────
function DivergenciasSection({ bonus }) {
  const conf1 = bonus.itens_conferidos || [];
  const conf2 = bonus.itens_conferidos_2 || [];
  const esperados = bonus.itens_esperados || [];
  if (conf1.length === 0 && conf2.length === 0) return null;

  const espPorDesc = {};
  const eanEspPorDesc = {};
  esperados.forEach(i => {
    const d = decodeHTML(i.descricao);
    espPorDesc[d] = (espPorDesc[d] || 0) + (Number(i.qtd_esperada) || 0);
    if (/^\d{8,14}$/.test(i.ean || '')) eanEspPorDesc[d] = i.ean;
  });

  const conf1PorDesc = {};
  const eanConf1PorDesc = {};
  conf1.forEach(i => {
    const d = decodeHTML(i.descricao);
    conf1PorDesc[d] = (conf1PorDesc[d] || 0) + (Number(i.qtd_caixas) || 0);
    eanConf1PorDesc[d] = i.ean;
  });

  const divNF = [...new Set([...Object.keys(espPorDesc), ...Object.keys(conf1PorDesc)])]
    .map(desc => ({ ean: eanConf1PorDesc[desc] || eanEspPorDesc[desc] || desc, descricao: desc, esperado: espPorDesc[desc] || 0, conferido1: conf1PorDesc[desc] || 0 }))
    .filter(d => d.esperado !== d.conferido1);

  const totais1 = {};
  const descMap1 = {};
  conf1.forEach(i => { totais1[i.ean] = (totais1[i.ean] || 0) + (Number(i.qtd_caixas) || 0); descMap1[i.ean] = decodeHTML(i.descricao); });
  const totais2 = {};
  conf2.forEach(i => { totais2[i.ean] = (totais2[i.ean] || 0) + (Number(i.qtd_caixas) || 0); });

  const div12 = conf2.length > 0
    ? [...new Set([...Object.keys(totais1), ...Object.keys(totais2)])]
        .map(ean => ({ ean, descricao: descMap1[ean] || ean, conf1: totais1[ean] || 0, conf2: totais2[ean] || 0 }))
        .filter(d => d.conf1 !== d.conf2)
    : [];

  if (divNF.length === 0 && div12.length === 0) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        Nenhuma divergência encontrada — conferência 100% consistente.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {divNF.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-orange-600 mb-2">Divergências NF vs 1ª Conferência</h3>
          <div className="rounded-xl border border-orange-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead><tr className="bg-orange-50 border-b border-orange-200">
                <th className="text-left px-3 py-2 font-semibold text-orange-700 uppercase">Produto</th>
                <th className="text-right px-3 py-2 font-semibold text-orange-700 uppercase">Esperado NF</th>
                <th className="text-right px-3 py-2 font-semibold text-orange-700 uppercase">1ª Conf.</th>
                <th className="text-right px-3 py-2 font-semibold text-orange-700 uppercase">Diferença</th>
              </tr></thead>
              <tbody className="divide-y divide-orange-100">
                {divNF.map((d, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2"><p className="font-medium">{d.descricao}</p><p className="text-muted-foreground font-mono">{d.ean}</p></td>
                    <td className="px-3 py-2 text-right tabular-nums">{d.esperado.toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold">{d.conferido1.toLocaleString('pt-BR')}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-bold ${d.conferido1 - d.esperado > 0 ? 'text-orange-600' : 'text-red-600'}`}>
                      {d.conferido1 - d.esperado > 0 ? '+' : ''}{(d.conferido1 - d.esperado).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {div12.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-red-600 mb-2">Divergências 1ª vs 2ª Conferência</h3>
          <div className="rounded-xl border border-red-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead><tr className="bg-red-50 border-b border-red-200">
                <th className="text-left px-3 py-2 font-semibold text-red-700 uppercase">Produto</th>
                <th className="text-right px-3 py-2 font-semibold text-red-700 uppercase">1ª Conf.</th>
                <th className="text-right px-3 py-2 font-semibold text-red-700 uppercase">2ª Conf.</th>
                <th className="text-right px-3 py-2 font-semibold text-red-700 uppercase">Diferença</th>
              </tr></thead>
              <tbody className="divide-y divide-red-100">
                {div12.map((d, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2"><p className="font-medium">{d.descricao}</p><p className="text-muted-foreground font-mono">{d.ean}</p></td>
                    <td className="px-3 py-2 text-right tabular-nums">{d.conf1.toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold">{d.conf2.toLocaleString('pt-BR')}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-bold ${d.conf2 - d.conf1 > 0 ? 'text-orange-600' : 'text-red-600'}`}>
                      {d.conf2 - d.conf1 > 0 ? '+' : ''}{(d.conf2 - d.conf1).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAPA DE SEPARAÇÃO (Somente xMun e xBairro mapeados direto do XML) ────────
function gerarMapaSeparacao(bonus, notasVinculadas) {
  if (!notasVinculadas || notasVinculadas.length === 0) {
    toast.error("Nenhuma Nota Fiscal vinculada a este bônus para gerar o mapa.");
    return;
  }

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const W = 210;
  const H = 297;
  const margin = 14;
  const maxY = H - 20;

  // Agrupar Notas Fiscais por Cliente
  const gruposClientes = {};
  notasVinculadas.forEach(nf => {
    const bruto = nf.destinatario_nome || nf.razao_social_destinatario || nf.razao_social || nf.cliente_nome || 'Cliente Não Identificado';
    const clienteNome = decodeHTML(bruto);
    if (!gruposClientes[clienteNome]) {
      gruposClientes[clienteNome] = [];
    }
    gruposClientes[clienteNome].push(nf);
  });

  let y = margin;

  const printMainHeader = () => {
    doc.setFillColor(30, 64, 175); 
    doc.rect(0, 0, W, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`Mapa de Separação - Bônus #${decodeHTML(bonus.numero_bonus)}`, margin, 10);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, margin, 16);
    y = 32;
  };

  const newPage = () => {
    doc.addPage();
    printMainHeader();
  };

  const checkY = (need) => {
    if (y + need > maxY) newPage();
  };

  printMainHeader();

  Object.keys(gruposClientes).forEach((cliente, index) => {
    checkY(35);

    if (index > 0 && y > 35) {
      doc.setDrawColor(210, 215, 220);
      doc.line(margin, y - 4, W - margin, y - 4);
      y += 2;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Cliente:`, margin, y);
    doc.setTextColor(30, 64, 175);
    
    const splitNome = doc.splitTextToSize(cliente, W - margin * 2 - 18);
    doc.text(splitNome, margin + 16, y);
    y += Math.max(8, splitNome.length * 5);

    let totalCaixasCliente = 0;
    const nfsDoCliente = gruposClientes[cliente];
    
    nfsDoCliente.forEach(nf => {
      checkY(25);
      
      const numeroNF = nf.numero_nf || nf.nf || 'S/N';
      const produtosNF = nf.itens || [];

      // Extrator Robusto para xMun e xBairro do XML SEFAZ
      let munVal = nf.xMun || nf.destinatario?.xMun || nf.dest?.enderDest?.xMun || nf.infNFe?.dest?.enderDest?.xMun;
      let bairroVal = nf.xBairro || nf.destinatario?.xBairro || nf.dest?.enderDest?.xBairro || nf.infNFe?.dest?.enderDest?.xBairro;

      // Fallback: Busca via Regex em todo o objeto stringificado, caso o XML tenha vindo compactado como string do backend
      const nfString = JSON.stringify(nf);
      if (!munVal && /<xMun>(.*?)<\/xMun>/.test(nfString)) {
        munVal = nfString.match(/<xMun>(.*?)<\/xMun>/)[1];
      }
      if (!bairroVal && /<xBairro>(.*?)<\/xBairro>/.test(nfString)) {
        bairroVal = nfString.match(/<xBairro>(.*?)<\/xBairro>/)[1];
      }

      const municipio = decodeHTML(munVal || 'N/I');
      const bairro = decodeHTML(bairroVal || 'N/I');

      // Cabeçalho da NF com Município e Bairro (Rota removida)
      doc.setFillColor(240, 244, 248);
      doc.roundedRect(margin, y, W - margin * 2, 9, 2, 2, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 58, 138); 
      doc.text(`NF: ${numeroNF}   |   Município: ${municipio}   |   Bairro: ${bairro}`, margin + 4, y + 6);
      y += 11;

      if (produtosNF.length === 0) {
         doc.setFontSize(8);
         doc.setTextColor(100, 100, 100);
         doc.setFont('helvetica', 'italic');
         doc.text("Nenhum produto detalhado encontrado para esta NF.", margin + 4, y);
         y += 8;
         return;
      }

      doc.setFillColor(226, 232, 240);
      doc.rect(margin, y, W - margin * 2, 6, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('EAN / CÓDIGO', margin + 2, y + 4);
      doc.text('DESCRIÇÃO DO PRODUTO', margin + 35, y + 4);
      doc.text('QTD CX', W - margin - 20, y + 4, { align: 'right' });
      y += 6;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      
      let totalCaixasNF = 0;

      produtosNF.forEach((item, idx) => {
        checkY(8);
        if (idx % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, W - margin * 2, 6, 'F');
        }
        
        const qtd = Number(item.qtd_caixas || item.quantidade_caixas || item.quantidade || item.qtd || item.qtd_esperada || 0);
        const ean = String(item.ean || item.codigo_barras || '—');
        const desc = decodeHTML(item.descricao || item.nome_produto || item.produto_descricao || '—');

        totalCaixasNF += qtd;
        totalCaixasCliente += qtd;

        doc.text(ean, margin + 2, y + 4);
        doc.text(doc.splitTextToSize(desc, 110)[0], margin + 35, y + 4);
        doc.setFont('helvetica', 'bold');
        doc.text(qtd.toLocaleString('pt-BR'), W - margin - 5, y + 4, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        
        y += 6;
      });

      checkY(8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(`Subtotal NF ${numeroNF}:`, margin + 35, y + 4);
      doc.text(`${totalCaixasNF.toLocaleString('pt-BR')} cx`, W - margin - 5, y + 4, { align: 'right' });
      y += 8;
    });

    checkY(12);
    doc.setFillColor(226, 232, 240);
    doc.rect(margin, y, W - margin * 2, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`TOTAL A SEPARAR (ESTE CLIENTE):`, margin + 2, y + 5);
    doc.text(`${totalCaixasCliente.toLocaleString('pt-BR')} cx`, W - margin - 5, y + 5, { align: 'right' });
    
    y += 12;
  });

  doc.save(`Mapa_Separacao_Bonus_${bonus.numero_bonus}.pdf`);
}

// ─── Geração do PDF: RELATÓRIO GERAL (Antigo) ─────────────────────────────────────────
function gerarPDF(bonus, notasVinculadas = [], filtros = { sobras: true, faltas: true, avarias: true }, orientacao = 'portrait') {
  const isLandscape = orientacao === 'landscape';
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: orientacao });
  const W = isLandscape ? 297 : 210;
  const H = isLandscape ? 210 : 297;
  const margin = 14;
  const maxY = H - 18;
  let y = 14;

  const tableW = W - margin * 2;
  const COL = {
    ean:      { x: margin + 1,                         w: tableW * 0.13 },
    desc:     { x: margin + tableW * 0.13 + 1,         w: tableW * 0.30 },
    validade: { x: margin + tableW * 0.43 + 1,         w: tableW * 0.11 },
    pedida:   { x: margin + tableW * 0.54 + 1,         w: tableW * 0.08 },
    qtd:      { x: margin + tableW * 0.62 + 1,         w: tableW * 0.08 },
    diff:     { x: margin + tableW * 0.70 + 1,         w: tableW * 0.08 },
    paletes:  { x: margin + tableW * 0.78 + 1,         w: tableW * 0.13 },
    tipo:     { x: margin + tableW * 0.91 + 1,         w: tableW * 0.09 },
  };

  const addText = (text, x, yy, opts = {}) => {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(opts.size || 8);
    if (opts.maxW) {
      const lines = doc.splitTextToSize(String(text), opts.maxW);
      doc.text(lines[0], x, yy);
    } else {
      doc.text(String(text), x, yy);
    }
  };

  const hLine = (yy, color = [200, 200, 200]) => {
    doc.setDrawColor(...color);
    doc.line(margin, yy, W - margin, yy);
  };

  const newPage = () => { doc.addPage(); y = 20; };
  const checkY = (need = 10) => { if (y + need > maxY) newPage(); };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  let nfLines = [];
  if (bonus.notas_fiscais_ids?.length) {
    const nfStr = notasVinculadas.length > 0
      ? `NFs: ${notasVinculadas.map(n => `NF-${n.numero_nf}`).join('  |  ')}`
      : `NFs: ${bonus.notas_fiscais_ids.length} vinculada(s)`;
    nfLines = doc.splitTextToSize(nfStr, W - margin * 2);
  }
  const headerH = 20 + (nfLines.length > 0 ? nfLines.length * 5 : 0);

  doc.setFillColor(22, 163, 74);
  doc.rect(0, 0, W, headerH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`Relatório de Bônus #${bonus.numero_bonus}`, margin, 10);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  doc.text(`Emitido em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, margin, 17);

  if (nfLines.length > 0) {
    nfLines.forEach((line, idx) => {
      doc.text(line, margin, 22 + idx * 5);
    });
  }

  doc.setTextColor(0, 0, 0);
  y = headerH + 6;

  const totalConferido1 = (bonus.itens_conferidos || []).reduce((a, i) => a + (Number(i.qtd_caixas) || 0), 0);
  const totalConferido2 = (bonus.itens_conferidos_2 || []).reduce((a, i) => a + (Number(i.qtd_caixas) || 0), 0);
  const totalPedido = (bonus.itens_esperados || []).reduce((a, i) => a + (Number(i.qtd_esperada) || 0), 0);
  const statusLabel = { conferido: 'Conferido', divergente: 'Divergente', em_conferencia: '1ª Conferência', aguardando_2a_conferencia: 'Ag. 2ª Conferência' };

  doc.setFillColor(247, 250, 247);
  doc.setDrawColor(200, 220, 200);
  doc.roundedRect(margin, y, tableW, 20, 2, 2, 'FD');
  y += 5;

  addText('Emitente:', margin + 3, y, { bold: true, size: 8 });
  addText(bonus.emitente_nome || '—', margin + 22, y, { size: 8, maxW: tableW * 0.4 });
  addText('Status:', W - margin - 60, y, { bold: true, size: 8 });
  addText(statusLabel[bonus.status] || bonus.status, W - margin - 45, y, { size: 8 });
  y += 6;

  addText('Qtd Pedida (NF):', margin + 3, y, { bold: true, size: 8 });
  addText(`${totalPedido.toLocaleString('pt-BR')} cx`, margin + 38, y, { size: 8 });
  addText('1ª Conf.:', margin + tableW * 0.35, y, { bold: true, size: 8 });
  addText(`${totalConferido1.toLocaleString('pt-BR')} cx`, margin + tableW * 0.35 + 16, y, { size: 8 });
  if (totalConferido2 > 0) {
    addText('2ª Conf.:', margin + tableW * 0.55, y, { bold: true, size: 8 });
    addText(`${totalConferido2.toLocaleString('pt-BR')} cx`, margin + tableW * 0.55 + 16, y, { size: 8 });
  }
  y += 6;

  if (bonus.data_conferencia || bonus.data_conferencia_2) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(100, 100, 100);
    let ds = '';
    if (bonus.data_conferencia) ds += `1ª Conf.: ${format(new Date(bonus.data_conferencia), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`;
    if (bonus.data_conferencia_2) ds += `   2ª Conf.: ${format(new Date(bonus.data_conferencia_2), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`;
    doc.text(ds, margin + 3, y);
    doc.setTextColor(0, 0, 0);
    y += 5;
  }

  y += 4;
  hLine(y); y += 6;

  const espPorDesc = {};
  (bonus.itens_esperados || []).forEach(i => {
    espPorDesc[i.descricao] = (espPorDesc[i.descricao] || 0) + (Number(i.qtd_esperada) || 0);
  });

  const drawItensTable = (itens, titulo) => {
    if (!itens || itens.length === 0) return;
    checkY(20);

    addText(titulo, margin, y, { bold: true, size: 10 }); y += 7;

    doc.setFillColor(230, 245, 235);
    doc.rect(margin, y - 4.5, tableW, 6.5, 'F');
    hLine(y - 4.5, [180, 210, 180]);
    doc.setTextColor(40, 100, 60);
    addText('EAN',       COL.ean.x,      y, { bold: true, size: 6.5 });
    addText('Descrição', COL.desc.x,     y, { bold: true, size: 6.5 });
    addText('Validade',  COL.validade.x, y, { bold: true, size: 6.5 });
    addText('Pedido',    COL.pedida.x,   y, { bold: true, size: 6.5 });
    addText('Conf.',     COL.qtd.x,      y, { bold: true, size: 6.5 });
    addText('+/-',       COL.diff.x,     y, { bold: true, size: 6.5 });
    addText('Paletes',   COL.paletes.x,  y, { bold: true, size: 6.5 });
    addText('Tipo',      COL.tipo.x,     y, { bold: true, size: 6.5 });
    doc.setTextColor(0, 0, 0);
    y += 5; hLine(y, [180, 210, 180]); y += 3;

    let totalBoas = 0, totalAvarias = 0;

    itens.forEach((item, idx) => {
      checkY(6);
      const isAvaria = item.tipo_estoque === 'AVARIA';
      const qtdConf = Number(item.qtd_caixas) || 0;
      const qtdPed  = espPorDesc[item.descricao] || 0;
      const diff    = qtdConf - qtdPed;

      if (isAvaria && !filtros.avarias) return;
      if (!isAvaria) {
        const isSobra = diff > 0;
        const isFalta = diff < 0;
        if (isSobra && !filtros.sobras) return;
        if (isFalta && !filtros.faltas) return;
      }

      if (isAvaria) {
        doc.setFillColor(255, 245, 245);
        doc.rect(margin, y - 3.5, tableW, 5.5, 'F');
        doc.setTextColor(180, 30, 30);
        totalAvarias += qtdConf;
      } else {
        if (idx % 2 === 0) { doc.setFillColor(252, 252, 252); doc.rect(margin, y - 3.5, tableW, 5.5, 'F'); }
        doc.setTextColor(30, 30, 30);
        totalBoas += qtdConf;
      }

      doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      doc.text(doc.splitTextToSize((item.ean || '—').toString(), COL.ean.w)[0], COL.ean.x, y);
      doc.text(doc.splitTextToSize((item.descricao || '—').toString(), COL.desc.w)[0], COL.desc.x, y);
      doc.text(item.validade ? format(new Date(item.validade), 'dd/MM/yyyy') : '—', COL.validade.x, y);

      if (!isAvaria) {
        doc.setTextColor(80, 80, 80);
        doc.text(qtdPed > 0 ? qtdPed.toString() : '—', COL.pedida.x, y);
      } else { doc.text('—', COL.pedida.x, y); }

      doc.setTextColor(isAvaria ? 180 : 30, 30, 30);
      doc.text(qtdConf.toString(), COL.qtd.x, y);

      if (!isAvaria && qtdPed > 0) {
        if (diff === 0) { doc.setTextColor(22, 163, 74); doc.text('=', COL.diff.x, y); }
        else if (diff > 0) { doc.setTextColor(200, 100, 0); doc.text(`+${diff}`, COL.diff.x, y); }
        else { doc.setTextColor(180, 30, 30); doc.text(`${diff}`, COL.diff.x, y); }
      } else { doc.setTextColor(150, 150, 150); doc.text('—', COL.diff.x, y); }

      doc.setTextColor(isAvaria ? 180 : 30, 30, 30);
      doc.text(doc.splitTextToSize((item.qtd_paletes || '—').toString(), COL.paletes.w)[0], COL.paletes.x, y);
      doc.text(isAvaria ? 'AVARIA' : 'BOM', COL.tipo.x, y);
      doc.setTextColor(0, 0, 0);
      y += 5.5;
    });

    doc.setTextColor(0, 0, 0);
    hLine(y); y += 4;
    doc.setFillColor(240, 248, 240);
    doc.rect(margin, y - 3.5, tableW, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text(`Boas: ${totalBoas.toLocaleString('pt-BR')} cx`, COL.validade.x, y + 1);
    if (totalAvarias > 0) {
      doc.setTextColor(180, 30, 30);
      doc.text(`Avarias: ${totalAvarias.toLocaleString('pt-BR')} cx`, COL.qtd.x, y + 1);
      doc.setTextColor(0, 0, 0);
    }
    doc.text(`Total: ${(totalBoas + totalAvarias).toLocaleString('pt-BR')} cx`, COL.paletes.x, y + 1);
    y += 12;
  };

  drawItensTable(bonus.itens_conferidos, '1ª Conferência — Itens Conferidos');
  if (bonus.itens_conferidos_2?.length) {
    drawItensTable(bonus.itens_conferidos_2, '2ª Conferência — Itens Verificados');
  }

  if (filtros.faltas) {
    const itensConferidosRef = bonus.itens_conferidos_2?.length ? bonus.itens_conferidos_2 : (bonus.itens_conferidos || []);
    const confPorDesc = {};
    itensConferidosRef.forEach(i => { confPorDesc[i.descricao] = (confPorDesc[i.descricao] || 0) + (Number(i.qtd_caixas) || 0); });
    const itensPendentes = (bonus.itens_esperados || [])
      .map(item => ({ ...item, qtd_conferida: confPorDesc[item.descricao] || 0, qtd_pendente: (Number(item.qtd_esperada) || 0) - (confPorDesc[item.descricao] || 0) }))
      .filter(item => item.qtd_pendente > 0);

    if (itensPendentes.length > 0) {
      checkY(20);
      addText('Itens Pendentes de Conferência (Faltas)', margin, y, { bold: true, size: 10 }); y += 7;

      doc.setFillColor(255, 243, 230);
      doc.rect(margin, y - 4.5, tableW, 6.5, 'F');
      hLine(y - 4.5, [220, 180, 100]);
      doc.setTextColor(140, 80, 0);
      addText('EAN',       margin + 1,           y, { bold: true, size: 6.5 });
      addText('Descrição', margin + tableW * 0.15, y, { bold: true, size: 6.5 });
      addText('Pedido',    margin + tableW * 0.75, y, { bold: true, size: 6.5 });
      addText('Conferido', margin + tableW * 0.83, y, { bold: true, size: 6.5 });
      addText('Pendente',  margin + tableW * 0.91, y, { bold: true, size: 6.5 });
      doc.setTextColor(0, 0, 0);
      y += 5; hLine(y, [220, 180, 100]); y += 3;

      itensPendentes.forEach((item, idx) => {
        checkY(6);
        if (idx % 2 === 0) { doc.setFillColor(255, 250, 240); doc.rect(margin, y - 3.5, tableW, 5.5, 'F'); }
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
        doc.text(doc.splitTextToSize((item.ean || '—').toString(), tableW * 0.14)[0], margin + 1, y);
        doc.text(doc.splitTextToSize((item.descricao || '—').toString(), tableW * 0.58)[0], margin + tableW * 0.15, y);
        doc.setTextColor(80, 80, 80);
        doc.text(item.qtd_esperada.toString(),  margin + tableW * 0.75, y);
        doc.text(item.qtd_conferida.toString(), margin + tableW * 0.83, y);
        doc.setTextColor(180, 30, 30); doc.setFont('helvetica', 'bold');
        doc.text(`-${item.qtd_pendente}`, margin + tableW * 0.91, y);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
        y += 5.5;
      });

      hLine(y); y += 4;
      doc.setFillColor(255, 243, 230);
      doc.rect(margin, y - 3.5, tableW, 6, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(140, 80, 0);
      const totalPend = itensPendentes.reduce((a, i) => a + i.qtd_pendente, 0);
      doc.text(`Total pendente: ${totalPend.toLocaleString('pt-BR')} cx`, margin + 3, y + 1);
      doc.setTextColor(0, 0, 0);
      y += 12;
    }
  }

  doc.save(`Relatorio_Bonus_${bonus.numero_bonus}.pdf`);
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function BonusDetalhado({ bonus, onVoltar, onDeleted }) {
  
  if (!bonus) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <AlertTriangle className="w-10 h-10 text-amber-500" />
        <p className="text-muted-foreground font-medium">Carregando informações do bônus...</p>
        <Button onClick={onVoltar} variant="outline" className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para Lista
        </Button>
      </div>
    );
  }

  const [authDeleteOpen, setAuthDeleteOpen] = useState(false);
  const [confirmReplicacaoOpen, setConfirmReplicacaoOpen] = useState(false);
  const [authReplicacaoOpen, setAuthReplicacaoOpen] = useState(false);
  const [replicando, setReplicando] = useState(false);
  
  const [authForceCompleteOpen, setAuthForceCompleteOpen] = useState(false);
  const [notasVinculadas, setNotasVinculadas] = useState([]);

  // Filtros do PDF
  const [filtroSobras, setFiltroSobras] = useState(true);
  const [filtroFaltas, setFiltroFaltas] = useState(true);
  const [filtroAvarias, setFiltroAvarias] = useState(true);
  const [orientacao, setOrientacao] = useState('portrait');

  const cfg = STATUS_CONFIG[bonus.status] || STATUS_CONFIG.em_conferencia;

  useEffect(() => {
    if (!bonus.notas_fiscais_ids?.length) return;
    Promise.all(bonus.notas_fiscais_ids.map(id => base44.entities.NotaFiscal.filter({ id })))
      .then(results => setNotasVinculadas(results.flatMap(r => r).filter(Boolean)))
      .catch(() => {});
  }, [bonus.id]);

  const itens1 = bonus.itens_conferidos || [];
  const itens2 = bonus.itens_conferidos_2 || [];
  const totalCx1 = itens1.reduce((a, i) => a + (Number(i.qtd_caixas) || Number(i.qtd_esperada) || 0), 0);
  const totalCx2 = itens2.reduce((a, i) => a + (Number(i.qtd_caixas) || Number(i.qtd_esperada) || 0), 0);
  const totalEsp = (bonus.itens_esperados || []).reduce((a, i) => a + (Number(i.qtd_esperada) || 0), 0);
  const temAvaria1 = itens1.some(i => i.tipo_estoque === 'AVARIA');
  const temAvaria2 = itens2.some(i => i.tipo_estoque === 'AVARIA');

  const handleReplicar = async () => {
    setReplicando(true);
    try {
      const itens1Copia = JSON.parse(JSON.stringify(bonus.itens_conferidos || []));
      await base44.entities.BonusRecebimento.update(bonus.id, {
        itens_conferidos_2: itens1Copia,
        status: 'aguardando_2a_conferencia',
        data_conferencia_2: new Date().toISOString(),
      });
      toast.success('1ª conferência replicada com sucesso para a 2ª conferência!');
      onVoltar();
    } catch (err) {
      toast.error('Erro ao replicar: ' + err.message);
    } finally {
      setReplicando(false);
    }
  };

  const handleForcarConclusao = async () => {
    try {
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

      await base44.entities.BonusRecebimento.update(bonus.id, {
        status: 'conferido',
        itens_conferidos: itensForcados,
        data_conferencia: new Date().toISOString()
      });
      toast.success('Bônus forçado como Conferido com sucesso!');
      onVoltar(); 
    } catch (err) {
      toast.error('Erro ao forçar conclusão: ' + err.message);
    }
  };

  const handleExportarPDF = () => {
    gerarPDF(
      bonus,
      notasVinculadas,
      { sobras: filtroSobras, faltas: filtroFaltas, avarias: filtroAvarias },
      orientacao
    );
  };

  const handleMapaSeparacao = () => {
    if (!notasVinculadas || notasVinculadas.length === 0) {
      toast.error('Não é possível emitir o mapa: Não há Notas Fiscais vinculadas a este bônus no banco de dados.');
      return;
    }
    gerarMapaSeparacao(bonus, notasVinculadas);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={onVoltar} className="-ml-1 shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">Bônus #{bonus.numero_bonus}</h1>
            <Badge className={`text-[11px] border ${cfg.className}`}>{cfg.label}</Badge>
            {(temAvaria1 || temAvaria2) && (
              <Badge className="text-[11px] border bg-red-100 text-red-700 border-red-200 gap-1">
                <AlertTriangle className="w-3 h-3" />Contém Avarias
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{bonus.emitente_nome || '—'}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {bonus.status !== 'conferido' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAuthForceCompleteOpen(true)}
              className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
            >
              <CheckSquare className="w-4 h-4" />
              Forçar Conclusão
            </Button>
          )}

          {itens1.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmReplicacaoOpen(true)}
              className="gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
            >
              <Copy className="w-4 h-4" />
              Replicação
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setAuthDeleteOpen(true)} className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10">
            <Trash2 className="w-4 h-4" />Excluir
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmReplicacaoOpen} onOpenChange={setConfirmReplicacaoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Atenção — Ação de Risco
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <p>Esta ação irá <strong>duplicar todos os itens da 1ª conferência</strong> como dados da 2ª conferência, sobrescrevendo qualquer conferência dupla existente.</p>
              <p className="text-amber-700 font-medium">Tem certeza que deseja prosseguir adiante?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => { setConfirmReplicacaoOpen(false); setAuthReplicacaoOpen(true); }}
            >
              Sim, prosseguir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AdminAuthDialog open={authReplicacaoOpen} onOpenChange={setAuthReplicacaoOpen} title="Autenticação — Replicação" description="Confirme suas credenciais de administrador para replicar a 1ª conferência." onAuthorized={handleReplicar} />
      <AdminAuthDialog open={authForceCompleteOpen} onOpenChange={setAuthForceCompleteOpen} title="Forçar Conclusão" description="Esta ação marcará o bônus como 100% conferido. Confirme suas credenciais de administrador." onAuthorized={handleForcarConclusao} />
      <AdminAuthDialog open={authDeleteOpen} onOpenChange={setAuthDeleteOpen} title="Excluir Bônus" description="Esta ação é irreversível. Confirme suas credenciais de administrador para excluir este bônus e liberar as NFs vinculadas." onAuthorized={async () => { await base44.entities.BonusRecebimento.delete(bonus.id); onDeleted?.(); onVoltar(); }} />

      {notasVinculadas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {notasVinculadas.map(nf => (
            <span key={nf.id} className="text-xs font-mono bg-muted border border-border rounded px-2 py-1">NF-{nf.numero_nf || nf.nf}</span>
          ))}
        </div>
      )}

      {/* ── Painel de exportação PDF ─────────── */}
      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
          <span>Relatórios e Exportações</span>
        </p>

        <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Incluir no Relatório:</span>
            <RoundToggle checked={filtroSobras} onChange={setFiltroSobras} label="Sobra(s)" colorClass="bg-orange-50 text-orange-600 border-orange-400" />
            <RoundToggle checked={filtroFaltas} onChange={setFiltroFaltas} label="Falta(s)" colorClass="bg-red-50 text-red-600 border-red-400" />
            <RoundToggle checked={filtroAvarias} onChange={setFiltroAvarias} label="Avaria(s)" colorClass="bg-purple-50 text-purple-600 border-purple-400" />
          </div>

          <div className="w-px h-6 bg-border hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Layout:</span>
            <RoundToggle checked={orientacao === 'portrait'} onChange={(v) => v && setOrientacao('portrait')} label="Vertical" colorClass="bg-blue-50 text-blue-600 border-blue-400" />
            <RoundToggle checked={orientacao === 'landscape'} onChange={(v) => v && setOrientacao('landscape')} label="Horizontal" colorClass="bg-blue-50 text-blue-600 border-blue-400" />
          </div>

          <div className="flex flex-wrap gap-2 sm:ml-auto w-full sm:w-auto">
            <Button onClick={handleMapaSeparacao} variant="secondary" size="sm" className="gap-2 flex-1 sm:flex-none border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100">
              <Map className="w-4 h-4" />
              Mapa de Separação
            </Button>
            
            <Button onClick={handleExportarPDF} size="sm" className="gap-2 flex-1 sm:flex-none">
              <FileDown className="w-4 h-4" />
              Relatório Geral
            </Button>
          </div>
        </div>
      </div>

      {/* Metadados */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">NFs Vinculadas</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">{bonus.notas_fiscais_ids?.length || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Total Esperado</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">{totalEsp.toLocaleString('pt-BR')} cx</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">1ª Conferência</p>
            <p className="text-xl font-bold tabular-nums mt-0.5 text-blue-600">{totalCx1.toLocaleString('pt-BR')} cx</p>
          </CardContent>
        </Card>
        {itens2.length > 0 && (
          <Card className="border-border">
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground">2ª Conferência</p>
              <p className="text-xl font-bold tabular-nums mt-0.5 text-purple-600">{totalCx2.toLocaleString('pt-BR')} cx</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Datas */}
      <div className="flex gap-4 flex-wrap text-xs text-muted-foreground">
        {bonus.data_conferencia && (
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            1ª Conf.: <strong className="text-foreground">{format(new Date(bonus.data_conferencia), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</strong>
          </span>
        )}
        {bonus.data_conferencia_2 && (
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            2ª Conf.: <strong className="text-foreground">{format(new Date(bonus.data_conferencia_2), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</strong>
          </span>
        )}
      </div>

      {/* 1ª Conferência */}
      {itens1.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center">
              <List className="w-3.5 h-3.5 text-blue-700" />
            </div>
            <h2 className="font-semibold text-sm">1ª Conferência</h2>
            {bonus.data_conferencia && (
              <span className="text-xs text-muted-foreground">— {format(new Date(bonus.data_conferencia), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}</span>
            )}
          </div>
          <ItensTable itens={itens1} titulo="Itens Conferidos" cor="text-blue-700" />
        </section>
      )}

      {/* 2ª Conferência */}
      {itens2.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-700" />
            </div>
            <h2 className="font-semibold text-sm">2ª Conferência</h2>
            {bonus.data_conferencia_2 && (
              <span className="text-xs text-muted-foreground">— {format(new Date(bonus.data_conferencia_2), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}</span>
            )}
          </div>
          <ItensTable itens={itens2} titulo="Itens Verificados" cor="text-purple-700" />
        </section>
      )}

      {/* Itens Pendentes de Conferência */}
      {(() => {
        const confRef = itens2.length ? itens2 : itens1;
        const confPorDesc = {};
        confRef.forEach(i => { confPorDesc[i.descricao] = (confPorDesc[i.descricao] || 0) + (Number(i.qtd_caixas) || Number(i.qtd_esperada) || 0); });
        const pendentes = (bonus.itens_esperados || [])
          .map(item => ({ ...item, conferido: confPorDesc[item.descricao] || 0, pendente: (Number(item.qtd_esperada) || 0) - (confPorDesc[item.descricao] || 0) }))
          .filter(item => item.pendente > 0);
        if (pendentes.length === 0) return null;
        return (
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-orange-100 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-orange-600" />
              </div>
              <h2 className="font-semibold text-sm">Itens Pendentes de Conferência</h2>
              <span className="text-xs text-orange-600 font-medium">({pendentes.length} produto(s))</span>
            </div>
            <div className="rounded-xl border border-orange-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-orange-50 border-b border-orange-200">
                    <th className="text-left px-3 py-2.5 font-semibold text-orange-700 uppercase">EAN</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-orange-700 uppercase">Descrição</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-orange-700 uppercase">Pedido</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-orange-700 uppercase">Conferido</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-orange-700 uppercase">Pendente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-100">
                  {pendentes.map((item, i) => (
                    <tr key={i} className="hover:bg-orange-50/50">
                      <td className="px-3 py-2 font-mono text-muted-foreground">{item.ean || '—'}</td>
                      <td className="px-3 py-2 font-medium">{decodeHTML(item.descricao) || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{(item.qtd_esperada || 0).toLocaleString('pt-BR')}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{(item.conferido || 0).toLocaleString('pt-BR')}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums text-red-600">-{(item.pendente || 0).toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })()}

      {/* Análise de Divergências */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-orange-100 flex items-center justify-center">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-700" />
          </div>
          <h2 className="font-semibold text-sm">Análise de Divergências</h2>
        </div>
        <DivergenciasSection bonus={bonus} />
      </section>

      {/* Observação */}
      {bonus.observacao && (
        <section className="p-4 rounded-xl bg-muted/50 border border-border text-sm text-muted-foreground">
          <strong className="text-foreground">Observação:</strong> {decodeHTML(bonus.observacao)}
        </section>
      )}
    </div>
  );
}