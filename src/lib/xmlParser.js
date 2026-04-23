/**
 * Parse NF-e XML and extract relevant data
 */
export function parseNFeXML(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('XML inválido ou mal formatado.');
  }

  // Helper to get text content of a tag (handles namespaces)
  const getText = (parent, ...tags) => {
    if (!parent) return ''; // Trava de segurança essencial
    for (const tag of tags) {
      const el = parent.querySelector(tag) || parent.getElementsByTagName(tag)[0];
      if (el) return el.textContent?.trim() || '';
    }
    return '';
  };

  const infNFe = doc.querySelector('infNFe') || doc.getElementsByTagName('infNFe')[0];
  if (!infNFe) throw new Error('Estrutura de NF-e não encontrada no XML.');

  const ide = infNFe.querySelector('ide') || infNFe.getElementsByTagName('ide')[0];
  const emit = infNFe.querySelector('emit') || infNFe.getElementsByTagName('emit')[0];
  const dest = infNFe.querySelector('dest') || infNFe.getElementsByTagName('dest')[0];
  
  // Captura especificamente o bloco de endereço do destinatário
  const enderDest = dest ? (dest.querySelector('enderDest') || dest.getElementsByTagName('enderDest')[0]) : null;
  
  const total = infNFe.querySelector('total') || infNFe.getElementsByTagName('total')[0];

  const numeroNF = getText(ide, 'nNF');
  if (!numeroNF) throw new Error('Número da NF não encontrado no XML.');

  // Parse items
  const detEls = infNFe.querySelectorAll('det');
  const detArray = detEls.length > 0 ? Array.from(detEls) : Array.from(infNFe.getElementsByTagName('det'));

  const itens = detArray.map((det) => {
    const prod = det.querySelector('prod') || det.getElementsByTagName('prod')[0];
    const descricao = getText(prod, 'xProd');
    
    // Try to extract embalagem from description or xEAN or other fields
    const embalagem = extractEmbalagem(descricao, getText(prod, 'uCom'), getText(prod, 'uTrib'));
    
    const eanRaw = getText(prod, 'cEAN') || getText(prod, 'cEANTrib') || '';
    const ean = (eanRaw && eanRaw.toUpperCase() !== 'SEM GTIN' && eanRaw !== '0') ? eanRaw : '';

    return {
      codigo: getText(prod, 'cProd'),
      ean,
      descricao,
      embalagem,
      unidade: getText(prod, 'uCom') || getText(prod, 'uTrib'),
      quantidade: parseFloat(getText(prod, 'qCom') || getText(prod, 'qTrib') || '0'),
      valor_unitario: parseFloat(getText(prod, 'vUnCom') || getText(prod, 'vUnTrib') || '0'),
      valor_total: parseFloat(getText(prod, 'vProd') || '0'),
    };
  });

  const dataEmissao = getText(ide, 'dhEmi') || getText(ide, 'dEmi');
  const chaveAcesso = infNFe.getAttribute('Id')?.replace('NFe', '') || '';

  // Peso bruto: campo qVol dentro de transp > vol
  const transp = infNFe.querySelector('transp') || infNFe.getElementsByTagName('transp')[0];
  let pesoBruto = 0;
  if (transp) {
    const volEls = transp.querySelectorAll('vol');
    const volArray = volEls.length > 0 ? Array.from(volEls) : Array.from(transp.getElementsByTagName('vol'));
    volArray.forEach(vol => {
      const pb = parseFloat(getText(vol, 'pesoB') || '0');
      pesoBruto += pb;
    });
  }

  return {
    numero_nf: numeroNF,
    serie: getText(ide, 'serie'),
    chave_acesso: chaveAcesso,
    data_emissao: dataEmissao,
    emitente_nome: getText(emit, 'xNome'),
    emitente_cnpj: getText(emit, 'CNPJ'),
    destinatario_nome: getText(dest, 'xNome'),
    destinatario_cnpj: getText(dest, 'CNPJ') || getText(dest, 'CPF'),
    
    // 👇 Busca focada no enderDest 👇
    municipio: getText(enderDest, 'xMun'),
    bairro: getText(enderDest, 'xBairro'),
    // 👆 Busca focada no enderDest 👆

    valor_total: parseFloat(getText(total, 'vNF') || '0'),
    peso_bruto: pesoBruto,
    itens,
  };
}

function extractEmbalagem(descricao, uCom, uTrib) {
  // Common packaging patterns in Brazilian NF descriptions
  const patterns = [
    /\b(CX|CXA|CX\.)\s*[\d,.]*/gi,   // Caixa
    /\b(PCT|PC\.?)\s*[\d,.]*/gi,       // Pacote
    /\b(FD|FDO)\s*[\d,.]*/gi,          // Fardo
    /\b(LT|LTA)\s*[\d,.]*/gi,          // Lata
    /\b(GL|GRF)\s*[\d,.]*/gi,          // Galão/Garrafa
    /\b(SC|SAC)\s*[\d,.]*/gi,          // Saco
    /\b(BD|BDJ|BDO)\s*[\d,.]*/gi,      // Balde
    /\b(KG|KGS)\s*[\d,.]*/gi,          // Kilograma
    /\b(UN|UND|UNID)\s*[\d,.]*/gi,     // Unidade
    /\b(ML|LT)\s*[\d,.]*/gi,           // Mililitros/Litros
    /\bC\/\s*\d+/gi,                    // C/24, C/12 etc
    /\d+\s*X\s*\d+[\w]*/gi,            // 12X500ML etc
    /\d+\s*ML\b/gi,                     // 500ML
    /\d+\s*LT?\b/gi,                    // 1L, 1LT
    /\d+\s*KG\b/gi,                     // 5KG
  ];

  for (const pattern of patterns) {
    const match = descricao?.match(pattern);
    if (match) return match[0].trim();
  }

  // Fallback to unit
  const unit = uCom || uTrib || '';
  if (unit) return unit;
  return '-';
}