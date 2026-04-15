import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileDown, Package, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try { return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: ptBR }); }
  catch { return dateStr.substring(0, 10).split('-').reverse().join('/'); }
}

function formatCNPJ(cnpj) {
  if (!cnpj) return '-';
  const n = cnpj.replace(/\D/g, '');
  if (n.length === 14) return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return cnpj;
}

export default function NFCard({ nf, onClick }) {
  const totalQty = (nf.itens || []).reduce((s, i) => s + (i.quantidade || 0), 0);

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-all border hover:border-primary/30"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center shrink-0 mt-0.5">
              <Package className="w-5 h-5 text-accent-foreground" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm">NF-e #{nf.numero_nf}</p>
                {nf.serie && <Badge variant="outline" className="text-xs">Série {nf.serie}</Badge>}
                <Badge variant="secondary" className="text-xs">
                  {(nf.itens || []).length} itens
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{nf.emitente_nome || '-'}</p>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-xs text-muted-foreground">Data: {formatDate(nf.data_emissao)}</span>
                <span className="text-xs text-muted-foreground">
                  Qtd total: {totalQty.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                </span>
                {nf.valor_total > 0 && (
                  <span className="text-xs font-medium text-primary">
                    {nf.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {nf.arquivo_pdf_url && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => { e.stopPropagation(); window.open(nf.arquivo_pdf_url, '_blank'); }}
              >
                <FileDown className="w-4 h-4" />
              </Button>
            )}
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}