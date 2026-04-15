import jsPDF from 'jspdf';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = parseISO(dateStr);
    return format(d, 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return dateStr.substring(0, 10).split('-').reverse().join('/');
  }
}

function formatCNPJ(cnpj) {
  if (!cnpj) return '-';
  const n = cnpj.replace(/\D/g, '');
  if (n.length === 14) return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  if (n.length === 11) return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return cnpj;
}

function formatCurrency(val) {
  return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function generateNFePDF(nfData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;

  const drawLine = (yPos, color = [220, 220, 220]) => {
    doc.setDrawColor(...color);
    doc.line(margin, yPos, W - margin, yPos);
  };

  const section = (title, yPos) => {
    doc.setFillColor(42, 120, 95);
    doc.rect(margin, yPos, W - margin * 2, 7, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(title, margin + 3, yPos + 4.8);
    doc.setTextColor(0, 0, 0);
    return yPos + 10;
  };

  const labelValue = (label, value, x, yPos, labelW = 30) => {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text(label, x, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 20, 20);
    doc.text(String(value || '-'), x, yPos + 4.5);
    return yPos + 4.5;
  };

  // ── HEADER ──────────────────────────────────────────────────────
  doc.setFillColor(42, 120, 95);
  doc.rect(0, 0, W, 22, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('NOTA FISCAL ELETRÔNICA', margin, 10);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, margin, 15);

  // NF number badge top right
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`NF-e Nº ${nfData.numero_nf}`, W - margin, 10, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Série: ${nfData.serie || '-'}`, W - margin, 15, { align: 'right' });
  doc.setTextColor(0);
  y = 28;

  // ── IDENTIFICATION ───────────────────────────────────────────────
  y = section('IDENTIFICAÇÃO DA NOTA FISCAL', y);
  const col1 = margin, col2 = margin + 50, col3 = margin + 110;
  labelValue('Número da NF', nfData.numero_nf, col1, y);
  labelValue('Série', nfData.serie, col2, y);
  labelValue('Data de Emissão', formatDate(nfData.data_emissao), col3, y);
  y += 12;
  if (nfData.chave_acesso) {
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.setFont('helvetica', 'bold');
    doc.text('CHAVE DE ACESSO', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(nfData.chave_acesso, margin, y + 4);
    doc.setTextColor(0);
    y += 10;
  }
  drawLine(y); y += 4;

  // ── EMITENTE ────────────────────────────────────────────────────
  y = section('EMITENTE', y);
  labelValue('Razão Social / Nome', nfData.emitente_nome, col1, y);
  labelValue('CNPJ', formatCNPJ(nfData.emitente_cnpj), col3, y);
  y += 12; drawLine(y); y += 4;

  // ── DESTINATÁRIO ────────────────────────────────────────────────
  y = section('DESTINATÁRIO / REMETENTE', y);
  labelValue('Razão Social / Nome', nfData.destinatario_nome, col1, y);
  labelValue('CNPJ / CPF', formatCNPJ(nfData.destinatario_cnpj), col3, y);
  y += 12; drawLine(y); y += 4;

  // ── ITENS ────────────────────────────────────────────────────────
  y = section('ITENS DA NOTA FISCAL', y);

  // Table header
  const cols = { num: margin, cod: margin + 7, desc: margin + 22, emb: margin + 95, un: margin + 120, qty: margin + 133, vun: margin + 147, vtot: margin + 165 };
  doc.setFillColor(230, 245, 240);
  doc.rect(margin, y - 1, W - margin * 2, 6.5, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 100, 80);
  doc.text('#', cols.num, y + 3.5);
  doc.text('Código', cols.cod, y + 3.5);
  doc.text('Descrição do Produto', cols.desc, y + 3.5);
  doc.text('Embalagem', cols.emb, y + 3.5);
  doc.text('UN', cols.un, y + 3.5);
  doc.text('Qtd', cols.qty, y + 3.5, { align: 'right' });
  doc.text('Vl.Unit', cols.vun, y + 3.5, { align: 'right' });
  doc.text('Vl.Total', cols.vtot, y + 3.5, { align: 'right' });
  doc.setTextColor(0);
  y += 8;

  // Table rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  (nfData.itens || []).forEach((item, idx) => {
    if (y > H - 35) {
      doc.addPage();
      y = 20;
    }
    const rowH = 6.5;
    if (idx % 2 === 0) {
      doc.setFillColor(248, 252, 250);
      doc.rect(margin, y - 1, W - margin * 2, rowH, 'F');
    }
    doc.setTextColor(60, 60, 60);
    doc.text(String(idx + 1), cols.num, y + 3.5);
    doc.text(String(item.codigo || '-').substring(0, 8), cols.cod, y + 3.5);

    // Description truncate
    const desc = String(item.descricao || '-');
    const maxDescW = 70;
    const truncDesc = doc.getTextWidth(desc) > maxDescW ? desc.substring(0, 35) + '...' : desc;
    doc.text(truncDesc, cols.desc, y + 3.5);

    doc.text(String(item.embalagem || '-').substring(0, 12), cols.emb, y + 3.5);
    doc.text(String(item.unidade || '-'), cols.un, y + 3.5);
    doc.text(item.quantidade?.toLocaleString('pt-BR', { maximumFractionDigits: 3 }) || '0', cols.qty, y + 3.5, { align: 'right' });
    doc.text(formatCurrency(item.valor_unitario), cols.vun, y + 3.5, { align: 'right' });
    doc.text(formatCurrency(item.valor_total), cols.vtot, y + 3.5, { align: 'right' });
    doc.setTextColor(0);
    y += rowH;
  });

  drawLine(y); y += 4;

  // ── TOTALS ────────────────────────────────────────────────────────
  const totalQty = (nfData.itens || []).reduce((s, i) => s + (i.quantidade || 0), 0);
  const totalItens = (nfData.itens || []).length;

  if (y > H - 30) { doc.addPage(); y = 20; }

  doc.setFillColor(42, 120, 95);
  doc.rect(W - margin - 75, y - 2, 75, 22, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255);
  doc.text('Total de Itens:', W - margin - 72, y + 3);
  doc.text(`${totalItens} produto(s)`, W - margin - 2, y + 3, { align: 'right' });
  doc.text('Qtd. Total:', W - margin - 72, y + 9);
  doc.text(totalQty.toLocaleString('pt-BR', { maximumFractionDigits: 3 }), W - margin - 2, y + 9, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('VALOR TOTAL:', W - margin - 72, y + 17);
  doc.text(formatCurrency(nfData.valor_total), W - margin - 2, y + 17, { align: 'right' });
  doc.setTextColor(0);
  y += 28;

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text('Documento gerado para fins de consulta e organização interna. Não substitui a DANFE oficial.', W / 2, H - 8, { align: 'center' });

  return doc;
}