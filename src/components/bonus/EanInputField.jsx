import React, { useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function EanInputField({
  value,
  onChange,
  onBlur,
  onEnter,
  produto,
  buscando,
  erroEan,
  autoFocus,
  inputRef,
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Cód. Barras (EAN)
      </Label>
      <div className="relative">
        <Input
          ref={inputRef}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onEnter?.();
            }
          }}
          placeholder="Bipe ou digite o código..."
          className={cn(
            "pr-9 font-mono text-sm h-11",
            produto && "border-emerald-500 focus-visible:ring-emerald-500/40",
            erroEan && "border-destructive focus-visible:ring-destructive/40"
          )}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {buscando && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
          {!buscando && produto && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          {!buscando && erroEan && <AlertCircle className="w-4 h-4 text-destructive" />}
        </div>
      </div>

      {/* Feedback do produto */}
      {produto && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 truncate">
              {produto.descricao}
            </p>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-500">
              Lastro: {produto.lastro ?? '—'} × Camada: {produto.camada ?? '—'} = Norma {(produto.lastro ?? 0) * (produto.camada ?? 0)} cx/palete
            </p>
          </div>
        </div>
      )}
      {erroEan && (
        <p className="text-[11px] text-destructive flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {erroEan}
        </p>
      )}
    </div>
  );
}