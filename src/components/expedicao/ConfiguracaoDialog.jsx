import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Trophy, Truck, Weight } from 'lucide-react';
import { toast } from 'sonner';

export default function ConfiguracaoDialog({ open, onOpenChange, config, configId, onSalvo }) {
  const [valorPorKg, setValorPorKg] = useState('');
  const [metaPremiacao, setMetaPremiacao] = useState('');
  const [metaVeiculos, setMetaVeiculos] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open) {
      setValorPorKg(config?.valor_por_kg?.toString() || '0.01');
      setMetaPremiacao(config?.meta_premiacao?.toString() || '');
      setMetaVeiculos(config?.meta_veiculos_dia?.toString() || '8');
    }
  }, [open, config]);

  async function handleSalvar() {
    const valorKg = parseFloat(valorPorKg);
    const meta = metaPremiacao ? parseFloat(metaPremiacao) : null;
    const metaVeic = parseInt(metaVeiculos) || 8;

    if (isNaN(valorKg) || valorKg <= 0) {
      toast.error('Informe um valor por kg válido.');
      return;
    }

    setSalvando(true);
    const payload = {
      valor_por_kg: valorKg,
      meta_premiacao: meta,
      meta_veiculos_dia: metaVeic,
    };

    if (configId) {
      await base44.entities.DashboardConfig.update(configId, payload);
    } else {
      await base44.entities.DashboardConfig.create(payload);
    }

    toast.success('Configurações salvas!');
    onSalvo?.();
    onOpenChange(false);
    setSalvando(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configurações do Dashboard
          </DialogTitle>
          <DialogDescription>
            Ajuste as metas e o valor de premiação por kg expedido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
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
              className="tabular-nums"
            />
            <p className="text-[10px] text-muted-foreground">Padrão: R$ 0,01 por kg</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" />
              Meta de Premiação (R$)
            </Label>
            <Input
              type="number"
              min={0}
              value={metaPremiacao}
              onChange={e => setMetaPremiacao(e.target.value)}
              placeholder="Ex: 500.00"
              className="tabular-nums"
            />
            <p className="text-[10px] text-muted-foreground">Deixe vazio para não definir meta</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5" />
              Meta de Veículos/Dia
            </Label>
            <Input
              type="number"
              min={1}
              value={metaVeiculos}
              onChange={e => setMetaVeiculos(e.target.value)}
              placeholder="8"
              className="tabular-nums"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={salvando} className="gap-2">
            {salvando ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}