import React from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Package, Layers, AlertTriangle } from 'lucide-react';
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

  const totalBoas = itens.filter(i => i.tipo_estoque === 'BOM').reduce((acc, i) => acc + i.qtd_caixas, 0);
  const totalAvaria = itens.filter(i => i.tipo_estoque === 'AVARIA').reduce((acc, i) => acc + i.qtd_caixas, 0);

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="text-xs font-semibold uppercase tracking-wider w-10 text-center">#</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider">EAN</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider">Descrição</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-center">Validade</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Qtd</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-center">Tipo / Paletes</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-center w-16">Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((item, index) => {
            const isAvaria = item.tipo_estoque === 'AVARIA';
            return (
              <TableRow
                key={item.id}
                className={`group transition-colors ${isAvaria
                  ? 'bg-red-50/60 hover:bg-red-50 dark:bg-red-950/20 dark:hover:bg-red-950/30 border-l-2 border-l-red-500'
                  : 'hover:bg-accent/40'
                }`}
              >
                <TableCell className="text-center text-xs text-muted-foreground font-mono">
                  {index + 1}
                </TableCell>
                <TableCell className="font-mono text-xs font-medium text-muted-foreground">
                  {item.ean}
                </TableCell>
                <TableCell>
                  <p className={`text-sm font-medium leading-tight ${isAvaria ? 'text-red-700 dark:text-red-400' : ''}`}>
                    {item.descricao}
                  </p>
                  {!isAvaria && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Norma: {item.norma_palete} cx/palete
                    </p>
                  )}
                  {isAvaria && (
                    <p className="text-[10px] text-red-500 mt-0.5 font-medium">
                      Destino: DOCA-AVARIAS (quarentena)
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="text-xs font-mono">
                    {item.validade
                      ? format(new Date(item.validade + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })
                      : '—'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <span className={`text-sm font-bold tabular-nums ${isAvaria ? 'text-red-600 dark:text-red-400' : ''}`}>
                    {item.qtd_caixas.toLocaleString('pt-BR')}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">cx</span>
                </TableCell>
                <TableCell className="text-center">
                  {isAvaria ? (
                    <div className="inline-flex items-center gap-1 bg-red-100 border border-red-300 rounded-lg px-2.5 py-1 dark:bg-red-900/30 dark:border-red-700">
                      <AlertTriangle className="w-3 h-3 text-red-600" />
                      <span className="text-xs font-semibold text-red-700 dark:text-red-400">Avariado</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1 bg-primary/5 border border-primary/20 rounded-lg px-2.5 py-1">
                      <Layers className="w-3 h-3 text-primary" />
                      <span className="text-xs font-semibold text-primary tabular-nums">
                        {item.paletes_cheios > 0 ? `${item.paletes_cheios} pal.` : ''}
                        {item.caixas_soltas > 0 ? `${item.paletes_cheios > 0 ? ' + ' : ''}${item.caixas_soltas} cx` : ''}
                        {item.paletes_cheios === 0 && item.caixas_soltas === 0 ? '—' : ''}
                      </span>
                    </div>
                  )}
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
            );
          })}
        </TableBody>
      </Table>

      {/* Totalizador */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 bg-muted/40 border-t border-border flex-wrap">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{itens.length}</span> linha(s) conferida(s)
        </p>
        <div className="flex items-center gap-4">
          {totalAvaria > 0 && (
            <p className="text-xs text-red-600 dark:text-red-400">
              Avaria:{' '}
              <span className="font-bold tabular-nums">{totalAvaria.toLocaleString('pt-BR')} cx</span>
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Boas:{' '}
            <span className="font-bold text-foreground tabular-nums">{totalBoas.toLocaleString('pt-BR')} cx</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Total:{' '}
            <span className="font-bold text-foreground tabular-nums">
              {(totalBoas + totalAvaria).toLocaleString('pt-BR')} cx
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}