'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// Paleta canónica del juego. Es la fuente de verdad para la skin Retro.
// COLORS[0] = null = celda vacía (no dibujar).
const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#ADD8E6', // J - pale blue
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

// ---- Skins ----------------------------------------------------------------
// Cada skin define: colors (array de 8, misma posición que COLORS) y
// drawBlock(context, x, y, colorIndex, size, alpha) específica de la skin.
// applySkin() puede añadir propiedades computadas a la skin (e.g. _patterns,
// _hasRoundRect) para pre-calcular recursos costosos una sola vez.
const SKINS = {
  retro: {
    name: 'Retro',
    // Retro usa COLORS como fuente de verdad (misma referencia).
    colors: COLORS,
    drawBlock(context, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      const color = this.colors[colorIndex];
      context.globalAlpha = alpha ?? 1;
      context.shadowBlur = 0;
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      // highlight superior estilo retro
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      context.globalAlpha = 1;
    },
  },

  neon: {
    name: 'Neon',
    colors: [
      null,
      '#00fff5', // I - cyan brillante
      '#ffff00', // O - amarillo eléctrico
      '#ee00ff', // T - magenta
      '#00ff44', // S - verde neón
      '#ff0040', // Z - rojo neón
      '#00aaff', // J - azul eléctrico
      '#ff8800', // L - naranja neón
    ],
    drawBlock(context, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      const color = this.colors[colorIndex];
      const a = alpha ?? 1;
      context.globalAlpha = a;

      // Primero dibujamos la base negra SIN glow (shadowBlur=0),
      // para que el fondo oscuro no emita halo de color.
      context.shadowBlur = 0;
      context.fillStyle = '#000';
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);

      // Ahora activamos el glow solo para el relleno de color neón.
      // shadowBlur se escala con alpha para que el fantasma brille menos.
      context.shadowColor = color;
      context.shadowBlur = 14 * a;
      context.fillStyle = color;
      context.globalAlpha = a * 0.85;
      context.fillRect(x * size + 2, y * size + 2, size - 4, size - 4);

      // El borde se dibuja sin glow para no triplicar el efecto.
      context.shadowBlur = 0;
      context.strokeStyle = color;
      context.lineWidth = 1;
      context.strokeRect(x * size + 1.5, y * size + 1.5, size - 3, size - 3);

      context.globalAlpha = 1;
    },
  },

  pastel: {
    name: 'Pastel',
    colors: [
      null,
      '#b2ebf2', // I - celeste suave
      '#fff9c4', // O - amarillo pastel
      '#e1bee7', // T - lila
      '#c8e6c9', // S - verde menta
      '#ffcdd2', // Z - rosa pastel
      '#bbdefb', // J - azul bebé
      '#ffe0b2', // L - melocotón
    ],
    // _hasRoundRect se calcula una vez en applySkin para no hacer el
    // feature-detect en cada llamada a drawBlock (hasta 200 veces por frame).
    _hasRoundRect: false,
    drawBlock(context, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      const color = this.colors[colorIndex];
      context.globalAlpha = alpha ?? 1;
      context.shadowBlur = 0;
      const r = Math.round(size * 0.22); // radio para esquinas redondeadas
      const bx = x * size + 2;
      const by = y * size + 2;
      const bw = size - 4;
      const bh = size - 4;
      context.fillStyle = color;
      if (this._hasRoundRect) {
        context.beginPath();
        context.roundRect(bx, by, bw, bh, r);
        context.fill();
        // highlight suave superior
        context.fillStyle = 'rgba(255,255,255,0.35)';
        context.beginPath();
        context.roundRect(bx, by, bw, Math.round(bh * 0.35), r);
        context.fill();
      } else {
        // fallback cuadrado si roundRect no está disponible
        context.fillRect(bx, by, bw, bh);
        context.fillStyle = 'rgba(255,255,255,0.35)';
        context.fillRect(bx, by, bw, Math.round(bh * 0.35));
      }
      context.globalAlpha = 1;
    },
  },

  pixel: {
    name: 'Pixel',
    colors: [
      null,
      '#5bc8d0', // I
      '#d4a017', // O
      '#8a44a0', // T
      '#4a8c4e', // S
      '#b04040', // Z
      '#5578a8', // J
      '#c07820', // L
    ],
    // _patterns[colorIndex] se construye una vez en applySkin con createPattern().
    // Así evitamos 14 fillRect por bloque en el hot path del render.
    _patterns: null,
    drawBlock(context, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      context.globalAlpha = alpha ?? 1;
      context.shadowBlur = 0;
      const bx = x * size + 1;
      const by = y * size + 1;
      const bw = size - 2;
      const bh = size - 2;

      // Usamos el pattern pre-computado si está disponible (OffscreenCanvas o canvas auxiliar).
      const pat = this._patterns && this._patterns[colorIndex];
      if (pat) {
        // Guardamos y restauramos la transformación para alinear el pattern al bloque.
        context.save();
        context.translate(bx, by);
        context.fillStyle = pat;
        context.fillRect(0, 0, bw, bh);
        context.restore();
      } else {
        // Fallback: base sólida sin textura (navegadores muy antiguos)
        context.fillStyle = this.colors[colorIndex];
        context.fillRect(bx, by, bw, bh);
      }

      // Borde oscuro estilo pixel art (1 llamada, no loop)
      context.strokeStyle = 'rgba(0,0,0,0.45)';
      context.lineWidth = 1;
      context.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      context.globalAlpha = 1;
    },
  },
};

// Skin activa (se asigna en initSkin al cargar la página)
let activeSkin = SKINS.retro;

/**
 * Construye los recursos pre-computados de una skin antes de usarla:
 * - Pixel: crea un pattern de cuadrícula por color (una vez, no en cada frame).
 * - Pastel: detecta si roundRect está disponible en el contexto canvas.
 */
function precomputeSkinResources(skin) {
  // ---- Pixel: pattern de mini-cuadrícula ----
  if (skin === SKINS.pixel) {
    const gridSize = 4;
    const bw = BLOCK - 2; // 28 px
    const bh = BLOCK - 2;
    const patterns = [null]; // índice 0 = vacío
    for (let ci = 1; ci < skin.colors.length; ci++) {
      const color = skin.colors[ci];
      // Creamos un mini-canvas del tamaño del bloque con el patrón pintado.
      const pc = document.createElement('canvas');
      pc.width = bw;
      pc.height = bh;
      const pctx = pc.getContext('2d');
      // Base de color sólido
      pctx.fillStyle = color;
      pctx.fillRect(0, 0, bw, bh);
      // Líneas de cuadrícula oscuras (4×4 px)
      pctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let gx = 0; gx < bw; gx += gridSize) {
        pctx.fillRect(gx, 0, 1, bh);
      }
      for (let gy = 0; gy < bh; gy += gridSize) {
        pctx.fillRect(0, gy, bw, 1);
      }
      // Creamos el CanvasPattern para usarlo en drawBlock
      patterns.push(ctx.createPattern(pc, 'no-repeat'));
    }
    skin._patterns = patterns;
  }

  // ---- Pastel: detectar roundRect una sola vez ----
  if (skin === SKINS.pastel) {
    skin._hasRoundRect = typeof ctx.roundRect === 'function';
  }
}

/** Aplica la skin indicada, guarda preferencia en localStorage y redibuja. */
function applySkin(name) {
  if (!SKINS[name]) return;
  activeSkin = SKINS[name];
  // Pre-computar recursos de la skin (patterns, feature-flags)
  precomputeSkinResources(activeSkin);
  try { localStorage.setItem('tetris_skin', name); } catch (_) {}
  // Marcar el botón activo usando data-attribute (no class dinámica)
  document.querySelectorAll('.skin-btn').forEach(btn => {
    btn.dataset.active = (btn.dataset.skin === name) ? 'true' : 'false';
  });
  // Redibujar inmediatamente si la partida ya está en marcha
  if (board && current) {
    draw();
    drawNext();
  }
}

// ---- Canvas & DOM ---------------------------------------------------------
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');

// ---- Estado global --------------------------------------------------------
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
    return;
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

/** Dibuja un bloque delegando al skin activo. colorIndex 0 = celda vacía, no dibujar. */
function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  activeSkin.drawBlock(context, x, y, colorIndex, size, alpha);
}

function drawGrid() {
  ctx.strokeStyle = document.body.classList.contains('light-mode') ? '#c8c8d8' : '#22222e';
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // tablero
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // fantasma
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // pieza activa
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (!gameOver) animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

document.getElementById('theme-switch').addEventListener('change', function () {
  document.body.classList.toggle('light-mode', this.checked);
});

// ---- Inicializar skin desde localStorage ----------------------------------
(function initSkin() {
  let savedSkin = 'retro';
  try { savedSkin = localStorage.getItem('tetris_skin') || 'retro'; } catch (_) {}
  // Registrar eventos de los botones de skin
  document.querySelectorAll('.skin-btn').forEach(btn => {
    btn.addEventListener('click', () => applySkin(btn.dataset.skin));
  });
  // Aplicar skin guardada (o retro por defecto); los recursos se pre-computan
  // después de que ctx esté disponible (lo está, se declaró arriba).
  applySkin(SKINS[savedSkin] ? savedSkin : 'retro');
})();

init();
