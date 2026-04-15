import React, { useRef, useState } from 'react';
import { Upload, FileCode2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function FileDropZone({ onFilesSelected, disabled }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files) => {
    const xmlFiles = Array.from(files).filter(f =>
      f.name.toLowerCase().endsWith('.xml')
    );
    if (xmlFiles.length > 0) onFilesSelected(xmlFiles);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer",
        dragging ? "border-primary bg-accent" : "border-border hover:border-primary/50 hover:bg-muted/50",
        disabled && "opacity-50 pointer-events-none"
      )}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xml"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="flex flex-col items-center gap-3">
        <div className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
          dragging ? "bg-primary" : "bg-accent"
        )}>
          {dragging
            ? <Upload className="w-6 h-6 text-primary-foreground" />
            : <FileCode2 className="w-6 h-6 text-accent-foreground" />
          }
        </div>
        <div>
          <p className="font-semibold text-sm">
            {dragging ? 'Solte os arquivos aqui' : 'Arraste XMLs ou clique para selecionar'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Aceita múltiplos arquivos .xml — NF-e padrão SEFAZ
          </p>
        </div>
      </div>
    </div>
  );
}