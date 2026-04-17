import React from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Package, Layers } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ItensConferidosTable({ itens, onRemover }) {
  if (itens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border rounded-xl bg-muted/20">
        <Package className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">Nenhum item conferido ainda</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Bipe o primeiro produto para iniciar a conferência</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="text-xs font-semibold uppercase tracking-wider w-10 text-center">#</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider">EAN</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider">Descrição</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-center">Validade</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Qtd Caixas</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-center">Qtd Paletes</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-center w-16">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((item, index) => (
            <TableRow key={item.id} className="group hover:bg-accent/40 transition-colors">
              <TableCell className="text-center text-xs text-muted-foreground font-mono">
                {index + 1}
              </TableCell>
              <TableCell className="font-mono text-xs font-medium text-muted-foreground">
                {item.ean}
              </TableCell>
              <TableCell>
                <p className="text-sm font-medium leading-tight">{item.descricao}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Norma: {item.norma_palete} cx/palete
                </p>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className="text-xs font-mono">
                  {item.validade
                    ? format(new Date(item.validade + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })
                    : '—'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <span className="text-sm font-bold tabular-nums">{item.qtd_caixas.toLocaleString('pt-BR')}</span>
                <span className="text-xs text-muted-foreground ml-1">cx</span>
              </TableCell>
              <TableCell className="text-center">
                <div className="inline-flex items-center gap-1 bg-primary/5 border border-primary/20 rounded-lg px-2.5 py-1">
                  <Layers className="w-3 h-3 text-primary" />
                  <span className="text-xs font-semibold text-primary tabular-nums">
                    {item.paletes_cheios > 0 ? `${item.paletes_cheios} pal.` : ''}
                    {item.caixas_soltas > 0 ? ` + ${item.caixas_soltas} cx` : ''}
                    {item.paletes_cheios === 0 && item.caixas_soltas === 0 ? '—' : ''}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                  onClick={() => onRemover(item.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Totalizador */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-t border-border">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{itens.length}</span> linha(s) conferida(s)
        </p>
        <p className="text-xs text-muted-foreground">
          Total:{' '}
          <span className="font-bold text-foreground tabular-nums">
            {itens.reduce((acc, i) => acc + i.qtd_caixas, 0).toLocaleString('pt-BR')} caixas
          </span>
        </p>
      </div>
    </div>
  );
}