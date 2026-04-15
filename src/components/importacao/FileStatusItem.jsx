import React from 'react';
import { CheckCircle2, XCircle, Loader2, AlertCircle, FileCode2, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  pending: {
    icon: FileCode2,
    color: 'text-muted-foreground',
    bg: 'bg-muted',
    label: 'Aguardando',
    badge: 'secondary',
  },
  processing: {
    icon: Loader2,
    color: 'text-primary',
    bg: 'bg-accent',
    label: 'Processando...',
    badge: 'outline',
    spin: true,
  },
  success: {
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    label: 'Importada com sucesso',
    badge: 'default',
  },
  not_found: {
    icon: AlertCircle,
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    label: 'NF não encontrada no sistema',
    badge: 'outline',
  },
  invalid: {
    icon: XCircle,
    color: 'text-destructive',
    bg: 'bg-destructive/5',
    label: 'XML inválido',
    badge: 'destructive',
  },
  error: {
    icon: XCircle,
    color: 'text-destructive',
    bg: 'bg-destructive/5',
    label: 'Erro ao processar',
    badge: 'destructive',
  },
};

export default function FileStatusItem({ file }) {
  const cfg = STATUS_CONFIG[file.status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;

  return (
    <div className={cn(
      "flex items-center gap-4 p-4 rounded-lg border transition-all",
      file.status === 'success' && "border-emerald-200",
      file.status === 'not_found' && "border-amber-200",
      (file.status === 'invalid' || file.status === 'error') && "border-destructive/20",
      file.status === 'pending' && "border-border",
      file.status === 'processing' && "border-primary/30",
    )}>
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", cfg.bg)}>
        <Icon className={cn("w-4.5 h-4.5", cfg.color, cfg.spin && "animate-spin")} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {file.nfNumero && (
            <span className="text-xs text-muted-foreground">NF-e #{file.nfNumero}</span>
          )}
          {file.emitente && (
            <span className="text-xs text-muted-foreground truncate">· {file.emitente}</span>
          )}
          {file.errorMessage && (
            <span className="text-xs text-destructive">{file.errorMessage}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Badge variant={cfg.badge} className="text-xs whitespace-nowrap">
          {cfg.label}
        </Badge>
        {file.status === 'success' && file.pdfBlob && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-7 text-xs"
            onClick={() => {
              const url = URL.createObjectURL(file.pdfBlob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `NF_${file.nfNumero}.pdf`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <FileDown className="w-3 h-3" />
            PDF
          </Button>
        )}
      </div>
    </div>
  );
}