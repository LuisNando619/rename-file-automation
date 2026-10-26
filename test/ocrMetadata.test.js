const test = require('node:test');
const assert = require('node:assert/strict');

const { extractDocumentMetadata } = require('../src/services/ocrService');

test('prioriza os campos identificados pelos rótulos da DANFE', () => {
  const text = 'DANFE Documento Auxiliar da Nota Fiscal Eletrônica N° 000175 Série 1 Bling www.bling.com.br Data emissão 07/08/2009 Valor total da nota 230,00';
  const metadata = extractDocumentMetadata(text);

  assert.equal(metadata.tipoDocumento, 'NF');
  assert.equal(metadata.numeroSerie, '175');
  assert.equal(metadata.nomeFornecedor, 'BLING');
  assert.equal(metadata.valor, '230.00');
  assert.equal(metadata.dataReferencia, '0809');
});

test('não usa números sem rótulo como total de uma DANFE', () => {
  const text = 'N° 000175 DANFE Bling 3.09089 629260001 00100000175';
  const metadata = extractDocumentMetadata(text);

  assert.equal(metadata.numeroSerie, '175');
  assert.equal(metadata.nomeFornecedor, 'BLING');
  assert.equal(metadata.valor, null);
});

test('extrai número pontuado, fornecedor e emissão de uma NF-e', () => {
  const text = 'Recebemos de EMPRESA EXEMPLO DE TRANSPORTADORAS os produtos e/ou serviços constantes da Nota Fiscal Eletrônica indicada ao lado. Emissão: 01/07/2021 DestuReme: EMPRESA EXEMPLO DE TRANSPORTADORAS Valor Total: 570,00 NF-e - Nº 000.000.005 DANFE Documento Auxiliar da Nota Fiscal Eletrônica N 000.000.005 SERIE 003 DATA DA EMISSÃO 01/07/2021 Valor total da nota 750,00 Faturas 01/08/2021';
  const metadata = extractDocumentMetadata(text);

  assert.equal(metadata.tipoDocumento, 'NF');
  assert.equal(metadata.numeroSerie, '5');
  assert.equal(metadata.nomeFornecedor, 'EMPRESA EXEMPLO DE TRANSPORTADORAS');
  assert.equal(metadata.dataReferencia, '0721');
});

test('extrai o total quando o OCR lê valor como Vdo', () => {
  const text = 'DANFE Nº 000175 Bling Dera emissão Dionisio de Baco 07/08/2009 Vdo total da nota 0,00 0,00 0,00 1,00 0,00 2 30,00 Transportador';
  const metadata = extractDocumentMetadata(text);

  assert.equal(metadata.numeroSerie, '175');
  assert.equal(metadata.nomeFornecedor, 'BLING');
  assert.equal(metadata.valor, '230.00');
  assert.equal(metadata.dataReferencia, '0809');
});

test('preenche automaticamente os campos da DANFE com ruído de OCR', () => {
  const text = 'N\' 000.200.017 SERIE: 1 DANFE Magasine Vibes Ltd OCR NUMERO NF N" 000.200.017 SERIE: 1 OCR EMITENTE Mngnano Vibor Ltdo Avenida Padre Lzennjoirns OCR DATA EMISSÃO 22 222.222/0001.22 DATADAEMISSÃO 001.30 INOT2O0X1 OCR TOTAL NF 400,00 IPJICFT';
  const metadata = extractDocumentMetadata(text);

  assert.equal(metadata.tipoDocumento, 'NF');
  assert.equal(metadata.numeroSerie, '200017');
  assert.equal(metadata.nomeFornecedor, 'MAGASINE VIBES LTD');
  assert.equal(metadata.valor, '400.00');
  assert.equal(metadata.dataReferencia, null);
});