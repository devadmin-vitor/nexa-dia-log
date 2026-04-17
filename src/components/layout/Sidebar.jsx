import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileCode2, FileText, BarChart2, X, Beaker, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', label: 'Importar XML', icon: FileCode2 },
  { path: '/notas', label: 'Notas Fiscais', icon: FileText },
  { path: '/bonus', label: 'Bônus de Recebimento', icon: PackageCheck },
  { path: '/relatorio', label: 'Relatório de Volumes', icon: BarChart2 },
];

export default function Sidebar({ open, onClose }) {
  const location = useLocation();

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onClose} />
      )}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Beaker className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">NF-e Manager</p>
              <p className="text-xs text-muted-foreground leading-tight">Importador de XML</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer hint */}
        <div className="p-4 mx-3 mb-3 rounded-lg bg-accent/60 border border-border text-xs">
          <p className="font-medium text-accent-foreground">Padrão NF-e SEFAZ</p>
          <p className="text-muted-foreground mt-0.5">Suporta XML v3.10 e v4.00</p>
        </div>
      </aside>
    </>
  );
}