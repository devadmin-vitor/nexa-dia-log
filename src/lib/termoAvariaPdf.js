import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Desenha uma linha horizontal simples
function hLine(doc, x1, x2, y, color = [200, 200, 200]) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.3);
  doc.line(x1, y, x2, y);
}

// Escreve texto com quebra automática e retorna o novo Y
function textBlock(doc, text, x, y, maxW, fontSize = 8, style = 'normal') {
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', style);
  const lines = doc.splitTextToSize(String(text || ''), maxW);
  doc.text(lines, x, y);
  return y + lines.length * (fontSize * 0.4);
}

export function gerarTermoAvariaPdf({ bonus, itensAvariados }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = pageW - margin * 2;
  const now = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  // ── Cabeçalho vermelho ───────────────────────────────────────────────────
  doc.setFillColor(220, 38, 38);
  doc.rect(0, 0, pageW, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('TERMO DE RECEBIMENTO COM AVARIA', pageW / 2, 13, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Documento interno — uso exclusivo do setor de recebimento', pageW / 2, 20, { align: 'center' });

  // ── Box de informações ───────────────────────────────────────────────────
  let y = 38;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentW, 30, 2, 2, 'FD');

  doc.setTextColor(30, 30, 30);
  const col2 = margin + contentW / 2;

  // Coluna esquerda
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.text('BÔNUS Nº:', margin + 4, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(String(bonus?.numero_bonus || '—'), margin + 28, y + 8);

  doc.setFont('helvetica', 'bold');
  doc.text('EMITENTE:', margin + 4, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.text(doc.splitTextToSize(String(bonus?.emitente_nome || '—'), contentW / 2 - 30), margin + 28, y + 16);

  doc.setFont('helvetica', 'bold');
  doc.text('DATA/HORA:', margin + 4, y + 24);
  doc.setFont('helvetica', 'normal');
  doc.text(now, margin + 28, y + 24);

  // Coluna direita
  const totalAvariado = itensAvariados.reduce((acc, i) => acc + i.qtd_caixas, 0);

  doc.setFont('helvetica', 'bold');
  doc.text('QTD. NFs VINCULADAS:', col2 + 2, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(String(bonus?.notas_fiscais_ids?.length || 0), col2 + 46, y + 8);

  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL AVARIADO:', col2 + 2, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 30, 30);
  doc.text(`${totalAvariado} cx`, col2 + 38, y + 16);
  doc.setTextColor(30, 30, 30);

  doc.setFont('helvetica', 'bold');
  doc.text('DESTINO:', col2 + 2, y + 24);
  doc.setFont('helvetica', 'normal');
  doc.text('DOCA-AVARIAS (quarentena)', col2 + 22, y + 24);

  y += 38;

  // ── Subtítulo tabela ─────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(220, 38, 38);
  doc.text('▶  ITENS COM AVARIA IDENTIFICADOS', margin, y + 4);
  doc.setTextColor(30, 30, 30);
  y += 10;

  // ── Tabela manual ────────────────────────────────────────────────────────
  const colWidths = [10, 35, 80, 28, 27]; // #, EAN, Descricao, Validade, Qtd
  const colX = [margin];
  colWidths.forEach((w, i) => { if (i > 0) colX.push(colX[i - 1] + colWidths[i - 1]); });
  const rowH = 8;
  const headers = ['#', 'EAN / Código', 'Descrição do Produto', 'Validade', 'Qtd Avariada'];

  // Cabeçalho da tabela
  doc.setFillColor(220, 38, 38);
  doc.rect(margin, y, contentW, rowH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  headers.forEach((h, i) => {
    const align = i === 0 || i === 4 ? 'center' : 'left';
    const tx = align === 'center' ? colX[i] + colWidths[i] / 2 : colX[i] + 1.5;
    doc.text(h, tx, y + 5.5, { align });
  });
  y += rowH;

  // Linhas de dados
  doc.setFontSize(7.5);
  itensAvariados.forEach((item, idx) => {
    // fundo alternado
    doc.setFillColor(idx % 2 === 0 ? 255 : 255, idx % 2 === 0 ? 245 : 255, idx % 2 === 0 ? 245 : 255);
    doc.rect(margin, y, contentW, rowH, 'F');

    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'normal');

    // #
    doc.text(String(idx + 1), colX[0] + colWidths[0] / 2, y + 5.5, { align: 'center' });
    // EAN (mono-like via courier)
    doc.setFont('courier', 'normal');
    doc.text(String(item.ean || ''), colX[1] + 1.5, y + 5.5);
    doc.setFont('helvetica', 'normal');
    // Descrição truncada
    const descTrunc = doc.splitTextToSize(String(item.descricao || ''), colWidths[2] - 3)[0];
    doc.text(descTrunc, colX[2] + 1.5, y + 5.5);
    // Validade
    const valStr = item.validade
      ? format(new Date(item.validade + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })
      : '—';
    doc.text(valStr, colX[3] + colWidths[3] / 2, y + 5.5, { align: 'center' });
    // Qtd
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(153, 27, 27);
    doc.text(`${item.qtd_caixas} cx`, colX[4] + colWidths[4] / 2, y + 5.5, { align: 'center' });
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'normal');

    // borda inferior
    hLine(doc, margin, margin + contentW, y + rowH, [220, 200, 200]);
    y += rowH;
  });

  // Linha de total
  doc.setFillColor(254, 226, 226);
  doc.rect(margin, y, contentW, rowH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(153, 27, 27);
  doc.text('TOTAL AVARIADO:', colX[3] + 1, y + 5.5);
  doc.text(`${totalAvariado} cx`, colX[4] + colWidths[4] / 2, y + 5.5, { align: 'center' });
  hLine(doc, margin, margin + contentW, y + rowH, [180, 100, 100]);
  y += rowH + 4;

  // Borda geral da tabela
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.4);
  doc.rect(margin, y - (rowH * (itensAvariados.length + 2)) - 4, contentW, rowH * (itensAvariados.length + 2) + 4, 'S');

  // ── Assinaturas ──────────────────────────────────────────────────────────
  const signY = Math.max(y + 20, 220);

  hLine(doc, margin, pageW - margin, signY - 4, [200, 200, 200]);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text('ASSINATURAS', pageW / 2, signY, { align: 'center' });

  const lineY = signY + 18;
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.5);

  // Linha esquerda
  doc.line(margin, lineY, pageW / 2 - 8, lineY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text('Assinatura do Conferente', (margin + pageW / 2 - 8) / 2, lineY + 4.5, { align: 'center' });

  // Linha direita
  doc.line(pageW / 2 + 8, lineY, pageW - margin, lineY);
  doc.text('Assinatura do Motorista (Aceite)', (pageW / 2 + 8 + pageW - margin) / 2, lineY + 4.5, { align: 'center' });

  // Nota final
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(150, 150, 150);
  const nota = 'Este documento confirma o recebimento de mercadorias com avaria identificada no ato da conferência. A assinatura do motorista constitui aceite das divergências.';
  const notaLines = doc.splitTextToSize(nota, contentW);
  doc.text(notaLines, pageW / 2, lineY + 14, { align: 'center' });
  doc.text(`Gerado em: ${now}  —  Sistema WMS`, pageW / 2, lineY + 14 + notaLines.length * 3, { align: 'center' });

  return doc;
}