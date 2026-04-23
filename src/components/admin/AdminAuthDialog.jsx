import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldAlert, Eye, EyeOff } from 'lucide-react';

const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admintor';

export default function AdminAuthDialog({ open, onOpenChange, onAuthorized, title, description }) {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [showPass, setShowPass] = useState(false);

  function handleConfirm() {
    if (usuario === ADMIN_USER && senha === ADMIN_PASS) {
      setErro('');
      setUsuario('');
      setSenha('');
      onAuthorized();
      onOpenChange(false);
    } else {
      setErro('Usuário ou senha incorretos.');
    }
  }

  function handleClose() {
    setUsuario('');
    setSenha('');
    setErro('');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-destructive" />
            </div>
            <DialogTitle>{title || 'Autenticação de Administrador'}</DialogTitle>
          </div>
          <DialogDescription>
            {description || 'Esta ação requer credenciais de administrador.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Usuário
            </Label>
            <Input
              value={usuario}
              onChange={e => { setUsuario(e.target.value); setErro(''); }}
              placeholder="admin"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Senha
            </Label>
            <div className="relative">
              <Input
                type={showPass ? 'text' : 'password'}
                value={senha}
                onChange={e => { setSenha(e.target.value); setErro(''); }}
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {erro && (
            <p className="text-xs text-destructive font-medium">{erro}</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}