const fs = require('node:fs/promises');
const path = require('node:path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

class DocumentOCR {
  constructor(language = 'eng') {
    if (!['eng', 'fra', 'spa'].includes(language)) throw new Error('Unsupported OCR language.');
    this.language = language;
    this.count = 0;
    this.worker = null;
  }
  async recognize(image) {
    if (!this.worker) {
      const { createWorker } = require('tesseract.js');
      const languageRoot = path.dirname(require.resolve(`@tesseract.js-data/${this.language}/package.json`));
      const langPath = path.join(languageRoot, '4.0.0_best_int');
      // Bundled data and WASM only: never download models or create traineddata caches.
      this.worker = await createWorker(this.language, 1, { langPath, cacheMethod: 'none', gzip: true, errorHandler: () => {} });
    }
    const result = await this.worker.recognize(image);
    return result.data.text.trim();
  }
  reserve() {
    if (this.count >= 20) throw new Error('OCR is limited to 20 pages or images per search. Select one resource to narrow the search.');
    this.count++;
  }
  async pdfPage(page) {
    this.reserve();
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2.5, Math.sqrt(4000000 / (base.width * base.height)));
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)));
    try {
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      return await this.recognize(canvas.toBuffer('image/png'));
    } finally { canvas.width = 1; canvas.height = 1; }
  }
  async image(filename) {
    this.reserve();
    const image = await loadImage(await fs.readFile(filename));
    if (image.width * image.height > 40000000) throw new Error('Image is too large for OCR.');
    const scale = Math.min(1, Math.sqrt(4000000 / (image.width * image.height)));
    const canvas = createCanvas(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)));
    try {
      const context = canvas.getContext('2d');
      context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return await this.recognize(canvas.toBuffer('image/png'));
    } finally { canvas.width = 1; canvas.height = 1; }
  }
  async close() { if (this.worker) await this.worker.terminate(); }
}
module.exports = { DocumentOCR };
