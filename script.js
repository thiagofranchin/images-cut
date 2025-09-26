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
  rotationLeft: document.getElementById('rotationLeft'),
  rotationRight: document.getElementById('rotationRight'),
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

  const originalCanvas = document.createElement('canvas');
  originalCanvas.width = image.width;
  originalCanvas.height = image.height;
  const originalCtx = originalCanvas.getContext('2d');
  originalCtx.drawImage(image, 0, 0);
  const originalImageData = originalCtx.getImageData(0, 0, image.width, image.height);

  const manualOverlayCanvas = document.createElement('canvas');
  manualOverlayCanvas.width = image.width;
  manualOverlayCanvas.height = image.height;

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
      rotationLeftBtn: card.querySelector('.card-rotation-left'),
      rotationRightBtn: card.querySelector('.card-rotation-right'),
      scaleSlider: card.querySelector('.scale-slider'),
      offsetXSlider: card.querySelector('.offset-x-slider'),
      offsetYSlider: card.querySelector('.offset-y-slider'),
      toleranceSlider: card.querySelector('.tolerance-slider'),
      toolButtons: card.querySelectorAll('.tool-btn'),
      modeButtons: card.querySelectorAll('.mode-btn'),
      toolSizeSlider: card.querySelector('.tool-size-slider'),
      layerWidthInput: card.querySelector('.layer-width'),
      layerHeightInput: card.querySelector('.layer-height'),
      downloadBtn: card.querySelector('.download-btn'),
      toggleBtn: card.querySelector('.toggle-btn'),
      restoreBtn: card.querySelector('.restore-btn')
    },
    originalImageData,
    manualMask: new Int8Array(image.width * image.height),
    manualOverlayCanvas,
    manualOverlayDirty: true,
    manualHasEdits: false,
    manualState: {
      tool: 'wand',
      mode: 'add',
      size: 80,
      tolerance: state.tolerance,
      pointerActive: false,
      rectStart: null,
      rectCurrent: null
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
    rotationLeftBtn,
    rotationRightBtn,
    scaleSlider,
    offsetXSlider,
    offsetYSlider,
    toleranceSlider,
    toolButtons,
    modeButtons,
    toolSizeSlider,
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
  toleranceSlider.value = item.manualState.tolerance;
  toolSizeSlider.value = item.manualState.size;

  rotationSlider.addEventListener('input', () => {
    item.settings.rotation = parseInt(rotationSlider.value, 10);
    updatePreview(item);
  });
  rotationLeftBtn.addEventListener('click', () => {
    item.settings.rotation = normalizeAngle(item.settings.rotation - 90);
    rotationSlider.value = item.settings.rotation;
    updatePreview(item);
  });

  rotationRightBtn.addEventListener('click', () => {
    item.settings.rotation = normalizeAngle(item.settings.rotation + 90);
    rotationSlider.value = item.settings.rotation;
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
    item.manualState.tolerance = parseInt(toleranceSlider.value, 10);
  });

  toolSizeSlider.addEventListener('input', () => {
    item.manualState.size = parseInt(toolSizeSlider.value, 10);
  });

  toolButtons.forEach((button) => {
    button.addEventListener('click', () => {
      toolButtons.forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');
      item.manualState.tool = button.dataset.tool;
      item.manualState.pointerActive = false;
      item.manualState.rectStart = null;
      item.manualState.rectCurrent = null;
      requestAnimationFrame(() => drawOriginalOverlay(item));
    });
  });

  modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      modeButtons.forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');
      item.manualState.mode = button.dataset.mode;
    });
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

  overlayCanvas.addEventListener('pointerdown', (event) => handleManualPointerDown(item, event));
  overlayCanvas.addEventListener('pointermove', (event) => handleManualPointerMove(item, event));
  overlayCanvas.addEventListener('pointerup', (event) => handleManualPointerUp(item, event));
  overlayCanvas.addEventListener('pointerleave', (event) => handleManualPointerUp(item, event));
  overlayCanvas.addEventListener('pointercancel', () => handleManualPointerCancel(item));
  overlayCanvas.addEventListener('lostpointercapture', () => handleManualPointerCancel(item));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeAngle(angle) {
  let result = angle;
  while (result > 180) result -= 360;
  while (result < -180) result += 360;
  return result;
}

function renderCardMode(item) {
  const showOriginal = state.viewMode === 'original' || item.showOriginal;
  item.elements.card.classList.toggle('show-original', showOriginal);
}

function restoreItem(item) {
  item.settings = cloneSettings(item.initialSettings);
  item.elements.rotationSlider.value = item.settings.rotation;
  item.manualState.tool = 'wand';
  item.manualState.mode = 'add';
  item.manualState.tolerance = state.tolerance;
  item.manualState.size = 80;
  item.manualState.pointerActive = false;
  item.manualState.rectStart = null;
  item.manualState.rectCurrent = null;
  item.manualMask.fill(0);
  item.manualHasEdits = false;
  item.manualOverlayDirty = true;
  clearManualOverlayCanvas(item);
  item.elements.toolButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tool === 'wand');
  });
  item.elements.modeButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === 'add');
  });
  item.elements.toleranceSlider.value = item.manualState.tolerance;
  item.elements.toolSizeSlider.value = item.manualState.size;
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

  const processed = getCompositeCanvas(item);
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

  const showOriginal = state.viewMode === 'original' || item.showOriginal;
  if (showOriginal) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.save();
  ctx.translate(canvas.width / 2 + offsetX, canvas.height / 2 + offsetY);
  ctx.rotate((item.settings.rotation * Math.PI) / 180);
  ctx.scale(finalScale, finalScale);
  if (showOriginal) {
    ctx.drawImage(image, -image.width / 2, -image.height / 2);
  }

  const overlay = ensureManualOverlay(item);
  if (overlay) {
    ctx.drawImage(overlay, -image.width / 2, -image.height / 2);
  }

  if (item.manualState.tool === 'object' && item.manualState.rectStart && item.manualState.rectCurrent) {
    const { rectStart, rectCurrent } = item.manualState;
    const x1 = rectStart.x - image.width / 2;
    const y1 = rectStart.y - image.height / 2;
    const x2 = rectCurrent.x - image.width / 2;
    const y2 = rectCurrent.y - image.height / 2;
    const width = x2 - x1;
    const height = y2 - y1;
    ctx.save();
    ctx.setLineDash([12 / finalScale, 8 / finalScale]);
    ctx.lineWidth = 3 / finalScale;
    ctx.strokeStyle = item.manualState.mode === 'add' ? 'rgba(59, 130, 246, 0.8)' : 'rgba(239, 68, 68, 0.8)';
    ctx.strokeRect(x1, y1, width, height);
    ctx.restore();
  }
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

function getCompositeCanvas(item) {
  const base = getMaskCanvas(item);
  if (!item.manualHasEdits) return base;
  const canvas = document.createElement('canvas');
  canvas.width = base.width;
  canvas.height = base.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(base, 0, 0);
  applyManualMask(canvas, item);
  return canvas;
}

function applyManualMask(canvas, item) {
  if (!item.manualMask || !item.originalImageData) return;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const original = item.originalImageData.data;
  const manualMask = item.manualMask;
  let changed = false;

  for (let i = 0; i < manualMask.length; i += 1) {
    const val = manualMask[i];
    if (!val) continue;
    const offset = i * 4;
    if (val === 1) {
      data[offset] = original[offset];
      data[offset + 1] = original[offset + 1];
      data[offset + 2] = original[offset + 2];
      data[offset + 3] = 255;
      changed = true;
    } else if (val === -1) {
      if (data[offset + 3] !== 0) {
        data[offset + 3] = 0;
        changed = true;
      }
    }
  }

  if (changed) {
    ctx.putImageData(imageData, 0, 0);
  }
}

function markManualEdits(item) {
  item.manualHasEdits = true;
  item.manualOverlayDirty = true;
}

function clearManualOverlayCanvas(item) {
  if (!item.manualOverlayCanvas) return;
  const ctx = item.manualOverlayCanvas.getContext('2d');
  ctx.clearRect(0, 0, item.manualOverlayCanvas.width, item.manualOverlayCanvas.height);
}

function ensureManualOverlay(item) {
  if (!item.manualHasEdits) return null;
  if (!item.manualOverlayCanvas) return null;
  if (!item.manualOverlayDirty) return item.manualOverlayCanvas;

  const canvas = item.manualOverlayCanvas;
  const ctx = canvas.getContext('2d');
  const overlayData = ctx.createImageData(canvas.width, canvas.height);
  const data = overlayData.data;
  const mask = item.manualMask;

  for (let i = 0; i < mask.length; i += 1) {
    const val = mask[i];
    if (!val) continue;
    const offset = i * 4;
    if (val === 1) {
      data[offset] = 59;
      data[offset + 1] = 130;
      data[offset + 2] = 246;
      data[offset + 3] = 140;
    } else if (val === -1) {
      data[offset] = 239;
      data[offset + 1] = 68;
      data[offset + 2] = 68;
      data[offset + 3] = 160;
    }
  }

  ctx.putImageData(overlayData, 0, 0);
  item.manualOverlayDirty = false;
  return canvas;
}

function mapCanvasPointToImage(item, canvasX, canvasY) {
  const canvas = item.elements.overlayCanvas;
  const { image } = item;
  if (!image || !canvas.width || !canvas.height) return { x: NaN, y: NaN };
  const baseScale = Math.min(canvas.width / image.width, canvas.height / image.height);
  const finalScale = baseScale * item.settings.scale;
  const offsetX = item.settings.offsetX * canvas.width * 0.4;
  const offsetY = item.settings.offsetY * canvas.height * 0.4;
  const cx = canvas.width / 2 + offsetX;
  const cy = canvas.height / 2 + offsetY;

  const dx = canvasX - cx;
  const dy = canvasY - cy;
  const angle = (-item.settings.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rx = dx * cos - dy * sin;
  const ry = dx * sin + dy * cos;

  const x = rx / finalScale + image.width / 2;
  const y = ry / finalScale + image.height / 2;
  return { x, y };
}

function getPointerImageCoords(item, event) {
  const canvas = item.elements.overlayCanvas;
  const rect = canvas.getBoundingClientRect();
  const canvasX = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const canvasY = ((event.clientY - rect.top) / rect.height) * canvas.height;
  if (Number.isNaN(canvasX) || Number.isNaN(canvasY)) return null;
  if (canvasX < 0 || canvasY < 0 || canvasX > canvas.width || canvasY > canvas.height) return null;
  const { x, y } = mapCanvasPointToImage(item, canvasX, canvasY);
  if (Number.isNaN(x) || Number.isNaN(y)) return null;
  const clampedX = clamp(x, 0, item.image.width - 1);
  const clampedY = clamp(y, 0, item.image.height - 1);
  return { x: clampedX, y: clampedY };
}

function handleManualPointerDown(item, event) {
  if (!item.manualState) return;
  event.preventDefault();
  const coords = getPointerImageCoords(item, event);
  if (!coords) return;
  const tool = item.manualState.tool;

  if (tool === 'wand') {
    applyMagicWand(item, coords.x, coords.y);
    updatePreview(item);
    return;
  }

  item.manualState.pointerActive = true;
  if (tool === 'quick') {
    applyQuickSelection(item, coords.x, coords.y);
    updatePreview(item);
  }

  if (tool === 'object') {
    item.manualState.rectStart = coords;
    item.manualState.rectCurrent = coords;
    requestAnimationFrame(() => drawOriginalOverlay(item));
  }

  event.currentTarget.setPointerCapture(event.pointerId);
}

function handleManualPointerMove(item, event) {
  if (!item.manualState?.pointerActive) return;
  const coords = getPointerImageCoords(item, event);
  if (!coords) return;
  if (item.manualState.tool === 'quick') {
    applyQuickSelection(item, coords.x, coords.y);
    updatePreview(item);
  } else if (item.manualState.tool === 'object') {
    item.manualState.rectCurrent = coords;
    requestAnimationFrame(() => drawOriginalOverlay(item));
  }
}

function handleManualPointerUp(item, event) {
  if (!item.manualState) return;
  if (item.manualState.tool === 'object' && item.manualState.pointerActive) {
    const coords = getPointerImageCoords(item, event);
    if (coords) {
      item.manualState.rectCurrent = coords;
    }
    finalizeObjectSelection(item);
    updatePreview(item);
  }

  if (item.manualState.tool === 'quick' && item.manualState.pointerActive) {
    updatePreview(item);
  }

  item.manualState.pointerActive = false;
  if (event && event.currentTarget?.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
}

function handleManualPointerCancel(item) {
  if (!item.manualState) return;
  item.manualState.pointerActive = false;
  if (item.manualState.tool === 'object') {
    item.manualState.rectStart = null;
    item.manualState.rectCurrent = null;
    requestAnimationFrame(() => drawOriginalOverlay(item));
  }
}

function applyMagicWand(item, x, y) {
  const width = item.image.width;
  const height = item.image.height;
  const px = Math.round(clamp(x, 0, width - 1));
  const py = Math.round(clamp(y, 0, height - 1));
  const idxStart = py * width + px;
  const manualMask = item.manualMask;
  const data = item.originalImageData.data;
  const offsetStart = idxStart * 4;
  const sr = data[offsetStart];
  const sg = data[offsetStart + 1];
  const sb = data[offsetStart + 2];
  const tolerance = item.manualState.tolerance;
  const toleranceSq = tolerance * tolerance * 1.5;
  const targetValue = item.manualState.mode === 'erase' ? -1 : 1;
  const visited = new Uint8Array(width * height);
  const stack = [idxStart];
  let changed = false;

  while (stack.length) {
    const idx = stack.pop();
    if (visited[idx]) continue;
    visited[idx] = 1;
    const offset = idx * 4;
    const dr = data[offset] - sr;
    const dg = data[offset + 1] - sg;
    const db = data[offset + 2] - sb;
    const diff = dr * dr + dg * dg + db * db;
    if (diff > toleranceSq) continue;
    if (manualMask[idx] !== targetValue) {
      manualMask[idx] = targetValue;
      changed = true;
    }
    const ix = idx % width;
    const iy = (idx / width) | 0;
    if (ix > 0) stack.push(idx - 1);
    if (ix < width - 1) stack.push(idx + 1);
    if (iy > 0) stack.push(idx - width);
    if (iy < height - 1) stack.push(idx + width);
  }

  if (changed) {
    markManualEdits(item);
  }
}

function applyQuickSelection(item, x, y) {
  const width = item.image.width;
  const height = item.image.height;
  const cx = Math.round(clamp(x, 0, width - 1));
  const cy = Math.round(clamp(y, 0, height - 1));
  const data = item.originalImageData.data;
  const manualMask = item.manualMask;
  const sampleOffset = (cy * width + cx) * 4;
  const sr = data[sampleOffset];
  const sg = data[sampleOffset + 1];
  const sb = data[sampleOffset + 2];
  const tolerance = item.manualState.tolerance;
  const toleranceSq = tolerance * tolerance * 1.2;
  const radius = Math.max(2, Math.round(item.manualState.size));
  const radiusSq = radius * radius;
  const value = item.manualState.mode === 'erase' ? -1 : 1;
  const xStart = Math.max(0, cx - radius);
  const xEnd = Math.min(width - 1, cx + radius);
  const yStart = Math.max(0, cy - radius);
  const yEnd = Math.min(height - 1, cy + radius);
  let changed = false;

  for (let yy = yStart; yy <= yEnd; yy += 1) {
    const dy = yy - cy;
    for (let xx = xStart; xx <= xEnd; xx += 1) {
      const dx = xx - cx;
      if (dx * dx + dy * dy > radiusSq) continue;
      const idx = yy * width + xx;
      const offset = idx * 4;
      const dr = data[offset] - sr;
      const dg = data[offset + 1] - sg;
      const db = data[offset + 2] - sb;
      const diff = dr * dr + dg * dg + db * db;
      if (diff > toleranceSq) continue;
      if (manualMask[idx] !== value) {
        manualMask[idx] = value;
        changed = true;
      }
    }
  }

  if (changed) {
    markManualEdits(item);
  }
}

function finalizeObjectSelection(item) {
  const { rectStart, rectCurrent } = item.manualState;
  if (!rectStart || !rectCurrent) return;

  const width = item.image.width;
  const height = item.image.height;
  const x1 = clamp(Math.min(rectStart.x, rectCurrent.x), 0, width - 1);
  const x2 = clamp(Math.max(rectStart.x, rectCurrent.x), 0, width - 1);
  const y1 = clamp(Math.min(rectStart.y, rectCurrent.y), 0, height - 1);
  const y2 = clamp(Math.max(rectStart.y, rectCurrent.y), 0, height - 1);
  const manualMask = item.manualMask;
  const value = item.manualState.mode === 'erase' ? -1 : 1;
  let changed = false;

  for (let yy = Math.floor(y1); yy <= Math.ceil(y2); yy += 1) {
    for (let xx = Math.floor(x1); xx <= Math.ceil(x2); xx += 1) {
      const idx = yy * width + xx;
      if (manualMask[idx] !== value) {
        manualMask[idx] = value;
        changed = true;
      }
    }
  }

  if (changed) {
    markManualEdits(item);
  }

  item.manualState.rectStart = null;
  item.manualState.rectCurrent = null;
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

  refineAlpha(imageData, width, height);
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

function refineAlpha(imageData, width, height) {
  const length = width * height;
  const alphaMask = new Uint8Array(length);
  const data = imageData.data;

  for (let i = 0; i < length; i += 1) {
    alphaMask[i] = data[i * 4 + 3] > 0 ? 1 : 0;
  }

  const dilated = new Uint8Array(length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      let found = 0;
      for (let dy = -1; dy <= 1 && !found; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (alphaMask[ny * width + nx]) {
            found = 1;
            break;
          }
        }
      }
      dilated[idx] = found;
    }
  }

  const closed = new Uint8Array(length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      let keep = 1;
      for (let dy = -1; dy <= 1 && keep; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (!dilated[ny * width + nx]) {
            keep = 0;
            break;
          }
        }
      }
      closed[idx] = keep;
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          sum += closed[ny * width + nx];
          count += 1;
        }
      }
      const value = Math.round((sum / count) * 255);
      data[idx * 4 + 3] = value;
    }
  }
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
    item.manualState.tolerance = state.tolerance;
    toleranceSlider.value = item.manualState.tolerance;
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

  dom.rotationLeft.addEventListener('click', () => {
    state.rotation = normalizeAngle(state.rotation - 90);
    dom.rotation.value = state.rotation;
    dom.rotationValue.textContent = `${state.rotation}°`;
  });

  dom.rotationRight.addEventListener('click', () => {
    state.rotation = normalizeAngle(state.rotation + 90);
    dom.rotation.value = state.rotation;
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
