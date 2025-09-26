const state = {
  items: [],
  ratio: '1:1',
  customWidth: 1200,
  customHeight: 1200,
  rotation: 0,
  tolerance: 30,
  viewMode: 'processed'
};

const dom = {
  fileInput: document.getElementById('fileInput'),
  dropZone: document.getElementById('dropZone'),
  gallery: document.getElementById('gallery'),
  ratioButtons: document.getElementById('ratioButtons'),
  customWidth: document.getElementById('customWidth'),
  customHeight: document.getElementById('customHeight'),
  rotation: document.getElementById('rotation'),
  rotationValue: document.getElementById('rotationValue'),
  tolerance: document.getElementById('tolerance'),
  toleranceValue: document.getElementById('toleranceValue'),
  applySelected: document.getElementById('applySelected'),
  restoreSelected: document.getElementById('restoreSelected'),
  downloadSelected: document.getElementById('downloadSelected'),
  downloadAll: document.getElementById('downloadAll'),
  viewSwitch: document.querySelector('.view-switch'),
  viewButtons: document.querySelectorAll('.view-btn'),
  template: document.getElementById('imageCardTemplate')
};

const ratios = {
  '1:1': [1, 1],
  '4:5': [4, 5],
  '16:9': [16, 9],
  '3:4': [3, 4],
  '5:2': [5, 2]
};

function createId() {
  return `item-${Math.random().toString(36).slice(2, 9)}`;
}

function cloneSettings(settings) {
  return JSON.parse(JSON.stringify(settings));
}

function formatName(name) {
  if (name.length < 32) return name;
  return name.slice(0, 20) + '…' + name.slice(-8);
}

function showEmptyState(show) {
  const existing = dom.gallery.querySelector('.empty-state');
  if (!existing) return;
  existing.style.display = show ? 'flex' : 'none';
}

function loadFiles(files) {
  const imageFiles = Array.from(files).filter((file) => /image\/(png|jpeg|jpg|webp|gif)/.test(file.type));
  if (!imageFiles.length) return;
  showEmptyState(false);

  imageFiles.forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => addImageItem(file, img);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function addImageItem(file, image) {
  const id = createId();
  const initialLayerWidth = state.customWidth;
  const initialLayerHeight = computeHeightFromRatio(state.ratio, state.customWidth, state.customHeight) || state.customHeight;

  const settings = {
    ratio: state.ratio,
    customWidth: state.customWidth,
    customHeight: initialLayerHeight,
    layerWidth: initialLayerWidth,
    layerHeight: initialLayerHeight,
    rotation: state.rotation,
    tolerance: state.tolerance,
    scale: 1,
    offsetX: 0,
    offsetY: 0
  };

  const card = dom.template.content.firstElementChild.cloneNode(true);
  const previewCanvas = card.querySelector('.preview-canvas');
  const overlayCanvas = card.querySelector('.overlay-canvas');

  card.dataset.id = id;
  card.querySelector('[data-filename]').textContent = formatName(file.name);
  card.querySelector('.layer-width').value = initialLayerWidth;
  card.querySelector('.layer-height').value = initialLayerHeight;

  const item = {
    id,
    file,
    name: file.name,
    image,
    settings,
    initialSettings: cloneSettings(settings),
    elements: {
      card,
      previewCanvas,
      overlayCanvas,
      checkbox: card.querySelector('.select-checkbox'),
      rotationSlider: card.querySelector('.rotation-slider'),
      scaleSlider: card.querySelector('.scale-slider'),
      offsetXSlider: card.querySelector('.offset-x-slider'),
      offsetYSlider: card.querySelector('.offset-y-slider'),
      toleranceSlider: card.querySelector('.tolerance-slider'),
      layerWidthInput: card.querySelector('.layer-width'),
      layerHeightInput: card.querySelector('.layer-height'),
      downloadBtn: card.querySelector('.download-btn'),
      toggleBtn: card.querySelector('.toggle-btn'),
      restoreBtn: card.querySelector('.restore-btn')
    }
  };

  bindCardEvents(item);
  state.items.push(item);
  dom.gallery.appendChild(card);
  updatePreview(item);
}

function computeHeightFromRatio(ratio, width, fallbackHeight) {
  if (!ratio || ratio === 'free') return fallbackHeight;
  const [rw, rh] = ratios[ratio];
  return Math.round((width * rh) / rw);
}

function bindCardEvents(item) {
  const {
    rotationSlider,
    scaleSlider,
    offsetXSlider,
    offsetYSlider,
    toleranceSlider,
    layerWidthInput,
    layerHeightInput,
    downloadBtn,
    toggleBtn,
    restoreBtn,
    checkbox
  } = item.elements;

  rotationSlider.value = item.settings.rotation;
  scaleSlider.value = item.settings.scale;
  offsetXSlider.value = item.settings.offsetX;
  offsetYSlider.value = item.settings.offsetY;
  toleranceSlider.value = item.settings.tolerance;

  rotationSlider.addEventListener('input', () => {
    item.settings.rotation = parseInt(rotationSlider.value, 10);
    updatePreview(item);
  });

  scaleSlider.addEventListener('input', () => {
    item.settings.scale = parseFloat(scaleSlider.value);
    updatePreview(item);
  });

  offsetXSlider.addEventListener('input', () => {
    item.settings.offsetX = parseFloat(offsetXSlider.value);
    updatePreview(item);
  });

  offsetYSlider.addEventListener('input', () => {
    item.settings.offsetY = parseFloat(offsetYSlider.value);
    updatePreview(item);
  });

  toleranceSlider.addEventListener('input', () => {
    item.settings.tolerance = parseInt(toleranceSlider.value, 10);
    maskCache.delete(item.image);
    updatePreview(item);
  });

  layerWidthInput.addEventListener('change', () => {
    item.settings.layerWidth = clamp(parseInt(layerWidthInput.value, 10), 200, 4000);
    layerWidthInput.value = item.settings.layerWidth;
    updatePreview(item);
  });

  layerHeightInput.addEventListener('change', () => {
    item.settings.layerHeight = clamp(parseInt(layerHeightInput.value, 10), 200, 4000);
    layerHeightInput.value = item.settings.layerHeight;
    updatePreview(item);
  });

  downloadBtn.addEventListener('click', () => downloadItem(item));

  toggleBtn.addEventListener('click', () => {
    item.showOriginal = !item.showOriginal;
    toggleBtn.textContent = item.showOriginal ? 'Ver processada' : 'Ver original';
    renderCardMode(item);
  });

  restoreBtn.addEventListener('click', () => {
    restoreItem(item);
  });

  checkbox.addEventListener('change', () => {
    item.selected = checkbox.checked;
    item.elements.card.classList.toggle('selected', item.selected);
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function renderCardMode(item) {
  const showOriginal = state.viewMode === 'original' || item.showOriginal;
  item.elements.card.classList.toggle('show-original', showOriginal);
}

function restoreItem(item) {
  item.settings = cloneSettings(item.initialSettings);
  item.elements.rotationSlider.value = item.settings.rotation;
  item.elements.toleranceSlider.value = item.settings.tolerance;
  Object.assign(item.elements.scaleSlider, { value: item.settings.scale });
  Object.assign(item.elements.offsetXSlider, { value: item.settings.offsetX });
  Object.assign(item.elements.offsetYSlider, { value: item.settings.offsetY });
  item.elements.layerWidthInput.value = item.settings.layerWidth;
  item.elements.layerHeightInput.value = item.settings.layerHeight;
  item.showOriginal = false;
  item.elements.toggleBtn.textContent = 'Ver original';
  maskCache.delete(item.image);
  updatePreview(item);
}

async function downloadItem(item) {
  await ensurePreviewUpToDate(item);
  const blob = await canvasToBlob(item.elements.previewCanvas);
  if (blob) {
    saveAs(blob, createDownloadName(item.name));
  }
}

function createDownloadName(name) {
  const base = name.replace(/\.[^.]+$/, '');
  return `${base}-cutpro.png`;
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 1));
}

function ensurePreviewUpToDate(item) {
  return new Promise((resolve) => {
    updatePreview(item, resolve);
  });
}

function updatePreview(item, callback) {
  requestAnimationFrame(() => {
    const { previewCanvas, overlayCanvas } = item.elements;
    const { layerWidth, layerHeight } = item.settings;
    if (!layerWidth || !layerHeight) return;

    previewCanvas.width = layerWidth;
    previewCanvas.height = layerHeight;
    overlayCanvas.width = layerWidth;
    overlayCanvas.height = layerHeight;

    drawProcessedCanvas(item);
    drawOriginalOverlay(item);
    renderCardMode(item);
    if (callback) callback();
  });
}

function drawProcessedCanvas(item) {
  const canvas = item.elements.previewCanvas;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const processed = getMaskCanvas(item);
  const baseScale = Math.min(canvas.width / processed.width, canvas.height / processed.height);
  const finalScale = baseScale * item.settings.scale;
  const offsetX = item.settings.offsetX * canvas.width * 0.4;
  const offsetY = item.settings.offsetY * canvas.height * 0.4;

  ctx.save();
  ctx.translate(canvas.width / 2 + offsetX, canvas.height / 2 + offsetY);
  ctx.rotate((item.settings.rotation * Math.PI) / 180);
  ctx.scale(finalScale, finalScale);
  ctx.drawImage(processed, -processed.width / 2, -processed.height / 2);
  ctx.restore();
}

function drawOriginalOverlay(item) {
  const canvas = item.elements.overlayCanvas;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const { image } = item;
  const baseScale = Math.min(canvas.width / image.width, canvas.height / image.height);
  const finalScale = baseScale * item.settings.scale;
  const offsetX = item.settings.offsetX * canvas.width * 0.4;
  const offsetY = item.settings.offsetY * canvas.height * 0.4;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2 + offsetX, canvas.height / 2 + offsetY);
  ctx.rotate((item.settings.rotation * Math.PI) / 180);
  ctx.scale(finalScale, finalScale);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);
  ctx.restore();
}

const maskCache = new WeakMap();

function getMaskCanvas(item) {
  const cacheKey = `${item.settings.tolerance}|${item.image.src}`;
  let cached = maskCache.get(item.image);
  if (cached && cached.key === cacheKey) {
    return cached.canvas;
  }

  const { image } = item;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  removeBackground(ctx, item.settings.tolerance);

  maskCache.set(item.image, { key: cacheKey, canvas });
  return canvas;
}

function removeBackground(ctx, tolerance) {
  const { width, height } = ctx.canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const visited = new Uint8Array(width * height);
  const queue = [];

  const bgColor = sampleEdgeColor(data, width, height);
  const toleranceSq = tolerance * tolerance * 1.2;

  function tryAdd(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    const offset = idx * 4;
    const dr = data[offset] - bgColor[0];
    const dg = data[offset + 1] - bgColor[1];
    const db = data[offset + 2] - bgColor[2];
    const diff = dr * dr + dg * dg + db * db;
    if (diff <= toleranceSq) {
      visited[idx] = 1;
      queue.push(idx);
    }
  }

  for (let x = 0; x < width; x++) {
    tryAdd(x, 0);
    tryAdd(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    tryAdd(0, y);
    tryAdd(width - 1, y);
  }

  while (queue.length) {
    const idx = queue.shift();
    const offset = idx * 4;
    data[offset + 3] = 0;
    const x = idx % width;
    const y = (idx / width) | 0;
    tryAdd(x + 1, y);
    tryAdd(x - 1, y);
    tryAdd(x, y + 1);
    tryAdd(x, y - 1);
  }

  ctx.putImageData(imageData, 0, 0);
}

function sampleEdgeColor(data, width, height) {
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let count = 0;
  const stepX = Math.max(1, Math.floor(width / 40));
  const stepY = Math.max(1, Math.floor(height / 40));

  for (let x = 0; x < width; x += stepX) {
    const top = (0 * width + x) * 4;
    const bottom = ((height - 1) * width + x) * 4;
    totalR += data[top];
    totalG += data[top + 1];
    totalB += data[top + 2];
    totalR += data[bottom];
    totalG += data[bottom + 1];
    totalB += data[bottom + 2];
    count += 2;
  }

  for (let y = 0; y < height; y += stepY) {
    const left = (y * width + 0) * 4;
    const right = (y * width + (width - 1)) * 4;
    totalR += data[left];
    totalG += data[left + 1];
    totalB += data[left + 2];
    totalR += data[right];
    totalG += data[right + 1];
    totalB += data[right + 2];
    count += 2;
  }

  return [totalR / count || 255, totalG / count || 255, totalB / count || 255];
}

function getSelectedItems() {
  return state.items.filter((item) => item.selected);
}

function applySettingsTo(items) {
  items.forEach((item) => {
    item.settings.ratio = state.ratio;
    item.settings.rotation = state.rotation;
    item.settings.tolerance = state.tolerance;
    item.settings.customWidth = state.customWidth;
    item.settings.customHeight = computeHeightFromRatio(state.ratio, state.customWidth, state.customHeight) || state.customHeight;

    const {
      layerWidthInput,
      layerHeightInput,
      scaleSlider,
      offsetXSlider,
      offsetYSlider,
      rotationSlider,
      toleranceSlider
    } = item.elements;

    if (state.ratio !== 'free') {
      item.settings.layerWidth = state.customWidth;
      item.settings.layerHeight = computeHeightFromRatio(state.ratio, state.customWidth, state.customHeight);
    } else {
      item.settings.layerWidth = state.customWidth;
      item.settings.layerHeight = state.customHeight;
    }

    layerWidthInput.value = item.settings.layerWidth;
    layerHeightInput.value = item.settings.layerHeight;

    scaleSlider.value = item.settings.scale;
    offsetXSlider.value = item.settings.offsetX;
    offsetYSlider.value = item.settings.offsetY;
    rotationSlider.value = item.settings.rotation;
    toleranceSlider.value = item.settings.tolerance;
    maskCache.delete(item.image);

    updatePreview(item);
  });
}

function restoreItems(items) {
  items.forEach((item) => {
    restoreItem(item);
    item.elements.checkbox.checked = false;
    item.selected = false;
  });
}

async function downloadItems(items) {
  if (!items.length) return;
  if (items.length === 1) {
    await downloadItem(items[0]);
    return;
  }

  const zip = new JSZip();
  for (const item of items) {
    await ensurePreviewUpToDate(item);
    const blob = await canvasToBlob(item.elements.previewCanvas);
    if (blob) {
      zip.file(createDownloadName(item.name), blob);
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, 'cutpro-imagens.zip');
}

function initRatioButtons() {
  dom.ratioButtons.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-ratio]');
    if (!button) return;

    dom.ratioButtons.querySelectorAll('.ratio-btn').forEach((btn) => btn.classList.remove('active'));
    button.classList.add('active');
    const ratio = button.dataset.ratio;
    state.ratio = ratio;
    if (ratio !== 'free') {
      const height = computeHeightFromRatio(ratio, state.customWidth, state.customHeight);
      state.customHeight = height;
      dom.customHeight.value = height;
    }
  });
}

function initCustomDimensionInputs() {
  dom.customWidth.addEventListener('change', () => {
    state.customWidth = clamp(parseInt(dom.customWidth.value, 10) || 1200, 200, 4000);
    dom.customWidth.value = state.customWidth;
    if (state.ratio !== 'free') {
      const height = computeHeightFromRatio(state.ratio, state.customWidth, state.customHeight);
      state.customHeight = height;
      dom.customHeight.value = height;
    }
  });

  dom.customHeight.addEventListener('change', () => {
    state.customHeight = clamp(parseInt(dom.customHeight.value, 10) || 1200, 200, 4000);
    dom.customHeight.value = state.customHeight;
    if (state.ratio !== 'free') {
      const height = computeHeightFromRatio(state.ratio, state.customWidth, state.customHeight);
      state.customHeight = height;
      dom.customHeight.value = height;
    }
  });
}

function initGlobalControls() {
  dom.rotation.addEventListener('input', () => {
    state.rotation = parseInt(dom.rotation.value, 10);
    dom.rotationValue.textContent = `${state.rotation}°`;
  });

  dom.tolerance.addEventListener('input', () => {
    state.tolerance = parseInt(dom.tolerance.value, 10);
    dom.toleranceValue.textContent = state.tolerance;
  });

  dom.applySelected.addEventListener('click', () => {
    const selected = getSelectedItems();
    applySettingsTo(selected);
  });

  dom.restoreSelected.addEventListener('click', () => {
    const selected = getSelectedItems();
    restoreItems(selected);
  });

  dom.downloadSelected.addEventListener('click', () => {
    const selected = getSelectedItems();
    downloadItems(selected);
  });

  dom.downloadAll.addEventListener('click', () => {
    downloadItems(state.items);
  });
}

function initDropZone() {
  ['dragenter', 'dragover'].forEach((eventName) => {
    dom.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dom.dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dom.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dom.dropZone.classList.remove('dragover');
    });
  });

  dom.dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files) loadFiles(files);
  });
}

function initFileInput() {
  dom.fileInput.addEventListener('change', () => {
    if (dom.fileInput.files) {
      loadFiles(dom.fileInput.files);
      dom.fileInput.value = '';
    }
  });
}

function initViewSwitch() {
  dom.viewSwitch.addEventListener('click', (event) => {
    const button = event.target.closest('.view-btn');
    if (!button) return;

    dom.viewButtons.forEach((btn) => btn.classList.remove('active'));
    button.classList.add('active');
    state.viewMode = button.dataset.view;
    state.items.forEach((item) => renderCardMode(item));
  });
}

function init() {
  initRatioButtons();
  initCustomDimensionInputs();
  initGlobalControls();
  initDropZone();
  initFileInput();
  initViewSwitch();
}

window.addEventListener('DOMContentLoaded', init);
