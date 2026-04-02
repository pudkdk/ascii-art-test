// ── Constants ──────────────────────────────────────────────────────────────
const CHAR_ASPECT = 0.55; // monospace char width:height ratio (approx)

// ── DOM refs ───────────────────────────────────────────────────────────────
const out          = document.getElementById('ascii-out');
const placeholder  = document.getElementById('placeholder');
const canvasArea   = document.getElementById('canvas-area');
const fileInput    = document.getElementById('file-input');
const speedSlider  = document.getElementById('speed');
const hueSlider    = document.getElementById('hue');
const satSlider    = document.getElementById('sat');
const brightSlider = document.getElementById('brightness');
const contrastSlider = document.getElementById('contrast');
const fontsizeSlider = document.getElementById('fontsize');
const charsInput   = document.getElementById('chars-input');
const resSlider    = document.getElementById('resolution');
const colorToggle  = document.getElementById('color-toggle');
const invertToggle = document.getElementById('invert-toggle');
const copyBtn      = document.getElementById('copy-btn');
const downloadBtn  = document.getElementById('download-btn');
const offscreen    = document.getElementById('offscreen');
const renderCanvas = document.getElementById('render-canvas');
const toastEl      = document.getElementById('toast');
const ctx          = offscreen.getContext('2d');

// ── State ──────────────────────────────────────────────────────────────────
let W          = 80;
let H          = 40;
let animFrame  = null;
let lastTime   = 0;
let intervalMs = 1000 / 30;
let source     = null;
let lastText   = '';

// ── Init ───────────────────────────────────────────────────────────────────
updateDimensions();

// ── Helpers ────────────────────────────────────────────────────────────────
function updateDimensions() {
  W = parseInt(resSlider.value);
  H = Math.round(W * 0.5); // chars are ~2× taller than wide
  offscreen.width  = W;
  offscreen.height = H;
}

function buildFilter() {
  return [
    `hue-rotate(${hueSlider.value}deg)`,
    `saturate(${satSlider.value}%)`,
    `brightness(${brightSlider.value}%)`,
    `contrast(${contrastSlider.value}%)`,
  ].join(' ');
}

function charForLuminance(lum) {
  const chars = charsInput.value || '@. ';
  const b     = invertToggle.checked ? 1 - lum : lum;
  const idx   = Math.floor((1 - b) * (chars.length - 1));
  return chars[Math.max(0, Math.min(chars.length - 1, idx))];
}

// ── Render ─────────────────────────────────────────────────────────────────
function renderFrame() {
  if (!source) return;

  ctx.filter = buildFilter();
  ctx.drawImage(source, 0, 0, W, H);
  const pixels = ctx.getImageData(0, 0, W, H).data;

  if (colorToggle.checked) {
    renderColor(pixels);
  } else {
    renderMono(pixels);
  }
}

function renderMono(pixels) {
  let rows = '';
  for (let y = 0; y < H; y++) {
    let row = '';
    for (let x = 0; x < W; x++) {
      const i   = (y * W + x) * 4;
      const lum = (0.299 * pixels[i] + 0.587 * pixels[i+1] + 0.114 * pixels[i+2]) / 255;
      row += charForLuminance(lum);
    }
    rows += row + '\n';
  }
  out.textContent = rows;
  lastText = rows;
}

function renderColor(pixels) {
  let html = '';
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i   = (y * W + x) * 4;
      const r   = pixels[i], g = pixels[i+1], b = pixels[i+2];
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const ch  = charForLuminance(lum);
      html += `<span style="color:rgb(${r},${g},${b})">${ch}</span>`;
    }
    html += '\n';
  }
  out.innerHTML = html;
  lastText = out.textContent;
}

// ── Animation loop ─────────────────────────────────────────────────────────
function loop(ts) {
  if (ts - lastTime >= intervalMs) {
    lastTime = ts;
    renderFrame();
  }
  animFrame = requestAnimationFrame(loop);
}

// ── File loading ───────────────────────────────────────────────────────────
function loadFile(file) {
  if (!file) return;
  if (animFrame) cancelAnimationFrame(animFrame);

  const url = URL.createObjectURL(file);
  placeholder.style.display = 'none';
  out.style.display = 'block';
  copyBtn.disabled = false;
  downloadBtn.disabled = false;
  updateDimensions();

  if (file.type.startsWith('video')) {
    const vid = document.createElement('video');
    vid.src       = url;
    vid.loop      = true;
    vid.muted     = true;
    vid.playsInline = true;
    vid.oncanplay = () => {
      vid.play();
      source    = vid;
      animFrame = requestAnimationFrame(loop);
    };
  } else {
    const img  = new Image();
    img.onload = () => {
      source    = img;
      renderFrame();
      animFrame = requestAnimationFrame(loop);
    };
    img.src = url;
  }
}

// ── Download PNG ───────────────────────────────────────────────────────────
function downloadPNG() {
  if (!source) return;

  const fontSize   = parseInt(fontsizeSlider.value);
  const lineHeight = fontSize * 2;
  const charWidth  = fontSize * CHAR_ASPECT * 2;
  const cw = Math.ceil(W * charWidth);
  const ch = Math.ceil(H * lineHeight);

  renderCanvas.width  = cw;
  renderCanvas.height = ch;
  const rctx = renderCanvas.getContext('2d');
  rctx.fillStyle = '#000';
  rctx.fillRect(0, 0, cw, ch);
  rctx.font         = `${fontSize * 2}px monospace`;
  rctx.textBaseline = 'top';

  const useColor = colorToggle.checked;
  const imgData  = ctx.getImageData(0, 0, W, H).data;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i   = (y * W + x) * 4;
      const r   = imgData[i], g = imgData[i+1], b = imgData[i+2];
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      rctx.fillStyle = useColor ? `rgb(${r},${g},${b})` : '#fff';
      rctx.fillText(charForLuminance(lum), x * charWidth, y * lineHeight);
    }
  }

  const link    = document.createElement('a');
  link.download = 'ascii-art.png';
  link.href     = renderCanvas.toDataURL('image/png');
  link.click();
  showToast('downloaded');
}

// ── Toast ──────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
}

// ── Event listeners ────────────────────────────────────────────────────────
fileInput.addEventListener('change', (e) => loadFile(e.target.files[0]));

// Drag and drop
canvasArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  canvasArea.classList.add('drag-over');
});
canvasArea.addEventListener('dragleave', () => canvasArea.classList.remove('drag-over'));
canvasArea.addEventListener('drop', (e) => {
  e.preventDefault();
  canvasArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && (file.type.startsWith('image') || file.type.startsWith('video'))) {
    loadFile(file);
  }
});

// Sliders
function bindSlider(el, labelId, suffix, callback) {
  el.addEventListener('input', () => {
    document.getElementById(labelId).textContent = el.value;
    callback?.();
  });
}

bindSlider(speedSlider,    'speed-val',    'fps', () => { intervalMs = 1000 / parseInt(speedSlider.value); });
bindSlider(hueSlider,      'hue-val',      '°',   renderFrame);
bindSlider(satSlider,      'sat-val',      '%',   renderFrame);
bindSlider(brightSlider,   'bright-val',   '%',   renderFrame);
bindSlider(contrastSlider, 'contrast-val', '%',   renderFrame);
bindSlider(fontsizeSlider, 'size-val',     'px',  () => { out.style.fontSize = fontsizeSlider.value + 'px'; });
bindSlider(resSlider,      'res-val',      '',    () => { updateDimensions(); renderFrame(); });

colorToggle.addEventListener('change', renderFrame);
invertToggle.addEventListener('change', renderFrame);
charsInput.addEventListener('input', renderFrame);

copyBtn.addEventListener('click', async () => {
  if (!lastText) return;
  try {
    await navigator.clipboard.writeText(lastText);
    showToast('copied to clipboard');
  } catch {
    showToast('copy failed');
  }
});

downloadBtn.addEventListener('click', downloadPNG);
