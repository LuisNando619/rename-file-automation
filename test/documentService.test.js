const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { saveProcessedFile } = require('../src/services/documentService');

test('preserva a extensão do arquivo ao salvar o documento processado', () => {
  const sourcePath = path.join(__dirname, `upload-${Date.now()}.png`);
  const targetName = `document-test-${Date.now()}`;
  const expectedPath = path.resolve(__dirname, '../processed', `${targetName}.png`);

  fs.writeFileSync(sourcePath, 'test image');

  try {
    const savedPath = saveProcessedFile(sourcePath, targetName);

    assert.equal(savedPath, expectedPath);
    assert.equal(fs.readFileSync(savedPath, 'utf8'), 'test image');
  } finally {
    fs.rmSync(sourcePath, { force: true });
    fs.rmSync(expectedPath, { force: true });
  }
});

test('não sobrescreve arquivos processados com o mesmo nome', () => {
  const firstSource = path.join(__dirname, `upload-first-${Date.now()}.png`);
  const secondSource = path.join(__dirname, `upload-second-${Date.now()}.png`);
  const targetName = `document-duplicate-${Date.now()}`;
  const firstExpectedPath = path.resolve(__dirname, '../processed', `${targetName}.png`);
  const secondExpectedPath = path.resolve(__dirname, '../processed', `${targetName} (2).png`);

  fs.writeFileSync(firstSource, 'first image');
  fs.writeFileSync(secondSource, 'second image');

  try {
    assert.equal(saveProcessedFile(firstSource, targetName), firstExpectedPath);
    assert.equal(saveProcessedFile(secondSource, targetName), secondExpectedPath);
    assert.equal(fs.readFileSync(firstExpectedPath, 'utf8'), 'first image');
    assert.equal(fs.readFileSync(secondExpectedPath, 'utf8'), 'second image');
  } finally {
    fs.rmSync(firstSource, { force: true });
    fs.rmSync(secondSource, { force: true });
    fs.rmSync(firstExpectedPath, { force: true });
    fs.rmSync(secondExpectedPath, { force: true });
  }
});