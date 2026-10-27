/**
 * PixelKit — Core Image Utilities (`src/image-utils.js`)
 * Production-ready, zero-cost, in-browser image validation, decoding, and processing.
 * 100% client-side: no server uploads, no external APIs.
 */

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB max file size limit
export const MAX_PIXEL_DIMENSION = 8192; // 8K max width or height to guard mobile memory
export const MAX_MEGAPIXELS = 45; // ~45 MP max memory threshold

export const SUPPORTED_INPUT_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp'
];

/**
 * Format raw byte counts into human-readable strings (e.g. "1.2 MB")
 * @param {number} bytes
 * @param {number} [decimals=1]
 * @returns {string}
 */
export function formatBytes(bytes, decimals = 1) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Clamps a number between min and max bounds
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

/**
 * Validates a file's existence, size (<20MB), file extension, and binary magic bytes
 * @param {File|Blob} file
 * @returns {Promise<{ valid: boolean, error?: string, mimeType?: string }>}
 */
export async function validateImageFile(file) {
  if (!file) {
    return { valid: false, error: 'No image file provided.' };
  }

  // 1. File size check (Max 20 MB)
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size (${formatBytes(file.size)}) exceeds the safe 20 MB limit for mobile processing.`
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: 'The selected file is empty (0 bytes).'
    };
  }

  // 2. Extension & initial MIME validation
  const filename = file.name || '';
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const allowedExts = ['jpg', 'jpeg', 'png', 'webp'];

  if (filename && !allowedExts.includes(ext) && !SUPPORTED_INPUT_MIMES.includes(file.type)) {
    return {
      valid: false,
      error: `Unsupported format ".${ext}". PixelKit supports JPEG, PNG, and WebP images.`
    };
  }

  // 3. Inspect first 16 bytes for magic bytes header (prevent disguised or corrupt non-image files)
  try {
    const slice = file.slice(0, 16);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    let detectedMime = null;

    // JPEG header: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      detectedMime = 'image/jpeg';
    }
    // PNG header: 89 50 4E 47 0D 0A 1A 0A
    else if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    ) {
      detectedMime = 'image/png';
    }
    // WebP header: RIFF .... WEBP
    else if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      detectedMime = 'image/webp';
    }

    if (!detectedMime) {
      // If header is ambiguous but browser reported a supported MIME type, proceed with cautious fallback
      if (SUPPORTED_INPUT_MIMES.includes(file.type)) {
        detectedMime = file.type;
      } else {
        return {
          valid: false,
          error: 'The selected file is not a valid JPEG, PNG, or WebP image or has a corrupted header.'
        };
      }
    }

    return { valid: true, mimeType: detectedMime };
  } catch (err) {
    return {
      valid: false,
      error: `Failed to read file signature: ${err.message}`
    };
  }
}

/**
 * Reads a File or Blob as a Base64 Data URL for downstream tools or serialization
 * @param {File|Blob} file
 * @returns {Promise<string>} Resolves with data URL string
 */
export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('No file provided to readFileAsDataURL.'));
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to encode file as Data URL.'));
      }
    };

    reader.onerror = () => {
      reject(new Error(reader.error ? reader.error.message : 'Error reading file as Data URL.'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Decodes a File or Blob into an HTMLImageElement using asynchronous image decoding
 * @param {File|Blob} file
 * @returns {Promise<{ img: HTMLImageElement, width: number, height: number, objectUrl: string }>}
 */
export async function readFileAsImage(file) {
  const validation = await validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const objectUrl = URL.createObjectURL(file);

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = async () => {
      try {
        if ('decode' in img) {
          try {
            await img.decode();
          } catch (decodeErr) {
            // Some browsers fail decode() for unusual embedded color profiles; onload is still valid
          }
        }

        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;

        if (!width || !height || width <= 0 || height <= 0) {
          URL.revokeObjectURL(objectUrl);
          return reject(new Error('Image has invalid or zero dimensions.'));
        }

        if (width > MAX_PIXEL_DIMENSION || height > MAX_PIXEL_DIMENSION) {
          URL.revokeObjectURL(objectUrl);
          return reject(
            new Error(`Image dimensions (${width}×${height}) exceed the safe maximum of ${MAX_PIXEL_DIMENSION}px.`)
          );
        }

        const megapixels = (width * height) / 1000000;
        if (megapixels > MAX_MEGAPIXELS) {
          URL.revokeObjectURL(objectUrl);
          return reject(
            new Error(`Image resolution (${megapixels.toFixed(1)} MP) exceeds the mobile safe limit of ${MAX_MEGAPIXELS} MP.`)
          );
        }

        resolve({
          img,
          width,
          height,
          objectUrl
        });
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`Failed to decode image: ${err.message}`));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to decode image. File may be corrupted or in an unsupported format.'));
    };

    img.src = objectUrl;
  });
}

/**
 * Robust master loader for downstream tools: validates, decodes, and creates a working master 2D canvas
 * @param {File} file
 * @returns {Promise<{ img: HTMLImageElement, canvas: HTMLCanvasElement, width: number, height: number, format: string, size: number, name: string, objectUrl: string, getDataURL: () => Promise<string> }>}
 */
export async function loadImageFromFile(file) {
  const { img, width, height, objectUrl } = await readFileAsImage(file);
  const validation = await validateImageFile(file);

  // Draw master source canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    URL.revokeObjectURL(objectUrl);
    throw new Error('Browser 2D canvas context unavailable.');
  }

  ctx.drawImage(img, 0, 0, width, height);

  return {
    img,
    canvas,
    width,
    height,
    format: validation.mimeType || file.type || 'image/jpeg',
    size: file.size,
    name: file.name || 'image',
    objectUrl,
    getDataURL: () => readFileAsDataURL(file)
  };
}

/**
 * Creates a low-resolution thumbnail canvas for high-performance slider previews
 * @param {HTMLCanvasElement|HTMLImageElement} source
 * @param {number} [maxDimension=640]
 * @returns {HTMLCanvasElement}
 */
export function createPreviewCanvas(source, maxDimension = 640) {
  const srcW = source.width || source.naturalWidth;
  const srcH = source.height || source.naturalHeight;

  let w = srcW;
  let h = srcH;
  if (w > maxDimension || h > maxDimension) {
    if (w >= h) {
      h = Math.round((srcH / srcW) * maxDimension);
      w = maxDimension;
    } else {
      w = Math.round((srcW / srcH) * maxDimension);
      h = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    ctx.drawImage(source, 0, 0, w, h);
  }
  return canvas;
}

/**
 * Export canvas to Blob using standard browser Canvas API
 * @param {HTMLCanvasElement} canvas
 * @param {string} [mimeType='image/jpeg']
 * @param {number} [quality=0.85] 0.01 - 1.0
 * @returns {Promise<{ blob: Blob, actualMime: string, size: number }>}
 */
export function canvasToBlob(canvas, mimeType = 'image/jpeg', quality = 0.85) {
  return new Promise((resolve, reject) => {
    try {
      const q = clamp(Number(quality) || 0.85, 0.01, 1.0);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            return reject(new Error(`Browser failed to export canvas to ${mimeType}.`));
          }
          resolve({
            blob,
            actualMime: blob.type || mimeType,
            size: blob.size
          });
        },
        mimeType,
        q
      );
    } catch (err) {
      reject(new Error(`Export failed: ${err.message}`));
    }
  });
}

/**
 * Applies Brightness, Contrast, Saturation, and Sharpness directly to canvas pixels
 * @param {HTMLCanvasElement} sourceCanvas
 * @param {Object} [options]
 * @param {number} [options.brightness=0] -100 to 100
 * @param {number} [options.contrast=0] -100 to 100
 * @param {number} [options.saturation=0] -100 to 100
 * @param {number} [options.sharpness=0] 0 to 100
 * @param {HTMLCanvasElement} [targetCanvas]
 * @returns {HTMLCanvasElement}
 */
export function applyAdjustments(
  sourceCanvas,
  { brightness = 0, contrast = 0, saturation = 0, sharpness = 0 } = {},
  targetCanvas = null
) {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;

  const out = targetCanvas || document.createElement('canvas');
  if (out.width !== w) out.width = w;
  if (out.height !== h) out.height = h;

  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return out;

  ctx.drawImage(sourceCanvas, 0, 0, w, h);

  const hasAdjustments = brightness !== 0 || contrast !== 0 || saturation !== 0 || sharpness > 0;
  if (!hasAdjustments) return out;

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const len = data.length;

  // 1. Build fast Lookup Table (LUT) for brightness & contrast
  const cFactor = (259 * (contrast * 2.55 + 255)) / (255 * (259 - contrast * 2.55));
  const bDelta = brightness * 2.55;

  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    let val = i + bDelta;
    val = cFactor * (val - 128) + 128;
    lut[i] = clamp(Math.round(val), 0, 255);
  }

  const satFactor = 1 + (saturation / 100);
  const doSat = saturation !== 0;

  for (let i = 0; i < len; i += 4) {
    let r = lut[data[i]];
    let g = lut[data[i + 1]];
    let b = lut[data[i + 2]];

    if (doSat) {
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = clamp(Math.round(gray + satFactor * (r - gray)), 0, 255);
      g = clamp(Math.round(gray + satFactor * (g - gray)), 0, 255);
      b = clamp(Math.round(gray + satFactor * (b - gray)), 0, 255);
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }

  // 2. Sharpness 3x3 Convolution (Unsharp Mask) if requested
  if (sharpness > 0) {
    const amount = (sharpness / 100) * 1.2;
    const center = 1 + 4 * amount;
    const edge = -amount;

    const copy = new Uint8Array(data);

    for (let y = 1; y < h - 1; y++) {
      const rowOffset = y * w * 4;
      const prevRowOffset = (y - 1) * w * 4;
      const nextRowOffset = (y + 1) * w * 4;

      for (let x = 1; x < w - 1; x++) {
        const idx = rowOffset + x * 4;
        const topIdx = prevRowOffset + x * 4;
        const btmIdx = nextRowOffset + x * 4;
        const leftIdx = rowOffset + (x - 1) * 4;
        const rightIdx = rowOffset + (x + 1) * 4;

        data[idx] = clamp(
          Math.round(copy[idx] * center + (copy[topIdx] + copy[btmIdx] + copy[leftIdx] + copy[rightIdx]) * edge),
          0,
          255
        );
        data[idx + 1] = clamp(
          Math.round(copy[idx + 1] * center + (copy[topIdx + 1] + copy[btmIdx + 1] + copy[leftIdx + 1] + copy[rightIdx + 1]) * edge),
          0,
          255
        );
        data[idx + 2] = clamp(
          Math.round(copy[idx + 2] * center + (copy[topIdx + 2] + copy[btmIdx + 2] + copy[leftIdx + 2] + copy[rightIdx + 2]) * edge),
          0,
          255
        );
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return out;
}

/**
 * Resizes an image or canvas to custom dimensions
 * @param {HTMLCanvasElement|HTMLImageElement} source
 * @param {number} targetWidth
 * @param {number} targetHeight
 * @param {string} [backgroundColor=null]
 * @returns {HTMLCanvasElement}
 */
export function resizeImage(source, targetWidth, targetHeight, backgroundColor = null) {
  const w = Math.round(targetWidth);
  const h = Math.round(targetHeight);

  if (w <= 0 || h <= 0 || !Number.isFinite(w) || !Number.isFinite(h)) {
    throw new Error(`Invalid resize dimensions: ${w}×${h}`);
  }

  if (w > MAX_PIXEL_DIMENSION || h > MAX_PIXEL_DIMENSION) {
    throw new Error(`Dimensions cannot exceed ${MAX_PIXEL_DIMENSION}px.`);
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not acquire 2D canvas context.');

  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, w, h);

  return canvas;
}

/**
 * Crops a portion of the source canvas with exact coordinate bounds
 * @param {HTMLCanvasElement|HTMLImageElement} source
 * @param {number} x
 * @param {number} y
 * @param {number} cropW
 * @param {number} cropH
 * @returns {HTMLCanvasElement}
 */
export function cropImage(source, x, y, cropW, cropH) {
  const srcW = source.width || source.naturalWidth;
  const srcH = source.height || source.naturalHeight;

  const clampedX = clamp(Math.round(x), 0, srcW - 1);
  const clampedY = clamp(Math.round(y), 0, srcH - 1);
  const clampedW = clamp(Math.round(cropW), 1, srcW - clampedX);
  const clampedH = clamp(Math.round(cropH), 1, srcH - clampedY);

  const canvas = document.createElement('canvas');
  canvas.width = clampedW;
  canvas.height = clampedH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not acquire 2D canvas context.');

  ctx.drawImage(source, clampedX, clampedY, clampedW, clampedH, 0, 0, clampedW, clampedH);
  return canvas;
}

/**
 * Bounded target file size compressor using iterative search.
 * Guaranteed to terminate within maxAttempts (default 8). Never runs an infinite loop.
 * 
 * @param {HTMLCanvasElement} sourceCanvas
 * @param {number} targetBytes
 * @param {string} [mimeType='image/jpeg']
 * @param {number} [maxAttempts=8]
 * @returns {Promise<{ success: boolean, blob: Blob, size: number, quality: number, width: number, height: number, attempts: number, message: string }>}
 */
export async function boundedCompressToTarget(sourceCanvas, targetBytes, mimeType = 'image/jpeg', maxAttempts = 8) {
  if (targetBytes <= 1024) {
    throw new Error('Target size must be at least 1 KB.');
  }

  if (mimeType === 'image/png') {
    const raw = await canvasToBlob(sourceCanvas, 'image/png');
    return {
      success: raw.size <= targetBytes,
      blob: raw.blob,
      size: raw.size,
      quality: 1,
      width: sourceCanvas.width,
      height: sourceCanvas.height,
      attempts: 1,
      message: raw.size <= targetBytes 
        ? `Output is ${formatBytes(raw.size)}, which meets your target of ${formatBytes(targetBytes)}.`
        : `PNG is a lossless format. Browser PNG encoding cannot be lossy-compressed to reach ${formatBytes(targetBytes)}. Switch to WebP or JPEG to reach target size.`
    };
  }

  let minQ = 0.05;
  let maxQ = 0.95;
  let bestBlob = null;
  let bestSize = Infinity;
  let bestQuality = 0.7;
  let bestCanvas = sourceCanvas;
  let attempts = 0;

  // Phase 1: Binary search on quality parameter
  while (attempts < Math.min(maxAttempts, 6)) {
    attempts++;
    const q = (minQ + maxQ) / 2;
    const { blob, size } = await canvasToBlob(bestCanvas, mimeType, q);

    if (size <= targetBytes) {
      bestBlob = blob;
      bestSize = size;
      bestQuality = q;
      minQ = q;
    } else {
      maxQ = q;
    }

    if (Math.abs(maxQ - minQ) < 0.04) break;
  }

  // Phase 2: If quality alone is insufficient, reduce dimensions progressively
  if ((!bestBlob || bestSize > targetBytes) && attempts < maxAttempts) {
    const scaleFactors = [0.75, 0.5];
    for (const scale of scaleFactors) {
      if (attempts >= maxAttempts) break;
      attempts++;
      const scaledW = Math.max(16, Math.round(sourceCanvas.width * scale));
      const scaledH = Math.max(16, Math.round(sourceCanvas.height * scale));
      const scaledCanvas = resizeImage(sourceCanvas, scaledW, scaledH);
      
      const { blob, size } = await canvasToBlob(scaledCanvas, mimeType, 0.45);
      if (size <= targetBytes) {
        bestBlob = blob;
        bestSize = size;
        bestCanvas = scaledCanvas;
        bestQuality = 0.45;
        break;
      }
    }
  }

  if (!bestBlob) {
    const fallback = await canvasToBlob(bestCanvas, mimeType, 0.1);
    bestBlob = fallback.blob;
    bestSize = fallback.size;
    bestQuality = 0.1;
  }

  const reached = bestSize <= targetBytes;
  return {
    success: reached,
    blob: bestBlob,
    size: bestSize,
    quality: Math.round(bestQuality * 100),
    width: bestCanvas.width,
    height: bestCanvas.height,
    attempts,
    message: reached
      ? `Successfully reached ${formatBytes(bestSize)} in ${attempts} steps.`
      : `Closest achievable size was ${formatBytes(bestSize)} (${formatBytes(bestSize - targetBytes)} above target).`
  };
}

/**
 * Downloads a Blob reliably on mobile and desktop browsers
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  if (!blob) throw new Error('No blob available for download.');
  
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = blobUrl;
  a.download = filename;
  
  document.body.appendChild(a);
  a.click();
  
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  }, 2000);
}

/**
 * Determine correct file extension from MIME type
 * @param {string} mimeType
 * @param {string} [fallback='jpg']
 * @returns {string}
 */
export function getExtensionForMime(mimeType, fallback = 'jpg') {
  if (!mimeType) return fallback;
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  return fallback;
}
