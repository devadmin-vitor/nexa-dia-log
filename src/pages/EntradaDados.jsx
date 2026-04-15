import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Keyboard, Upload } from 'lucide-react';
import ManualEntryForm from '@/components/entrada/ManualEntryForm';
import FileImport from '@/components/entrada/FileImport';
import ProductTable from '@/components/entrada/ProductTable';
import { toast } from 'sonner';

export default function EntradaDados() {
  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('-created_date', 200),
  });

  const createMutation = useMutation({
    mutationFn: (entries) => base44.entities.Product.bulkCreate(entries),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Dados adicionados com sucesso!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Product.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produto removido.');
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Entrada de Dados</h1>
        <p className="text-sm text-muted-foreground mt-1">Adicione produtos e volumes manualmente ou via importação de arquivo</p>
      </div>

      <Tabs defaultValue="manual" className="space-y-4">
        <TabsList>
          <TabsTrigger value="manual" className="gap-2">
            <Keyboard className="w-4 h-4" />
            Digitação Manual
          </TabsTrigger>
          <TabsTrigger value="import" className="gap-2">
            <Upload className="w-4 h-4" />
            Importar Arquivo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual">
          <ManualEntryForm onAdd={(entries) => createMutation.mutate(entries)} />
        </TabsContent>

        <TabsContent value="import">
          <FileImport onImport={(entries) => createMutation.mutate(entries)} />
        </TabsContent>
      </Tabs>

      <ProductTable products={products} onDelete={(id) => deleteMutation.mutate(id)} />
    </div>
  );
}