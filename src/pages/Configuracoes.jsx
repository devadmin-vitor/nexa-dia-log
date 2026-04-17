import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Trophy, Truck, Weight, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function Configuracoes() {
  const queryClient = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['dashboard-config'],
    queryFn: () => base44.entities.DashboardConfig.list(),
  });

  const config = configs[0];

  const [valorPorKg, setValorPorKg] = useState('');
  const [metaPremiacao, setMetaPremiacao] = useState('');
  const [metaVeiculos, setMetaVeiculos] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (config) {
      setValorPorKg(config.valor_por_kg?.toString() || '0.01');
      setMetaPremiacao(config.meta_premiacao?.toString() || '');
      setMetaVeiculos(config.meta_veiculos_dia?.toString() || '8');
    } else if (!isLoading) {
      setValorPorKg('0.01');
      setMetaPremiacao('');
      setMetaVeiculos('8');
    }
  }, [config, isLoading]);

  async function handleSalvar() {
    const valorKg = parseFloat(valorPorKg);
    if (isNaN(valorKg) || valorKg <= 0) {
      toast.error('Informe um valor por kg válido.');
      return;
    }

    setSalvando(true);
    const payload = {
      valor_por_kg: valorKg,
      meta_premiacao: metaPremiacao ? parseFloat(metaPremiacao) : null,
      meta_veiculos_dia: parseInt(metaVeiculos) || 8,
    };

    if (config?.id) {
      await base44.entities.DashboardConfig.update(config.id, payload);
    } else {
      await base44.entities.DashboardConfig.create(payload);
    }

    toast.success('Configurações salvas com sucesso!');
    queryClient.invalidateQueries({ queryKey: ['dashboard-config'] });
    setSalvando(false);
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Defina as metas e parâmetros do sistema de expedição
        </p>
      </div>

      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader className="pb-3 pt-5 px-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Settings className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <p className="font-semibold text-sm">Parâmetros de Premiação</p>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-5">

          {/* Valor por KG */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Weight className="w-3.5 h-3.5" />
              Valor por kg (R$) *
            </Label>
            <Input
              type="number"
              step="0.001"
              min={0}
              value={valorPorKg}
              onChange={e => setValorPorKg(e.target.value)}
              placeholder="0.01"
              className="tabular-nums h-10"
              disabled={isLoading}
            />
            <p className="text-[11px] text-muted-foreground">
              Cada kg expedido gera este valor em premiação. Padrão: R$ 0,01/kg
            </p>
          </div>

          {/* Meta de Premiação */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" />
              Meta de Premiação (R$)
            </Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={metaPremiacao}
              onChange={e => setMetaPremiacao(e.target.value)}
              placeholder="Ex: 500.00"
              className="tabular-nums h-10"
              disabled={isLoading}
            />
            <p className="text-[11px] text-muted-foreground">
              Valor acumulado necessário para liberar a premiação. Deixe vazio para não definir meta.
            </p>
          </div>

          {/* Meta de Veículos */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5" />
              Meta de Bônus Conferidos por Dia
            </Label>
            <Input
              type="number"
              min={1}
              value={metaVeiculos}
              onChange={e => setMetaVeiculos(e.target.value)}
              placeholder="8"
              className="tabular-nums h-10"
              disabled={isLoading}
            />
            <p className="text-[11px] text-muted-foreground">
              Quantidade diária de bônus de recebimento conferidos para atingir a meta. Padrão: 8
            </p>
          </div>

          <Button
            onClick={handleSalvar}
            disabled={salvando || isLoading}
            className="w-full h-11 gap-2"
          >
            <Save className="w-4 h-4" />
            {salvando ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}