import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Truck, Plus, Weight, Users, Search, Trash2,
  FileText, Calendar, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const hoje = format(new Date(), 'yyyy-MM-dd');

export default function Expedicoes() {
  const queryClient = useQueryClient();

  // Form state
  const [dataExpedicao, setDataExpedicao] = useState(hoje);
  const [placa, setPlaca] = useState('');
  const [selectedNFIds, setSelectedNFIds] = useState([]);
  const [participantesStr, setParticipantesStr] = useState('');
  const [observacao, setObservacao] = useState('');
  const [searchNF, setSearchNF] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [nfsExpandido, setNfsExpandido] = useState(true);

  // Data
  const { data: notas = [], isLoading: loadingNotas } = useQuery({
    queryKey: ['notas-expedicao-lista'],
    queryFn: () => base44.entities.NotaFiscal.list('-data_emissao', 9999),
  });

  const { data: expedicoes = [], isLoading: loadingExp } = useQuery({
    queryKey: ['expedicoes-todas'],
    queryFn: () => base44.entities.ExpedicaoVeiculo.list('-created_date', 9999),
  });

  // Notas filtradas para seleção
  const notasFiltradas = notas.filter(nf =>
    !searchNF ||
    nf.numero_nf?.includes(searchNF) ||
    nf.emitente_nome?.toLowerCase().includes(searchNF.toLowerCase())
  );

  // Peso calculado automaticamente pelas NFs selecionadas
  const pesoCalculado = notas
    .filter(nf => selectedNFIds.includes(nf.id))
    .reduce((acc, nf) => acc + (nf.peso_bruto || 0), 0);

  function toggleNF(id) {
    setSelectedNFIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  async function handleSalvar() {
    if (!placa.trim()) {
      toast.error('Informe a placa do veículo.');
      return;
    }
    if (!dataExpedicao) {
      toast.error('Informe a data da expedição.');
      return;
    }

    setSalvando(true);
    const participantes = participantesStr
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    await base44.entities.ExpedicaoVeiculo.create({
      data_expedicao: dataExpedicao,
      placa: placa.trim().toUpperCase(),
      nota_fiscal_ids: selectedNFIds,
      peso_total_kg: pesoCalculado,
      participantes,
      observacao: observacao.trim() || undefined,
    });

    toast.success(`Expedição do veículo ${placa.toUpperCase()} registrada!`);
    queryClient.invalidateQueries({ queryKey: ['expedicoes-todas'] });
    queryClient.invalidateQueries({ queryKey: ['expedicoes-hoje'] });
    queryClient.invalidateQueries({ queryKey: ['notas-expedicao-all'] });

    // Reset
    setPlaca('');
    setSelectedNFIds([]);
    setParticipantesStr('');
    setObservacao('');
    setDataExpedicao(hoje);
    setSalvando(false);
  }

  async function handleDeletar(id, placa) {
    await base44.entities.ExpedicaoVeiculo.delete(id);
    queryClient.invalidateQueries({ queryKey: ['expedicoes-todas'] });
    queryClient.invalidateQueries({ queryKey: ['expedicoes-hoje'] });
    toast.success(`Expedição ${placa} removida.`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Expedições</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registre saídas de veículos com notas fiscais e participantes da equipe
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Formulário */}
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background shadow-lg shadow-primary/5">
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <Plus className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <p className="font-semibold text-sm">Nova Expedição</p>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            {/* Data + Placa */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Data *
                </Label>
                <Input
                  type="date"
                  value={dataExpedicao}
                  onChange={e => setDataExpedicao(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Placa *
                </Label>
                <Input
                  value={placa}
                  onChange={e => setPlaca(e.target.value.toUpperCase())}
                  placeholder="ABC-1234"
                  className="h-10 font-mono uppercase"
                  maxLength={8}
                />
              </div>
            </div>

            {/* Participantes */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Participantes
              </Label>
              <Input
                value={participantesStr}
                onChange={e => setParticipantesStr(e.target.value)}
                placeholder="João, Carlos, Pedro"
                className="h-10"
              />
              <p className="text-[10px] text-muted-foreground">Separe os nomes por vírgula</p>
            </div>

            {/* Observação */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Observação
              </Label>
              <Input
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                placeholder="Opcional..."
                className="h-10"
              />
            </div>

            {/* Seleção de NFs */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setNfsExpandido(v => !v)}
                className="flex items-center justify-between w-full text-left"
              >
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer">
                  Notas Fiscais
                  {selectedNFIds.length > 0 && (
                    <Badge className="ml-2 text-[10px] bg-primary text-primary-foreground">{selectedNFIds.length} selecionada(s)</Badge>
                  )}
                </Label>
                {nfsExpandido ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>

              {nfsExpandido && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="p-2 bg-muted/30 border-b border-border">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        className="pl-8 h-8 text-xs"
                        placeholder="Buscar NF..."
                        value={searchNF}
                        onChange={e => setSearchNF(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-border">
                    {loadingNotas ? (
                      <div className="p-3 text-xs text-muted-foreground">Carregando...</div>
                    ) : notasFiltradas.length === 0 ? (
                      <div className="p-3 text-xs text-muted-foreground">Nenhuma NF encontrada.</div>
                    ) : (
                      notasFiltradas.map(nf => (
                        <label
                          key={nf.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedNFIds.includes(nf.id)}
                            onCheckedChange={() => toggleNF(nf.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium">NF {nf.numero_nf}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{nf.emitente_nome}</p>
                          </div>
                          {nf.peso_bruto > 0 && (
                            <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                              {nf.peso_bruto.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg
                            </span>
                          )}
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Peso calculado */}
            {pesoCalculado > 0 && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2">
                  <Weight className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">Peso Total (automático)</span>
                </div>
                <Badge className="text-sm font-bold px-3 py-1 bg-primary text-primary-foreground tabular-nums">
                  {pesoCalculado.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg
                </Badge>
              </div>
            )}

            <Button
              onClick={handleSalvar}
              disabled={salvando}
              className="w-full h-11 gap-2"
            >
              <Truck className="w-4 h-4" />
              {salvando ? 'Salvando...' : 'Registrar Expedição'}
            </Button>
          </CardContent>
        </Card>

        {/* Lista de expedições */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Expedições Registradas
          </h2>

          {loadingExp ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : expedicoes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Truck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma expedição registrada.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {expedicoes.map(exp => (
                <Card key={exp.id} className="border-border group hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center shrink-0">
                        <Truck className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm font-mono">{exp.placa}</span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {exp.data_expedicao ? format(new Date(exp.data_expedicao + 'T12:00:00'), 'dd/MM/yy') : '—'}
                          </span>
                          {exp.nota_fiscal_ids?.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] gap-1">
                              <FileText className="w-2.5 h-2.5" />
                              {exp.nota_fiscal_ids.length} NF(s)
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap text-[11px] text-muted-foreground">
                          {exp.peso_total_kg > 0 && (
                            <span className="flex items-center gap-1">
                              <Weight className="w-3 h-3" />
                              {exp.peso_total_kg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg
                            </span>
                          )}
                          {exp.participantes?.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {exp.participantes.join(', ')}
                            </span>
                          )}
                        </div>
                        {exp.observacao && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 italic truncate">{exp.observacao}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={() => handleDeletar(exp.id, exp.placa)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}