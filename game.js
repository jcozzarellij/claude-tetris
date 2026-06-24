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
const TOP_COUNT = 5; // cuántas entradas guarda el ranking
const LS_SCORES_KEY = 'tetris_scores';     // localStorage: array de {name, score}
const LS_BEST_COMBO_KEY = 'tetris_best_combo'; // localStorage: número
const LS_MAX_LINES_KEY = 'tetris_max_lines';   // localStorage: número

// ---- Referencias DOM ----
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const comboEl = document.getElementById('combo');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const nameEntry = document.getElementById('name-entry');
const playerNameInput = document.getElementById('player-name');
const saveScoreBtn = document.getElementById('save-score-btn');
const gameoverScores = document.getElementById('gameover-scores');
const gameoverTable = document.getElementById('gameover-table');
const startOverlay = document.getElementById('start-overlay');
const startTable = document.getElementById('start-table');
const statBestCombo = document.getElementById('stat-best-combo');
const statMaxLines = document.getElementById('stat-max-lines');
const playBtn = document.getElementById('play-btn');
const resetRecordsBtn = document.getElementById('reset-records-btn');

// ---- Estado de juego ----
let board, current, next, score, lines, level;
let paused, gameOver;
let lastTime, dropAccum, dropInterval, animId;
// Combo: sube cada vez que una pieza limpia >=1 línea consecutivamente
let combo, maxCombo;
// Bandera: true desde la primera vez que el jugador pulsa "Jugar"
let gameStarted = false;

// ---- localStorage helpers ----

/** Lee el array de records (hasta TOP_COUNT entradas). */
function loadScores() {
  try {
    return JSON.parse(localStorage.getItem(LS_SCORES_KEY)) || [];
  } catch (_) {
    return [];
  }
}

/** Guarda el array de records en localStorage. */
function saveScores(arr) {
  try {
    localStorage.setItem(LS_SCORES_KEY, JSON.stringify(arr));
  } catch (_) { /* cuota superada: ignorar */ }
}

/** Devuelve true si `pts` entra en el top (incluyendo empates con el último). */
function isTopScore(pts) {
  const scores = loadScores();
  return scores.length < TOP_COUNT || pts >= scores[scores.length - 1].score;
}

/**
 * Inserta {name, score} en el ranking, mantiene orden descendente
 * y recorta a TOP_COUNT entradas. Devuelve el índice de la entrada nueva.
 */
function insertScore(name, pts) {
  const normalized = name.trim() || 'Anónimo';
  const scores = loadScores();
  scores.push({ name: normalized, score: pts });
  scores.sort((a, b) => b.score - a.score);
  if (scores.length > TOP_COUNT) scores.length = TOP_COUNT;
  saveScores(scores);
  // Buscar la última posición con este nombre+puntuación para resaltar la recién insertada
  let idx = -1;
  for (let i = 0; i < scores.length; i++) {
    if (scores[i].name === normalized && scores[i].score === pts) idx = i;
  }
  return idx;
}

/** Lee el mejor combo histórico. */
function loadBestCombo() {
  return parseInt(localStorage.getItem(LS_BEST_COMBO_KEY), 10) || 0;
}

/** Actualiza el mejor combo histórico si `val` lo supera. */
function updateBestCombo(val) {
  if (val > loadBestCombo()) {
    try { localStorage.setItem(LS_BEST_COMBO_KEY, val); } catch (_) {}
  }
}

/** Lee el máximo de líneas históricas. */
function loadMaxLines() {
  return parseInt(localStorage.getItem(LS_MAX_LINES_KEY), 10) || 0;
}

/** Actualiza el máximo de líneas si `val` lo supera. */
function updateMaxLines(val) {
  if (val > loadMaxLines()) {
    try { localStorage.setItem(LS_MAX_LINES_KEY, val); } catch (_) {}
  }
}

// ---- Renderizado de tablas de records ----

/**
 * Rellena una <table> con el ranking.
 * @param {HTMLTableElement} tableEl  - elemento tabla destino
 * @param {number|null} highlightIdx - índice de fila a resaltar (-1 o null = ninguna)
 */
function renderScoresTable(tableEl, highlightIdx) {
  const scores = loadScores();
  tableEl.innerHTML = '';

  // Cabecera
  const thead = tableEl.createTHead();
  const headRow = thead.insertRow();
  ['#', 'Nombre', 'Puntuación'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headRow.appendChild(th);
  });

  // Filas
  const tbody = tableEl.createTBody();
  for (let i = 0; i < TOP_COUNT; i++) {
    const tr = tbody.insertRow();
    if (i < scores.length) {
      tr.insertCell().textContent = i + 1;
      tr.insertCell().textContent = scores[i].name;
      tr.insertCell().textContent = scores[i].score.toLocaleString();
      if (i === highlightIdx) tr.classList.add('highlight');
    } else {
      tr.insertCell().textContent = i + 1;
      tr.insertCell().textContent = '-';
      tr.insertCell().textContent = '-';
      tr.classList.add('empty');
    }
  }
}

/** Muestra estadísticas históricas (mejor combo, máx. líneas) en la pantalla de inicio. */
function renderGlobalStats() {
  const bc = loadBestCombo();
  const ml = loadMaxLines();
  statBestCombo.textContent = bc > 0 ? bc : '-';
  statMaxLines.textContent = ml > 0 ? ml : '-';
}

/** Resetea todos los records de localStorage y recarga las tablas. */
function resetRecords() {
  try {
    localStorage.removeItem(LS_SCORES_KEY);
    localStorage.removeItem(LS_BEST_COMBO_KEY);
    localStorage.removeItem(LS_MAX_LINES_KEY);
  } catch (_) {}
  renderScoresTable(startTable, null);
  renderGlobalStats();
}

// ---- Lógica de juego ----

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

/**
 * Elimina las filas completas y actualiza score/lines/level.
 * @returns {number} número de líneas eliminadas
 */
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
  return cleared;
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

/**
 * Fija la pieza actual, actualiza el combo y pasa a la siguiente.
 * clearLines() devuelve el número de líneas limpiadas; si > 0, el combo sube.
 */
function lockPiece() {
  merge();
  const cleared = clearLines();
  if (cleared > 0) {
    combo++;
    if (combo > maxCombo) maxCombo = combo;
  } else {
    combo = 0;
  }
  updateHUD();
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
  comboEl.textContent = combo;
}

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

  // ghost
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

/**
 * Muestra el overlay de game over.
 * Si la puntuación entra en el top 5 → muestra campo de nombre.
 * Siempre muestra la tabla de records.
 */
function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);

  // Persistir estadísticas históricas
  updateBestCombo(maxCombo);
  updateMaxLines(lines);

  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()} | Combo máx: ${maxCombo}`;

  if (isTopScore(score)) {
    // Mostrar entrada de nombre; guardar score se hace al pulsar "Guardar"
    scoreSaved = false; // reset para permitir un único guardado por partida
    nameEntry.classList.remove('hidden');
    gameoverScores.classList.add('hidden');
    playerNameInput.value = '';
    playerNameInput.focus();
  } else {
    // No entra al top: mostrar tabla directamente
    nameEntry.classList.add('hidden');
    renderScoresTable(gameoverTable, null);
    gameoverScores.classList.remove('hidden');
  }

  overlay.classList.remove('hidden');
}

/** Guarda el nombre + puntuación y muestra la tabla resaltando la fila nueva. */
let scoreSaved = false; // guarda contra doble disparo (Enter + clic simultáneos)
function saveScore() {
  if (scoreSaved) return;
  scoreSaved = true;
  const name = playerNameInput.value.trim() || 'Anónimo';
  const idx = insertScore(name, score);
  nameEntry.classList.add('hidden');
  renderScoresTable(gameoverTable, idx);
  gameoverScores.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    nameEntry.classList.add('hidden');
    gameoverScores.classList.add('hidden');
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

/**
 * Inicializa el estado de juego y arranca el loop.
 * Se llama desde playBtn (primera vez) y desde restartBtn (reinicio).
 */
function init() {
  gameStarted = true;
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  combo = 0;
  maxCombo = 0;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  // Ocultar ambos overlays
  overlay.classList.add('hidden');
  startOverlay.classList.add('hidden');
  nameEntry.classList.add('hidden');
  gameoverScores.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

// ---- Event listeners ----

// Botón Jugar (pantalla de inicio)
playBtn.addEventListener('click', init);

// Botón Reiniciar (overlay game over / pausa)
restartBtn.addEventListener('click', init);

// Guardar nombre en game over
saveScoreBtn.addEventListener('click', saveScore);

// También guardar con Enter en el campo de nombre
playerNameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') saveScore();
});

// Resetear records
resetRecordsBtn.addEventListener('click', resetRecords);

// Controles de teclado
document.addEventListener('keydown', e => {
  // Ignorar todo antes de que el jugador haya pulsado "Jugar"
  if (!gameStarted) return;
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

// Toggle de tema (claro/oscuro)
document.getElementById('theme-switch').addEventListener('change', function () {
  document.body.classList.toggle('light-mode', this.checked);
});

// ---- Arranque: mostrar pantalla de inicio ----
// El juego NO auto-arranca; init() se llama cuando el usuario pulsa Jugar.
renderScoresTable(startTable, null);
renderGlobalStats();
