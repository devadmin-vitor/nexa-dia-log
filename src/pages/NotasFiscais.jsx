import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Search, FileText, Trash2 } from 'lucide-react';
import NFCard from '@/components/nf/NFCard';
import NFDetail from '@/components/nf/NFDetail';
import { toast } from 'sonner';

export default function NotasFiscais() {
  const [search, setSearch] = useState('');
  const [selectedNF, setSelectedNF] = useState(null);
  const queryClient = useQueryClient();

  const { data: notas = [], isLoading } = useQuery({
    queryKey: ['notas-fiscais'],
    queryFn: () => base44.entities.NotaFiscal.list('-created_date', 200),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.NotaFiscal.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-fiscais'] });
      setSelectedNF(null);
      toast.success('Nota fiscal removida.');
    },
  });

  if (selectedNF) {
    return (
      <NFDetail
        nf={selectedNF}
        onBack={() => setSelectedNF(null)}
      />
    );
  }

  const filtered = notas.filter(n =>
    !search ||
    n.numero_nf?.includes(search) ||
    n.emitente_nome?.toLowerCase().includes(search.toLowerCase()) ||
    n.destinatario_nome?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notas Fiscais</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Todas as NF-e importadas via XML
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por número, emitente ou destinatário..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm font-medium text-muted-foreground">
              {search ? 'Nenhuma nota encontrada para a busca.' : 'Nenhuma NF-e importada ainda.'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Use a aba "Importar XML" para adicionar notas fiscais.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((nf) => (
            <NFCard key={nf.id} nf={nf} onClick={() => setSelectedNF(nf)} />
          ))}
        </div>
      )}
    </div>
  );
}