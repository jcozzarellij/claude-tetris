# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Game

No build step required — open `index.html` directly in a browser or serve it locally:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

There are no npm packages, no bundler, no transpiler, and no test suite.

## Architecture

Three files, tight coupling:

- **index.html** — DOM structure: two `<canvas>` elements (`#board` 300×600px, `#next-canvas` 120×120px), a stats panel, and a single overlay div for pause/game-over states.
- **style.css** — Dark retro theme; no classes added dynamically by JS except overlay visibility.
- **game.js** — All game logic (~305 lines). Runs on page load with no module system.

### game.js internals

Global state drives everything:

```
board       // 20×10 matrix of color indices (0 = empty)
current     // { shape, x, y, type } — active piece
next        // same shape, queued
score, lines, level
paused, gameOver
lastTime, dropAccum, dropInterval   // timing
animId      // requestAnimationFrame handle
```

Game loop: `init()` → `spawn()` → `requestAnimationFrame(loop)`. Each `loop(ts)` frame: accumulate elapsed time, drop piece when `dropAccum ≥ dropInterval`, call `draw()`, re-request frame. Locking a piece calls `merge()` → `clearLines()` → `spawn()`; if spawn collides immediately, `endGame()` fires.

Rotation uses `rotateCW()` (matrix transpose + row reversal) with wall-kick fallbacks at ±1 and ±2 column offsets via `tryRotate()`.

### Tunable constants (top of game.js)

| Constant | Default | Notes |
|---|---|---|
| `COLS` / `ROWS` | 10 / 20 | Must match canvas pixel dimensions in index.html (COLS×BLOCK, ROWS×BLOCK) |
| `BLOCK` | 30px | Cell size in pixels |
| `LINE_SCORES` | [0,100,300,500,800] | Points for 1–4 simultaneous line clears, multiplied by level |
| Initial `dropInterval` | 1000ms | Decreases by 90ms per level, floors at 100ms |

### Scoring

`LINE_SCORES[n] × level` for `n` lines cleared at once. Hard drop adds 2 pts/row, soft drop adds 1 pt/row. Level = `floor(linesCleared / 10) + 1`.
