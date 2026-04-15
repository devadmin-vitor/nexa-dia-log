import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { FileDown, ArrowLeft } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try { return format(parseISO(dateStr), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }); }
  catch { return dateStr.substring(0, 10).split('-').reverse().join('/'); }
}

function formatCNPJ(cnpj) {
  if (!cnpj) return '-';
  const n = cnpj.replace(/\D/g, '');
  if (n.length === 14) return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  if (n.length === 11) return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return cnpj;
}

export default function NFDetail({ nf, onBack }) {
  const totalQty = (nf.itens || []).reduce((s, i) => s + (i.quantidade || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold">NF-e #{nf.numero_nf}</h2>
          <p className="text-sm text-muted-foreground">{nf.emitente_nome}</p>
        </div>
        {nf.arquivo_pdf_url && (
          <Button variant="outline" className="gap-2" onClick={() => window.open(nf.arquivo_pdf_url, '_blank')}>
            <FileDown className="w-4 h-4" />
            Download PDF
          </Button>
        )}
      </div>

      {/* Header info */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Emitente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="font-medium">{nf.emitente_nome || '-'}</p>
            <p className="text-sm text-muted-foreground">{formatCNPJ(nf.emitente_cnpj)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Destinatário</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="font-medium">{nf.destinatario_nome || '-'}</p>
            <p className="text-sm text-muted-foreground">{formatCNPJ(nf.destinatario_cnpj)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Número', value: nf.numero_nf },
          { label: 'Série', value: nf.serie || '-' },
          { label: 'Emissão', value: formatDate(nf.data_emissao) },
          { label: 'Valor Total', value: (nf.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
        ].map(({ label, value }) => (
          <Card key={label} className="p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-semibold text-sm mt-0.5">{value}</p>
          </Card>
        ))}
      </div>

      {/* Items table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Itens da Nota Fiscal</CardTitle>
          <div className="flex gap-2">
            <Badge variant="secondary">{(nf.itens || []).length} produtos</Badge>
            <Badge variant="outline">Qtd total: {totalQty.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">#</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Código</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Descrição</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Embalagem</th>
                  <th className="text-center py-2.5 px-3 text-xs font-medium text-muted-foreground">UN</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">Quantidade</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">Vl. Unit.</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">Vl. Total</th>
                </tr>
              </thead>
              <tbody>
                {(nf.itens || []).map((item, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                    <td className="py-2.5 px-3 text-muted-foreground">{i + 1}</td>
                    <td className="py-2.5 px-3 font-mono text-xs">{item.codigo || '-'}</td>
                    <td className="py-2.5 px-3 font-medium max-w-xs">{item.descricao}</td>
                    <td className="py-2.5 px-3">
                      <Badge variant="secondary" className="text-xs font-normal">{item.embalagem || '-'}</Badge>
                    </td>
                    <td className="py-2.5 px-3 text-center text-xs">{item.unidade || '-'}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-medium">
                      {item.quantidade?.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                    </td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground text-xs">
                      {(item.valor_unitario || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium">
                      {(item.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-bold bg-muted/30">
                  <td colSpan={5} className="py-3 px-3 text-sm">TOTAL</td>
                  <td className="py-3 px-3 text-right font-mono">
                    {totalQty.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                  </td>
                  <td />
                  <td className="py-3 px-3 text-right text-primary">
                    {(nf.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}