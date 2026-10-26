const fs = require('fs');
const path = require('path');

const VALID_TYPES = ['BOLETO', 'NF', 'DACTE', 'COMPROVANTE'];

function normalizeDocumentType(value) {
  const type = String(value ?? '').trim().toUpperCase();

  if (!type) {
    throw new Error('O campo tipoDocumento é obrigatório.');
  }

  if (!VALID_TYPES.includes(type)) {
    throw new Error(`tipoDocumento inválido. Valores aceitos: ${VALID_TYPES.join(', ')}`);
  }

  return type;
}

function normalizeSerie(value) {
  const cleaned = String(value ?? '').trim();

  if (!cleaned) {
    throw new Error('O campo numeroSerie é obrigatório.');
  }

  const withoutLeadingZeros = cleaned.replace(/^0+/, '');
  return withoutLeadingZeros || '0';
}

function normalizeFornecedor(value) {
  const cleaned = String(value ?? '').trim();

  if (!cleaned) {
    throw new Error('O campo nomeFornecedor é obrigatório.');
  }

  return cleaned.toUpperCase();
}

function formatValue(value) {
  let normalized = String(value ?? '')
    .replace(/[R$\s]/g, '')
    .trim();

  if (!normalized) {
    throw new Error('O campo valor deve ser um número válido.');
  }

  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  }

  const numericValue = Number(normalized);

  if (Number.isNaN(numericValue)) {
    throw new Error('O campo valor deve ser um número válido.');
  }

  const [integerPart, decimalPart = '00'] = numericValue.toFixed(2).split('.');
  const withThousands = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `${withThousands},${decimalPart}`;
}

function normalizeReferenceDate(value) {
  const raw = String(value ?? '').trim();

  if (!raw) {
    throw new Error('O campo dataReferencia é obrigatório.');
  }

  const cleaned = raw.replace(/[^0-9/\-]/g, '');

  if (/^\d{4}$/.test(cleaned)) {
    return cleaned;
  }

  if (/^\d{2}\/\d{2,4}$/.test(cleaned)) {
    const [month, year] = cleaned.split('/');
    return `${month}${year.slice(-2)}`;
  }

  if (/^\d{2}-\d{2,4}$/.test(cleaned)) {
    const [month, year] = cleaned.split('-');
    return `${month}${year.slice(-2)}`;
  }

  if (/^\d{4}-\d{2}$/.test(cleaned)) {
    const [year, month] = cleaned.split('-');
    return `${month}${year.slice(-2)}`;
  }

  return cleaned.replace(/\D/g, '').slice(-4);
}

function buildDocumentName({ tipoDocumento, numeroSerie, nomeFornecedor, valor, dataReferencia }) {
  const type = normalizeDocumentType(tipoDocumento);
  const series = normalizeSerie(numeroSerie);
  const supplier = normalizeFornecedor(nomeFornecedor);
  const value = formatValue(valor);
  const reference = normalizeReferenceDate(dataReferencia);

  return `${type} - ${series} - ${supplier} - R$ ${value}_${reference}`;
}

function ensureDirectory(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function saveProcessedFile(filePath, targetName) {
  const destinationDir = path.resolve(__dirname, '../../processed');
  ensureDirectory(destinationDir);

  const extension = filePath ? path.extname(filePath) : '.pdf';
  const finalPath = path.join(destinationDir, `${targetName}${extension}`);

  if (filePath && fs.existsSync(filePath)) {
    fs.renameSync(filePath, finalPath);
  }

  return finalPath;
}

module.exports = {
  VALID_TYPES,
  normalizeDocumentType,
  normalizeSerie,
  normalizeFornecedor,
  formatValue,
  normalizeReferenceDate,
  buildDocumentName,
  saveProcessedFile,
};
