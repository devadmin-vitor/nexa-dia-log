import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Search, FileText, Trash2, FileDown, X } from 'lucide-react';
import NFCard from '@/components/nf/NFCard';
import NFDetail from '@/components/nf/NFDetail';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function NotasFiscais() {
  const [search, setSearch] = useState('');
  const [selectedNF, setSelectedNF] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  
  // Estados para o fluxo de Autenticação
  const [authOpen, setAuthOpen] = useState(false);
  const [authLogin, setAuthLogin] = useState('');
  const [authSenha, setAuthSenha] = useState('');
  const [pendingDeleteAction, setPendingDeleteAction] = useState(null);

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

  const filtered = notas.filter(n =>
    !search ||
    n.numero_nf?.includes(search) ||
    n.emitente_nome?.toLowerCase().includes(search.toLowerCase()) ||
    n.destinatario_nome?.toLowerCase().includes(search.toLowerCase())
  );

  const allSelected = filtered.length > 0 && filtered.every(n => selectedIds.includes(n.id));

  function toggleSelect(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }

  function selectAll() {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(filtered.map(n => n.id));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  // Lógica de exclusão em massa isolada para ser chamada após a autenticação
  async function executeBulkDelete() {
    const count = selectedIds.length;
    await Promise.all(selectedIds.map(id => base44.entities.NotaFiscal.delete(id)));
    queryClient.invalidateQueries({ queryKey: ['notas-fiscais'] });
    setSelectedIds([]);
    setBulkDeleteOpen(false);
    toast.success(`${count} nota(s) fiscal(is) removida(s).`);
  }

  // Função de validação de credenciais
  function handleConfirmAuth(e) {
    e.preventDefault(); // Previne o fechamento automático do modal em caso de erro
    if (authLogin === 'admin' && authSenha === 'amintor') {
      setAuthOpen(false);
      setAuthLogin('');
      setAuthSenha('');
      
      // Executa a função que estava pendente (individual ou em massa)
      if (pendingDeleteAction) pendingDeleteAction();
    } else {
      toast.error('Credenciais inválidas!');
    }
  }

  function handleBulkDownload() {
    const selected = notas.filter(n => selectedIds.includes(n.id) && n.arquivo_pdf_url);
    if (selected.length === 0) {
      toast.error('Nenhuma nota selecionada possui PDF disponível.');
      return;
    }
    selected.forEach((nf, i) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = nf.arquivo_pdf_url;
        a.target = '_blank';
        a.download = `NF_${nf.numero_nf}.pdf`;
        a.click();
      }, i * 300);
    });
    toast.success(`Iniciando download de ${selected.length} PDF(s)...`);
  }

  if (selectedNF) {
    return <NFDetail nf={selectedNF} onBack={() => setSelectedNF(null)} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notas Fiscais</h1>
        <p className="text-sm text-muted-foreground mt-1">Todas as NF-e importadas via XML</p>
      </div>

      {/* Search + Select All */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por número, emitente ou destinatário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {filtered.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={allSelected} onCheckedChange={selectAll} />
            <span className="whitespace-nowrap">Selecionar todas</span>
          </div>
        )}
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-accent border border-primary/20 rounded-xl flex-wrap">
          <span className="text-sm font-semibold text-accent-foreground">
            {selectedIds.length} {selectedIds.length === 1 ? 'item selecionado' : 'itens selecionados'}
          </span>
          <div className="flex gap-2 ml-auto flex-wrap">
            <Button size="sm" variant="outline" className="gap-2" onClick={handleBulkDownload}>
              <FileDown className="w-3.5 h-3.5" />
              Baixar PDFs
            </Button>

            <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive" className="gap-2">
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir {selectedIds.length}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmação</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja prosseguir adiante?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Não</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => {
                      setBulkDeleteOpen(false);
                      setPendingDeleteAction(() => executeBulkDelete);
                      setAuthOpen(true);
                    }}
                  >
                    Sim
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button size="sm" variant="ghost" className="gap-2" onClick={clearSelection}>
              <X className="w-3.5 h-3.5" />
              Cancelar
            </Button>
          </div>
        </div>
      )}

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
            <div key={nf.id} className="relative group">
              <NFCard
                nf={nf}
                onClick={() => setSelectedNF(nf)}
                isSelected={selectedIds.includes(nf.id)}
                onSelect={toggleSelect}
              />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-3 right-10 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10 z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmação</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja prosseguir adiante?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Não</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => {
                        setPendingDeleteAction(() => () => deleteMutation.mutate(nf.id));
                        setAuthOpen(true);
                      }}
                    >
                      Sim
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Autenticação Administrador */}
      <AlertDialog open={authOpen} onOpenChange={setAuthOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Credenciais Necessárias</AlertDialogTitle>
            <AlertDialogDescription>
              Por favor, insira o login e senha de administrador para autorizar a exclusão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Input
                placeholder="Login"
                value={authLogin}
                onChange={(e) => setAuthLogin(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Senha"
                value={authSenha}
                onChange={(e) => setAuthSenha(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setAuthLogin('');
              setAuthSenha('');
              setPendingDeleteAction(null);
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAuth}>
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}