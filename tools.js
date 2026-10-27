/**
 * PixelKit — Interactive Tools Controller
 * Handles Compressor, Resizer, Cropper, Converter, and Enhancer workflows.
 */

import {
  clamp,
  formatBytes,
  canvasToBlob,
  applyAdjustments,
  resizeImage,
  cropImage,
  boundedCompressToTarget,
  downloadBlob,
  getExtensionForMime,
  createPreviewCanvas
} from './image-utils.js';

export class ToolsManager {
  /**
   * @param {Object} context
   * @param {Function} context.getSourceImage Current loaded image state getter
   * @param {Function} context.onStatusChange Status updates
   * @param {Function} context.onError Error reporter
   */
  constructor({ getSourceImage, onStatusChange, onError }) {
    this.getSourceImage = getSourceImage;
    this.onStatusChange = onStatusChange || (() => {});
    this.onError = onError || (() => {});

    // Active tool ID: 'compress' | 'resize' | 'crop' | 'convert' | 'enhance'
    this.activeTool = 'compress';

    // Tool states
    this.compressState = {
      mode: 'quality', // 'quality' | 'target'
      quality: 80,
      format: 'image/jpeg',
      maxDimension: 'none',
      targetSizeKb: 200,
      lastResult: null,
      isProcessing: false
    };

    this.resizeState = {
      width: 0,
      height: 0,
      lockRatio: true,
      originalRatio: 1,
      percent: 100,
      lastResult: null,
      isProcessing: false
    };

    this.cropState = {
      ratio: 'free', // 'free' | '1:1' | '4:5' | '4:3' | '16:9' | '9:16'
      cropX: 0,
      cropY: 0,
      cropWidth: 0,
      cropHeight: 0,
      previewScale: 1,
      isDragging: false,
      dragMode: null, // 'move' | 'nw' | 'ne' | 'se' | 'sw'
      dragStart: { x: 0, y: 0 },
      initialRect: { x: 0, y: 0, w: 0, h: 0 },
      lastResult: null
    };

    this.convertState = {
      targetFormat: 'image/webp',
      jpegBgColor: '#ffffff',
      lastResult: null,
      isProcessing: false
    };

    this.enhanceState = {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      sharpness: 0,
      previewCanvas: null,
      lastResult: null,
      isProcessing: false
    };

    // Stale generation guard
    this.currentOperationToken = 0;
  }

  /**
   * Called when a new image is loaded into PixelKit
   */
  onNewImageLoaded() {
    const src = this.getSourceImage();
    if (!src) return;

    // Reset and initialize resize tool
    this.resizeState.width = src.width;
    this.resizeState.height = src.height;
    this.resizeState.originalRatio = src.width / src.height;
    this.resizeState.percent = 100;
    this.resizeState.lastResult = null;

    // Reset crop tool
    this.initCropRect(src.width, src.height, this.cropState.ratio);
    this.cropState.lastResult = null;

    // Reset compress tool
    this.compressState.lastResult = null;
    this.compressState.format = src.format === 'image/png' ? 'image/png' : 'image/jpeg';

    // Reset convert tool
    this.convertState.lastResult = null;
    this.convertState.targetFormat = src.format === 'image/jpeg' ? 'image/webp' : 'image/jpeg';

    // Reset enhancer
    this.enhanceState.brightness = 0;
    this.enhanceState.contrast = 0;
    this.enhanceState.saturation = 0;
    this.enhanceState.sharpness = 0;
    this.enhanceState.previewCanvas = createPreviewCanvas(src.canvas, 640);
    this.enhanceState.lastResult = null;
  }

  /**
   * Initializes crop rectangle based on aspect ratio preset
   */
  initCropRect(imgW, imgH, ratioPreset) {
    let targetRatio = null;
    if (ratioPreset === '1:1') targetRatio = 1;
    else if (ratioPreset === '4:5') targetRatio = 4 / 5;
    else if (ratioPreset === '4:3') targetRatio = 4 / 3;
    else if (ratioPreset === '16:9') targetRatio = 16 / 9;
    else if (ratioPreset === '9:16') targetRatio = 9 / 16;

    if (!targetRatio) {
      // Free: default to 90% centered box
      const margin = 0.05;
      this.cropState.cropWidth = Math.round(imgW * 0.9);
      this.cropState.cropHeight = Math.round(imgH * 0.9);
      this.cropState.cropX = Math.round(imgW * margin);
      this.cropState.cropY = Math.round(imgH * margin);
      return;
    }

    let w, h;
    const imgRatio = imgW / imgH;

    if (imgRatio > targetRatio) {
      // Image is wider than crop target
      h = Math.round(imgH * 0.9);
      w = Math.round(h * targetRatio);
    } else {
      // Image is taller than crop target
      w = Math.round(imgW * 0.9);
      h = Math.round(w / targetRatio);
    }

    this.cropState.cropWidth = clamp(w, 10, imgW);
    this.cropState.cropHeight = clamp(h, 10, imgH);
    this.cropState.cropX = Math.round((imgW - this.cropState.cropWidth) / 2);
    this.cropState.cropY = Math.round((imgH - this.cropState.cropHeight) / 2);
  }

  // ==========================================
  // TOOL 1: COMPRESSOR
  // ==========================================

  async processCompress() {
    const src = this.getSourceImage();
    if (!src) return;

    const opToken = ++this.currentOperationToken;
    this.compressState.isProcessing = true;
    this.onStatusChange('Compressing image...');

    try {
      let workingCanvas = src.canvas;

      // Optional max dimension constraint
      if (this.compressState.maxDimension !== 'none') {
        const maxD = parseInt(this.compressState.maxDimension, 10);
        if (maxD && (src.width > maxD || src.height > maxD)) {
          let targetW = src.width;
          let targetH = src.height;
          if (src.width >= src.height) {
            targetH = Math.round((src.height / src.width) * maxD);
            targetW = maxD;
          } else {
            targetW = Math.round((src.width / src.height) * maxD);
            targetH = maxD;
          }
          workingCanvas = resizeImage(src.canvas, targetW, targetH);
        }
      }

      let result;

      if (this.compressState.mode === 'target') {
        const targetBytes = Math.max(1024, this.compressState.targetSizeKb * 1024);
        result = await boundedCompressToTarget(
          workingCanvas,
          targetBytes,
          this.compressState.format
        );
      } else {
        const q = this.compressState.quality / 100;
        const exportRes = await canvasToBlob(workingCanvas, this.compressState.format, q);
        result = {
          success: true,
          blob: exportRes.blob,
          size: exportRes.size,
          quality: this.compressState.quality,
          width: workingCanvas.width,
          height: workingCanvas.height,
          message: 'Compression finished.'
        };
      }

      if (opToken !== this.currentOperationToken) return; // Stale check

      const originalSize = src.size;
      const outputSize = result.size;
      const reductionPercent = Math.round(((originalSize - outputSize) / originalSize) * 100);

      this.compressState.lastResult = {
        blob: result.blob,
        size: outputSize,
        originalSize,
        reductionPercent,
        width: result.width,
        height: result.height,
        mimeType: result.blob.type || this.compressState.format,
        message: result.message
      };

      this.onStatusChange('Compression complete.');
      return this.compressState.lastResult;
    } catch (err) {
      if (opToken === this.currentOperationToken) {
        this.onError(`Compression failed: ${err.message}`);
      }
    } finally {
      this.compressState.isProcessing = false;
    }
  }

  downloadCompressResult() {
    const res = this.compressState.lastResult;
    const src = this.getSourceImage();
    if (!res || !src) return;

    const baseName = src.name.replace(/\.[^/.]+$/, '');
    const ext = getExtensionForMime(res.mimeType, 'jpg');
    const filename = `${baseName}-compressed.${ext}`;
    downloadBlob(res.blob, filename);
  }

  // ==========================================
  // TOOL 2: RESIZER
  // ==========================================

  setResizeWidth(val) {
    const src = this.getSourceImage();
    if (!src) return;
    const w = parseInt(val, 10);
    if (!w || w <= 0) return;

    this.resizeState.width = w;
    if (this.resizeState.lockRatio) {
      this.resizeState.height = Math.max(1, Math.round(w / this.resizeState.originalRatio));
    }
    this.resizeState.percent = Math.round((w / src.width) * 100);
    this.resizeState.lastResult = null;
  }

  setResizeHeight(val) {
    const src = this.getSourceImage();
    if (!src) return;
    const h = parseInt(val, 10);
    if (!h || h <= 0) return;

    this.resizeState.height = h;
    if (this.resizeState.lockRatio) {
      this.resizeState.width = Math.max(1, Math.round(h * this.resizeState.originalRatio));
    }
    this.resizeState.percent = Math.round((this.resizeState.width / src.width) * 100);
    this.resizeState.lastResult = null;
  }

  setResizePercent(percent) {
    const src = this.getSourceImage();
    if (!src) return;
    const p = clamp(parseInt(percent, 10) || 100, 1, 500);
    this.resizeState.percent = p;
    this.resizeState.width = Math.max(1, Math.round((src.width * p) / 100));
    this.resizeState.height = Math.max(1, Math.round((src.height * p) / 100));
    this.resizeState.lastResult = null;
  }

  async processResize() {
    const src = this.getSourceImage();
    if (!src) return;

    const opToken = ++this.currentOperationToken;
    this.resizeState.isProcessing = true;
    this.onStatusChange('Resizing image...');

    try {
      const w = parseInt(this.resizeState.width, 10);
      const h = parseInt(this.resizeState.height, 10);

      if (!w || !h || w <= 0 || h <= 0) {
        throw new Error('Please enter valid positive dimensions.');
      }

      if (w > 8192 || h > 8192) {
        throw new Error('Maximum dimension limit is 8192 pixels.');
      }

      const canvas = resizeImage(src.canvas, w, h);
      const mime = src.format || 'image/jpeg';
      const exportRes = await canvasToBlob(canvas, mime, 0.9);

      if (opToken !== this.currentOperationToken) return;

      this.resizeState.lastResult = {
        blob: exportRes.blob,
        size: exportRes.size,
        width: w,
        height: h,
        mimeType: exportRes.actualMime
      };

      this.onStatusChange('Resize complete.');
      return this.resizeState.lastResult;
    } catch (err) {
      if (opToken === this.currentOperationToken) {
        this.onError(`Resize failed: ${err.message}`);
      }
    } finally {
      this.resizeState.isProcessing = false;
    }
  }

  downloadResizeResult() {
    const res = this.resizeState.lastResult;
    const src = this.getSourceImage();
    if (!res || !src) return;

    const baseName = src.name.replace(/\.[^/.]+$/, '');
    const ext = getExtensionForMime(res.mimeType, 'jpg');
    const filename = `${baseName}-${res.width}x${res.height}.${ext}`;
    downloadBlob(res.blob, filename);
  }

  // ==========================================
  // TOOL 3: CROPPER
  // ==========================================

  setCropRatio(ratio) {
    const src = this.getSourceImage();
    if (!src) return;
    this.cropState.ratio = ratio;
    this.initCropRect(src.width, src.height, ratio);
    this.cropState.lastResult = null;
  }

  updateCropRect(dx, dy, mode) {
    const src = this.getSourceImage();
    if (!src) return;

    const imgW = src.width;
    const imgH = src.height;
    const r = this.cropState.initialRect;
    const ratioPreset = this.cropState.ratio;

    let targetRatio = null;
    if (ratioPreset === '1:1') targetRatio = 1;
    else if (ratioPreset === '4:5') targetRatio = 4 / 5;
    else if (ratioPreset === '4:3') targetRatio = 4 / 3;
    else if (ratioPreset === '16:9') targetRatio = 16 / 9;
    else if (ratioPreset === '9:16') targetRatio = 9 / 16;

    if (mode === 'move') {
      this.cropState.cropX = clamp(r.x + dx, 0, imgW - this.cropState.cropWidth);
      this.cropState.cropY = clamp(r.y + dy, 0, imgH - this.cropState.cropHeight);
    } else if (mode === 'se') {
      let newW = clamp(r.w + dx, 20, imgW - r.x);
      let newH = clamp(r.h + dy, 20, imgH - r.y);

      if (targetRatio) {
        if (newW / targetRatio <= imgH - r.y) {
          newH = Math.round(newW / targetRatio);
        } else {
          newH = imgH - r.y;
          newW = Math.round(newH * targetRatio);
        }
      }
      this.cropState.cropWidth = newW;
      this.cropState.cropHeight = newH;
    } else if (mode === 'nw') {
      let newX = clamp(r.x + dx, 0, r.x + r.w - 20);
      let newY = clamp(r.y + dy, 0, r.y + r.h - 20);
      let newW = (r.x + r.w) - newX;
      let newH = (r.y + r.h) - newY;

      if (targetRatio) {
        newH = Math.round(newW / targetRatio);
        newY = (r.y + r.h) - newH;
        if (newY < 0) {
          newY = 0;
          newH = r.y + r.h;
          newW = Math.round(newH * targetRatio);
          newX = (r.x + r.w) - newW;
        }
      }
      this.cropState.cropX = newX;
      this.cropState.cropY = newY;
      this.cropState.cropWidth = newW;
      this.cropState.cropHeight = newH;
    } else if (mode === 'ne') {
      let newY = clamp(r.y + dy, 0, r.y + r.h - 20);
      let newW = clamp(r.w + dx, 20, imgW - r.x);
      let newH = (r.y + r.h) - newY;

      if (targetRatio) {
        newH = Math.round(newW / targetRatio);
        newY = (r.y + r.h) - newH;
        if (newY < 0) {
          newY = 0;
          newH = r.y + r.h;
          newW = Math.round(newH * targetRatio);
        }
      }
      this.cropState.cropY = newY;
      this.cropState.cropWidth = newW;
      this.cropState.cropHeight = newH;
    } else if (mode === 'sw') {
      let newX = clamp(r.x + dx, 0, r.x + r.w - 20);
      let newW = (r.x + r.w) - newX;
      let newH = clamp(r.h + dy, 20, imgH - r.y);

      if (targetRatio) {
        newH = Math.round(newW / targetRatio);
        if (r.y + newH > imgH) {
          newH = imgH - r.y;
          newW = Math.round(newH * targetRatio);
          newX = (r.x + r.w) - newW;
        }
      }
      this.cropState.cropX = newX;
      this.cropState.cropWidth = newW;
      this.cropState.cropHeight = newH;
    }
  }

  async processCrop() {
    const src = this.getSourceImage();
    if (!src) return;

    const opToken = ++this.currentOperationToken;
    this.onStatusChange('Cropping image...');

    try {
      const { cropX, cropY, cropWidth, cropHeight } = this.cropState;
      const croppedCanvas = cropImage(src.canvas, cropX, cropY, cropWidth, cropHeight);
      const mime = src.format || 'image/jpeg';
      const exportRes = await canvasToBlob(croppedCanvas, mime, 0.92);

      if (opToken !== this.currentOperationToken) return;

      this.cropState.lastResult = {
        blob: exportRes.blob,
        size: exportRes.size,
        width: cropWidth,
        height: cropHeight,
        mimeType: exportRes.actualMime
      };

      this.onStatusChange('Crop complete.');
      return this.cropState.lastResult;
    } catch (err) {
      if (opToken === this.currentOperationToken) {
        this.onError(`Crop failed: ${err.message}`);
      }
    }
  }

  downloadCropResult() {
    const res = this.cropState.lastResult;
    const src = this.getSourceImage();
    if (!res || !src) return;

    const baseName = src.name.replace(/\.[^/.]+$/, '');
    const ext = getExtensionForMime(res.mimeType, 'jpg');
    const filename = `${baseName}-cropped.${ext}`;
    downloadBlob(res.blob, filename);
  }

  // ==========================================
  // TOOL 4: CONVERTER
  // ==========================================

  async processConvert() {
    const src = this.getSourceImage();
    if (!src) return;

    const opToken = ++this.currentOperationToken;
    this.convertState.isProcessing = true;
    this.onStatusChange('Converting format...');

    try {
      const targetMime = this.convertState.targetFormat;
      let workingCanvas = src.canvas;

      // When converting to JPEG from transparent image, flatten onto chosen background color
      if (targetMime === 'image/jpeg') {
        const bg = this.convertState.jpegBgColor || '#ffffff';
        workingCanvas = document.createElement('canvas');
        workingCanvas.width = src.width;
        workingCanvas.height = src.height;
        const ctx = workingCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, src.width, src.height);
          ctx.drawImage(src.canvas, 0, 0);
        }
      }

      const exportRes = await canvasToBlob(workingCanvas, targetMime, 0.92);

      if (opToken !== this.currentOperationToken) return;

      this.convertState.lastResult = {
        blob: exportRes.blob,
        size: exportRes.size,
        width: src.width,
        height: src.height,
        actualMime: exportRes.actualMime,
        targetMime
      };

      this.onStatusChange('Conversion complete.');
      return this.convertState.lastResult;
    } catch (err) {
      if (opToken === this.currentOperationToken) {
        this.onError(`Format conversion failed: ${err.message}`);
      }
    } finally {
      this.convertState.isProcessing = false;
    }
  }

  downloadConvertResult() {
    const res = this.convertState.lastResult;
    const src = this.getSourceImage();
    if (!res || !src) return;

    const baseName = src.name.replace(/\.[^/.]+$/, '');
    const ext = getExtensionForMime(res.actualMime, 'webp');
    const filename = `${baseName}.${ext}`;
    downloadBlob(res.blob, filename);
  }

  // ==========================================
  // TOOL 5: PHOTO ENHANCER
  // ==========================================

  updateEnhancerPreview(previewCanvasTarget) {
    if (!this.enhanceState.previewCanvas) return;
    const { brightness, contrast, saturation, sharpness } = this.enhanceState;
    applyAdjustments(
      this.enhanceState.previewCanvas,
      { brightness, contrast, saturation, sharpness },
      previewCanvasTarget
    );
  }

  async processEnhance() {
    const src = this.getSourceImage();
    if (!src) return;

    const opToken = ++this.currentOperationToken;
    this.enhanceState.isProcessing = true;
    this.onStatusChange('Applying enhancements...');

    try {
      const { brightness, contrast, saturation, sharpness } = this.enhanceState;
      const fullCanvas = document.createElement('canvas');
      fullCanvas.width = src.width;
      fullCanvas.height = src.height;

      applyAdjustments(
        src.canvas,
        { brightness, contrast, saturation, sharpness },
        fullCanvas
      );

      const mime = src.format || 'image/jpeg';
      const exportRes = await canvasToBlob(fullCanvas, mime, 0.92);

      if (opToken !== this.currentOperationToken) return;

      this.enhanceState.lastResult = {
        blob: exportRes.blob,
        size: exportRes.size,
        width: src.width,
        height: src.height,
        mimeType: exportRes.actualMime
      };

      this.onStatusChange('Enhancement complete.');
      return this.enhanceState.lastResult;
    } catch (err) {
      if (opToken === this.currentOperationToken) {
        this.onError(`Enhancement failed: ${err.message}`);
      }
    } finally {
      this.enhanceState.isProcessing = false;
    }
  }

  downloadEnhanceResult() {
    const res = this.enhanceState.lastResult;
    const src = this.getSourceImage();
    if (!res || !src) return;

    const baseName = src.name.replace(/\.[^/.]+$/, '');
    const ext = getExtensionForMime(res.mimeType, 'jpg');
    const filename = `${baseName}-enhanced.${ext}`;
    downloadBlob(res.blob, filename);
  }

  resetEnhancements() {
    this.enhanceState.brightness = 0;
    this.enhanceState.contrast = 0;
    this.enhanceState.saturation = 0;
    this.enhanceState.sharpness = 0;
    this.enhanceState.lastResult = null;
  }
}
