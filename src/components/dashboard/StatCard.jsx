import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function StatCard({ title, value, subtitle, icon: Icon, className }) {
  return (
    <Card className={cn("p-5 relative overflow-hidden", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-1.5 tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-accent-foreground" />
        </div>
      </div>
    </Card>
  );
}