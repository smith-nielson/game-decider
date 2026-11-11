// Stage 1: game list lives in games.json (edit that file to add/remove games).
// Stage 2 swaps this fetch for data from the Go/SQLite backend.
// Logo art is pre-fetched by scripts/fetch-icons.mjs into assets/logos/ — a
// game missing from that manifest just falls back to an emoji icon.
let GAMES = [];
let LOGO_MANIFEST = {};

const ICONS = ['🎲', '🃏', '🎯', '♠️', '♦️', '🎰', '🕹️', '👑', '⭐', '💎'];

const TILE_H = 136; // must match --tile-h in styles.css
const VISIBLE_ROWS = 3;
const REPEATS = 10;
const REEL_DURATIONS = [1900, 2300, 2700];
const REEL_START_DELAYS = [0, 150, 300];
const JACKPOT_CHANCE = 0.3;

const reelEls = [0, 1, 2].map((i) => document.getElementById(`reel-${i}`));
const spinBtn = document.getElementById('spinBtn');
const leverRail = document.getElementById('leverRail');
const leverHandle = document.getElementById('leverHandle');
const resultEl = document.getElementById('result');
const cabinetEl = document.querySelector('.cabinet');
const coinField = document.getElementById('coinField');

const LEVER_REST_BOTTOM = 210;
const LEVER_PULLED_BOTTOM = 7;
const LEVER_TRAVEL = LEVER_REST_BOTTOM - LEVER_PULLED_BOTTOM;
const LEVER_DRAG_THRESHOLD = 0.6;

let spinning = false;
let ready = false;
let dragStartY = null;
let coinRainInterval = null;

function tileContentFor(name) {
  const logo = LOGO_MANIFEST[name];
  // The logo art already spells out the game name, so only show the text
  // label as a fallback for games without one — otherwise it's just noise
  // on top of the image (and shrinks the logo to make room). Every symbol
  // (logo or emoji) sits in the same fixed box so wildly different source
  // image sizes/aspect ratios all read as the same "slot symbol" size.
  if (logo) {
    return `<div class="tile-symbol"><img class="tile-logo" src="assets/logos/${logo.file}" alt="${name}"></div>`;
  }
  const emoji = ICONS[GAMES.indexOf(name) % ICONS.length];
  return `<div class="tile-symbol"><span class="tile-icon">${emoji}</span></div><span class="tile-label">${name}</span>`;
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
    .map((name) => `<div class="tile">${tileContentFor(name)}</div>`)
    .join('');
}

function renderReel(reelEl, winnerName, forceMatch) {
  const longList = [];
  for (let i = 0; i < REPEATS; i++) longList.push(...shuffled(GAMES));

  const minTarget = Math.floor(longList.length * 0.7);
  const maxTarget = longList.length - 2;
  const targetIndex = minTarget + Math.floor(Math.random() * (maxTarget - minTarget));
  if (forceMatch) longList[targetIndex] = winnerName;

  reelEl.style.transition = 'none';
  reelEl.style.transform = 'translateY(0)';
  reelEl.style.filter = 'blur(0px)';
  reelEl.classList.remove('spinning');
  reelEl.innerHTML = buildStrip(longList);

  const offset = -(targetIndex - 1) * TILE_H;
  return offset;
}

function spin() {
  if (spinning || !ready) return;
  spinning = true;
  spinBtn.disabled = true;
  resultEl.classList.remove('show', 'jackpot');
  cabinetEl.classList.remove('jackpot');
  cabinetEl.classList.add('spinning');
  stopCoinRain();

  leverRail.classList.add('pulled');

  const winner = GAMES[Math.floor(Math.random() * GAMES.length)];
  const isJackpot = Math.random() < JACKPOT_CHANCE;

  const offsets = reelEls.map((reelEl) => renderReel(reelEl, winner, isJackpot));

  // Force layout flush so the transition below actually animates from translateY(0).
  reelEls.forEach((reelEl) => reelEl.getBoundingClientRect());

  requestAnimationFrame(() => {
    reelEls.forEach((reelEl, i) => {
      const delay = REEL_START_DELAYS[i];
      const duration = REEL_DURATIONS[i];
      reelEl.style.transition = `transform ${duration}ms cubic-bezier(0.17, 0.89, 0.32, 1) ${delay}ms`;
      reelEl.style.transform = `translateY(${offsets[i]}px)`;
      reelEl.style.animationDelay = `${delay}ms`;
      reelEl.style.animationDuration = `${duration}ms`;
      reelEl.classList.add('spinning');
    });
  });

  const lastReel = reelEls[reelEls.length - 1];
  lastReel.addEventListener('transitionend', () => onSpinComplete(winner, isJackpot), { once: true });
}

function onSpinComplete(winner, isJackpot) {
  spinning = false;
  spinBtn.disabled = false;
  leverRail.classList.remove('pulled');
  cabinetEl.classList.remove('spinning');

  // A miss announces nothing — it just means "spin again." Only a hit
  // reveals tonight's game.
  if (isJackpot) {
    resultEl.textContent = `TONIGHT: ${winner.toUpperCase()}`;
    resultEl.classList.add('show', 'jackpot');
    cabinetEl.classList.add('jackpot');
    startCoinRain();
  }
}

function spawnCoins(count) {
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

function startCoinRain() {
  stopCoinRain();
  spawnCoins(24);
  coinRainInterval = setInterval(() => spawnCoins(4), 220);
}

function stopCoinRain() {
  if (coinRainInterval !== null) {
    clearInterval(coinRainInterval);
    coinRainInterval = null;
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

async function loadGameData() {
  spinBtn.disabled = true;
  spinBtn.querySelector('.spin-btn-label').textContent = 'LOADING...';

  const [games, manifest] = await Promise.all([
    fetch('games.json').then((r) => r.json()),
    fetch('assets/logos/manifest.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
  ]);

  GAMES = games;
  LOGO_MANIFEST = manifest;
  initReels();

  spinBtn.disabled = false;
  spinBtn.querySelector('.spin-btn-label').textContent = 'SPIN';
  ready = true;
}

loadGameData();
