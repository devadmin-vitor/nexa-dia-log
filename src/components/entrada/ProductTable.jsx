import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Package } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ProductTable({ products, onDelete }) {
  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Package className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum produto registrado.</p>
          <p className="text-xs text-muted-foreground mt-1">Use o formulário acima para adicionar dados.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Produtos Registrados</CardTitle>
        <Badge variant="secondary">{products.length} entradas</Badge>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Produto</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">Volume (ml)</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">Data</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                  <td className="py-2.5 px-3 font-medium">{p.name}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{p.volume_ml?.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right text-muted-foreground text-xs">
                    {format(new Date(p.created_date), 'dd/MM/yy', { locale: ptBR })}
                  </td>
                  <td className="py-2.5 px-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete(p.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}