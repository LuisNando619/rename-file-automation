const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');

const { buildDocumentName, saveProcessedFile } = require('../services/documentService');
const { ocrImage, extractDocumentMetadata } = require('../services/ocrService');

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const destination = path.resolve(__dirname, '../../uploads');
      fs.mkdirSync(destination, { recursive: true });
      cb(null, destination);
    },
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const safeName = file.originalname.replace(/\s+/g, '_');
      cb(null, `${timestamp}_${safeName}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp'];

    if (allowedExtensions.includes(extension)) {
      cb(null, true);
      return;
    }

    cb(new Error('Apenas arquivos PDF ou imagens são permitidos.'));
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

router.get('/health', (req, res) => {
  res.status(200).json({ ok: true, message: 'API pronta' });
});

router.post('/rename', upload.single('file'), (req, res) => {
  try {
    const payload = {
      tipoDocumento: req.body?.tipoDocumento || req.body?.tipo || '',
      numeroSerie: req.body?.numeroSerie || req.body?.numero || '',
      nomeFornecedor: req.body?.nomeFornecedor || req.body?.fornecedor || '',
      valor: req.body?.valor || req.body?.valorDocumento || '',
      dataReferencia: req.body?.dataReferencia || req.body?.data || '',
    };

    const generatedName = buildDocumentName(payload);

    if (req.file) {
      const savedPath = saveProcessedFile(req.file.path, generatedName);
      return res.status(200).json({
        message: 'Documento renomeado com sucesso.',
        originalName: req.file.originalname,
        newName: path.basename(savedPath),
        path: savedPath,
      });
    }

    return res.status(200).json({
      message: 'Nome gerado com sucesso.',
      newName: path.basename(savedPath),
    });
  } catch (error) {
    return res.status(400).json({
      message: 'Não foi possível gerar o nome do documento.',
      error: error.message,
    });
  }
});

router.post('/ocr', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Arquivo obrigatório.' });
    }

    const text = await ocrImage(req.file.path);
    const metadata = extractDocumentMetadata(text);

    return res.status(200).json({
      message: 'OCR realizado com sucesso.',
      text,
      metadata,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Erro ao realizar OCR.',
      error: error.message,
    });
  }
});

router.post('/ocr/rename', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Arquivo obrigatório.' });
    }

    const text = await ocrImage(req.file.path);
    const metadata = extractDocumentMetadata(text);

    const payload = {
      tipoDocumento: metadata.tipoDocumento,
      numeroSerie: metadata.numeroSerie,
      nomeFornecedor: metadata.nomeFornecedor,
      valor: metadata.valor,
      dataReferencia: metadata.dataReferencia,
    };

    const generatedName = buildDocumentName(payload);
    const savedPath = saveProcessedFile(req.file.path, generatedName);

    return res.status(200).json({
      message: 'Documento renomeado automaticamente após OCR.',
      text,
      metadata,
      newName: `${generatedName}.pdf`,
      path: savedPath,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Erro ao processar OCR e renomear documento.',
      error: error.message,
    });
  }
});

router.post('/process', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Arquivo obrigatório.' });
    }

    const text = await ocrImage(req.file.path);
    const metadata = extractDocumentMetadata(text);

    const payload = {
      tipoDocumento: metadata.tipoDocumento,
      numeroSerie: metadata.numeroSerie,
      nomeFornecedor: metadata.nomeFornecedor,
      valor: metadata.valor,
      dataReferencia: metadata.dataReferencia,
    };

    const generatedName = buildDocumentName(payload);
    const savedPath = saveProcessedFile(req.file.path, generatedName);

    return res.status(200).json({
      message: 'Processamento completo concluído.',
      text,
      metadata,
      generatedName: path.basename(savedPath),
      path: savedPath,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Erro ao processar documento.',
      error: error.message,
    });
  }
});

module.exports = router;
