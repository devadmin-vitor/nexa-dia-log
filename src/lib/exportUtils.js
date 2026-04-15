import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function exportToPDF(report) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(report.title || 'Relatório de Volumes', pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.text(`Gerado em: ${format(new Date(), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR })}`, pageWidth / 2, y, { align: 'center' });
  doc.setTextColor(0);
  y += 15;

  // Summary Stats
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total de Produtos: ${report.total_products}`, 14, y);
  doc.text(`Total de Entradas: ${report.total_entries}`, 90, y);
  doc.text(`Volume Total: ${report.total_volume?.toLocaleString()} ml`, 160, y);
  y += 12;

  // Table header
  const colX = [14, 100, 145, 175];
  doc.setFillColor(240, 240, 240);
  doc.rect(14, y - 5, pageWidth - 28, 8, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Produto', colX[0], y);
  doc.text('Volume Total (ml)', colX[1], y);
  doc.text('Entradas', colX[2], y);
  doc.text('% do Total', colX[3], y);
  y += 8;

  // Table rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  (report.summary || []).forEach((item) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    const pct = report.total_volume > 0 ? ((item.total_volume_ml / report.total_volume) * 100).toFixed(1) : '0';
    doc.text(item.product_name, colX[0], y);
    doc.text(item.total_volume_ml.toLocaleString(), colX[1], y);
    doc.text(String(item.entry_count), colX[2], y);
    doc.text(`${pct}%`, colX[3], y);
    y += 7;
  });

  // Total row
  y += 3;
  doc.setDrawColor(200);
  doc.line(14, y - 4, pageWidth - 14, y - 4);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', colX[0], y);
  doc.text(`${report.total_volume?.toLocaleString()} ml`, colX[1], y);
  doc.text(String(report.total_entries), colX[2], y);

  doc.save(`relatorio_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
}

export function exportToExcel(report) {
  const headers = ['Produto', 'Volume Total (ml)', 'Entradas', '% do Total'];
  const rows = (report.summary || []).map(item => {
    const pct = report.total_volume > 0 ? ((item.total_volume_ml / report.total_volume) * 100).toFixed(1) : '0';
    return [item.product_name, item.total_volume_ml, item.entry_count, `${pct}%`];
  });

  // Add total row
  rows.push(['TOTAL', report.total_volume || 0, report.total_entries || 0, '100%']);

  // Build CSV (Excel-compatible)
  const BOM = '\uFEFF';
  const csv = BOM + [
    headers.join(';'),
    ...rows.map(r => r.join(';'))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}