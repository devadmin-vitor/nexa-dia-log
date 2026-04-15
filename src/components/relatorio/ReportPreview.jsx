import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileDown, FileSpreadsheet, Droplets, Package, Hash } from 'lucide-react';
import { exportToPDF, exportToExcel } from '@/lib/exportUtils';

export default function ReportPreview({ report }) {
  if (!report) return null;

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
            <Package className="w-4 h-4 text-accent-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Produtos</p>
            <p className="text-lg font-bold">{report.total_products}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
            <Hash className="w-4 h-4 text-accent-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Entradas</p>
            <p className="text-lg font-bold">{report.total_entries}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
            <Droplets className="w-4 h-4 text-accent-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Volume Total</p>
            <p className="text-lg font-bold">{report.total_volume?.toLocaleString()} ml</p>
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{report.title}</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => exportToPDF(report)}>
              <FileDown className="w-4 h-4" />
              PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => exportToExcel(report)}>
              <FileSpreadsheet className="w-4 h-4" />
              Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Produto</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">Volume Total (ml)</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">Entradas</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">% do Total</th>
                </tr>
              </thead>
              <tbody>
                {report.summary?.map((item, i) => {
                  const pct = report.total_volume > 0
                    ? ((item.total_volume_ml / report.total_volume) * 100).toFixed(1)
                    : '0';
                  return (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-2.5 px-3 font-medium">{item.product_name}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{item.total_volume_ml.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right">
                        <Badge variant="secondary">{item.entry_count}</Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-bold">
                  <td className="py-3 px-3">TOTAL</td>
                  <td className="py-3 px-3 text-right font-mono">{report.total_volume?.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right">
                    <Badge>{report.total_entries}</Badge>
                  </td>
                  <td className="py-3 px-3 text-right">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}