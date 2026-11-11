// Stage 1: hardcoded game list. Stage 2 swaps this for data from the Go/SQLite backend.
const GAMES = [
  'Game One',
  'Game Two',
  'Game Three',
  'Game Four',
  'Game Five',
  'Game Six',
  'Game Seven',
  'Game Eight',
];

const ICONS = ['🎲', '🃏', '🎯', '♠️', '♦️', '🎰', '🕹️', '👑', '⭐', '💎'];

const TILE_H = 112;
const VISIBLE_ROWS = 3;
const REPEATS = 10;
const REEL_DURATIONS = [1900, 2300, 2700];

const reelEls = [0, 1, 2].map((i) => document.getElementById(`reel-${i}`));
const spinBtn = document.getElementById('spinBtn');
const leverRail = document.getElementById('leverRail');
const leverHandle = document.getElementById('leverHandle');
const resultEl = document.getElementById('result');
const cabinetEl = document.querySelector('.cabinet');
const coinField = document.getElementById('coinField');

const LEVER_REST_BOTTOM = 180;
const LEVER_PULLED_BOTTOM = 6;
const LEVER_TRAVEL = LEVER_REST_BOTTOM - LEVER_PULLED_BOTTOM;
const LEVER_DRAG_THRESHOLD = 0.6;

let spinning = false;
let dragStartY = null;

function iconFor(name) {
  return ICONS[GAMES.indexOf(name) % ICONS.length];
}

function shuffled(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildStrip(names) {
  return names
    .map((name) => `<div class="tile"><span class="tile-icon">${iconFor(name)}</span><span class="tile-label">${name}</span></div>`)
    .join('');
}

function renderReel(reelEl, winnerName) {
  const longList = [];
  for (let i = 0; i < REPEATS; i++) longList.push(...shuffled(GAMES));

  const minTarget = Math.floor(longList.length * 0.7);
  const maxTarget = longList.length - 2;
  const targetIndex = minTarget + Math.floor(Math.random() * (maxTarget - minTarget));
  longList[targetIndex] = winnerName;

  reelEl.style.transition = 'none';
  reelEl.style.transform = 'translateY(0)';
  reelEl.innerHTML = buildStrip(longList);

  const offset = -(targetIndex - 1) * TILE_H;
  return offset;
}

function spin() {
  if (spinning) return;
  spinning = true;
  spinBtn.disabled = true;
  resultEl.classList.remove('show', 'jackpot');
  cabinetEl.classList.remove('jackpot');

  leverRail.classList.add('pulled');

  const winner = GAMES[Math.floor(Math.random() * GAMES.length)];

  const offsets = reelEls.map((reelEl) => renderReel(reelEl, winner));

  // Force layout flush so the transition below actually animates from translateY(0).
  reelEls.forEach((reelEl) => reelEl.getBoundingClientRect());

  requestAnimationFrame(() => {
    reelEls.forEach((reelEl, i) => {
      reelEl.style.transition = `transform ${REEL_DURATIONS[i]}ms cubic-bezier(0.17, 0.89, 0.32, 1)`;
      reelEl.style.transform = `translateY(${offsets[i]}px)`;
    });
  });

  const lastReel = reelEls[reelEls.length - 1];
  lastReel.addEventListener('transitionend', () => onSpinComplete(winner), { once: true });
}

function onSpinComplete(winner) {
  spinning = false;
  spinBtn.disabled = false;
  leverRail.classList.remove('pulled');

  resultEl.textContent = `TONIGHT: ${winner.toUpperCase()}`;
  resultEl.classList.add('show', 'jackpot');
  cabinetEl.classList.add('jackpot');

  spawnCoins();
}

function spawnCoins() {
  const count = 24;
  for (let i = 0; i < count; i++) {
    const coin = document.createElement('span');
    coin.className = 'coin';
    coin.textContent = Math.random() < 0.5 ? '🪙' : '💰';
    coin.style.left = `${Math.random() * 100}vw`;
    coin.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
    coin.style.animationDelay = `${Math.random() * 0.5}s`;
    coinField.appendChild(coin);
    coin.addEventListener('animationend', () => coin.remove());
  }
}

function initReels() {
  reelEls.forEach((reelEl) => {
    const list = [];
    for (let i = 0; i < 3; i++) list.push(...shuffled(GAMES));
    reelEl.innerHTML = buildStrip(list);
    reelEl.style.transform = `translateY(${-TILE_H}px)`;
  });
}

function clamp(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value));
}

function handlePointerDown(e) {
  if (spinning) return;
  dragStartY = e.clientY;
  leverHandle.style.transition = 'none';
  leverHandle.classList.add('dragging');
  leverHandle.setPointerCapture(e.pointerId);
}

function handlePointerMove(e) {
  if (dragStartY === null) return;
  const dragged = clamp(e.clientY - dragStartY, 0, LEVER_TRAVEL);
  leverHandle.style.bottom = `${LEVER_REST_BOTTOM - dragged}px`;
}

function handlePointerUp(e) {
  if (dragStartY === null) return;
  const dragged = clamp(e.clientY - dragStartY, 0, LEVER_TRAVEL);
  dragStartY = null;
  leverHandle.classList.remove('dragging');
  leverHandle.style.transition = '';
  leverHandle.style.bottom = '';

  if (dragged / LEVER_TRAVEL >= LEVER_DRAG_THRESHOLD) spin();
}

leverHandle.addEventListener('pointerdown', handlePointerDown);
leverHandle.addEventListener('pointermove', handlePointerMove);
leverHandle.addEventListener('pointerup', handlePointerUp);
leverHandle.addEventListener('pointercancel', handlePointerUp);

spinBtn.addEventListener('click', spin);
leverRail.addEventListener('click', spin);
leverRail.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    spin();
  }
});

initReels();
