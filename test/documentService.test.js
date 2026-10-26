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