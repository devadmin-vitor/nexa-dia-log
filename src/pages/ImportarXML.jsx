import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Play, RotateCcw, RefreshCw, AlertTriangle } from 'lucide-react';
import FileDropZone from '@/components/importacao/FileDropZone';
import FileStatusItem from '@/components/importacao/FileStatusItem';
import BatchSummary from '@/components/importacao/BatchSummary';
import { parseNFeXML } from '@/lib/xmlParser';
import { generateNFePDF } from '@/lib/nfePdfGenerator';
import { toast } from 'sonner';

// ─── Botão de Toggle Customizado ──────────────────────────────────────────
function ToggleMode({ checked, onChange, label, description }) {
  return (
    <div 
      onClick={() => onChange(!checked)}
      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
        checked 
          ? 'bg-amber-50 border-amber-300 shadow-sm' 
          : 'bg-muted/30 border-border hover:bg-muted/50'
      }`}
    >
      <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
        checked ? 'bg-amber-500 border-amber-500 text-white' : 'border-muted-foreground'
      }`}>
        {checked && <svg viewBox="0 0 14 14" fill="none" className="w-3 h-3"><path d="M3 7.5L5.5 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </div>
      <div>
        <p className={`text-sm font-semibold ${checked ? 'text-amber-900' : 'text-foreground'}`}>{label}</p>
        <p className={`text-xs mt-0.5 ${checked ? 'text-amber-700' : 'text-muted-foreground'}`}>{description}</p>
      </div>
    </div>
  );
}

export default function ImportarXML() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileStatuses, setFileStatuses] = useState([]);
  const [processing, setProcessing] = useState(false);
  
  // NOVO ESTADO: Controla se vamos sobrescrever/atualizar notas existentes
  const [modoAtualizacao, setModoAtualizacao] = useState(false);
  
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

        // 5. Save/Update NF in database
        if (nfData.chave_acesso) {
          const existing = await base44.entities.NotaFiscal.filter({ chave_acesso: nfData.chave_acesso });
          
          if (existing && existing.length > 0) {
            // SE A NOTA JÁ EXISTE NO BANCO:
            if (modoAtualizacao) {
              // MODO ATUALIZAÇÃO ATIVADO: Injeta Município, Bairro e recarrega os itens
              await base44.entities.NotaFiscal.update(existing[0].id, {
                municipio: nfData.municipio,
                bairro: nfData.bairro,
                itens: nfData.itens,
                peso_bruto: nfData.peso_bruto,
                valor_total: nfData.valor_total,
                ...(pdfUrl ? { arquivo_pdf_url: pdfUrl } : {}),
              });
              
              updateStatus(i, {
                status: 'success',
                nfNumero: nfData.numero_nf,
                emitente: nfData.emitente_nome + ' (Atualizada)',
                pdfBlob,
              });
              continue; // Pula a criação, vai para a próxima nota
            } else {
              // MODO PADRÃO: Rejeita a nota duplicada
              updateStatus(i, { status: 'error', errorMessage: 'Nota Fiscal já importada anteriormente.' });
              continue; // Pula a criação, vai para a próxima nota
            }
          }
        }

        // 6. Se a nota não existir (ou não tiver chave de acesso), cria uma nova
        const payload = {
          ...nfData,
          xml_nome_arquivo: file.name,
          status: 'importada',
          ...(pdfUrl ? { arquivo_pdf_url: pdfUrl } : {}),
        };

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

    toast.success(`Processamento concluído! ${selectedFiles.length} arquivo(s) verificado(s).`);
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
          Selecione arquivos XML para importar novas notas ou atualizar informações de notas já cadastradas.
        </p>
      </div>

      {/* Painel de Controle antes de dropar os arquivos */}
      {fileStatuses.length === 0 && (
        <div className="space-y-4">
          <ToggleMode 
            checked={modoAtualizacao} 
            onChange={setModoAtualizacao} 
            label="Modo de Atualização (Sobrescrever Dados Faltantes)"
            description="Se ativado, ao importar um XML de uma nota que já existe no sistema, ele irá atualizar os dados dela (como Município e Bairro) sem duplicá-la. Ideal para consertar notas antigas."
          />
          <FileDropZone onFilesSelected={handleFilesSelected} disabled={processing} />
        </div>
      )}

      {/* File list */}
      {fileStatuses.length > 0 && (
        <div className="space-y-4">
          
          {modoAtualizacao && (
             <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <p><strong>Modo Atualização Ativo:</strong> Notas já cadastradas serão atualizadas com novos dados do XML.</p>
             </div>
          )}

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
                {modoAtualizacao ? <RefreshCw className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {processing ? 'Processando...' : modoAtualizacao ? 'Atualizar Notas' : 'Importar e Gerar PDFs'}
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
                Nova Importação / Atualização
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}