import React from 'react';
import { Card } from '@/components/ui/card';
import { CheckCircle2, AlertCircle, XCircle, FileCode2 } from 'lucide-react';

export default function BatchSummary({ files }) {
  if (files.length === 0) return null;

  const total = files.length;
  const success = files.filter(f => f.status === 'success').length;
  const notFound = files.filter(f => f.status === 'not_found').length;
  const errors = files.filter(f => f.status === 'invalid' || f.status === 'error').length;

  const stats = [
    { label: 'Processados', value: total, icon: FileCode2, color: 'text-muted-foreground', bg: 'bg-muted' },
    { label: 'Vinculados', value: success, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Não encontrados', value: notFound, icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: 'Erros', value: errors, icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/5' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map(({ label, value, icon: Icon, color, bg }) => (
        <Card key={label} className="p-4 flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
            <Icon className={`w-4 h-4 ${color}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold">{value}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}