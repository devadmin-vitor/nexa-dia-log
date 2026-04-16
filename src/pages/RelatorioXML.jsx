import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  FileDown, FileSpreadsheet, Droplets, Package, Hash, RefreshCw,
  DollarSign, TrendingUp, Search, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import jsPDF from 'jspdf';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PIE_COLORS = ['hsl(166,72%,40%)', 'hsl(199,65%,48%)', 'hsl(262,52%,55%)', 'hsl(43,74%,55%)', 'hsl(12,76%,61%)', 'hsl(330,70%,55%)'];

function exportReportPDF(data, filters) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  let y = 14;

  doc.setFillColor(42, 120, 95);
  doc.rect(0, 0, W, 20, 'F');
  doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(255);
  doc.text('Relatório de Volumes por Produto', W / 2, 9, { align: 'center' });
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, W / 2, 15, { align: 'center' });
  doc.setTextColor(0); y = 28;

  // Active filters info
  const filterLines = [];
  if (filters.nfFilter !== 'all') filterLines.push(`NF-e: #${filters.nfFilter}`);
  if (filters.fornecedorFilter !== 'all') filterLines.push(`Fornecedor: ${filters.fornecedorFilter.substring(0, 50)}`);
  if (filters.dataInicio) filterLines.push(`De: ${filters.dataInicio}`);
  if (filters.dataFim) filterLines.push(`Até: ${filters.dataFim}`);
  if (filterLines.length > 0) {
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text(`Filtros: ${filterLines.join(' | ')}`, 14, y); y += 8;
  }

  const totalQty = data.reduce((s, r) => s + r.total_qty, 0);
  const totalGasto = data.reduce((s, r) => s + r.valor_total_gasto, 0);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text(`Produtos distintos: ${data.length}`, 14, y);
  doc.text(`Qtd total: ${totalQty.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}`, 100, y);
  doc.text(`Valor total: ${totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 180, y);
  y += 10;

  // Columns: # | Desc | Embalagem | UN | Qtd | Ent. | Vl.Total | Custo Médio
  // "Pertence" é impresso como sublinha abaixo do produto
  const cols = [14, 22, 100, 132, 148, 168, 210, 255];
  doc.setFillColor(230, 245, 240);
  doc.rect(14, y - 1, W - 28, 7, 'F');
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(40, 100, 80);
  doc.text('#', cols[0], y + 4);
  doc.text('Produto / Descrição', cols[1], y + 4);
  doc.text('Embalagem', cols[2], y + 4);
  doc.text('UN', cols[3], y + 4);
  doc.text('Qtd. Total', cols[4], y + 4, { align: 'right' });
  doc.text('Ent.', cols[5], y + 4, { align: 'right' });
  doc.text('Vl. Total', cols[6], y + 4, { align: 'right' });
  doc.text('Custo Médio', cols[7], y + 4, { align: 'right' });
  doc.setTextColor(0); y += 10;

  doc.setFontSize(7); doc.setFont('helvetica', 'normal');
  data.forEach((row, idx) => {
    // Each row = main line (9mm) + sublinha pertence (5mm) = 14mm total
    const rowH = 14;
    if (y > 180) { doc.addPage(); y = 20; }
    if (idx % 2 === 0) { doc.setFillColor(248, 252, 250); doc.rect(14, y - 1, W - 28, rowH, 'F'); }

    const desc = row.descricao.length > 48 ? row.descricao.substring(0, 46) + '...' : row.descricao;

    // Main line
    doc.setFont('helvetica', 'normal'); doc.setTextColor(0);
    doc.text(String(idx + 1), cols[0], y + 4);
    doc.setFont('helvetica', 'bold');
    doc.text(desc, cols[1], y + 4);
    doc.setFont('helvetica', 'normal');
    doc.text((row.embalagem || '-').substring(0, 16), cols[2], y + 4);
    doc.text(row.unidade || '-', cols[3], y + 4);
    doc.text(row.total_qty.toLocaleString('pt-BR', { maximumFractionDigits: 3 }), cols[4], y + 4, { align: 'right' });
    doc.text(String(row.count), cols[5], y + 4, { align: 'right' });
    doc.text(row.valor_total_gasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), cols[6], y + 4, { align: 'right' });
    doc.text(row.custo_medio > 0 ? row.custo_medio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-', cols[7], y + 4, { align: 'right' });

    // Sub-line: Pertence (NFs) — full list, wrapped
    doc.setFontSize(6); doc.setTextColor(100, 120, 110);
    const pertenceLabel = 'NFs: ';
    const pertenceText = row.nfs_pertencentes || '-';
    const maxWidth = W - 14 - cols[1] - 2;
    const lines = doc.splitTextToSize(pertenceLabel + pertenceText, maxWidth);
    doc.text(lines[0], cols[1], y + 9); // only first line to keep height fixed
    doc.setFontSize(7); doc.setTextColor(0);

    y += rowH;
  });

  y += 4;
  doc.setDrawColor(42, 120, 95); doc.line(14, y, W - 14, y); y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', cols[1], y);
  doc.text(totalQty.toLocaleString('pt-BR', { maximumFractionDigits: 3 }), cols[4], y, { align: 'right' });
  doc.text(totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), cols[6], y, { align: 'right' });

  doc.save(`relatorio_volumes_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
}

function exportReportExcel(data, filters) {
  const BOM = '\uFEFF';
  const filterInfo = [];
  if (filters.nfFilter !== 'all') filterInfo.push(`NF:${filters.nfFilter}`);
  if (filters.fornecedorFilter !== 'all') filterInfo.push(`Fornecedor:${filters.fornecedorFilter}`);
  if (filters.dataInicio) filterInfo.push(`De:${filters.dataInicio}`);
  if (filters.dataFim) filterInfo.push(`Ate:${filters.dataFim}`);

  const headers = ['Código', 'Produto/Descrição', 'Embalagem', 'Unidade', 'Quantidade Total', 'Nº de Entradas (NFs)', 'Pertence (NFs)', 'Valor Total (R$)', 'Custo Médio (R$)'];
  const rows = data.map(r => [
    r.codigo || '-',
    r.descricao,
    r.embalagem || '-',
    r.unidade || '-',
    r.total_qty,
    r.count,
    r.nfs_pertencentes,
    r.valor_total_gasto.toFixed(2).replace('.', ','),
    r.custo_medio > 0 ? r.custo_medio.toFixed(2).replace('.', ',') : '0,00',
  ]);
  const metaRow = filterInfo.length > 0 ? [`Filtros: ${filterInfo.join(' | ')}`] : [];
  const csvLines = [...(metaRow.length ? [metaRow.join(';'), ''] : []), headers.join(';'), ...rows.map(r => r.join(';'))];
  const csv = BOM + csvLines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `relatorio_volumes_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 ml-1 inline text-muted-foreground/50" />;
  return sortDir === 'asc'
    ? <ArrowUp className="w-3 h-3 ml-1 inline text-primary" />
    : <ArrowDown className="w-3 h-3 ml-1 inline text-primary" />;
}

export default function RelatorioXML() {
  const [nfFilter, setNfFilter] = useState('all');
  const [fornecedorFilter, setFornecedorFilter] = useState('all');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [searchProduto, setSearchProduto] = useState('');
  const [sortCol, setSortCol] = useState('total_qty');
  const [sortDir, setSortDir] = useState('desc');

  const { data: notas = [], isLoading, refetch } = useQuery({
    queryKey: ['notas-fiscais'],
    queryFn: () => base44.entities.NotaFiscal.list('-created_date', 500),
  });

  const fornecedoresUnicos = useMemo(() => {
    const set = new Set(notas.map(n => n.emitente_nome).filter(Boolean));
    return Array.from(set).sort();
  }, [notas]);

  const filteredNotas = useMemo(() => {
    return notas.filter(n => {
      if (nfFilter !== 'all' && n.id !== nfFilter) return false;
      if (fornecedorFilter !== 'all' && n.emitente_nome !== fornecedorFilter) return false;
      if (dataInicio || dataFim) {
        const dataStr = n.data_emissao || n.created_date;
        if (!dataStr) return false;
        try {
          const nfDate = parseISO(dataStr);
          if (dataInicio && nfDate < startOfDay(parseISO(dataInicio))) return false;
          if (dataFim && nfDate > endOfDay(parseISO(dataFim))) return false;
        } catch { return false; }
      }
      return true;
    });
  }, [notas, nfFilter, fornecedorFilter, dataInicio, dataFim]);

  const { reportData, totalQty, totalGasto, custaMedioGeral, pieData } = useMemo(() => {
    const grouped = {};
    const fornecedorGasto = {};

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
            valor_total_gasto: 0,
            nfs_set: new Set(),
          };
        }
        grouped[key].total_qty += item.quantidade || 0;
        grouped[key].valor_total_gasto += item.valor_total || 0;
        grouped[key].count += 1;
        if (nf.numero_nf) grouped[key].nfs_set.add(nf.numero_nf);
      });

      // for pie chart
      const nome = nf.emitente_nome || 'Desconhecido';
      fornecedorGasto[nome] = (fornecedorGasto[nome] || 0) + (nf.valor_total || 0);
    });

    let data = Object.values(grouped).map(r => ({
      ...r,
      nfs_pertencentes: Array.from(r.nfs_set).join(', '),
      custo_medio: r.total_qty > 0 ? r.valor_total_gasto / r.total_qty : 0,
    }));

    // search filter
    if (searchProduto.trim()) {
      const q = searchProduto.toLowerCase();
      data = data.filter(r => r.descricao?.toLowerCase().includes(q) || r.codigo?.toLowerCase().includes(q));
    }

    // sort
    data.sort((a, b) => {
      const av = a[sortCol] ?? 0;
      const bv = b[sortCol] ?? 0;
      return sortDir === 'asc' ? av - bv : bv - av;
    });

    const totalQty = data.reduce((s, r) => s + r.total_qty, 0);
    const totalGasto = data.reduce((s, r) => s + r.valor_total_gasto, 0);
    const custaMedioGeral = totalQty > 0 ? totalGasto / totalQty : 0;

    const pieData = Object.entries(fornecedorGasto)
      .map(([name, value]) => ({ name: name.substring(0, 25), value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    return { reportData: data, totalQty, totalGasto, custaMedioGeral, pieData };
  }, [filteredNotas, searchProduto, sortCol, sortDir]);

  const chartData = reportData.slice(0, 10).map(r => ({
    name: r.descricao?.substring(0, 18) || '-',
    qty: Math.round(r.total_qty * 1000) / 1000,
  }));

  const activeFilters = { nfFilter, fornecedorFilter, dataInicio, dataFim };

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatório de Volumes</h1>
          <p className="text-sm text-muted-foreground mt-1">Agrupamento automático de itens das NFs importadas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportReportPDF(reportData, activeFilters)} className="gap-2" disabled={reportData.length === 0}>
            <FileDown className="w-3.5 h-3.5" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportReportExcel(reportData, activeFilters)} className="gap-2" disabled={reportData.length === 0}>
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1 min-w-[180px]">
            <Label className="text-xs">Filtrar por NF</Label>
            <Select value={nfFilter} onValueChange={setNfFilter}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Todas as NFs" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as NFs</SelectItem>
                {notas.map(n => (
                  <SelectItem key={n.id} value={n.id}>
                    NF-e #{n.numero_nf} — {n.emitente_nome?.substring(0, 20)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1 min-w-[200px]">
            <Label className="text-xs">Filtrar por Fornecedor</Label>
            <Select value={fornecedorFilter} onValueChange={setFornecedorFilter}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Todos os Fornecedores" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Fornecedores</SelectItem>
                {fornecedoresUnicos.map(f => (
                  <SelectItem key={f} value={f}>{f.substring(0, 35)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Data Inicial</Label>
            <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-40" />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Data Final</Label>
            <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-40" />
          </div>

          <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
            <Label className="text-xs">Buscar Produto</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input className="pl-8" placeholder="Código ou descrição..." value={searchProduto} onChange={e => setSearchProduto(e.target.value)} />
            </div>
          </div>

          {(nfFilter !== 'all' || fornecedorFilter !== 'all' || dataInicio || dataFim || searchProduto) && (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { setNfFilter('all'); setFornecedorFilter('all'); setDataInicio(''); setDataFim(''); setSearchProduto(''); }}>
              Limpar filtros
            </Button>
          )}
        </div>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
          <Skeleton className="h-72 rounded-lg" />
        </div>
      ) : reportData.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Nenhum item encontrado.</p>
            <p className="text-xs text-muted-foreground mt-1">Ajuste os filtros ou importe XMLs de NF-e.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { icon: Package, label: 'Produtos Distintos', value: reportData.length },
              { icon: Droplets, label: 'Quantidade Total', value: totalQty.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) },
              { icon: Hash, label: 'NFs Analisadas', value: filteredNotas.length },
              { icon: DollarSign, label: 'Valor Total Gasto', value: totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
              { icon: TrendingUp, label: 'Custo Médio Geral', value: custaMedioGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
            ].map(({ icon: Icon, label, value }) => (
              <Card key={label} className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-accent-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-lg font-bold truncate">{value}</p>
                </div>
              </Card>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Top 10 por Quantidade</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: -10, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} angle={-30} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(v) => [v.toLocaleString('pt-BR'), 'Quantidade']} />
                    <Bar dataKey="qty" fill="hsl(var(--primary))" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Volume de Compras por Fornecedor</CardTitle></CardHeader>
              <CardContent>
                {pieData.length === 0 ? (
                  <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">Sem dados financeiros</div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

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
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">#</th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Código</th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Produto / Embalagem / UN</th>
                      <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort('total_qty')}>
                        Qtd. Total <SortIcon col="total_qty" sortCol={sortCol} sortDir={sortDir} />
                      </th>
                      <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">Entradas</th>
                      <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort('valor_total_gasto')}>
                        Vl. Total <SortIcon col="valor_total_gasto" sortCol={sortCol} sortDir={sortDir} />
                      </th>
                      <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort('custo_medio')}>
                        Custo Médio <SortIcon col="custo_medio" sortCol={sortCol} sortDir={sortDir} />
                      </th>
                      <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">% Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row, i) => {
                      const pct = totalQty > 0 ? ((row.total_qty / totalQty) * 100).toFixed(1) : '0';
                      return (
                        <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                          <td className="py-3 px-3 text-muted-foreground align-top">{i + 1}</td>
                          <td className="py-3 px-3 font-mono text-xs align-top">{row.codigo || '-'}</td>
                          <td className="py-3 px-3 align-top">
                            <p className="font-semibold text-sm">{row.descricao}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="secondary" className="text-xs font-normal">{row.embalagem || '-'}</Badge>
                              <span className="text-xs text-muted-foreground">{row.unidade || '-'}</span>
                            </div>
                            {row.nfs_pertencentes && (
                              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                <span className="font-medium text-foreground">NFs: </span>
                                {row.nfs_pertencentes}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold align-top">
                            {row.total_qty.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                          </td>
                          <td className="py-3 px-3 text-right align-top">
                            <Badge variant="outline">{row.count}</Badge>
                          </td>
                          <td className="py-3 px-3 text-right font-medium text-primary align-top">
                            {row.valor_total_gasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                          <td className="py-3 px-3 text-right text-muted-foreground align-top">
                            {row.custo_medio > 0 ? row.custo_medio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                          </td>
                          <td className="py-3 px-3 text-right text-muted-foreground align-top">{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border font-bold bg-muted/30">
                      <td colSpan={3} className="py-3 px-3">TOTAL</td>
                      <td className="py-3 px-3 text-right font-mono text-primary">{totalQty.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</td>
                      <td />
                      <td className="py-3 px-3 text-right text-primary">{totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
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