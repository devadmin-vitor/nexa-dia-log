import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function gerarTermoAvariaPdf({ bonus, itensAvariados }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const now = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  // ── Cabeçalho ────────────────────────────────────────────────────────────
  // Faixa superior vermelha
  doc.setFillColor(220, 38, 38); // red-600
  doc.rect(0, 0, pageW, 28, 'F');

  // Título
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('TERMO DE RECEBIMENTO COM AVARIA', pageW / 2, 12, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Documento interno — uso exclusivo do setor de recebimento', pageW / 2, 18, { align: 'center' });

  // ── Informações do bônus ─────────────────────────────────────────────────
  doc.setTextColor(30, 30, 30);
  let y = 36;

  // Box de info
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(220, 220, 220);
  doc.roundedRect(margin, y, pageW - margin * 2, 28, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('BÔNUS Nº:', margin + 4, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(String(bonus?.numero_bonus || '—'), margin + 30, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.text('EMITENTE:', margin + 4, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.text(String(bonus?.emitente_nome || '—'), margin + 30, y + 14);

  doc.setFont('helvetica', 'bold');
  doc.text('DATA/HORA:', margin + 4, y + 21);
  doc.setFont('helvetica', 'normal');
  doc.text(now, margin + 30, y + 21);

  // NFs vinculadas (lado direito)
  const nfCount = bonus?.notas_fiscais_ids?.length || 0;
  doc.setFont('helvetica', 'bold');
  doc.text('QTD. NFs:', pageW / 2 + 4, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(String(nfCount), pageW / 2 + 26, y + 7);

  const totalAvariado = itensAvariados.reduce((acc, i) => acc + i.qtd_caixas, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL AVARIADO:', pageW / 2 + 4, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 30, 30);
  doc.text(`${totalAvariado} cx`, pageW / 2 + 42, y + 14);
  doc.setTextColor(30, 30, 30);

  y += 36;

  // ── Subtítulo da tabela ──────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(220, 38, 38);
  doc.text('▶  ITENS COM AVARIA IDENTIFICADOS', margin, y + 4);
  doc.setTextColor(30, 30, 30);
  y += 10;

  // ── Tabela de avarias ────────────────────────────────────────────────────
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['#', 'EAN / Código', 'Descrição do Produto', 'Validade', 'Qtd Avariada']],
    body: itensAvariados.map((item, i) => [
      i + 1,
      item.ean,
      item.descricao,
      item.validade
        ? format(new Date(item.validade + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })
        : '—',
      `${item.qtd_caixas} cx`,
    ]),
    foot: [[
      '', '', '', 'TOTAL AVARIADO:',
      `${totalAvariado} cx`,
    ]],
    headStyles: {
      fillColor: [220, 38, 38],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 30, 30],
    },
    footStyles: {
      fillColor: [254, 226, 226],
      textColor: [153, 27, 27],
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { cellWidth: 32, font: 'courier', fontSize: 7 },
      2: { cellWidth: 'auto' },
      3: { halign: 'center', cellWidth: 22 },
      4: { halign: 'center', cellWidth: 24, fontStyle: 'bold', textColor: [153, 27, 27] },
    },
    alternateRowStyles: { fillColor: [255, 245, 245] },
    showFoot: 'lastPage',
  });

  // ── Rodapé de assinaturas ────────────────────────────────────────────────
  const afterTableY = doc.lastAutoTable.finalY + 20;
  const signatureY = Math.max(afterTableY, 220); // garante espaço mínimo

  // Linha separadora
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, signatureY - 4, pageW - margin, signatureY - 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text('ASSINATURAS', pageW / 2, signatureY, { align: 'center' });

  const colLeft = margin + 20;
  const colRight = pageW / 2 + 20;
  const lineY = signatureY + 20;

  // Linha esquerda
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.5);
  doc.line(margin, lineY, pageW / 2 - 10, lineY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text('Assinatura do Conferente', colLeft, lineY + 5, { align: 'center' });

  // Linha direita
  doc.line(pageW / 2 + 10, lineY, pageW - margin, lineY);
  doc.text('Assinatura do Motorista (Aceite)', colRight, lineY + 5, { align: 'center' });

  // Nota de rodapé
  const footerY = lineY + 16;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(150, 150, 150);
  doc.text(
    'Este documento confirma o recebimento de mercadorias com avaria identificada no ato da conferência. A assinatura do motorista constitui aceite das divergências.',
    pageW / 2,
    footerY,
    { align: 'center', maxWidth: pageW - margin * 2 }
  );

  doc.setTextColor(180, 180, 180);
  doc.text(`Gerado em: ${now}  —  Sistema WMS`, pageW / 2, footerY + 5, { align: 'center' });

  return doc;
}