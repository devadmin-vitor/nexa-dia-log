import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { FileDown, FileSpreadsheet, Droplets, Package, Hash, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function exportReportPDF(data, nfFilter) {
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();
  let y = 14;

  doc.setFillColor(42, 120, 95);
  doc.rect(0, 0, W, 20, 'F');
  doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(255);
  doc.text('Relatório de Volumes por Produto', W / 2, 9, { align: 'center' });
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, W / 2, 15, { align: 'center' });
  doc.setTextColor(0); y = 28;

  if (nfFilter !== 'all') {
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(`Filtro: NF-e #${nfFilter}`, 14, y); y += 8;
  }

  // Totals
  const totalQty = data.reduce((s, r) => s + r.total_qty, 0);
  const totalItems = data.length;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text(`Produtos distintos: ${totalItems}`, 14, y);
  doc.text(`Quantidade total: ${totalQty.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}`, 100, y);
  y += 10;

  // Table
  const cols = [14, 95, 125, 155];
  doc.setFillColor(230, 245, 240);
  doc.rect(14, y - 1, W - 28, 7, 'F');
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(40, 100, 80);
  doc.text('Produto / Descrição', cols[0], y + 4);
  doc.text('Embalagem', cols[1], y + 4);
  doc.text('Qtd. Total', cols[2], y + 4, { align: 'right' });
  doc.text('Entradas (NFs)', cols[3], y + 4, { align: 'right' });
  doc.setTextColor(0); y += 10;

  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  data.forEach((row, idx) => {
    if (y > 270) { doc.addPage(); y = 20; }
    if (idx % 2 === 0) { doc.setFillColor(248, 252, 250); doc.rect(14, y - 1, W - 28, 7, 'F'); }
    const desc = row.descricao.length > 50 ? row.descricao.substring(0, 48) + '...' : row.descricao;
    doc.text(desc, cols[0], y + 4);
    doc.text(row.embalagem || '-', cols[1], y + 4);
    doc.text(row.total_qty.toLocaleString('pt-BR', { maximumFractionDigits: 3 }), cols[2], y + 4, { align: 'right' });
    doc.text(String(row.count), cols[3], y + 4, { align: 'right' });
    y += 7;
  });

  y += 4;
  doc.setDrawColor(42, 120, 95); doc.line(14, y, W - 14, y); y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', cols[0], y);
  doc.text(totalQty.toLocaleString('pt-BR', { maximumFractionDigits: 3 }), cols[2], y, { align: 'right' });

  doc.save(`relatorio_volumes_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
}

function exportReportExcel(data) {
  const BOM = '\uFEFF';
  const headers = ['Código', 'Produto/Descrição', 'Embalagem', 'Unidade', 'Quantidade Total', 'Nº de Entradas (NFs)'];
  const rows = data.map(r => [r.codigo || '-', r.descricao, r.embalagem || '-', r.unidade || '-', r.total_qty, r.count]);
  const csv = BOM + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `relatorio_volumes_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

export default function RelatorioXML() {
  const [nfFilter, setNfFilter] = useState('all');

  const { data: notas = [], isLoading, refetch } = useQuery({
    queryKey: ['notas-fiscais'],
    queryFn: () => base44.entities.NotaFiscal.list('-created_date', 500),
  });

  const filteredNotas = nfFilter === 'all' ? notas : notas.filter(n => n.id === nfFilter);

  // Aggregate items
  const grouped = {};
  filteredNotas.forEach(nf => {
    (nf.itens || []).forEach(item => {
      const key = (item.codigo || item.descricao || '').toLowerCase().trim();
      if (!key) return;
      if (!grouped[key]) {
        grouped[key] = {
          codigo: item.codigo,
          descricao: item.descricao,
          embalagem: item.embalagem,
          unidade: item.unidade,
          total_qty: 0,
          count: 0,
        };
      }
      grouped[key].total_qty += item.quantidade || 0;
      grouped[key].count += 1;
    });
  });

  const reportData = Object.values(grouped).sort((a, b) => b.total_qty - a.total_qty);
  const totalQty = reportData.reduce((s, r) => s + r.total_qty, 0);
  const chartData = reportData.slice(0, 10).map(r => ({
    name: r.descricao?.substring(0, 20) || '-',
    qty: Math.round(r.total_qty * 1000) / 1000,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatório de Volumes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Agrupamento automático de itens das NFs importadas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportReportPDF(reportData, nfFilter)} className="gap-2" disabled={reportData.length === 0}>
            <FileDown className="w-3.5 h-3.5" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportReportExcel(reportData)} className="gap-2" disabled={reportData.length === 0}>
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Label className="text-sm whitespace-nowrap">Filtrar por NF:</Label>
        <Select value={nfFilter} onValueChange={setNfFilter}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Todas as NFs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as NFs</SelectItem>
            {notas.map(n => (
              <SelectItem key={n.id} value={n.id}>
                NF-e #{n.numero_nf} — {n.emitente_nome?.substring(0, 25)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
          <Skeleton className="h-72 rounded-lg" />
        </div>
      ) : reportData.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Nenhum item encontrado.</p>
            <p className="text-xs text-muted-foreground mt-1">Importe XMLs de NF-e para gerar o relatório.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
                <Package className="w-4 h-4 text-accent-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Produtos Distintos</p>
                <p className="text-xl font-bold">{reportData.length}</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
                <Droplets className="w-4 h-4 text-accent-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Quantidade Total</p>
                <p className="text-xl font-bold">{totalQty.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
                <Hash className="w-4 h-4 text-accent-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">NFs Analisadas</p>
                <p className="text-xl font-bold">{filteredNotas.length}</p>
              </div>
            </Card>
          </div>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top 10 Produtos por Quantidade</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -10, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} angle={-30} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(v) => [v.toLocaleString('pt-BR'), 'Quantidade']} />
                  <Bar dataKey="qty" fill="hsl(var(--primary))" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Detalhamento por Produto</CardTitle>
              <Badge variant="secondary">{reportData.length} produtos</Badge>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">#</th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Código</th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Produto</th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Embalagem</th>
                      <th className="text-center py-2.5 px-3 text-xs font-medium text-muted-foreground">UN</th>
                      <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">Qtd. Total</th>
                      <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">Entradas</th>
                      <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">% do Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row, i) => {
                      const pct = totalQty > 0 ? ((row.total_qty / totalQty) * 100).toFixed(1) : '0';
                      return (
                        <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                          <td className="py-2.5 px-3 text-muted-foreground">{i + 1}</td>
                          <td className="py-2.5 px-3 font-mono text-xs">{row.codigo || '-'}</td>
                          <td className="py-2.5 px-3 font-medium">{row.descricao}</td>
                          <td className="py-2.5 px-3">
                            <Badge variant="secondary" className="text-xs font-normal">{row.embalagem || '-'}</Badge>
                          </td>
                          <td className="py-2.5 px-3 text-center text-xs">{row.unidade || '-'}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold">
                            {row.total_qty.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <Badge variant="outline">{row.count}</Badge>
                          </td>
                          <td className="py-2.5 px-3 text-right text-muted-foreground">{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border font-bold bg-muted/30">
                      <td colSpan={5} className="py-3 px-3">TOTAL</td>
                      <td className="py-3 px-3 text-right font-mono text-primary">
                        {totalQty.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}