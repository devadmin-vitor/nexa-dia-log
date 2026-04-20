import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Clock,
  FileText, Calendar, Package, ShieldCheck, List, FileDown, Trash2,
} from 'lucide-react';
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
                <td className="px-3 py-2 font-medium">{item.descricao || '—'}</td>
                <td className="px-3 py-2 text-center tabular-nums">
                  {item.validade
                    ? format(new Date(item.validade), 'dd/MM/yyyy')
                    : <span className="text-muted-foreground/50">—</span>
                  }
                </td>
                <td className="px-3 py-2 text-center font-bold tabular-nums text-foreground">
                  {(item.qtd_caixas || 0).toLocaleString('pt-BR')}
                </td>
                <td className="px-3 py-2 text-center text-muted-foreground">{item.qtd_paletes || '—'}</td>
                <td className="px-3 py-2 text-center">
                  <Badge className="text-[9px] bg-emerald-100 text-emerald-700 border border-emerald-200">BOM</Badge>
                </td>
              </tr>
            ))}
            {itensAvaria.map((item, i) => (
              <tr key={`av_${i}`} className="bg-red-50/50 hover:bg-red-50">
                <td className="px-3 py-2 font-mono text-muted-foreground">{item.ean || '—'}</td>
                <td className="px-3 py-2 font-medium">{item.descricao || '—'}</td>
                <td className="px-3 py-2 text-center tabular-nums">
                  {item.validade
                    ? format(new Date(item.validade), 'dd/MM/yyyy')
                    : <span className="text-muted-foreground/50">—</span>
                  }
                </td>
                <td className="px-3 py-2 text-center font-bold tabular-nums text-red-600">
                  {(item.qtd_caixas || 0).toLocaleString('pt-BR')}
                </td>
                <td className="px-3 py-2 text-center text-muted-foreground">{item.qtd_paletes || '—'}</td>
                <td className="px-3 py-2 text-center">
                  <Badge className="text-[9px] bg-red-100 text-red-700 border border-red-200 gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    AVARIA
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totais */}
        <div className="px-3 py-2 bg-muted/30 border-t border-border flex items-center justify-end gap-6 text-xs">
          <span>
            Total Boas: <span className="font-bold text-foreground">{itensBons.reduce((a, i) => a + (i.qtd_caixas || 0), 0).toLocaleString('pt-BR')} cx</span>
          </span>
          {itensAvaria.length > 0 && (
            <span className="text-red-600">
              Total Avarias: <span className="font-bold">{itensAvaria.reduce((a, i) => a + (i.qtd_caixas || 0), 0).toLocaleString('pt-BR')} cx</span>
            </span>
          )}
          <span className="font-semibold">
            Total Geral: <span className="text-foreground">{itens.reduce((a, i) => a + (i.qtd_caixas || 0), 0).toLocaleString('pt-BR')} cx</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function DivergenciasSection({ bonus }) {
  const conf1 = bonus.itens_conferidos || [];
  const conf2 = bonus.itens_conferidos_2 || [];
  const esperados = bonus.itens_esperados || [];

  if (conf1.length === 0 && conf2.length === 0) return null;

  // Divergências NF x 1ª conf — comparar por DESCRIÇÃO para evitar falsos positivos
  // quando itens_esperados foi salvo com código interno no lugar do EAN
  const espPorDesc = {};
  const eanEspPorDesc = {};
  esperados.forEach(i => {
    espPorDesc[i.descricao] = (espPorDesc[i.descricao] || 0) + (i.qtd_esperada || 0);
    const eanValido = /^\d{8,14}$/.test(i.ean || '');
    if (eanValido) eanEspPorDesc[i.descricao] = i.ean;
  });

  const conf1PorDesc = {};
  const eanConf1PorDesc = {};
  conf1.forEach(i => {
    conf1PorDesc[i.descricao] = (conf1PorDesc[i.descricao] || 0) + (i.qtd_caixas || 0);
    eanConf1PorDesc[i.descricao] = i.ean;
  });

  const allDescsVsNF = new Set([...Object.keys(espPorDesc), ...Object.keys(conf1PorDesc)]);
  const divNF = [...allDescsVsNF]
    .map(desc => ({
      ean: eanConf1PorDesc[desc] || eanEspPorDesc[desc] || desc,
      descricao: desc,
      esperado: espPorDesc[desc] || 0,
      conferido1: conf1PorDesc[desc] || 0,
    }))
    .filter(d => d.esperado !== d.conferido1);

  // Divergências 1ª x 2ª conf — comparar por EAN (ambas gravadas com EAN real)
  const totais1 = {};
  const descMap1 = {};
  conf1.forEach(i => { totais1[i.ean] = (totais1[i.ean] || 0) + (i.qtd_caixas || 0); descMap1[i.ean] = i.descricao; });

  const totais2 = {};
  conf2.forEach(i => { totais2[i.ean] = (totais2[i.ean] || 0) + (i.qtd_caixas || 0); });

  const allEansConf = new Set([...Object.keys(totais1), ...Object.keys(totais2)]);
  const div12 = conf2.length > 0
    ? [...allEansConf]
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
              <thead>
                <tr className="bg-orange-50 border-b border-orange-200">
                  <th className="text-left px-3 py-2 font-semibold text-orange-700 uppercase">Produto</th>
                  <th className="text-right px-3 py-2 font-semibold text-orange-700 uppercase">Esperado NF</th>
                  <th className="text-right px-3 py-2 font-semibold text-orange-700 uppercase">1ª Conf.</th>
                  <th className="text-right px-3 py-2 font-semibold text-orange-700 uppercase">Diferença</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-100">
                {divNF.map((d, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">
                      <p className="font-medium">{d.descricao}</p>
                      <p className="text-muted-foreground font-mono">{d.ean}</p>
                    </td>
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
              <thead>
                <tr className="bg-red-50 border-b border-red-200">
                  <th className="text-left px-3 py-2 font-semibold text-red-700 uppercase">Produto</th>
                  <th className="text-right px-3 py-2 font-semibold text-red-700 uppercase">1ª Conf.</th>
                  <th className="text-right px-3 py-2 font-semibold text-red-700 uppercase">2ª Conf.</th>
                  <th className="text-right px-3 py-2 font-semibold text-red-700 uppercase">Diferença</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {div12.map((d, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">
                      <p className="font-medium">{d.descricao}</p>
                      <p className="text-muted-foreground font-mono">{d.ean}</p>
                    </td>
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

function gerarPDF(bonus) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const margin = 14;
  let y = 14;

  // Larguras das colunas
  // EAN | Descrição | Validade | Qtd Pedida | Qtd Cx | +/- | Paletes | Tipo
  const COL = {
    ean:      { x: margin + 1,   w: 24 },
    desc:     { x: margin + 25,  w: 58 },
    validade: { x: margin + 83,  w: 22 },
    pedida:   { x: margin + 105, w: 13 },
    qtd:      { x: margin + 118, w: 13 },
    diff:     { x: margin + 131, w: 13 },
    paletes:  { x: margin + 144, w: 22 },
    tipo:     { x: margin + 166, w: 13 },
  };

  const addText = (text, x, yy, opts = {}) => {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(opts.size || 8);
    const maxW = opts.maxW || undefined;
    if (maxW) {
      // Trunca o texto para caber na largura
      const lines = doc.splitTextToSize(String(text), maxW);
      doc.text(lines[0], x, yy);
    } else {
      doc.text(String(text), x, yy);
    }
  };

  const hLine = (yy, color = [200, 200, 200]) => {
    doc.setDrawColor(...color);
    doc.line(margin, yy, W - margin, yy);
  };

  // ── Cabeçalho verde ────────────────────────────────────────────────
  const headerH = bonus.notas_fiscais_ids?.length ? 26 : 22;
  doc.setFillColor(22, 163, 74);
  doc.rect(0, 0, W, headerH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`Relatório de Bônus #${bonus.numero_bonus}`, margin, 10);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Emitido em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, margin, 17);

  // NFs no cabeçalho
  if (bonus.notas_fiscais_ids?.length) {
    const nfTxt = `NFs: ${bonus.notas_fiscais_ids.length} vinculada(s)`;
    doc.text(nfTxt, margin, 23);
  }

  doc.setTextColor(0, 0, 0);
  y = headerH + 6;

  // ── Resumo rápido (Qtd Conferida vs Pedida) ────────────────────────
  const totalConferido1 = (bonus.itens_conferidos || []).reduce((a, i) => a + (i.qtd_caixas || 0), 0);
  const totalConferido2 = (bonus.itens_conferidos_2 || []).reduce((a, i) => a + (i.qtd_caixas || 0), 0);
  const totalPedido = (bonus.itens_esperados || []).reduce((a, i) => a + (i.qtd_esperada || 0), 0);
  const statusLabel = { conferido: 'Conferido', divergente: 'Divergente', em_conferencia: '1ª Conferência', aguardando_2a_conferencia: 'Ag. 2ª Conferência' };

  // Box de resumo
  doc.setFillColor(247, 250, 247);
  doc.setDrawColor(200, 220, 200);
  doc.roundedRect(margin, y, W - margin * 2, 20, 2, 2, 'FD');
  y += 5;

  addText('Emitente:', margin + 3, y, { bold: true, size: 8 });
  addText(bonus.emitente_nome || '—', margin + 22, y, { size: 8, maxW: 70 });

  addText('Status:', 130, y, { bold: true, size: 8 });
  addText(statusLabel[bonus.status] || bonus.status, 143, y, { size: 8 });
  y += 6;

  // Linha de quantidades
  addText('Qtd Pedida (NF):', margin + 3, y, { bold: true, size: 8 });
  addText(`${totalPedido.toLocaleString('pt-BR')} cx`, margin + 38, y, { size: 8 });

  addText('1ª Conf.:', margin + 70, y, { bold: true, size: 8 });
  addText(`${totalConferido1.toLocaleString('pt-BR')} cx`, margin + 84, y, { size: 8 });

  if (totalConferido2 > 0) {
    addText('2ª Conf.:', 130, y, { bold: true, size: 8 });
    addText(`${totalConferido2.toLocaleString('pt-BR')} cx`, 143, y, { size: 8 });
  }

  y += 6;

  // Datas
  if (bonus.data_conferencia || bonus.data_conferencia_2) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    let dateStr = '';
    if (bonus.data_conferencia) dateStr += `1ª Conf.: ${format(new Date(bonus.data_conferencia), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`;
    if (bonus.data_conferencia_2) dateStr += `   2ª Conf.: ${format(new Date(bonus.data_conferencia_2), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`;
    doc.text(dateStr, margin + 3, y);
    doc.setTextColor(0, 0, 0);
    y += 5;
  }

  y += 4;
  hLine(y); y += 6;

  // ── Mapa qtd esperada por descrição (para lookup por item) ───────────
  const espPorDesc = {};
  (bonus.itens_esperados || []).forEach(i => {
    espPorDesc[i.descricao] = (espPorDesc[i.descricao] || 0) + (i.qtd_esperada || 0);
  });

  // ── Tabela de itens ────────────────────────────────────────────────
  const drawItensTable = (itens, titulo) => {
    if (!itens || itens.length === 0) return;
    if (y > 255) { doc.addPage(); y = 20; }

    addText(titulo, margin, y, { bold: true, size: 10 });
    y += 7;

    // Header
    doc.setFillColor(230, 245, 235);
    doc.rect(margin, y - 4.5, W - margin * 2, 6.5, 'F');
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
    y += 5;
    hLine(y, [180, 210, 180]); y += 3;

    let totalBoas = 0, totalAvarias = 0;
    itens.forEach((item, idx) => {
      if (y > 272) { doc.addPage(); y = 20; }
      const isAvaria = item.tipo_estoque === 'AVARIA';
      const qtdConf = item.qtd_caixas || 0;
      const qtdPed  = espPorDesc[item.descricao] || 0;
      const diff    = qtdConf - qtdPed;

      if (isAvaria) {
        doc.setFillColor(255, 245, 245);
        doc.rect(margin, y - 3.5, W - margin * 2, 5.5, 'F');
        doc.setTextColor(180, 30, 30);
        totalAvarias += qtdConf;
      } else {
        if (idx % 2 === 0) {
          doc.setFillColor(252, 252, 252);
          doc.rect(margin, y - 3.5, W - margin * 2, 5.5, 'F');
        }
        doc.setTextColor(30, 30, 30);
        totalBoas += qtdConf;
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);

      const eanTxt  = doc.splitTextToSize((item.ean || '—').toString(), COL.ean.w)[0];
      const descTxt = doc.splitTextToSize((item.descricao || '—').toString(), COL.desc.w)[0];
      const valTxt  = item.validade ? format(new Date(item.validade), 'dd/MM/yyyy') : '—';
      const palTxt  = doc.splitTextToSize((item.qtd_paletes || '—').toString(), COL.paletes.w)[0];
      const tipoTxt = isAvaria ? 'AVARIA' : 'BOM';

      doc.text(eanTxt,  COL.ean.x,      y);
      doc.text(descTxt, COL.desc.x,     y);
      doc.text(valTxt,  COL.validade.x, y);

      // Qtd Pedida
      if (!isAvaria) {
        doc.setTextColor(80, 80, 80);
        doc.text(qtdPed > 0 ? qtdPed.toString() : '—', COL.pedida.x, y);
      } else {
        doc.text('—', COL.pedida.x, y);
      }

      // Qtd Conferida
      doc.setTextColor(isAvaria ? 180 : 30, 30, 30);
      doc.text(qtdConf.toString(), COL.qtd.x, y);

      // Divergência +/-
      if (!isAvaria && qtdPed > 0) {
        if (diff === 0) {
          doc.setTextColor(22, 163, 74);
          doc.text('=', COL.diff.x, y);
        } else if (diff > 0) {
          doc.setTextColor(200, 100, 0);
          doc.text(`+${diff}`, COL.diff.x, y);
        } else {
          doc.setTextColor(180, 30, 30);
          doc.text(`${diff}`, COL.diff.x, y);
        }
      } else {
        doc.setTextColor(150, 150, 150);
        doc.text('—', COL.diff.x, y);
      }

      doc.setTextColor(isAvaria ? 180 : 30, 30, 30);
      doc.text(palTxt,  COL.paletes.x, y);
      doc.text(tipoTxt, COL.tipo.x,    y);
      doc.setTextColor(0, 0, 0);
      y += 5.5;
    });

    doc.setTextColor(0, 0, 0);
    hLine(y); y += 4;

    // Totais
    doc.setFillColor(240, 248, 240);
    doc.rect(margin, y - 3.5, W - margin * 2, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
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

  // ── Itens esperados (NFs) ──────────────────────────────────────────
  if (bonus.itens_esperados?.length) {
    if (y > 245) { doc.addPage(); y = 20; }
    addText('Itens Esperados — NFs', margin, y, { bold: true, size: 10 }); y += 7;

    doc.setFillColor(235, 240, 250);
    doc.rect(margin, y - 4.5, W - margin * 2, 6.5, 'F');
    hLine(y - 4.5, [180, 190, 220]);
    doc.setTextColor(40, 60, 120);
    addText('EAN',          margin + 1,  y, { bold: true, size: 7 });
    addText('Descrição',    margin + 30, y, { bold: true, size: 7 });
    addText('Qtd Esperada', margin + 155, y, { bold: true, size: 7 });
    doc.setTextColor(0, 0, 0);
    y += 5; hLine(y, [180, 190, 220]); y += 3;

    bonus.itens_esperados.forEach((item, idx) => {
      if (y > 272) { doc.addPage(); y = 20; }
      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 255);
        doc.rect(margin, y - 3.5, W - margin * 2, 5.5, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      const eanT  = doc.splitTextToSize((item.ean || '—').toString(), 28)[0];
      const descT = doc.splitTextToSize((item.descricao || '—').toString(), 124)[0];
      doc.text(eanT, margin + 1, y);
      doc.text(descT, margin + 30, y);
      doc.text((item.qtd_esperada || 0).toLocaleString('pt-BR'), margin + 155, y);
      y += 5.5;
    });
    hLine(y); y += 8;
  }

  doc.save(`Bonus_${bonus.numero_bonus}_Relatorio.pdf`);
}

export default function BonusDetalhado({ bonus, onVoltar, onDeleted }) {
  const [authDeleteOpen, setAuthDeleteOpen] = useState(false);
  const cfg = STATUS_CONFIG[bonus.status] || STATUS_CONFIG.em_conferencia;

  const itens1 = bonus.itens_conferidos || [];
  const itens2 = bonus.itens_conferidos_2 || [];
  const totalCx1 = itens1.reduce((a, i) => a + (i.qtd_caixas || 0), 0);
  const totalCx2 = itens2.reduce((a, i) => a + (i.qtd_caixas || 0), 0);
  const totalEsp = (bonus.itens_esperados || []).reduce((a, i) => a + (i.qtd_esperada || 0), 0);
  const temAvaria1 = itens1.some(i => i.tipo_estoque === 'AVARIA');
  const temAvaria2 = itens2.some(i => i.tipo_estoque === 'AVARIA');

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
                <AlertTriangle className="w-3 h-3" />
                Contém Avarias
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{bonus.emitente_nome || '—'}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => gerarPDF(bonus)}
            className="gap-2"
          >
            <FileDown className="w-4 h-4" />
            Exportar PDF
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAuthDeleteOpen(true)}
            className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4" />
            Excluir
          </Button>
        </div>
      </div>

      <AdminAuthDialog
        open={authDeleteOpen}
        onOpenChange={setAuthDeleteOpen}
        title="Excluir Bônus"
        description="Esta ação é irreversível. Confirme suas credenciais de administrador para excluir este bônus e liberar as NFs vinculadas."
        onAuthorized={async () => {
          await base44.entities.BonusRecebimento.delete(bonus.id);
          onDeleted?.();
          onVoltar();
        }}
      />

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
            <p className="text-xl font-bold tabular-nums mt-0.5 text-blue-600">
              {totalCx1.toLocaleString('pt-BR')} cx
            </p>
          </CardContent>
        </Card>
        {itens2.length > 0 && (
          <Card className="border-border">
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground">2ª Conferência</p>
              <p className="text-xl font-bold tabular-nums mt-0.5 text-purple-600">
                {totalCx2.toLocaleString('pt-BR')} cx
              </p>
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
              <span className="text-xs text-muted-foreground">
                — {format(new Date(bonus.data_conferencia), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
              </span>
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
              <span className="text-xs text-muted-foreground">
                — {format(new Date(bonus.data_conferencia_2), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
          </div>
          <ItensTable itens={itens2} titulo="Itens Verificados" cor="text-purple-700" />
        </section>
      )}

      {/* Itens Esperados (NFs) */}
      {bonus.itens_esperados?.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <h2 className="font-semibold text-sm">Itens Esperados (NFs)</h2>
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase">EAN</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase">Descrição</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground uppercase">Qtd Esperada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bonus.itens_esperados.map((item, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-muted-foreground">{item.ean || '—'}</td>
                    <td className="px-3 py-2 font-medium">{item.descricao || '—'}</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">
                      {(item.qtd_esperada || 0).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
          <strong className="text-foreground">Observação:</strong> {bonus.observacao}
        </section>
      )}
    </div>
  );
}