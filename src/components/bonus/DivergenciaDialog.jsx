import React from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function DivergenciaDialog({ open, onOpenChange, divergencias, onConfirmar, onCancelar }) {
  const temDivergencia = divergencias && divergencias.length > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-1">
            {temDivergencia ? (
              <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
            )}
            <AlertDialogTitle className="text-lg">
              {temDivergencia ? 'Divergência Encontrada' : 'Conferência OK'}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {temDivergencia ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Foram encontradas diferenças entre o físico conferido e o esperado pelas notas fiscais:
                  </p>
                  <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 overflow-hidden">
                    <div className="grid grid-cols-4 px-3 py-2 bg-orange-100/70 dark:bg-orange-900/30 text-[10px] font-bold uppercase tracking-wider text-orange-700 dark:text-orange-400">
                      <span className="col-span-2">Produto</span>
                      <span className="text-right">Esperado</span>
                      <span className="text-right">Conferido</span>
                    </div>
                    <div className="divide-y divide-orange-100 dark:divide-orange-900/40 max-h-48 overflow-y-auto">
                      {divergencias.map((d, i) => (
                        <div key={i} className="grid grid-cols-4 px-3 py-2 items-center">
                          <div className="col-span-2 min-w-0">
                            <p className="text-xs font-medium truncate">{d.descricao || d.ean}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{d.ean}</p>
                          </div>
                          <span className="text-xs text-right tabular-nums font-mono">{d.esperado.toLocaleString('pt-BR')}</span>
                          <span className={`text-xs text-right tabular-nums font-bold font-mono ${d.conferido > d.esperado ? 'text-orange-600' : 'text-destructive'}`}>
                            {d.conferido.toLocaleString('pt-BR')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
                    ⚠️ Deseja <strong>forçar o fechamento</strong> e registrar a quebra? O bônus será salvo com status <strong>"divergente"</strong>.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  As quantidades conferidas batem com o esperado pelas notas fiscais. Deseja finalizar a conferência?
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancelar}>
            {temDivergencia ? 'Revisar Conferência' : 'Cancelar'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirmar}
            className={temDivergencia
              ? "bg-orange-600 hover:bg-orange-700 text-white"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }
          >
            {temDivergencia ? 'Forçar Fechamento' : 'Finalizar Conferência'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}