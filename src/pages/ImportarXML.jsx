import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Play, RotateCcw } from 'lucide-react';
import FileDropZone from '@/components/importacao/FileDropZone';
import FileStatusItem from '@/components/importacao/FileStatusItem';
import BatchSummary from '@/components/importacao/BatchSummary';
import { parseNFeXML } from '@/lib/xmlParser';
import { generateNFePDF } from '@/lib/nfePdfGenerator';
import { toast } from 'sonner';

export default function ImportarXML() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileStatuses, setFileStatuses] = useState([]);
  const [processing, setProcessing] = useState(false);
  const queryClient = useQueryClient();

  const updateStatus = (index, patch) => {
    setFileStatuses(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...patch };
      return updated;
    });
  };

  const handleFilesSelected = (files) => {
    setSelectedFiles(files);
    setFileStatuses(files.map(f => ({ name: f.name, status: 'pending' })));
  };

  const handleProcess = async () => {
    if (selectedFiles.length === 0) return;
    setProcessing(true);

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      updateStatus(i, { status: 'processing' });

      try {
        // 1. Read XML
        const xmlText = await file.text();

        // 2. Parse XML
        let nfData;
        try {
          nfData = parseNFeXML(xmlText);
        } catch (parseErr) {
          updateStatus(i, { status: 'invalid', errorMessage: parseErr.message });
          continue;
        }

        // 3. Generate PDF
        const pdfDoc = generateNFePDF(nfData);
        const pdfBlob = pdfDoc.output('blob');

        // 4. Upload PDF
        let pdfUrl = null;
        try {
          const { file_url } = await base44.integrations.Core.UploadFile({ file: pdfBlob });
          pdfUrl = file_url;
        } catch {
          // PDF generated but upload failed — still save NF
        }

        // 5. Save NF to database — check by chave_acesso to prevent duplicates
        if (nfData.chave_acesso) {
          const existing = await base44.entities.NotaFiscal.filter({ chave_acesso: nfData.chave_acesso });
          if (existing && existing.length > 0) {
            updateStatus(i, { status: 'error', errorMessage: 'Nota Fiscal já importada anteriormente.' });
            continue;
          }
        }

        const payload = {
          ...nfData,
          xml_nome_arquivo: file.name,
          status: 'importada',
          ...(pdfUrl ? { arquivo_pdf_url: pdfUrl } : {}),
        };

        // 🚨 DEBUG CRUCIAL: Verificando o que está indo para o banco de dados 🚨
        console.log(`[DEBUG NF-${nfData.numero_nf}] Payload enviado para a base44:`, payload);

        await base44.entities.NotaFiscal.create(payload);

        updateStatus(i, {
          status: 'success',
          nfNumero: nfData.numero_nf,
          emitente: nfData.emitente_nome,
          pdfBlob,
        });

      } catch (err) {
        updateStatus(i, { status: 'error', errorMessage: err.message || 'Erro desconhecido' });
      }
    }

    queryClient.invalidateQueries({ queryKey: ['notas-fiscais'] });
    setProcessing(false);

    const success = fileStatuses.filter(f => f.status === 'success').length;
    toast.success(`Processamento concluído! ${selectedFiles.length} arquivo(s) processado(s).`);
  };

  const handleReset = () => {
    setSelectedFiles([]);
    setFileStatuses([]);
  };

  const isDone = fileStatuses.length > 0 && fileStatuses.every(f =>
    ['success', 'not_found', 'invalid', 'error'].includes(f.status)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar XML de NF-e</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione um ou mais arquivos XML de Nota Fiscal Eletrônica para importar, gerar PDF e vincular automaticamente
        </p>
      </div>

      {/* Upload zone */}
      {fileStatuses.length === 0 && (
        <FileDropZone onFilesSelected={handleFilesSelected} disabled={processing} />
      )}

      {/* File list */}
      {fileStatuses.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              {fileStatuses.length} arquivo(s) selecionado(s)
            </p>
            {!processing && (
              <Button variant="ghost" size="sm" onClick={handleReset} className="gap-2">
                <RotateCcw className="w-3.5 h-3.5" />
                Limpar
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {fileStatuses.map((file, i) => (
              <FileStatusItem key={i} file={file} />
            ))}
          </div>

          {/* Action buttons */}
          {!isDone && (
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleProcess}
                disabled={processing}
                className="gap-2"
              >
                <Play className="w-4 h-4" />
                {processing ? 'Processando...' : 'Importar e Gerar PDFs'}
              </Button>
              {!processing && (
                <Button variant="outline" onClick={handleReset}>
                  Cancelar
                </Button>
              )}
            </div>
          )}

          {/* Summary */}
          {isDone && (
            <div className="space-y-4 pt-2">
              <Separator />
              <p className="text-sm font-semibold">Resumo do Processamento</p>
              <BatchSummary files={fileStatuses} />
              <Button variant="outline" onClick={handleReset} className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Importar Novos Arquivos
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}