'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

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

// Nivel con el que arrancará la próxima partida (1–15). Se puede cambiar
// desde el menú de pausa; no se altera mid-game.
let startLevel = 1;

// Color de la cuadrícula; se actualiza al cambiar el tema visual.
let gridColor = '#22222e';

/** Calcula el intervalo de caída (ms) para el nivel dado. */
function speedForLevel(n) {
  return Math.max(100, 1000 - (n - 1) * 90);
}

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');

// Sub-vistas del overlay
const viewGameover  = document.getElementById('view-gameover');
const viewPause     = document.getElementById('view-pause');
const viewControls  = document.getElementById('view-controls');

// Elementos de game over
const overlayTitle  = document.getElementById('overlay-title');
const overlayScore  = document.getElementById('overlay-score');
const restartBtn    = document.getElementById('restart-btn');

// Elementos del menú de pausa
const btnResume     = document.getElementById('btn-resume');
const btnRestart    = document.getElementById('btn-restart');
const btnControls   = document.getElementById('btn-controls');
const startLevelDisplay = document.getElementById('start-level-display');
const btnLevelDec   = document.getElementById('btn-level-dec');
const btnLevelInc   = document.getElementById('btn-level-inc');

// Sub-vista controles
const btnControlsBack = document.getElementById('btn-controls-back');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

// ── Utilidades de overlay ────────────────────────────────────────────────────

/** Oculta todas las sub-vistas y el propio overlay. */
function hideOverlay() {
  overlay.querySelectorAll('.overlay-view').forEach(v => v.classList.add('hidden'));
  overlay.classList.add('hidden');
}

/** Muestra el overlay con la sub-vista indicada. */
function showView(view) {
  overlay.querySelectorAll('.overlay-view').forEach(v => v.classList.add('hidden'));
  overlay.classList.remove('hidden');
  view.classList.remove('hidden');
}

/** Actualiza el display del nivel inicial en el menú de pausa. */
function updateStartLevelDisplay() {
  startLevelDisplay.textContent = startLevel;
  btnLevelDec.disabled = startLevel <= 1;
  btnLevelInc.disabled = startLevel >= 15;
}

// ── Lógica de tablero ────────────────────────────────────────────────────────

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
    dropInterval = speedForLevel(level);
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

// ── Dibujo ───────────────────────────────────────────────────────────────────

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
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

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
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

// ── Estados del juego ────────────────────────────────────────────────────────

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  showView(viewGameover);
}

/** Pausa el juego y muestra el menú de pausa completo. */
function pause() {
  if (gameOver || paused) return;
  paused = true;
  cancelAnimationFrame(animId);
  updateStartLevelDisplay();
  showView(viewPause);
}

/** Reanuda el juego desde el menú de pausa. Reinicia lastTime para evitar
 *  que el tiempo acumulado durante la pausa cause un salto de pieza. */
function resume() {
  if (!paused || gameOver) return;
  paused = false;
  hideOverlay();
  // Restablece el tiempo para que no acumule el delta de la pausa
  lastTime = performance.now();
  dropAccum = 0;
  animId = requestAnimationFrame(loop);
}

/** Alternador de pausa: se activa con P o Escape. */
function togglePause() {
  if (gameOver) return;
  if (paused) {
    resume();
  } else {
    pause();
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

/** Inicia o reinicia una partida completa, respetando startLevel. */
function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  // Arranca en el nivel elegido por el jugador
  level = startLevel;
  paused = false;
  gameOver = false;
  // Intervalo de caída según el nivel inicial
  dropInterval = speedForLevel(startLevel);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  hideOverlay();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

// ── Eventos de teclado ───────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  // P / Escape alternan la pausa
  if (e.code === 'KeyP' || e.code === 'Escape') {
    e.preventDefault(); // evita comportamientos nativos (p.ej. salir de fullscreen)
    // Si estamos en la sub-vista de controles, volver al menú de pausa
    if (paused && !viewControls.classList.contains('hidden')) {
      showView(viewPause);
      return;
    }
    togglePause();
    return;
  }
  // Mientras el juego esté pausado o terminado, bloquear inputs de movimiento
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

// ── Eventos de botones del overlay ──────────────────────────────────────────

// Game over → reiniciar
restartBtn.addEventListener('click', init);

// Menú de pausa → Reanudar
btnResume.addEventListener('click', resume);

// Menú de pausa → Reiniciar (nueva partida)
btnRestart.addEventListener('click', init);

// Menú de pausa → Ver controles
btnControls.addEventListener('click', () => {
  showView(viewControls);
});

// Sub-vista controles → Volver al menú de pausa
btnControlsBack.addEventListener('click', () => {
  showView(viewPause);
});

// Selector de nivel inicial: decrementar
btnLevelDec.addEventListener('click', () => {
  if (startLevel > 1) {
    startLevel--;
    updateStartLevelDisplay();
  }
});

// Selector de nivel inicial: incrementar
btnLevelInc.addEventListener('click', () => {
  if (startLevel < 15) {
    startLevel++;
    updateStartLevelDisplay();
  }
});

// ── Tema visual ──────────────────────────────────────────────────────────────

document.getElementById('theme-switch').addEventListener('change', function () {
  document.body.classList.toggle('light-mode', this.checked);
  // Actualiza el color de cuadrícula cacheado para el tema activo
  gridColor = this.checked ? '#c8c8d8' : '#22222e';
});

// ── Arranque ─────────────────────────────────────────────────────────────────

init();
