/**
 * PixelKit — Application Coordinator
 * Zero external dependencies. 100% vanilla browser JavaScript.
 */

import {
  formatBytes,
  loadImageFromFile,
  clamp
} from './image-utils.js';
import { ToolsManager } from './tools.js';

class PixelKitApp {
  constructor() {
    this.currentImage = null; // Holds { img, canvas, width, height, format, size, name, objectUrl }
    this.isProcessing = false;

    // Toast element
    this.toastEl = document.getElementById('toastNotice');
    this.toastTimer = null;

    // Initialize Tools Manager
    this.toolsManager = new ToolsManager({
      getSourceImage: () => this.currentImage,
      onStatusChange: (msg) => this.showToast(msg, false),
      onError: (err) => this.showToast(err, true)
    });

    this.initDOM();
    this.bindEvents();
  }

  showToast(message, isError = false) {
    if (!this.toastEl) return;
    clearTimeout(this.toastTimer);

    this.toastEl.textContent = message;
    this.toastEl.className = isError ? 'toast-notice show error' : 'toast-notice show';

    this.toastTimer = setTimeout(() => {
      this.toastEl.className = 'toast-notice';
    }, 3500);
  }

  initDOM() {
    // Top & Upload elements
    this.fileInput = document.getElementById('imageFileInput');
    this.dropzone = document.getElementById('dropzone');
    this.btnUploadHeader = document.getElementById('btnUploadHeader');
    this.imageMetaBar = document.getElementById('imageMetaBar');
    this.imageThumbMini = document.getElementById('imageThumbMini');
    this.imageMetaName = document.getElementById('imageMetaName');
    this.imageMetaDimensions = document.getElementById('imageMetaDimensions');
    this.imageMetaSize = document.getElementById('imageMetaSize');
    this.imageMetaFormat = document.getElementById('imageMetaFormat');
    this.btnRemoveImage = document.getElementById('btnRemoveImage');

    // Tool Tabs
    this.tabButtons = {
      compress: document.getElementById('tabCompress'),
      resize: document.getElementById('tabResize'),
      crop: document.getElementById('tabCrop'),
      convert: document.getElementById('tabConvert'),
      enhance: document.getElementById('tabEnhance')
    };

    this.toolPanels = {
      compress: document.getElementById('panelCompress'),
      resize: document.getElementById('panelResize'),
      crop: document.getElementById('panelCrop'),
      convert: document.getElementById('panelConvert'),
      enhance: document.getElementById('panelEnhance')
    };

    // Compress Elements
    this.btnCompressModeQuality = document.getElementById('btnCompressModeQuality');
    this.btnCompressModeTarget = document.getElementById('btnCompressModeTarget');
    this.compressQualityContainer = document.getElementById('compressQualityContainer');
    this.compressTargetContainer = document.getElementById('compressTargetContainer');
    this.compressQualitySlider = document.getElementById('compressQualitySlider');
    this.compressQualityVal = document.getElementById('compressQualityVal');
    this.compressTargetInput = document.getElementById('compressTargetInput');
    this.compressFormatSelect = document.getElementById('compressFormatSelect');
    this.compressMaxDimSelect = document.getElementById('compressMaxDimSelect');
    this.btnRunCompress = document.getElementById('btnRunCompress');
    this.btnResetCompress = document.getElementById('btnResetCompress');
    this.compressResultCard = document.getElementById('compressResultCard');
    this.compressOriginalSize = document.getElementById('compressOriginalSize');
    this.compressFinalSize = document.getElementById('compressFinalSize');
    this.compressSavingsBadge = document.getElementById('compressSavingsBadge');
    this.compressResultNote = document.getElementById('compressResultNote');
    this.btnDownloadCompress = document.getElementById('btnDownloadCompress');

    // Resize Elements
    this.resizeWidthInput = document.getElementById('resizeWidthInput');
    this.resizeHeightInput = document.getElementById('resizeHeightInput');
    this.btnToggleRatioLock = document.getElementById('btnToggleRatioLock');
    this.ratioLockText = document.getElementById('ratioLockText');
    this.btnRunResize = document.getElementById('btnRunResize');
    this.btnResetResize = document.getElementById('btnResetResize');
    this.resizeResultCard = document.getElementById('resizeResultCard');
    this.resizeOutputDimensions = document.getElementById('resizeOutputDimensions');
    this.resizeResultNote = document.getElementById('resizeResultNote');
    this.btnDownloadResize = document.getElementById('btnDownloadResize');

    // Crop Elements
    this.cropWorkspace = document.getElementById('cropWorkspace');
    this.cropCanvas = document.getElementById('cropCanvas');
    this.cropBox = document.getElementById('cropBox');
    this.btnRunCrop = document.getElementById('btnRunCrop');
    this.btnResetCrop = document.getElementById('btnResetCrop');
    this.cropResultCard = document.getElementById('cropResultCard');
    this.cropOutputDimensions = document.getElementById('cropOutputDimensions');
    this.btnDownloadCrop = document.getElementById('btnDownloadCrop');
    this.btnNudgeUp = document.getElementById('btnNudgeUp');
    this.btnNudgeDown = document.getElementById('btnNudgeDown');
    this.btnNudgeLeft = document.getElementById('btnNudgeLeft');
    this.btnNudgeRight = document.getElementById('btnNudgeRight');
    this.btnCenterCrop = document.getElementById('btnCenterCrop');

    // Convert Elements
    this.convertTargetFormatSelect = document.getElementById('convertTargetFormatSelect');
    this.convertBgColorGroup = document.getElementById('convertBgColorGroup');
    this.convertBgColorInput = document.getElementById('convertBgColorInput');
    this.convertBgColorHex = document.getElementById('convertBgColorHex');
    this.btnRunConvert = document.getElementById('btnRunConvert');
    this.convertResultCard = document.getElementById('convertResultCard');
    this.convertOutputSpecs = document.getElementById('convertOutputSpecs');
    this.btnDownloadConvert = document.getElementById('btnDownloadConvert');

    // Enhance Elements
    this.enhancerPreviewCanvas = document.getElementById('enhancerPreviewCanvas');
    this.enhanceBrightnessSlider = document.getElementById('enhanceBrightnessSlider');
    this.enhanceBrightnessVal = document.getElementById('enhanceBrightnessVal');
    this.enhanceContrastSlider = document.getElementById('enhanceContrastSlider');
    this.enhanceContrastVal = document.getElementById('enhanceContrastVal');
    this.enhanceSaturationSlider = document.getElementById('enhanceSaturationSlider');
    this.enhanceSaturationVal = document.getElementById('enhanceSaturationVal');
    this.enhanceSharpnessSlider = document.getElementById('enhanceSharpnessSlider');
    this.enhanceSharpnessVal = document.getElementById('enhanceSharpnessVal');
    this.btnRunEnhance = document.getElementById('btnRunEnhance');
    this.btnResetEnhance = document.getElementById('btnResetEnhance');
  }

  bindEvents() {
    // 1. File Upload Bindings
    if (this.dropzone) {
      this.dropzone.addEventListener('click', () => this.fileInput.click());
      this.dropzone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.fileInput.click();
        }
      });

      // Drag & Drop
      ['dragenter', 'dragover'].forEach(name => {
        this.dropzone.addEventListener(name, (e) => {
          e.preventDefault();
          this.dropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(name => {
        this.dropzone.addEventListener(name, (e) => {
          e.preventDefault();
          this.dropzone.classList.remove('dragover');
        });
      });

      this.dropzone.addEventListener('drop', (e) => {
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          this.handleFileSelected(files[0]);
        }
      });
    }

    if (this.fileInput) {
      this.fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
          this.handleFileSelected(files[0]);
        }
      });
    }

    if (this.btnUploadHeader) {
      this.btnUploadHeader.addEventListener('click', () => this.fileInput.click());
    }

    if (this.btnRemoveImage) {
      this.btnRemoveImage.addEventListener('click', () => this.resetImageState());
    }

    // 2. Tab Navigation
    Object.keys(this.tabButtons).forEach(toolKey => {
      const btn = this.tabButtons[toolKey];
      if (btn) {
        btn.addEventListener('click', () => this.switchTool(toolKey));
      }
    });

    // 3. Compress Tool Controls
    this.bindCompressEvents();

    // 4. Resize Tool Controls
    this.bindResizeEvents();

    // 5. Crop Tool Controls
    this.bindCropEvents();

    // 6. Convert Tool Controls
    this.bindConvertEvents();

    // 7. Enhance Tool Controls
    this.bindEnhanceEvents();

    // 8. FAQ Accordions
    document.querySelectorAll('.faq-question').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        const isOpen = item.classList.contains('open');
        // Toggle this item
        item.classList.toggle('open', !isOpen);
        btn.setAttribute('aria-expanded', String(!isOpen));
      });
    });
  }

  // ==========================================
  // File Handling
  // ==========================================

  async handleFileSelected(file) {
    if (!file) return;

    this.showToast('Loading and decoding image...', false);

    try {
      // Clear previous image resources
      if (this.currentImage?.objectUrl) {
        URL.revokeObjectURL(this.currentImage.objectUrl);
      }

      const imgData = await loadImageFromFile(file);
      this.currentImage = imgData;

      // Update UI Header bar
      if (this.imageMetaBar) this.imageMetaBar.style.display = 'flex';
      if (this.imageThumbMini) this.imageThumbMini.src = imgData.objectUrl;
      if (this.imageMetaName) this.imageMetaName.textContent = imgData.name;
      if (this.imageMetaDimensions) this.imageMetaDimensions.textContent = `${imgData.width} × ${imgData.height} px`;
      if (this.imageMetaSize) this.imageMetaSize.textContent = formatBytes(imgData.size);
      if (this.imageMetaFormat) {
        const ext = imgData.name.split('.').pop().toUpperCase();
        this.imageMetaFormat.textContent = ext || 'IMG';
      }

      // Notify tools manager
      this.toolsManager.onNewImageLoaded();

      // Sync tool form fields
      this.syncToolInputs();

      // Render crop canvas
      this.renderCropCanvas();

      // Render enhance preview canvas
      this.renderEnhancePreview();

      this.showToast('Image ready for editing.', false);

      // Scroll smoothly to tools section if not in view
      const toolsEl = document.getElementById('tools');
      if (toolsEl) {
        toolsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (err) {
      this.showToast(err.message, true);
    } finally {
      // Reset input value so re-selecting the exact same file fires 'change' event
      if (this.fileInput) this.fileInput.value = '';
    }
  }

  resetImageState() {
    if (this.currentImage?.objectUrl) {
      URL.revokeObjectURL(this.currentImage.objectUrl);
    }
    this.currentImage = null;

    if (this.imageMetaBar) this.imageMetaBar.style.display = 'none';
    if (this.compressResultCard) this.compressResultCard.style.display = 'none';
    if (this.resizeResultCard) this.resizeResultCard.style.display = 'none';
    if (this.cropResultCard) this.cropResultCard.style.display = 'none';
    if (this.convertResultCard) this.convertResultCard.style.display = 'none';

    // Clear canvases
    if (this.cropCanvas) {
      const ctx = this.cropCanvas.getContext('2d');
      ctx?.clearRect(0, 0, this.cropCanvas.width, this.cropCanvas.height);
    }
    if (this.enhancerPreviewCanvas) {
      const ctx = this.enhancerPreviewCanvas.getContext('2d');
      ctx?.clearRect(0, 0, this.enhancerPreviewCanvas.width, this.enhancerPreviewCanvas.height);
    }

    this.showToast('Image cleared. Select a new photo to begin.', false);
  }

  switchTool(toolKey) {
    Object.keys(this.tabButtons).forEach(k => {
      const btn = this.tabButtons[k];
      const panel = this.toolPanels[k];
      const isActive = k === toolKey;

      if (btn) {
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', String(isActive));
      }
      if (panel) {
        panel.classList.toggle('active', isActive);
      }
    });

    this.toolsManager.activeTool = toolKey;

    if (toolKey === 'crop' && this.currentImage) {
      // Refresh crop box coordinates
      setTimeout(() => this.renderCropCanvas(), 20);
    } else if (toolKey === 'enhance' && this.currentImage) {
      setTimeout(() => this.renderEnhancePreview(), 20);
    }
  }

  syncToolInputs() {
    if (!this.currentImage) return;

    // Resizer inputs
    if (this.resizeWidthInput) this.resizeWidthInput.value = this.currentImage.width;
    if (this.resizeHeightInput) this.resizeHeightInput.value = this.currentImage.height;

    // Converter options
    if (this.convertBgColorGroup) {
      const isPng = this.currentImage.format === 'image/png';
      this.convertBgColorGroup.style.display = isPng ? 'flex' : 'none';
    }
  }

  // ==========================================
  // Compress Events
  // ==========================================

  bindCompressEvents() {
    // Mode toggle
    this.btnCompressModeQuality?.addEventListener('click', () => {
      this.toolsManager.compressState.mode = 'quality';
      this.btnCompressModeQuality.classList.add('active');
      this.btnCompressModeTarget.classList.remove('active');
      this.compressQualityContainer.style.display = 'flex';
      this.compressTargetContainer.style.display = 'none';
    });

    this.btnCompressModeTarget?.addEventListener('click', () => {
      this.toolsManager.compressState.mode = 'target';
      this.btnCompressModeTarget.classList.add('active');
      this.btnCompressModeQuality.classList.remove('active');
      this.compressQualityContainer.style.display = 'none';
      this.compressTargetContainer.style.display = 'flex';
    });

    // Quality slider
    this.compressQualitySlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.toolsManager.compressState.quality = val;
      if (this.compressQualityVal) this.compressQualityVal.textContent = `${val}%`;
    });

    // Target size input
    this.compressTargetInput?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (val && val > 0) {
        this.toolsManager.compressState.targetSizeKb = val;
      }
    });

    // Quick target size buttons
    document.querySelectorAll('.quick-target-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.quick-target-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const kb = parseInt(btn.dataset.kb, 10);
        this.toolsManager.compressState.targetSizeKb = kb;
        if (this.compressTargetInput) this.compressTargetInput.value = kb;
      });
    });

    // Format select
    this.compressFormatSelect?.addEventListener('change', (e) => {
      this.toolsManager.compressState.format = e.target.value;
    });

    // Max dimension select
    this.compressMaxDimSelect?.addEventListener('change', (e) => {
      this.toolsManager.compressState.maxDimension = e.target.value;
    });

    // Compress run button
    this.btnRunCompress?.addEventListener('click', async () => {
      if (!this.currentImage) {
        this.showToast('Please select an image first.', true);
        return;
      }
      this.btnRunCompress.disabled = true;
      const res = await this.toolsManager.processCompress();
      this.btnRunCompress.disabled = false;

      if (res && this.compressResultCard) {
        this.compressResultCard.style.display = 'flex';
        this.compressOriginalSize.textContent = formatBytes(res.originalSize);
        this.compressFinalSize.textContent = formatBytes(res.size);

        if (res.reductionPercent > 0) {
          this.compressSavingsBadge.className = 'savings-tag positive';
          this.compressSavingsBadge.textContent = `-${res.reductionPercent}% smaller`;
        } else {
          this.compressSavingsBadge.className = 'savings-tag negative';
          this.compressSavingsBadge.textContent = `+${Math.abs(res.reductionPercent)}% larger`;
        }

        this.compressResultNote.textContent = res.message || 'Output generated safely.';
      }
    });

    // Reset button
    this.btnResetCompress?.addEventListener('click', () => {
      this.toolsManager.compressState.quality = 80;
      if (this.compressQualitySlider) this.compressQualitySlider.value = 80;
      if (this.compressQualityVal) this.compressQualityVal.textContent = '80%';
      if (this.compressResultCard) this.compressResultCard.style.display = 'none';
      this.showToast('Compress settings reset.', false);
    });

    // Download button
    this.btnDownloadCompress?.addEventListener('click', () => {
      this.toolsManager.downloadCompressResult();
    });
  }

  // ==========================================
  // Resize Events
  // ==========================================

  bindResizeEvents() {
    this.resizeWidthInput?.addEventListener('input', (e) => {
      this.toolsManager.setResizeWidth(e.target.value);
      if (this.toolsManager.resizeState.lockRatio && this.resizeHeightInput) {
        this.resizeHeightInput.value = this.toolsManager.resizeState.height;
      }
    });

    this.resizeHeightInput?.addEventListener('input', (e) => {
      this.toolsManager.setResizeHeight(e.target.value);
      if (this.toolsManager.resizeState.lockRatio && this.resizeWidthInput) {
        this.resizeWidthInput.value = this.toolsManager.resizeState.width;
      }
    });

    this.btnToggleRatioLock?.addEventListener('click', () => {
      const newState = !this.toolsManager.resizeState.lockRatio;
      this.toolsManager.resizeState.lockRatio = newState;
      if (this.ratioLockText) {
        this.ratioLockText.textContent = newState ? 'Aspect Ratio: Locked' : 'Aspect Ratio: Unlocked';
      }
      this.btnToggleRatioLock.classList.toggle('btn-primary', newState);
      this.btnToggleRatioLock.classList.toggle('btn-secondary', !newState);
    });

    // Percent buttons
    document.querySelectorAll('.resize-percent-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.resize-percent-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const p = parseInt(btn.dataset.percent, 10);
        this.toolsManager.setResizePercent(p);
        if (this.resizeWidthInput) this.resizeWidthInput.value = this.toolsManager.resizeState.width;
        if (this.resizeHeightInput) this.resizeHeightInput.value = this.toolsManager.resizeState.height;
      });
    });

    // Preset buttons
    document.querySelectorAll('.resize-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = parseInt(btn.dataset.w, 10);
        const h = parseInt(btn.dataset.h, 10);
        this.toolsManager.resizeState.width = w;
        this.toolsManager.resizeState.height = h;
        if (this.resizeWidthInput) this.resizeWidthInput.value = w;
        if (this.resizeHeightInput) this.resizeHeightInput.value = h;
      });
    });

    this.btnRunResize?.addEventListener('click', async () => {
      if (!this.currentImage) {
        this.showToast('Please select an image first.', true);
        return;
      }
      this.btnRunResize.disabled = true;
      const res = await this.toolsManager.processResize();
      this.btnRunResize.disabled = false;

      if (res && this.resizeResultCard) {
        this.resizeResultCard.style.display = 'flex';
        this.resizeOutputDimensions.textContent = `${res.width} × ${res.height} px · ${formatBytes(res.size)}`;
      }
    });

    this.btnResetResize?.addEventListener('click', () => {
      if (!this.currentImage) return;
      this.toolsManager.resizeState.width = this.currentImage.width;
      this.toolsManager.resizeState.height = this.currentImage.height;
      if (this.resizeWidthInput) this.resizeWidthInput.value = this.currentImage.width;
      if (this.resizeHeightInput) this.resizeHeightInput.value = this.currentImage.height;
      if (this.resizeResultCard) this.resizeResultCard.style.display = 'none';
      this.showToast('Dimensions reset to original.', false);
    });

    this.btnDownloadResize?.addEventListener('click', () => {
      this.toolsManager.downloadResizeResult();
    });
  }

  // ==========================================
  // Crop Events & Interactive Overlay
  // ==========================================

  bindCropEvents() {
    // Ratio buttons
    document.querySelectorAll('.crop-ratio-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.crop-ratio-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const ratio = btn.dataset.ratio;
        this.toolsManager.setCropRatio(ratio);
        this.updateCropBoxDOM();
      });
    });

    // Pointer / Touch crop dragging
    const onDragStart = (e, mode) => {
      if (!this.currentImage) return;
      e.preventDefault();

      const point = e.touches ? e.touches[0] : e;
      this.toolsManager.cropState.isDragging = true;
      this.toolsManager.cropState.dragMode = mode;
      this.toolsManager.cropState.dragStart = { x: point.clientX, y: point.clientY };
      this.toolsManager.cropState.initialRect = {
        x: this.toolsManager.cropState.cropX,
        y: this.toolsManager.cropState.cropY,
        w: this.toolsManager.cropState.cropWidth,
        h: this.toolsManager.cropState.cropHeight
      };

      window.addEventListener('mousemove', onDragMove);
      window.addEventListener('mouseup', onDragEnd);
      window.addEventListener('touchmove', onDragMove, { passive: false });
      window.addEventListener('touchend', onDragEnd);
      window.addEventListener('touchcancel', onDragEnd);
    };

    const onDragMove = (e) => {
      if (!this.toolsManager.cropState.isDragging || !this.currentImage) return;
      e.preventDefault();

      const point = e.touches ? e.touches[0] : e;
      const scale = this.toolsManager.cropState.previewScale || 1;

      // Delta in real image coordinates
      const dx = (point.clientX - this.toolsManager.cropState.dragStart.x) / scale;
      const dy = (point.clientY - this.toolsManager.cropState.dragStart.y) / scale;

      this.toolsManager.updateCropRect(dx, dy, this.toolsManager.cropState.dragMode);
      this.updateCropBoxDOM();
    };

    const onDragEnd = () => {
      this.toolsManager.cropState.isDragging = false;
      window.removeEventListener('mousemove', onDragMove);
      window.removeEventListener('mouseup', onDragEnd);
      window.removeEventListener('touchmove', onDragMove);
      window.removeEventListener('touchend', onDragEnd);
      window.removeEventListener('touchcancel', onDragEnd);
    };

    // Bind crop box center drag
    this.cropBox?.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('crop-handle')) return;
      onDragStart(e, 'move');
    });
    this.cropBox?.addEventListener('touchstart', (e) => {
      if (e.target.classList.contains('crop-handle')) return;
      onDragStart(e, 'move');
    }, { passive: false });

    // Bind corner handles
    document.querySelectorAll('.crop-handle').forEach(handle => {
      const handleMode = handle.dataset.handle;
      handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        onDragStart(e, handleMode);
      });
      handle.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        onDragStart(e, handleMode);
      }, { passive: false });
    });

    // Touch Nudge buttons
    const nudge = (dx, dy) => {
      if (!this.currentImage) return;
      const s = this.toolsManager.cropState;
      s.cropX = clamp(s.cropX + dx, 0, this.currentImage.width - s.cropWidth);
      s.cropY = clamp(s.cropY + dy, 0, this.currentImage.height - s.cropHeight);
      this.updateCropBoxDOM();
    };

    this.btnNudgeUp?.addEventListener('click', () => nudge(0, -10));
    this.btnNudgeDown?.addEventListener('click', () => nudge(0, 10));
    this.btnNudgeLeft?.addEventListener('click', () => nudge(-10, 0));
    this.btnNudgeRight?.addEventListener('click', () => nudge(10, 0));

    this.btnCenterCrop?.addEventListener('click', () => {
      if (!this.currentImage) return;
      const s = this.toolsManager.cropState;
      s.cropX = Math.round((this.currentImage.width - s.cropWidth) / 2);
      s.cropY = Math.round((this.currentImage.height - s.cropHeight) / 2);
      this.updateCropBoxDOM();
    });

    this.btnRunCrop?.addEventListener('click', async () => {
      if (!this.currentImage) {
        this.showToast('Please select an image first.', true);
        return;
      }
      this.btnRunCrop.disabled = true;
      const res = await this.toolsManager.processCrop();
      this.btnRunCrop.disabled = false;

      if (res && this.cropResultCard) {
        this.cropResultCard.style.display = 'flex';
        this.cropOutputDimensions.textContent = `${res.width} × ${res.height} px · ${formatBytes(res.size)}`;
      }
    });

    this.btnResetCrop?.addEventListener('click', () => {
      if (!this.currentImage) return;
      this.toolsManager.initCropRect(this.currentImage.width, this.currentImage.height, this.toolsManager.cropState.ratio);
      this.updateCropBoxDOM();
      if (this.cropResultCard) this.cropResultCard.style.display = 'none';
      this.showToast('Crop area reset.', false);
    });

    this.btnDownloadCrop?.addEventListener('click', () => {
      this.toolsManager.downloadCropResult();
    });
  }

  renderCropCanvas() {
    if (!this.currentImage || !this.cropCanvas) return;

    const ctx = this.cropCanvas.getContext('2d');
    if (!ctx) return;

    // Set display canvas dimensions
    const containerW = this.cropWorkspace ? this.cropWorkspace.clientWidth : 600;
    const maxH = 460;

    let displayW = this.currentImage.width;
    let displayH = this.currentImage.height;

    const scaleW = containerW / displayW;
    const scaleH = maxH / displayH;
    const scale = Math.min(scaleW, scaleH, 1.0);

    displayW = Math.round(displayW * scale);
    displayH = Math.round(displayH * scale);

    this.cropCanvas.width = displayW;
    this.cropCanvas.height = displayH;
    this.toolsManager.cropState.previewScale = scale;

    ctx.drawImage(this.currentImage.canvas, 0, 0, displayW, displayH);
    this.updateCropBoxDOM();
  }

  updateCropBoxDOM() {
    if (!this.cropBox || !this.currentImage) return;

    const s = this.toolsManager.cropState;
    const scale = s.previewScale || 1;

    // Crop box offset relative to cropCanvas
    const canvasRect = this.cropCanvas.getBoundingClientRect();
    const workspaceRect = this.cropWorkspace.getBoundingClientRect();

    const canvasLeft = canvasRect.left - workspaceRect.left;
    const canvasTop = canvasRect.top - workspaceRect.top;

    const left = canvasLeft + s.cropX * scale;
    const top = canvasTop + s.cropY * scale;
    const width = s.cropWidth * scale;
    const height = s.cropHeight * scale;

    this.cropBox.style.left = `${Math.round(left)}px`;
    this.cropBox.style.top = `${Math.round(top)}px`;
    this.cropBox.style.width = `${Math.round(width)}px`;
    this.cropBox.style.height = `${Math.round(height)}px`;
  }

  // ==========================================
  // Convert Events
  // ==========================================

  bindConvertEvents() {
    this.convertTargetFormatSelect?.addEventListener('change', (e) => {
      const format = e.target.value;
      this.toolsManager.convertState.targetFormat = format;
      if (this.convertBgColorGroup) {
        this.convertBgColorGroup.style.display = format === 'image/jpeg' ? 'flex' : 'none';
      }
    });

    this.convertBgColorInput?.addEventListener('input', (e) => {
      const color = e.target.value;
      this.toolsManager.convertState.jpegBgColor = color;
      if (this.convertBgColorHex) this.convertBgColorHex.textContent = color;
    });

    this.btnRunConvert?.addEventListener('click', async () => {
      if (!this.currentImage) {
        this.showToast('Please select an image first.', true);
        return;
      }
      this.btnRunConvert.disabled = true;
      const res = await this.toolsManager.processConvert();
      this.btnRunConvert.disabled = false;

      if (res && this.convertResultCard) {
        this.convertResultCard.style.display = 'flex';
        const formatName = res.actualMime.split('/').pop().toUpperCase();
        this.convertOutputSpecs.textContent = `${formatName} · ${formatBytes(res.size)}`;
      }
    });

    this.btnDownloadConvert?.addEventListener('click', () => {
      this.toolsManager.downloadConvertResult();
    });
  }

  // ==========================================
  // Enhance Events
  // ==========================================

  bindEnhanceEvents() {
    let debounceTimer = null;
    const updatePreview = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.renderEnhancePreview();
      }, 16);
    };

    // Brightness
    this.enhanceBrightnessSlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.toolsManager.enhanceState.brightness = val;
      if (this.enhanceBrightnessVal) this.enhanceBrightnessVal.textContent = val > 0 ? `+${val}` : `${val}`;
      updatePreview();
    });

    // Contrast
    this.enhanceContrastSlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.toolsManager.enhanceState.contrast = val;
      if (this.enhanceContrastVal) this.enhanceContrastVal.textContent = val > 0 ? `+${val}` : `${val}`;
      updatePreview();
    });

    // Saturation
    this.enhanceSaturationSlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.toolsManager.enhanceState.saturation = val;
      if (this.enhanceSaturationVal) this.enhanceSaturationVal.textContent = val > 0 ? `+${val}` : `${val}`;
      updatePreview();
    });

    // Sharpness
    this.enhanceSharpnessSlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.toolsManager.enhanceState.sharpness = val;
      if (this.enhanceSharpnessVal) this.enhanceSharpnessVal.textContent = `${val}%`;
      updatePreview();
    });

    // Quick style preset buttons
    document.querySelectorAll('.enhance-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        const s = this.toolsManager.enhanceState;

        if (preset === 'auto') {
          s.brightness = 5;
          s.contrast = 20;
          s.saturation = 10;
          s.sharpness = 25;
        } else if (preset === 'vivid') {
          s.brightness = 0;
          s.contrast = 15;
          s.saturation = 40;
          s.sharpness = 15;
        } else if (preset === 'warm') {
          s.brightness = 8;
          s.contrast = 10;
          s.saturation = 25;
          s.sharpness = 0;
        } else if (preset === 'bw') {
          s.brightness = 0;
          s.contrast = 25;
          s.saturation = -100; // Complete grayscale
          s.sharpness = 20;
        } else if (preset === 'crisp') {
          s.brightness = 0;
          s.contrast = 15;
          s.saturation = 5;
          s.sharpness = 60;
        }

        // Sync slider values
        if (this.enhanceBrightnessSlider) this.enhanceBrightnessSlider.value = s.brightness;
        if (this.enhanceBrightnessVal) this.enhanceBrightnessVal.textContent = `${s.brightness}`;
        if (this.enhanceContrastSlider) this.enhanceContrastSlider.value = s.contrast;
        if (this.enhanceContrastVal) this.enhanceContrastVal.textContent = `${s.contrast}`;
        if (this.enhanceSaturationSlider) this.enhanceSaturationSlider.value = s.saturation;
        if (this.enhanceSaturationVal) this.enhanceSaturationVal.textContent = `${s.saturation}`;
        if (this.enhanceSharpnessSlider) this.enhanceSharpnessSlider.value = s.sharpness;
        if (this.enhanceSharpnessVal) this.enhanceSharpnessVal.textContent = `${s.sharpness}%`;

        this.renderEnhancePreview();
      });
    });

    this.btnRunEnhance?.addEventListener('click', async () => {
      if (!this.currentImage) {
        this.showToast('Please select an image first.', true);
        return;
      }
      this.btnRunEnhance.disabled = true;
      const res = await this.toolsManager.processEnhance();
      this.btnRunEnhance.disabled = false;

      if (res) {
        this.toolsManager.downloadEnhanceResult();
      }
    });

    this.btnResetEnhance?.addEventListener('click', () => {
      this.toolsManager.resetEnhancements();
      if (this.enhanceBrightnessSlider) this.enhanceBrightnessSlider.value = 0;
      if (this.enhanceBrightnessVal) this.enhanceBrightnessVal.textContent = '0';
      if (this.enhanceContrastSlider) this.enhanceContrastSlider.value = 0;
      if (this.enhanceContrastVal) this.enhanceContrastVal.textContent = '0';
      if (this.enhanceSaturationSlider) this.enhanceSaturationSlider.value = 0;
      if (this.enhanceSaturationVal) this.enhanceSaturationVal.textContent = '0';
      if (this.enhanceSharpnessSlider) this.enhanceSharpnessSlider.value = 0;
      if (this.enhanceSharpnessVal) this.enhanceSharpnessVal.textContent = '0%';
      this.renderEnhancePreview();
      this.showToast('Adjustments reset.', false);
    });
  }

  renderEnhancePreview() {
    if (!this.currentImage || !this.enhancerPreviewCanvas) return;
    this.toolsManager.updateEnhancerPreview(this.enhancerPreviewCanvas);
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new PixelKitApp();
});
