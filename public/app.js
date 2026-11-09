const fileInput = document.querySelector('#file-input');
const dropzone = document.querySelector('#dropzone');
const fileQueue = document.querySelector('#file-queue');
const queueCount = document.querySelector('#queue-count');
const clearFilesButton = document.querySelector('#clear-files');
const processButton = document.querySelector('#process-button');
const processButtonLabel = document.querySelector('#process-button-label');
const statusMessage = document.querySelector('#status-message');
const progressLabel = document.querySelector('#progress-label');
const progressCount = document.querySelector('#progress-count');
const progressBar = document.querySelector('#batch-progress');
const resultList = document.querySelector('#result-list');
const openOutputButton = document.querySelector('#open-output-button');
const themeToggle = document.querySelector('#theme-toggle');
const themeColor = document.querySelector('meta[name="theme-color"]');

const allowedExtensions = new Set(['pdf', 'png', 'jpg', 'jpeg', 'tif', 'tiff', 'bmp']);
const maxFileSize = 10 * 1024 * 1024;
let jobs = [];
let isProcessing = false;
let nextJobId = 0;
let themeFadeTimer = null;

function applyTheme(theme, persist = false) {
  const isDark = theme === 'dark';
  const root = document.documentElement;
  const nextTheme = isDark ? 'dark' : 'light';
  const changeTheme = () => {
    root.dataset.theme = nextTheme;
    root.style.setProperty('--theme-fade-duration', '1000ms');
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
    themeFadeTimer = window.setTimeout(() => root.classList.remove('theme-fading'), 1100);
  } else {
    changeTheme();
  }

  if (persist) {
    try {
      localStorage.setItem('rename-file-theme', isDark ? 'dark' : 'light');
    } catch (error) {
      console.warn('Não foi possível salvar a preferência de tema.', error);
    }
  }
}

let initialTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
try {
  initialTheme = localStorage.getItem('rename-file-theme') || initialTheme;
} catch (error) {
  console.warn('Não foi possível ler a preferência de tema.', error);
}
applyTheme(initialTheme);
themeToggle.addEventListener('change', () => applyTheme(themeToggle.checked ? 'dark' : 'light', true));

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle('is-error', isError);
  statusMessage.hidden = !message;
}

function formatFileSize(size) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function updateControls() {
  const pendingCount = jobs.filter((job) => job.valid && job.status !== 'Renomeado').length;
  processButton.disabled = isProcessing || pendingCount === 0;
  clearFilesButton.disabled = isProcessing || jobs.length === 0;
  processButtonLabel.textContent = isProcessing
    ? 'Processando documentos...'
    : pendingCount === 0 && jobs.some((job) => job.status === 'Renomeado')
      ? 'Lote processado'
      : 'Processar documentos';
  queueCount.textContent = jobs.length
    ? `${jobs.length} ${jobs.length === 1 ? 'ARQUIVO NA FILA' : 'ARQUIVOS NA FILA'}`
    : 'FILA VAZIA';
}

function renderQueue() {
  fileQueue.replaceChildren();

  for (const job of jobs) {
    const item = document.createElement('li');
    item.className = 'queue-item';

    const details = document.createElement('div');
    details.className = 'queue-file';
    const name = document.createElement('strong');
    name.textContent = job.file.name;
    const info = document.createElement('span');
    info.textContent = `${formatFileSize(job.file.size)} · ${job.status}`;
    details.append(name, info);
    item.append(details);

    if (!isProcessing) {
      const removeButton = document.createElement('button');
      removeButton.className = 'remove-queue-item';
      removeButton.type = 'button';
      removeButton.dataset.removeId = String(job.id);
      removeButton.setAttribute('aria-label', `Remover ${job.file.name}`);
      removeButton.textContent = '×';
      item.append(removeButton);
    }

    fileQueue.append(item);
  }

  updateControls();
}

function renderResults() {
  resultList.replaceChildren();

  if (!jobs.some((job) => job.result || job.error)) {
    const empty = document.createElement('li');
    empty.className = 'empty-result';
    empty.textContent = 'Os resultados aparecerão aqui após o processamento.';
    resultList.append(empty);
    return;
  }

  for (const job of jobs.filter((item) => item.result || item.error)) {
    const item = document.createElement('li');
    item.className = `result-item ${job.result ? 'is-success' : 'is-error'}`;
    const icon = document.createElement('span');
    icon.className = 'result-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = job.result ? '✓' : '!';

    const content = document.createElement('div');
    content.className = 'result-copy';
    const source = document.createElement('span');
    source.className = 'result-source';
    source.textContent = job.file.name;
    const detail = document.createElement('strong');
    detail.textContent = job.result ? job.result.generatedName : job.error;
    content.append(source, detail);
    item.append(icon, content);

    if (job.result) {
      const download = document.createElement('a');
      download.className = 'download-link';
      download.href = `/processed/${encodeURIComponent(job.result.generatedName)}`;
      download.setAttribute('download', job.result.generatedName);
      download.textContent = 'Abrir';
      item.append(download);
    }

    resultList.append(item);
  }
}

function addFiles(fileList) {
  const existing = new Set(jobs.map((job) => `${job.file.name}:${job.file.size}:${job.file.lastModified}`));
  let rejectedCount = 0;

  for (const file of fileList) {
    const identity = `${file.name}:${file.size}:${file.lastModified}`;
    if (existing.has(identity)) continue;
    existing.add(identity);

    const extension = file.name.split('.').pop().toLowerCase();
    const valid = allowedExtensions.has(extension) && file.size <= maxFileSize;
    jobs.push({
      id: nextJobId++,
      file,
      valid,
      status: valid ? 'Pendente' : 'Não suportado',
      error: null,
      result: null,
    });

    if (!valid) rejectedCount += 1;
  }

  fileInput.value = '';
  renderQueue();
  renderResults();
  setStatus(rejectedCount
    ? `${rejectedCount} arquivo(s) não suportado(s): use PDF ou imagem de até 10 MB.`
    : '');
}

async function requestJson(url, formData) {
  const response = await fetch(url, { method: 'POST', body: formData });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || result.message || 'Não foi possível processar o documento.');
  }
  return result;
}

function updateProgress(done, total) {
  progressBar.max = Math.max(total, 1);
  progressBar.value = done;
  progressCount.textContent = `${done} / ${total}`;
  progressLabel.textContent = done === total ? 'Lote concluído' : 'Processando arquivos em sequência';
}

async function processFiles() {
  if (isProcessing) return;

  const pendingJobs = jobs.filter((job) => job.valid && job.status !== 'Renomeado');
  if (!pendingJobs.length) return;

  isProcessing = true;
  setStatus('');
  updateProgress(0, pendingJobs.length);
  renderQueue();

  let completedCount = 0;
  for (const job of pendingJobs) {
    job.status = 'Processando';
    renderQueue();

    try {
      const payload = new FormData();
      payload.append('file', job.file);
      const result = await requestJson('/documents/process', payload);
      job.result = result;
      job.error = null;
      job.status = 'Renomeado';
    } catch (error) {
      job.error = error.message;
      job.status = 'Falha';
    }

    completedCount += 1;
    updateProgress(completedCount, pendingJobs.length);
    renderQueue();
    renderResults();
  }

  isProcessing = false;
  renderQueue();
  const failedInBatch = pendingJobs.filter((job) => job.status === 'Falha').length;
  setStatus(failedInBatch
    ? `Lote concluído: ${pendingJobs.length - failedInBatch} arquivo(s) renomeado(s), ${failedInBatch} com falha. Revise os detalhes nos resultados.`
    : `${pendingJobs.length} arquivo(s) renomeado(s) com sucesso.`);
}

fileInput.addEventListener('change', () => addFiles(fileInput.files));
clearFilesButton.addEventListener('click', () => {
  if (isProcessing) return;
  jobs = [];
  progressBar.value = 0;
  progressBar.max = 1;
  progressCount.textContent = '0 / 0';
  progressLabel.textContent = 'Aguardando documentos';
  setStatus('');
  renderQueue();
  renderResults();
});
fileQueue.addEventListener('click', (event) => {
  const removeButton = event.target.closest('[data-remove-id]');
  if (!removeButton || isProcessing) return;
  jobs = jobs.filter((job) => job.id !== Number(removeButton.dataset.removeId));
  renderQueue();
  renderResults();
});
processButton.addEventListener('click', processFiles);
openOutputButton.addEventListener('click', async () => {
  if (!window.renameFileDesktop) {
    setStatus('A abertura da pasta de saída está disponível no aplicativo desktop.', true);
    return;
  }

  try {
    await window.renameFileDesktop.openOutputFolder();
  } catch (error) {
    setStatus(error.message, true);
  }
});

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
dropzone.addEventListener('drop', (event) => addFiles(event.dataTransfer.files));
