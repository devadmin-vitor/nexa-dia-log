import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Droplets, Package, FileText, Hash } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import VolumeChart from '@/components/dashboard/VolumeChart';
import RecentEntries from '@/components/dashboard/RecentEntries';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('-created_date', 200),
  });

  const { data: reports = [], isLoading: loadingReports } = useQuery({
    queryKey: ['reports'],
    queryFn: () => base44.entities.Report.list('-created_date', 50),
  });

  const totalVolume = products.reduce((sum, p) => sum + (p.volume_ml || 0), 0);
  const uniqueProducts = new Set(products.map(p => p.name?.trim().toLowerCase())).size;

  if (loadingProducts || loadingReports) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral dos seus dados de volume</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Produtos Únicos" value={uniqueProducts} icon={Package} />
        <StatCard title="Total de Entradas" value={products.length} icon={Hash} />
        <StatCard title="Volume Total" value={`${Math.round(totalVolume).toLocaleString()} ml`} icon={Droplets} />
        <StatCard title="Relatórios" value={reports.length} icon={FileText} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <VolumeChart products={products} />
        <RecentEntries products={products} />
      </div>
    </div>
  );
}