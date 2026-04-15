import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Trash2, ChevronRight, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ReportPreview from '@/components/relatorio/ReportPreview';
import { toast } from 'sonner';

export default function Historico() {
  const [selectedReport, setSelectedReport] = useState(null);
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: () => base44.entities.Report.list('-created_date', 50),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Report.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setSelectedReport(null);
      toast.success('Relatório removido.');
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
    );
  }

  if (selectedReport) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedReport(null)}>
            ← Voltar
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{selectedReport.title}</h1>
        </div>
        <ReportPreview report={selectedReport} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Histórico de Relatórios</h1>
        <p className="text-sm text-muted-foreground mt-1">Visualize e exporte relatórios gerados anteriormente</p>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum relatório gerado ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">Vá para "Gerar Relatório" para criar seu primeiro relatório.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <Card
              key={report.id}
              className="cursor-pointer hover:shadow-md transition-all"
              onClick={() => setSelectedReport(report)}
            >
              <CardContent className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{report.title}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(report.created_date), "dd MMM yyyy, HH:mm", { locale: ptBR })}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {report.total_products} produtos
                      </Badge>
                      <Badge variant="secondary" className="text-xs font-mono">
                        {report.total_volume?.toLocaleString()} ml
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(report.id); }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}