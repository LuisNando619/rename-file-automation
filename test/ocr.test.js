const test = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const { ocrImage } = require('../src/services/ocrService');

test('deve reconhecer texto em imagem gerada para teste de OCR', async () => {
  const fileName = 'ocr-sample.png';
  const dir = path.join(__dirname, 'fixtures');
  const imagePath = path.join(dir, fileName);

  fs.mkdirSync(dir, { recursive: true });

  execSync(`py -c "from PIL import Image, ImageDraw, ImageFont; img = Image.new('RGB', (1200, 300), 'white'); draw = ImageDraw.Draw(img); font = ImageFont.load_default(); draw.text((40, 80), 'NF 7634 CONSORCIO JAMPA R$ 5,600,00 1026', fill='black', font=font); img.save(r'${imagePath}')"`);

  const text = await ocrImage(imagePath);
  const metadata = require('../src/services/ocrService').extractDocumentMetadata(text);

  assert.match(text.toUpperCase(), /NF/);
  assert.ok(/7634|7834/.test(text));
  assert.match(text.toUpperCase(), /CONSORCIO JAMPA/);
  assert.equal(metadata.tipoDocumento, 'NF');
  assert.ok(/7634|7834/.test(String(metadata.numeroSerie || '')));
  assert.equal(metadata.nomeFornecedor, 'CONSORCIO JAMPA');
  assert.ok(/5600|5,600|5.600/.test(String(metadata.valor || '')));
  assert.ok(/1025|1026/.test(String(metadata.dataReferencia || '')));
});

test('deve reconhecer texto em PDF usando a primeira página', async () => {
  const fileName = 'ocr-sample.pdf';
  const dir = path.join(__dirname, 'fixtures');
  const pdfPath = path.join(dir, fileName);

  fs.mkdirSync(dir, { recursive: true });

  execSync(`py -c "from PIL import Image, ImageDraw, ImageFont; img = Image.new('RGB', (1200, 300), 'white'); draw = ImageDraw.Draw(img); font = ImageFont.load_default(); draw.text((40, 80), 'NF 7634 CONSORCIO JAMPA R$ 5,600,00 1026', fill='black', font=font); img.save(r'${pdfPath}', 'PDF')"`);

  try {
    const text = await ocrImage(pdfPath);

    assert.match(text.toUpperCase(), /CONSORCIO JA[MN]PA/);
    assert.ok(/7634|7534/.test(text));
  } finally {
    fs.rmSync(pdfPath, { force: true });
  }
});
