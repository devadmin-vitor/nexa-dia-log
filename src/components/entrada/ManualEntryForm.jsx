import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ManualEntryForm({ onAdd }) {
  const [rows, setRows] = useState([{ name: '', volume: '' }]);

  const addRow = () => setRows([...rows, { name: '', volume: '' }]);

  const removeRow = (index) => {
    if (rows.length === 1) return;
    setRows(rows.filter((_, i) => i !== index));
  };

  const updateRow = (index, field, value) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: value };
    setRows(updated);
  };

  const handleSubmit = () => {
    const valid = rows.filter(r => r.name.trim() && parseFloat(r.volume) > 0);
    if (valid.length === 0) return;

    const entries = valid.map(r => ({
      name: r.name.trim(),
      volume_ml: parseFloat(r.volume),
    }));

    onAdd(entries);
    setRows([{ name: '', volume: '' }]);
  };

  const hasValid = rows.some(r => r.name.trim() && parseFloat(r.volume) > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_140px_40px] gap-3 items-end">
        <Label className="text-xs font-medium text-muted-foreground">Produto</Label>
        <Label className="text-xs font-medium text-muted-foreground">Volume (ml)</Label>
        <div />
      </div>

      <AnimatePresence mode="popLayout">
        {rows.map((row, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-[1fr_140px_40px] gap-3 items-center"
          >
            <Input
              placeholder="Nome do produto"
              value={row.name}
              onChange={(e) => updateRow(index, 'name', e.target.value)}
            />
            <Input
              type="number"
              placeholder="0"
              min="0"
              step="0.1"
              value={row.volume}
              onChange={(e) => updateRow(index, 'volume', e.target.value)}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeRow(index)}
              disabled={rows.length === 1}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={addRow} className="gap-2">
          <Plus className="w-4 h-4" />
          Adicionar Linha
        </Button>
        <Button onClick={handleSubmit} disabled={!hasValid} className="gap-2">
          <Plus className="w-4 h-4" />
          Salvar Dados
        </Button>
      </div>
    </div>
  );
}