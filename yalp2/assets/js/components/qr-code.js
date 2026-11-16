/* ============================================================
   QR code — thin wrapper around qrcode.js CDN lib
   Loads lazily; degrades gracefully if CDN blocked
   ============================================================ */
let libPromise = null;

function loadLib() {
  if (window.QRCode) return Promise.resolve(window.QRCode);
  if (libPromise) return libPromise;
  libPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
    s.async = true;
    s.onload = () => window.QRCode ? resolve(window.QRCode) : reject(new Error('library loaded but API missing'));
    s.onerror = () => reject(new Error('CDN load failed'));
    document.head.appendChild(s);
  });
  return libPromise;
}

export async function renderQrToCanvas(canvas, text, { size = 240, dark = '#0e0e1a', light = '#ffffff', margin = 1 } = {}) {
  const QR = await loadLib();
  await QR.toCanvas(canvas, text, {
    width: size,
    margin,
    color: { dark, light },
    errorCorrectionLevel: 'M',
  });
  return canvas;
}

export async function renderQrToDataUrl(text, { size = 240, dark = '#0e0e1a', light = '#ffffff', margin = 1 } = {}) {
  const QR = await loadLib();
  return QR.toDataURL(text, {
    width: size,
    margin,
    color: { dark, light },
    errorCorrectionLevel: 'M',
  });
}
