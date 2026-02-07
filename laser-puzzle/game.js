// ── Constants ──────────────────────────────────────────────────────────

const EMPTY = 0;
const WALL = 1;
const PLAYER = 2;
const MIRROR_SLASH = 3;    // ╱  reflects: right→up, up→right, left→down, down→left
const MIRROR_BACKSLASH = 4; // ╲  reflects: right→down, down→right, left→up, up→left
const LASER = 5;
const TARGET = 6;
const BLOCK = 7;

const DIR = {
    UP:    { dx: 0, dy: -1 },
    DOWN:  { dx: 0, dy:  1 },
    LEFT:  { dx: -1, dy: 0 },
    RIGHT: { dx:  1, dy: 0 },
};

const LASER_DIRS = {
    '▶': DIR.RIGHT,
    '◀': DIR.LEFT,
    '▲': DIR.UP,
    '▼': DIR.DOWN,
    '►': DIR.RIGHT,
    '◄': DIR.LEFT,
};

const CHAR_MAP = {
    '#': WALL,
    '@': PLAYER,
    '╱': MIRROR_SLASH,
    '/': MIRROR_SLASH,
    '╲': MIRROR_BACKSLASH,
    '\\': MIRROR_BACKSLASH,
    '◎': TARGET,
    '◼': BLOCK,
    '.': EMPTY,
    ' ': EMPTY,
};

const DISPLAY = {
    [EMPTY]:            { ch: ' ',  cls: 'cell-empty' },
    [WALL]:             { ch: '█',  cls: 'cell-wall' },
    [PLAYER]:           { ch: '🐶', cls: 'cell-player' },
    [MIRROR_SLASH]:     { ch: '╱',  cls: 'cell-mirror' },
    [MIRROR_BACKSLASH]: { ch: '╲',  cls: 'cell-mirror' },
    [TARGET]:           { ch: '◎',  cls: 'cell-target' },
    [BLOCK]:            { ch: '◼',  cls: 'cell-block' },
};

const LASER_DISPLAY = {
    '▶': '▶', '►': '▶',
    '◀': '◀', '◄': '◀',
    '▲': '▲',
    '▼': '▼',
};

// ── Level Data ─────────────────────────────────────────────────────────

const LEVELS = [
    {
        name: "First Light",
        cols: 9,
        rows: 9,
        grid: [
            "#########",
            "#.......#",
            "#►..╱...#",
            "#..@....#",
            "#...╱.◎.#",
            "#.......#",
            "#.......#",
            "#.......#",
            "#########",
        ]
    },
    {
        name: "Redirect",
        cols: 7,
        rows: 7,
        grid: [
            "#######",
            "#.◎...#",
            "#►....#",
            "#.╱...#",
            "#.....#",
            "#@....#",
            "#######",
        ]
    },
    {
        name: "Periscope",
        cols: 9,
        rows: 9,
        grid: [
            "#########",
            "#.......#",
            "#►..╱...#",
            "#.......#",
            "#.....◎.#",
            "#...╲...#",
            "#.......#",
            "#..@....#",
            "#########",
        ]
    },
    {
        name: "Triple Threat",
        cols: 9,
        rows: 9,
        grid: [
            "#########",
            "#.....◎.#",
            "#►..╱...#",
            "#.......#",
            "#.......#",
            "#...╲...#",
            "#.....╱.#",
            "#..@....#",
            "#########",
        ]
    },
];

// ── Game State ─────────────────────────────────────────────────────────

let state = {
    grid: [],           // 2D array of cell types
    cols: 0,
    rows: 0,
    playerX: 0,
    playerY: 0,
    laserX: 0,
    laserY: 0,
    laserDir: null,
    laserChar: '▶',
    beam: [],
    moves: 0,
    levelIndex: 0,
    won: false,
    dead: false,
    initialGrid: [],    // for reset
    score: 0,           // accumulated score across levels
};

// ── DOM References ─────────────────────────────────────────────────────

let gridEl, canvasEl, ctx, cells;
let cellSize = 0;
let boardOffsetX = 0, boardOffsetY = 0;

// ── Level Parsing ──────────────────────────────────────────────────────

function parseLevel(levelData) {
    const rows = levelData.rows;
    const cols = levelData.cols;
    const grid = [];
    let playerX = 0, playerY = 0;
    let laserX = 0, laserY = 0, laserDir = null, laserChar = '▶';

    for (let y = 0; y < rows; y++) {
        const row = [];
        const line = levelData.grid[y] || '';
        // Parse the string character by character, handling multi-byte Unicode
        const chars = [...line];
        for (let x = 0; x < cols; x++) {
            const ch = chars[x] || '.';
            if (LASER_DIRS[ch]) {
                laserX = x;
                laserY = y;
                laserDir = LASER_DIRS[ch];
                laserChar = ch;
                row.push(LASER);
            } else if (ch === '@') {
                playerX = x;
                playerY = y;
                row.push(PLAYER);
            } else {
                row.push(CHAR_MAP[ch] !== undefined ? CHAR_MAP[ch] : EMPTY);
            }
        }
        grid.push(row);
    }

    return { grid, cols, rows, playerX, playerY, laserX, laserY, laserDir, laserChar };
}

function deepCopyGrid(grid) {
    return grid.map(row => [...row]);
}

function loadLevel(index) {
    const levelData = LEVELS[index];
    const parsed = parseLevel(levelData);

    state.cols = parsed.cols;
    state.rows = parsed.rows;
    state.grid = parsed.grid;
    state.playerX = parsed.playerX;
    state.playerY = parsed.playerY;
    state.laserX = parsed.laserX;
    state.laserY = parsed.laserY;
    state.laserDir = parsed.laserDir;
    state.laserChar = parsed.laserChar;
    state.moves = 0;
    state.won = false;
    state.dead = false;
    state.levelIndex = index;
    state.initialGrid = deepCopyGrid(parsed.grid);
    state.beam = [];

    document.getElementById('level-name').textContent = levelData.name;
    updateMoveCounter();
}

// ── Grid Rendering ─────────────────────────────────────────────────────

function createGrid() {
    gridEl = document.getElementById('grid');
    canvasEl = document.getElementById('beam-canvas');
    ctx = canvasEl.getContext('2d');

    computeLayout();
    buildCells();
    renderGrid();
    // Position canvas after DOM layout is complete
    requestAnimationFrame(() => {
        positionCanvas();
        calculateAndDrawBeam();
    });
}

function computeLayout() {
    const container = document.getElementById('board-container');
    const availW = container.clientWidth;
    const availH = container.clientHeight;

    cellSize = Math.floor(Math.min(availW / state.cols, availH / state.rows));
    const gridW = cellSize * state.cols;
    const gridH = cellSize * state.rows;

    gridEl.style.gridTemplateColumns = `repeat(${state.cols}, ${cellSize}px)`;
    gridEl.style.gridTemplateRows = `repeat(${state.rows}, ${cellSize}px)`;
    gridEl.style.width = gridW + 'px';
    gridEl.style.height = gridH + 'px';

    canvasEl.width = gridW;
    canvasEl.height = gridH;
    canvasEl.style.width = gridW + 'px';
    canvasEl.style.height = gridH + 'px';

}

function positionCanvas() {
    const gridRect = gridEl.getBoundingClientRect();
    const containerRect = gridEl.parentElement.getBoundingClientRect();
    canvasEl.style.left = (gridRect.left - containerRect.left) + 'px';
    canvasEl.style.top = (gridRect.top - containerRect.top) + 'px';
}

function buildCells() {
    gridEl.innerHTML = '';
    cells = [];
    for (let y = 0; y < state.rows; y++) {
        const row = [];
        for (let x = 0; x < state.cols; x++) {
            const div = document.createElement('div');
            div.className = 'cell';
            div.style.fontSize = Math.floor(cellSize * 0.6) + 'px';
            div.dataset.x = x;
            div.dataset.y = y;
            gridEl.appendChild(div);
            row.push(div);
        }
        cells.push(row);
    }
}

function renderGrid() {
    for (let y = 0; y < state.rows; y++) {
        for (let x = 0; x < state.cols; x++) {
            const cellType = state.grid[y][x];
            const div = cells[y][x];

            if (cellType === LASER) {
                div.textContent = LASER_DISPLAY[state.laserChar] || '▶';
                div.className = 'cell cell-laser';
            } else {
                const info = DISPLAY[cellType];
                div.textContent = info.ch;
                div.className = 'cell ' + info.cls;
            }
        }
    }
}

function updateMoveCounter() {
    document.getElementById('move-counter').textContent = 'Züge: ' + state.moves;
}

function updateScoreDisplay() {
    document.getElementById('score-display').textContent = state.score;
}

function updateBestDisplay() {
    const best = parseInt(localStorage.getItem('laserBestScore') || '0', 10);
    const el = document.getElementById('best-display');
    if (best > 0) {
        el.textContent = 'Best: ' + best;
        el.style.display = '';
    } else {
        el.style.display = 'none';
    }
}

// ── Beam Physics ───────────────────────────────────────────────────────

function calculateBeam() {
    const beam = [];
    let x = state.laserX;
    let y = state.laserY;
    let dir = { ...state.laserDir };

    // Limit iterations to prevent infinite loops
    const maxSteps = state.cols * state.rows * 4;
    let steps = 0;
    let hitTarget = false;
    let hitPlayer = false;

    while (steps++ < maxSteps) {
        const nx = x + dir.dx;
        const ny = y + dir.dy;

        if (nx < 0 || nx >= state.cols || ny < 0 || ny >= state.rows) break;

        const cell = state.grid[ny][nx];

        if (cell === WALL || cell === BLOCK) {
            break;
        }

        if (cell === PLAYER) {
            beam.push({ x: nx, y: ny });
            hitPlayer = true;
            break;
        }

        if (cell === TARGET) {
            beam.push({ x: nx, y: ny });
            hitTarget = true;
            break;
        }

        if (cell === MIRROR_SLASH) {
            beam.push({ x: nx, y: ny });
            // ╱: right→up, up→right, left→down, down→left
            const newDir = { dx: -dir.dy, dy: -dir.dx };
            dir = newDir;
            x = nx;
            y = ny;
            continue;
        }

        if (cell === MIRROR_BACKSLASH) {
            beam.push({ x: nx, y: ny });
            // ╲: right→down, down→right, left→up, up→left
            const newDir = { dx: dir.dy, dy: dir.dx };
            dir = newDir;
            x = nx;
            y = ny;
            continue;
        }

        // EMPTY or LASER (beam passes through laser source cell... but laser is origin)
        beam.push({ x: nx, y: ny });
        x = nx;
        y = ny;
    }

    return { beam, hitTarget, hitPlayer };
}

// ── Canvas Beam Rendering ──────────────────────────────────────────────

function drawBeam(beam, isWin) {
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    if (beam.length === 0) return;

    const half = cellSize / 2;

    // Build the full path including the laser source
    const points = [
        { x: state.laserX * cellSize + half, y: state.laserY * cellSize + half },
    ];
    for (const seg of beam) {
        points.push({ x: seg.x * cellSize + half, y: seg.y * cellSize + half });
    }

    // Glow layer (wider, semi-transparent)
    ctx.save();
    ctx.strokeStyle = isWin ? 'rgba(255, 214, 0, 0.15)' : 'rgba(255, 23, 68, 0.15)';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.restore();

    // Mid glow
    ctx.save();
    ctx.strokeStyle = isWin ? 'rgba(255, 214, 0, 0.35)' : 'rgba(255, 23, 68, 0.35)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.restore();

    // Core beam
    ctx.save();
    ctx.strokeStyle = isWin ? '#ffd600' : '#ff1744';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = isWin ? '#ffd600' : '#ff1744';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.restore();
}

function calculateAndDrawBeam() {
    const result = calculateBeam();
    state.beam = result.beam;
    drawBeam(result.beam, false);
    return result;
}

// ── Player Movement ────────────────────────────────────────────────────

function inBounds(x, y) {
    return x >= 0 && x < state.cols && y >= 0 && y < state.rows;
}

function isMoveable(cellType) {
    return cellType === MIRROR_SLASH || cellType === MIRROR_BACKSLASH || cellType === BLOCK;
}

function movePlayer(dx, dy) {
    if (state.won || state.dead) return;

    const nx = state.playerX + dx;
    const ny = state.playerY + dy;

    if (!inBounds(nx, ny)) return;

    const targetCell = state.grid[ny][nx];

    if (targetCell === WALL || targetCell === LASER || targetCell === TARGET) return;

    if (isMoveable(targetCell)) {
        // Try to push
        const pushX = nx + dx;
        const pushY = ny + dy;

        if (!inBounds(pushX, pushY)) return;

        const behindCell = state.grid[pushY][pushX];
        if (behindCell !== EMPTY) return;

        // Push the block
        state.grid[pushY][pushX] = targetCell;
        state.grid[ny][nx] = PLAYER;
        state.grid[state.playerY][state.playerX] = EMPTY;
        state.playerX = nx;
        state.playerY = ny;
    } else if (targetCell === EMPTY) {
        state.grid[ny][nx] = PLAYER;
        state.grid[state.playerY][state.playerX] = EMPTY;
        state.playerX = nx;
        state.playerY = ny;
    } else {
        return; // Can't move there
    }

    state.moves++;
    updateMoveCounter();
    renderGrid();

    const result = calculateAndDrawBeam();

    if (result.hitPlayer) {
        handleDeath();
    } else if (result.hitTarget) {
        handleWin();
    }
}

// ── Mirror Rotation ────────────────────────────────────────────────────

function rotateMirror(x, y) {
    if (state.won || state.dead) return;

    const cell = state.grid[y][x];
    if (cell === MIRROR_SLASH) {
        state.grid[y][x] = MIRROR_BACKSLASH;
    } else if (cell === MIRROR_BACKSLASH) {
        state.grid[y][x] = MIRROR_SLASH;
    } else {
        return;
    }

    state.moves++;
    updateMoveCounter();
    renderGrid();

    const result = calculateAndDrawBeam();

    if (result.hitPlayer) {
        handleDeath();
    } else if (result.hitTarget) {
        handleWin();
    }
}

function isAdjacentToPlayer(x, y) {
    const dx = Math.abs(x - state.playerX);
    const dy = Math.abs(y - state.playerY);
    return (dx + dy) === 1;
}

// ── Game Flow ──────────────────────────────────────────────────────────

function handleDeath() {
    state.dead = true;

    // Player cell pulses red
    const playerCell = cells[state.playerY][state.playerX];
    playerCell.classList.add('death-pulse');

    // Screen shake + flash
    gridEl.classList.add('death-flash');
    gridEl.classList.add('death-shake');

    setTimeout(() => {
        gridEl.classList.remove('death-flash');
        gridEl.classList.remove('death-shake');
        playerCell.classList.remove('death-pulse');
        resetLevel();
    }, 1000);
}

function handleWin() {
    state.won = true;

    // Calculate score for this level
    const levelPoints = Math.max(0, 5000 - state.moves * 50);
    state.score += levelPoints;
    updateScoreDisplay();

    // Persist best score
    const best = parseInt(localStorage.getItem('laserBestScore') || '0', 10);
    if (state.score > best) {
        localStorage.setItem('laserBestScore', String(state.score));
    }
    updateBestDisplay();

    // Redraw beam in gold
    drawBeam(state.beam, true);
    canvasEl.classList.add('win-beam');

    // Target glow burst
    const targetCell = findTargetCell();
    if (targetCell) targetCell.classList.add('target-burst');

    // Sparkle overlay
    showSparkles();

    setTimeout(() => {
        canvasEl.classList.remove('win-beam');
        if (targetCell) targetCell.classList.remove('target-burst');
        removeSparkles();

        const hasNext = state.levelIndex < LEVELS.length - 1;
        const totalMsg = `\nPunkte: +${levelPoints}  |  Gesamt: ${state.score}`;
        showOverlay(
            'Level geschafft!',
            `Gelöst in ${state.moves} Zügen${totalMsg}`,
            hasNext ? 'Nächstes Level' : 'Nochmal spielen',
            'win-title',
            hasNext ? () => nextLevel() : () => { state.score = 0; updateScoreDisplay(); resetLevel(); }
        );
    }, 2400);
}

function nextLevel() {
    hideOverlay();
    state.levelIndex++;
    loadLevel(state.levelIndex);
    createGrid();
}

function findTargetCell() {
    for (let y = 0; y < state.rows; y++) {
        for (let x = 0; x < state.cols; x++) {
            if (state.grid[y][x] === TARGET) return cells[y][x];
        }
    }
    return null;
}

function showSparkles() {
    const container = document.getElementById('board-container');
    const sparkleContainer = document.createElement('div');
    sparkleContainer.id = 'sparkle-container';
    for (let i = 0; i < 20; i++) {
        const s = document.createElement('div');
        s.className = 'sparkle';
        s.style.left = Math.random() * 100 + '%';
        s.style.top = Math.random() * 100 + '%';
        s.style.animationDelay = Math.random() * 0.5 + 's';
        s.style.animationDuration = (0.6 + Math.random() * 0.8) + 's';
        sparkleContainer.appendChild(s);
    }
    container.appendChild(sparkleContainer);
}

function removeSparkles() {
    const el = document.getElementById('sparkle-container');
    if (el) el.remove();
}

function resetLevel() {
    hideOverlay();
    const levelData = LEVELS[state.levelIndex];
    const parsed = parseLevel(levelData);

    state.grid = parsed.grid;
    state.playerX = parsed.playerX;
    state.playerY = parsed.playerY;
    state.moves = 0;
    state.won = false;
    state.dead = false;
    state.beam = [];

    updateMoveCounter();
    renderGrid();
    calculateAndDrawBeam();
}

function showOverlay(title, message, btnText, titleClass, onBtn) {
    const overlay = document.getElementById('overlay');
    const titleEl = document.getElementById('overlay-title');
    const msgEl = document.getElementById('overlay-message');
    const btnEl = document.getElementById('overlay-btn');

    titleEl.textContent = title;
    titleEl.className = titleClass || '';
    msgEl.textContent = message;
    btnEl.textContent = btnText;

    btnEl.onclick = () => {
        onBtn();
    };

    overlay.classList.remove('hidden');
}

function hideOverlay() {
    document.getElementById('overlay').classList.add('hidden');
}

// ── Input Handling ─────────────────────────────────────────────────────

// Touch
let touchStartX = 0, touchStartY = 0, touchStartTime = 0;

function handleTouchStart(e) {
    if (state.won || state.dead) return;
    e.preventDefault();
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
}

function handleTouchEnd(e) {
    if (state.won || state.dead) return;
    e.preventDefault();
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const elapsed = Date.now() - touchStartTime;

    const SWIPE_THRESHOLD = 30;
    const TAP_THRESHOLD = 15;

    if (dist > SWIPE_THRESHOLD) {
        // Swipe
        if (Math.abs(dx) > Math.abs(dy)) {
            movePlayer(dx > 0 ? 1 : -1, 0);
        } else {
            movePlayer(0, dy > 0 ? 1 : -1);
        }
    } else if (dist < TAP_THRESHOLD && elapsed < 300) {
        // Tap — find the tapped cell
        const rect = gridEl.getBoundingClientRect();
        const cx = touch.clientX - rect.left;
        const cy = touch.clientY - rect.top;
        const cellX = Math.floor(cx / cellSize);
        const cellY = Math.floor(cy / cellSize);

        if (inBounds(cellX, cellY) && isAdjacentToPlayer(cellX, cellY)) {
            const cell = state.grid[cellY][cellX];
            if (cell === MIRROR_SLASH || cell === MIRROR_BACKSLASH) {
                rotateMirror(cellX, cellY);
            }
        }
    }
}

// Keyboard
function handleKeyDown(e) {
    if (state.won || state.dead) return;

    switch (e.key) {
        case 'ArrowUp':    case 'w': case 'W': e.preventDefault(); movePlayer(0, -1); break;
        case 'ArrowDown':  case 's': case 'S': e.preventDefault(); movePlayer(0, 1);  break;
        case 'ArrowLeft':  case 'a': case 'A': e.preventDefault(); movePlayer(-1, 0); break;
        case 'ArrowRight': case 'd': case 'D': e.preventDefault(); movePlayer(1, 0);  break;
        case 'r': case 'R': resetLevel(); break;
    }
}

// Mouse click
function handleClick(e) {
    if (state.won || state.dead) return;

    const rect = gridEl.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const cellX = Math.floor(cx / cellSize);
    const cellY = Math.floor(cy / cellSize);

    if (inBounds(cellX, cellY) && isAdjacentToPlayer(cellX, cellY)) {
        const cell = state.grid[cellY][cellX];
        if (cell === MIRROR_SLASH || cell === MIRROR_BACKSLASH) {
            rotateMirror(cellX, cellY);
        }
    }
}

// ── Resize Handling ────────────────────────────────────────────────────

function handleResize() {
    computeLayout();
    // Update font sizes
    for (let y = 0; y < state.rows; y++) {
        for (let x = 0; x < state.cols; x++) {
            cells[y][x].style.fontSize = Math.floor(cellSize * 0.6) + 'px';
        }
    }
    requestAnimationFrame(() => {
        positionCanvas();
        drawBeam(state.beam, state.won);
    });
}

// ── Initialization ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    loadLevel(0);
    createGrid();
    updateScoreDisplay();
    updateBestDisplay();

    const container = document.getElementById('board-container');
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: false });

    gridEl.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);

    document.getElementById('reset-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        resetLevel();
    });

    document.getElementById('help-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('help-overlay').classList.remove('hidden');
    });

    document.getElementById('help-close-btn').addEventListener('click', () => {
        document.getElementById('help-overlay').classList.add('hidden');
    });

    document.getElementById('help-overlay').addEventListener('click', (e) => {
        if (e.target === document.getElementById('help-overlay')) {
            document.getElementById('help-overlay').classList.add('hidden');
        }
    });

    window.addEventListener('resize', () => {
        clearTimeout(window._resizeTimer);
        window._resizeTimer = setTimeout(handleResize, 100);
    });
});
