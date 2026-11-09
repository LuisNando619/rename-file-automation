const path = require('path');

function getStorageDirectory(directoryName) {
  const root = process.env.DOCUMENT_STORAGE_DIR
    ? path.resolve(process.env.DOCUMENT_STORAGE_DIR)
    : path.resolve(__dirname, '../..');

  return path.join(root, directoryName);
}

module.exports = { getStorageDirectory };
