import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function RecentEntries({ products }) {
  const recent = products.slice(0, 8);

  if (recent.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Entradas Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma entrada recente.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Entradas Recentes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {recent.map((p) => (
          <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <div>
              <p className="text-sm font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(p.created_date), "dd MMM yyyy, HH:mm", { locale: ptBR })}
              </p>
            </div>
            <Badge variant="secondary" className="font-mono">
              {p.volume_ml?.toLocaleString()} ml
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}