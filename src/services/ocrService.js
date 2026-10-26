const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const path = require('path');
const portugueseLanguage = require('@tesseract.js-data/por');

function normalizeOcrText(text) {
  return String(text || '')
    .replace(/\bJAPA\b/gi, 'JAMPA')
    .replace(/\s+/g, ' ')
    .trim();
}

async function convertPdfToImage(filePath) {
  const extension = filePath.toLowerCase().split('.').pop();

  if (extension !== 'pdf') {
    return filePath;
  }

  const { pdf } = await import('pdf-to-img');
  const document = await pdf(filePath, { scale: 5 });

  try {
    return await document.getPage(1);
  } finally {
    await document.destroy();
  }
}

async function ocrImage(filePath) {
  if (!filePath) {
    throw new Error('Arquivo de imagem obrigatório para OCR.');
  }

  const imagePath = await convertPdfToImage(filePath);
  const image = sharp(imagePath);
  const metadata = await image.metadata();
  const targetWidth = metadata.width < 1500 ? Math.min(metadata.width * 3, 3000) : metadata.width;
  const preprocessedImage = await sharp(imagePath)
    .rotate()
    .resize({ width: targetWidth })
    .greyscale()
    .linear(1.5, -64)
    .png()
    .toBuffer();

  const portugueseWorker = await Tesseract.createWorker('por', 1, {
    langPath: portugueseLanguage.langPath,
    gzip: portugueseLanguage.gzip,
  });
  let recognizedText;

  try {
    const { data } = await portugueseWorker.recognize(preprocessedImage);
    recognizedText = normalizeOcrText(data?.text || '');

    if (!/\bDANFE\b/i.test(recognizedText)) {
      return recognizedText;
    }

    const dimensions = await sharp(preprocessedImage).metadata();
    const getRegion = async ({ left, top, width, height }) => {
      const bounds = {
        left: Math.floor(dimensions.width * left),
        top: Math.floor(dimensions.height * top),
        width: Math.max(1, Math.floor(dimensions.width * width)),
        height: Math.max(1, Math.floor(dimensions.height * height)),
      };
      const crop = await sharp(preprocessedImage)
        .extract(bounds)
        .resize({ width: Math.min(bounds.width * 4, 1800) })
        .greyscale()
        .normalize()
        .png()
        .toBuffer();

      const { data: cropData } = await portugueseWorker.recognize(crop);
      return normalizeOcrText(cropData?.text || '');
    };

    const [serialText, issuerText, issueDateText] = await Promise.all([
      getRegion({ left: 0.84, top: 0.02, width: 0.16, height: 0.06 }),
      getRegion({ left: 0, top: 0.098, width: 0.346, height: 0.093 }),
      getRegion({ left: 0.75, top: 0.30, width: 0.25, height: 0.11 }),
    ]);
    await portugueseWorker.setParameters({ tessedit_pageseg_mode: '6' });
    const numericWorker = await Tesseract.createWorker('eng', 1, {
      langPath: path.resolve(__dirname, '../..'),
      gzip: false,
    });

    let totalText;
    try {
      const bounds = {
        left: Math.floor(dimensions.width * 0.827),
        top: Math.floor(dimensions.height * 0.549),
        width: Math.max(1, Math.floor(dimensions.width * 0.173)),
        height: Math.max(1, Math.floor(dimensions.height * 0.071)),
      };
      const crop = await sharp(preprocessedImage)
        .extract(bounds)
        .resize({ width: Math.min(bounds.width * 4, 1800) })
        .greyscale()
        .normalize()
        .png()
        .toBuffer();
      const { data: cropData } = await numericWorker.recognize(crop);
      totalText = normalizeOcrText(cropData?.text || '');
    } finally {
      await numericWorker.terminate();
    }

    return normalizeOcrText(
      `${recognizedText} OCR NUMERO NF ${serialText} OCR EMITENTE ${issuerText} OCR DATA EMISSÃO ${issueDateText} OCR TOTAL NF ${totalText}`,
    );
  } finally {
    await portugueseWorker.terminate();
  }
}

function findMatchByPatterns(text, patterns) {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) {
      return match[1] || match[0];
    }
  }

  return null;
}

function normalizeCurrencyValue(rawValue) {
  const digitsOnly = String(rawValue || '').replace(/\D/g, '');

  if (!digitsOnly) {
    return null;
  }

  if (digitsOnly.length >= 6) {
    const cents = digitsOnly.slice(-2);
    const integer = digitsOnly.slice(0, -2);
    const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${formattedInteger},${cents}`;
  }

  if (digitsOnly.length === 4 || digitsOnly.length === 5) {
    const cents = digitsOnly.slice(-2);
    const integer = digitsOnly.slice(0, -2) || '0';
    const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${formattedInteger},${cents}`;
  }

  return `${digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

function dateReference(day, month, year) {
  const dayNumber = Number(day);
  const monthNumber = Number(month);
  let yearNumber = Number(year);

  if (year.length === 2) {
    yearNumber += 2000;
  }

  if (dayNumber < 1 || dayNumber > 31 || monthNumber < 1 || monthNumber > 12 || yearNumber < 1950 || yearNumber > 2100) {
    return null;
  }

  return `${String(monthNumber).padStart(2, '0')}${String(yearNumber).slice(-2)}`;
}

function extractDateReference(text) {
  const dateMatches = Array.from(text.matchAll(/(\d{2})\s*[/.-]\s*(\d{2})\s*[/.-]\s*(\d{2,4})/g));

  for (const match of dateMatches) {
    const reference = dateReference(match[1], match[2], match[3]);
    if (reference) return reference;
  }

  return null;
}

function extractDanfeAmount(text) {
  const ocrTotal = text.match(/OCR\s+TOTAL\s+NF\s+([\s\S]*?)(?=\s+OCR\s+|$)/i);
  const ocrAmount = ocrTotal && ocrTotal[1].match(/(?:R\$\s*)?(\d{1,3}(?:[.,]\d{3})*[,.]\d{2}|\d+[,.]\d{2})/i);

  if (ocrAmount) {
    return normalizeCurrencyValue(ocrAmount[1]);
  }

  const label = /(?:V(?:ALOR|IDOR|DO|[ÃA]O|C)|WADO)\s+T(?:OTAL|OTE|OW)\s+DA\s+(?:NOT(?:A|S)|NF)/i;
  const labelMatch = label.exec(text);

  if (!labelMatch) {
    return null;
  }

  const afterLabel = text.slice(labelMatch.index + labelMatch[0].length, labelMatch.index + labelMatch[0].length + 160);
  const nextSection = afterLabel.search(/\b(?:TRANSPORTADOR|ITENS\s+DA\s+NOTA\s+FISCAL|C[AÁ]LCULO\s+DO\s+ISSQN)\b/i);
  const valueSection = nextSection < 0 ? afterLabel : afterLabel.slice(0, nextSection);
  const amounts = Array.from(valueSection.matchAll(/(?:R\$\s*)?(\d{1,3}(?:[.,]\d{3})*[,.]\d{2}|\d+[,.]\d{2})/gi));

  if (!amounts.length) {
    return null;
  }

  const lastAmount = amounts[amounts.length - 1];
  const precedingText = valueSection.slice(0, lastAmount.index);
  const splitLeadingDigit = precedingText.match(/(?:^|\s)(\d)\s*$/);
  const rawValue = splitLeadingDigit
    ? `${splitLeadingDigit[1]}${lastAmount[1]}`
    : lastAmount[1];

  return normalizeCurrencyValue(rawValue);
}

function extractDocumentMetadata(text) {
  const rawText = normalizeOcrText(String(text || ''));
  const upperText = rawText.toUpperCase();
  const textNoSpaces = rawText.replace(/\s+/g, '');
  const isDanfe = /\bDANFE\b/i.test(rawText);

  const matchType = isDanfe ? 'NF' : findMatchByPatterns(rawText, [
    /(BOLETO|NF|DACTE|COMPROVANTE)/i,
  ]);

  const typeIndex = matchType ? rawText.toUpperCase().indexOf(String(matchType).toUpperCase()) : -1;
  const danfeSerial = isDanfe
    ? Array.from(rawText.matchAll(/\bN\s*(?:[º°ª'’]|O)?\s*[:.-]?\s*(\d[\d.,/\-\s]{2,20})/gi))
      .map((match) => match[1].replace(/\D/g, ''))
      .find((candidate) => candidate.length >= 4 && candidate.length <= 12) || null
    : null;

  const rawNumberCandidates = Array.from(rawText.matchAll(/\d{4,}/g)).map((item) => item[0]);
  const serialCandidate = rawNumberCandidates.find((candidate) => {
    const index = rawText.indexOf(candidate);
    return index > typeIndex && index < rawText.length;
  }) || rawNumberCandidates[0] || null;

  const matchSerie = serialCandidate && !/^10\d{2}$|^11\d{2}$|^12\d{2}$/.test(serialCandidate)
    ? serialCandidate
    : rawNumberCandidates.find((candidate) => candidate.length >= 4 && candidate.length <= 8 && !/^10\d{2}$|^11\d{2}$|^12\d{2}$/.test(candidate)) || null;

  const nearTypeSerie = typeIndex >= 0
    ? (textNoSpaces.match(new RegExp(`${String(matchType || '').toUpperCase()}(\\d{4,})`, 'i')) || [])[1]
    : null;

  const matchSupplier = findMatchByPatterns(rawText, [
    /RECEBEMOS\s+DE\s+(.+?)\s+OS?\s+PRODUTOS/i,
    /\b([A-ZÀ-Ÿ][A-ZÀ-Ÿa-zà-ÿ0-9&.'-]*(?:\s+[A-ZÀ-Ÿ][A-ZÀ-Ÿa-zà-ÿ0-9&.'-]*){0,3}\s+(?:LTDA|LTD|EPP|ME|S\/A))\b/i,
    /OCR\s+EMITENTE\s+(.+?\b(?:LTDA|LTD[AO]?|EPP|ME|S\/A)\b)/i,
    /\b(BLING)\b/i,
    /(CONSORCIO\s*JAMPA|CONSORCIO\s*JAPA)/i,
    /CONSORCIO\s+[A-ZÀ-Ÿ]+/i,
  ]);
  const supplierName = matchSupplier
    ? String(matchSupplier).replace(/^(?:DANFE|NF-E|NF)\s+/i, '').trim()
    : null;

  const normalizedCurrencyText = rawText.replace(/RS/gi, 'R$');

  const moneyMatch = findMatchByPatterns(normalizedCurrencyText, [
    /R\$\s*([\d\.,]{4,})/i,
    /R\$\s*([\d]{4,8})/i,
  ]);

  const matchValue = isDanfe
    ? extractDanfeAmount(rawText)
    : moneyMatch ? normalizeCurrencyValue(moneyMatch) : findMatchByPatterns(rawText, [
    /R?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:,\d{2})?)/i,
    /(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:,\d{2})?)(?=\s*(?:\d{2}\/\d{2,4}|\d{2}-\d{2,4}|\d{4}))/i,
  ]);

  const ocrEmissionText = isDanfe
    ? (rawText.match(/OCR\s+DATA\s+EMISS[AÃ]O\s+([\s\S]*?)(?=\s+OCR\s+TOTAL\s+NF|$)/i) || [])[1]
    : null;
  const emissionDateLabel = isDanfe
    ? /(?:EMISS[AÃ]O|DATA\s+(?:DA|DE)\s*EMISS[AÃ]O)|D[AO]T[AO]\s+[A-Z=À-Ÿ]{3,12}|D[AE]ST[AE]\s+EM[EÉ]S[AÃ]O|D[AE]R[AE]\s+EMISS[AÃ]O/i.exec(rawText)
    : null;
  const emissionDateText = ocrEmissionText || (emissionDateLabel
    ? rawText.slice(emissionDateLabel.index + emissionDateLabel[0].length, emissionDateLabel.index + emissionDateLabel[0].length + 160)
    : '');
  const emissionDate = extractDateReference(emissionDateText);
  const recipientSection = isDanfe
    ? rawText.match(/DESTINAT[ÁA]RIO\/REMETENTE([\s\S]{0,300})/i)
    : null;
  const recipientDate = recipientSection ? extractDateReference(recipientSection[1]) : null;
  const invoicesIndex = isDanfe ? rawText.search(/FATURAS/i) : -1;
  const dateBeforeInvoices = invoicesIndex >= 0 ? extractDateReference(rawText.slice(0, invoicesIndex)) : null;
  const allDateCandidates = Array.from(rawText.matchAll(/\d{4}/g)).map((item) => item[0]);
  const selectedDate = emissionDate || recipientDate || dateBeforeInvoices;
  const matchDate = selectedDate
    ? selectedDate
    : isDanfe ? null : [...allDateCandidates].reverse().find((candidate) => {
      const value = Number(candidate);
      return value >= 1000 && value <= 1299;
    }) || [...allDateCandidates].reverse().find((candidate) => Number(candidate) >= 1000 && Number(candidate) <= 9999) || null;

  return {
    tipoDocumento: matchType ? String(matchType).toUpperCase() : null,
    numeroSerie: danfeSerial
      ? String(danfeSerial).replace(/^0+/, '') || '0'
      : nearTypeSerie || (matchSerie ? String(matchSerie).replace(/^0+/, '') : null),
    nomeFornecedor: supplierName ? supplierName.toUpperCase() : null,
    valor: matchValue ? String(matchValue).replace(/\./g, '').replace(',', '.') : null,
    dataReferencia: matchDate ? String(matchDate).replace(/\D/g, '').slice(-4) : null,
    textoReconhecido: rawText,
    textoReconhecidoUpper: upperText,
  };
}

function buildNameFromOcr(text) {
  const metadata = extractDocumentMetadata(text);

  return {
    ...metadata,
    generatedName: [
      metadata.tipoDocumento,
      metadata.numeroSerie,
      metadata.nomeFornecedor,
      `R$ ${String(metadata.valor || '0').replace('.', ',')}`,
      metadata.dataReferencia,
    ].filter(Boolean).join(' - '),
  };
}

module.exports = {
  ocrImage,
  extractDocumentMetadata,
  buildNameFromOcr,
};
