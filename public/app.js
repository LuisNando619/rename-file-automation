const fileInput = document.querySelector('#file-input');
const dropzone = document.querySelector('#dropzone');
const dropzoneTitle = document.querySelector('#dropzone-title');
const dropzoneSubtitle = document.querySelector('#dropzone-subtitle');
const previewWrap = document.querySelector('#preview-wrap');
const previewFrame = document.querySelector('#preview-frame');
const imagePreview = document.querySelector('#image-preview');
const pdfPreview = document.querySelector('#pdf-preview');
const unsupportedPreview = document.querySelector('#unsupported-preview');
const documentViewer = document.querySelector('#document-viewer');
const viewerFileName = document.querySelector('#viewer-file-name');
const viewerImage = document.querySelector('#viewer-image');
const viewerPdf = document.querySelector('#viewer-pdf');
const viewerZoomControls = document.querySelector('#viewer-zoom-controls');
const viewerZoomLevel = document.querySelector('#viewer-zoom-level');
const viewerContent = document.querySelector('#viewer-content');
const viewerCloseButton = document.querySelector('#viewer-close');
const viewerWindowToggle = document.querySelector('#viewer-window-toggle');
const fileName = document.querySelector('#file-name');
const fileSize = document.querySelector('#file-size');
const ocrButton = document.querySelector('#ocr-button');
const ocrButtonLabel = document.querySelector('#ocr-button-label');
const saveButton = document.querySelector('#save-button');
const saveButtonLabel = document.querySelector('#save-button-label');
const renameForm = document.querySelector('#rename-form');
const statusMessage = document.querySelector('#status-message');
const reviewState = document.querySelector('#review-state');
const namePreview = document.querySelector('#name-preview');
const savedResult = document.querySelector('#saved-result');
const savedName = document.querySelector('#saved-name');
const downloadLink = document.querySelector('#download-link');
const recognizedSection = document.querySelector('#recognized-section');
const recognizedText = document.querySelector('#recognized-text');
const themeToggle = document.querySelector('#theme-toggle');
const themeColor = document.querySelector('meta[name="theme-color"]');
let themeFadeTimer = null;

function applyTheme(theme, persist = false) {
  const isDark = theme === 'dark';
  const root = document.documentElement;
  const fadeDuration = 1000;
  const nextTheme = isDark ? 'dark' : 'light';
  const changeTheme = () => {
    root.dataset.theme = nextTheme;
    root.style.setProperty('--theme-fade-duration', `${fadeDuration}ms`);
    themeToggle.checked = isDark;
    themeColor.content = isDark ? '#141d19' : '#f3f5f1';
  };
  const shouldAnimate = root.dataset.theme && root.dataset.theme !== nextTheme;

  if (shouldAnimate && typeof document.startViewTransition === 'function') {
    document.startViewTransition(changeTheme);
  } else if (shouldAnimate) {
    root.classList.add('theme-fading');
    window.clearTimeout(themeFadeTimer);
    changeTheme();
    themeFadeTimer = window.setTimeout(() => root.classList.remove('theme-fading'), fadeDuration + 100);
  } else {
    changeTheme();
  }

  if (persist) {
    try {
      localStorage.setItem('rename-file-theme', isDark ? 'dark' : 'light');
    } catch (error) {
      // Theme still works for this page if storage is unavailable.
    }
  }
}

let initialTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
try {
  initialTheme = localStorage.getItem('rename-file-theme') || initialTheme;
} catch (error) {
  // Use the system preference if storage is unavailable.
}
applyTheme(initialTheme);
themeToggle.addEventListener('change', () => applyTheme(themeToggle.checked ? 'dark' : 'light', true));

let selectedFile = null;
let previewUrl = null;
let isBusy = false;
let imageZoom = 1;
let viewerMaximized = false;

function setImageZoom(zoom) {
  imageZoom = Math.min(4, Math.max(1, zoom));
  viewerImage.style.transform = `scale(${imageZoom})`;
  viewerZoomLevel.textContent = `${Math.round(imageZoom * 100)}%`;
}

function openDocumentViewer() {
  if (!selectedFile || !previewUrl) return;

  const isPdf = selectedFile.name.toLowerCase().endsWith('.pdf');
  viewerFileName.textContent = selectedFile.name;
  viewerImage.hidden = isPdf;
  viewerPdf.hidden = !isPdf;
  viewerZoomControls.hidden = isPdf;
  setImageZoom(1);

  if (isPdf) {
    viewerPdf.src = previewUrl;
  } else {
    viewerImage.src = previewUrl;
  }

  documentViewer.show();
  viewerCloseButton.focus();
}

function formatFileSize(size) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle('is-error', isError);
  statusMessage.hidden = !message;
}

function setBusy(button, busy, labelElement, idleLabel, busyLabel) {
  button.classList.toggle('is-loading', busy);
  button.disabled = busy || !selectedFile;
  labelElement.textContent = busy ? busyLabel : idleLabel;
}

function resetResult() {
  savedResult.hidden = true;
  recognizedSection.hidden = true;
  recognizedText.textContent = '';
  reviewState.textContent = 'AGUARDANDO OCR';
  setStatus('');
}

function showPreview(file) {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  imagePreview.hidden = true;
  pdfPreview.hidden = true;
  unsupportedPreview.hidden = true;

  const extension = file.name.split('.').pop().toLowerCase();
  if (extension === 'pdf') {
    pdfPreview.src = previewUrl;
    pdfPreview.hidden = false;
  } else if (['png', 'jpg', 'jpeg', 'tif', 'tiff', 'bmp'].includes(extension) && file.type.startsWith('image/')) {
    imagePreview.src = previewUrl;
    imagePreview.hidden = false;
  } else {
    unsupportedPreview.hidden = false;
  }

  fileName.textContent = file.name;
  fileSize.textContent = formatFileSize(file.size);
  previewWrap.hidden = false;
  dropzoneTitle.textContent = 'Documento selecionado';
  dropzoneSubtitle.textContent = 'Clique para escolher outro arquivo';
}

function clearFile() {
  if (documentViewer.open) documentViewer.close();
  selectedFile = null;
  fileInput.value = '';
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  imagePreview.removeAttribute('src');
  pdfPreview.removeAttribute('src');
  previewWrap.hidden = true;
  dropzoneTitle.textContent = 'Escolher documento';
  dropzoneSubtitle.textContent = 'ou arraste o arquivo para cá';
  ocrButton.disabled = true;
  saveButton.disabled = true;
  renameForm.reset();
  namePreview.textContent = 'Aguardando dados do documento';
  resetResult();
}

function setSelectedFile(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    setStatus('O arquivo excede o limite de 10 MB.', true);
    return;
  }
  selectedFile = file;
  showPreview(file);
  ocrButton.disabled = false;
  saveButton.disabled = false;
  renameForm.reset();
  namePreview.textContent = 'Preencha os campos para gerar o nome';
  resetResult();
}

async function requestJson(url, formData) {
  const response = await fetch(url, { method: 'POST', body: formData });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || result.message || 'Não foi possível processar o documento.');
  }
  return result;
}

function setMetadata(metadata = {}) {
  for (const [fieldName, value] of Object.entries(metadata)) {
    const field = renameForm.elements.namedItem(fieldName);
    if (field && value != null) {
      const fieldValue = fieldName === 'valor' && /^\d+\.\d{2}$/.test(String(value))
        ? String(value).replace('.', ',')
        : value;
      field.value = fieldValue;
    }
  }
  reviewState.textContent = 'REVISE OS CAMPOS';
  recognizedText.textContent = metadata.textoReconhecido || '';
  recognizedSection.hidden = !metadata.textoReconhecido;
  updateNamePreview();
}

function updateNamePreview() {
  const data = new FormData(renameForm);
  const type = data.get('tipoDocumento');
  const series = String(data.get('numeroSerie') || '').trim();
  const supplier = String(data.get('nomeFornecedor') || '').trim().toUpperCase();
  const rawValue = String(data.get('valor') || '').trim().replace(/^R\$\s*/i, '');
  const reference = String(data.get('dataReferencia') || '').trim();

  if (!type && !series && !supplier && !rawValue && !reference) {
    namePreview.textContent = 'Preencha os campos para gerar o nome';
    return;
  }

  const decimalValue = rawValue.replace(/^(\d+)\.(\d{2})$/, '$1,$2');
  const value = decimalValue.includes(',') ? decimalValue : decimalValue ? `${decimalValue},00` : '...';
  const parts = [type || 'TIPO', series || 'SÉRIE', supplier || 'FORNECEDOR', `R$ ${value}_${reference || 'REF'}`];
  namePreview.textContent = `${parts.join(' - ')}.${selectedFile ? selectedFile.name.split('.').pop().toLowerCase() : 'ext'}`;
}

fileInput.addEventListener('change', () => setSelectedFile(fileInput.files[0]));
document.querySelector('#remove-file').addEventListener('click', clearFile);
previewFrame.addEventListener('click', openDocumentViewer);
previewFrame.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openDocumentViewer();
  }
});
viewerCloseButton.addEventListener('click', () => documentViewer.close());
viewerWindowToggle.addEventListener('click', () => {
  viewerMaximized = !viewerMaximized;
  documentViewer.classList.toggle('is-maximized', viewerMaximized);
  viewerWindowToggle.setAttribute('aria-label', viewerMaximized ? 'Restaurar janela' : 'Maximizar janela');
  viewerWindowToggle.title = viewerMaximized ? 'Restaurar janela' : 'Maximizar janela';
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && documentViewer.open) {
    event.preventDefault();
    documentViewer.close();
  }
});
documentViewer.addEventListener('close', () => {
  viewerMaximized = false;
  documentViewer.classList.remove('is-maximized');
  viewerWindowToggle.setAttribute('aria-label', 'Maximizar janela');
  viewerWindowToggle.title = 'Maximizar janela';
  viewerImage.removeAttribute('src');
  viewerPdf.removeAttribute('src');
});
document.querySelector('#viewer-zoom-in').addEventListener('click', () => setImageZoom(imageZoom + 0.25));
document.querySelector('#viewer-zoom-out').addEventListener('click', () => setImageZoom(imageZoom - 0.25));
document.querySelector('#viewer-fit').addEventListener('click', () => {
  setImageZoom(1);
  viewerContent.scrollTo({ top: 0, left: 0 });
});
renameForm.addEventListener('input', updateNamePreview);
renameForm.addEventListener('change', updateNamePreview);

dropzone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    fileInput.click();
  }
});

for (const eventName of ['dragenter', 'dragover']) {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add('is-dragging');
  });
}
for (const eventName of ['dragleave', 'drop']) {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove('is-dragging');
  });
}
dropzone.addEventListener('drop', (event) => setSelectedFile(event.dataTransfer.files[0]));

ocrButton.addEventListener('click', async () => {
  if (!selectedFile || isBusy) return;
  isBusy = true;
  setBusy(ocrButton, true, ocrButtonLabel, 'Ler documento com OCR', 'Lendo documento...');
  saveButton.disabled = true;
  setStatus('O OCR pode levar alguns segundos.');
  try {
    const payload = new FormData();
    payload.append('file', selectedFile);
    const result = await requestJson('/documents/ocr', payload);
    setMetadata(result.metadata);
    setStatus('Leitura concluída. Confira os dados antes de salvar.');
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    isBusy = false;
    setBusy(ocrButton, false, ocrButtonLabel, 'Ler documento com OCR', 'Lendo documento...');
    saveButton.disabled = !selectedFile;
  }
});

renameForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedFile || isBusy) return;

  if (!renameForm.reportValidity()) return;

  isBusy = true;
  setBusy(saveButton, true, saveButtonLabel, 'Salvar documento renomeado', 'Salvando documento...');
  ocrButton.disabled = true;
  setStatus('');
  try {
    const payload = new FormData(renameForm);
    payload.append('file', selectedFile);
    const result = await requestJson('/documents/rename', payload);
    savedName.textContent = result.newName;
    downloadLink.href = `/processed/${encodeURIComponent(result.newName)}`;
    downloadLink.setAttribute('download', result.newName);
    savedResult.hidden = false;
    reviewState.textContent = 'SALVO';
    setStatus('Documento renomeado e salvo na pasta processed.');
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    isBusy = false;
    setBusy(saveButton, false, saveButtonLabel, 'Salvar documento renomeado', 'Salvando documento...');
    ocrButton.disabled = !selectedFile;
  }
});

window.addEventListener('beforeunload', () => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
});