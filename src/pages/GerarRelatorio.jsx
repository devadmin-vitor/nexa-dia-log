import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Loader2, Sparkles } from 'lucide-react';
import ReportPreview from '@/components/relatorio/ReportPreview';
import { toast } from 'sonner';

export default function GerarRelatorio() {
  const [title, setTitle] = useState('Relatório de Volumes');
  const [generatedReport, setGeneratedReport] = useState(null);
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('-created_date', 500),
  });

  const saveMutation = useMutation({
    mutationFn: (report) => base44.entities.Report.create(report),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast.success('Relatório salvo no histórico!');
    },
  });

  const generateReport = () => {
    if (products.length === 0) {
      toast.error('Nenhum produto disponível para gerar relatório.');
      return;
    }

    const grouped = {};
    products.forEach(p => {
      const key = p.name?.trim().toLowerCase() || 'sem nome';
      if (!grouped[key]) {
        grouped[key] = { product_name: p.name?.trim() || 'Sem Nome', total_volume_ml: 0, entry_count: 0 };
      }
      grouped[key].total_volume_ml += p.volume_ml || 0;
      grouped[key].entry_count += 1;
    });

    const summary = Object.values(grouped).sort((a, b) => b.total_volume_ml - a.total_volume_ml);
    const totalVolume = summary.reduce((s, i) => s + i.total_volume_ml, 0);

    const report = {
      title: title.trim() || 'Relatório de Volumes',
      summary,
      total_volume: Math.round(totalVolume * 100) / 100,
      total_products: summary.length,
      total_entries: products.length,
    };

    setGeneratedReport(report);
    saveMutation.mutate(report);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gerar Relatório</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Agrupe automaticamente seus produtos e exporte o relatório
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="title">Título do Relatório</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Relatório Mensal de Volumes"
              />
            </div>
            <Button
              onClick={generateReport}
              disabled={isLoading || products.length === 0}
              className="gap-2 shrink-0"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Gerar Relatório
            </Button>
          </div>
          {products.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground mt-3">
              Nenhum produto registrado. Vá para "Entrada de Dados" para adicionar produtos.
            </p>
          )}
        </CardContent>
      </Card>

      {generatedReport && <ReportPreview report={generatedReport} />}
    </div>
  );
}