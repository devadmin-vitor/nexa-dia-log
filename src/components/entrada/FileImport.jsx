import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function FileImport({ onImport }) {
  const [status, setStatus] = useState('idle'); // idle | uploading | processing | done | error
  const [message, setMessage] = useState('');
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('uploading');
    setMessage('Enviando arquivo...');

    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    setStatus('processing');
    setMessage('Extraindo dados...');

    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: "object",
        properties: {
          products: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Nome do produto" },
                volume_ml: { type: "number", description: "Volume em ml" }
              }
            }
          }
        }
      }
    });

    if (result.status === 'success' && result.output?.products?.length > 0) {
      const entries = result.output.products
        .filter(p => p.name && p.volume_ml > 0)
        .map(p => ({ name: p.name.trim(), volume_ml: parseFloat(p.volume_ml) }));

      if (entries.length > 0) {
        onImport(entries);
        setStatus('done');
        setMessage(`${entries.length} produto(s) importado(s) com sucesso!`);
      } else {
        setStatus('error');
        setMessage('Nenhum produto válido encontrado no arquivo.');
      }
    } else {
      setStatus('error');
      setMessage('Não foi possível extrair dados do arquivo. Verifique o formato.');
    }

    if (fileRef.current) fileRef.current.value = '';
    setTimeout(() => { setStatus('idle'); setMessage(''); }, 4000);
  };

  return (
    <Card className="border-dashed border-2 p-8 text-center relative">
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls,.json"
        onChange={handleFile}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={status === 'uploading' || status === 'processing'}
      />
      <div className="flex flex-col items-center gap-3">
        {status === 'idle' && (
          <>
            <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
              <Upload className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Arraste ou clique para importar</p>
              <p className="text-xs text-muted-foreground mt-1">Formatos aceitos: CSV, Excel (.xlsx), JSON</p>
            </div>
            <Button variant="outline" size="sm" className="gap-2 pointer-events-none">
              <FileSpreadsheet className="w-4 h-4" />
              Selecionar Arquivo
            </Button>
          </>
        )}
        {(status === 'uploading' || status === 'processing') && (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{message}</p>
          </>
        )}
        {status === 'done' && (
          <>
            <CheckCircle2 className="w-8 h-8 text-primary" />
            <p className="text-sm font-medium text-primary">{message}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertCircle className="w-8 h-8 text-destructive" />
            <p className="text-sm text-destructive">{message}</p>
          </>
        )}
      </div>
    </Card>
  );
}