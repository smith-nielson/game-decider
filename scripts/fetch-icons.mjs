// One-off tool: NOT served by the site. Run manually to populate assets/logos/
// with real game logo art from SteamGridDB, since the Stage 1 frontend is
// static and must not call SteamGridDB (or hold its API key) at runtime.
//
// Reads game names from games.json (the single editable source of truth for
// the game list) and re-run any time that file changes.
//
// Usage:
//   node --env-file=.env scripts/fetch-icons.mjs
//
// Writes one PNG per game into assets/logos/ plus assets/logos/manifest.json
// mapping each game name to its downloaded file and SteamGridDB source info.

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const API_BASE = 'https://www.steamgriddb.com/api/v2';
const ROOT = path.join(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'logos');
const GAMES_FILE = path.join(ROOT, 'games.json');

const apiKey = process.env.SGDB_API_KEY;
if (!apiKey) {
  console.error('SGDB_API_KEY is not set. Run with: node --env-file=.env scripts/fetch-icons.mjs');
  process.exit(1);
}

async function sgdb(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(`SteamGridDB ${endpoint} failed: ${res.status} ${JSON.stringify(body.errors)}`);
  }
  return body.data;
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const PREFERRED_LANGUAGE = 'en';

function pickBestLogo(logos) {
  if (logos.length === 0) return null;

  // SteamGridDB has no server-side language filter on this endpoint (tested
  // `languages=`/`language=`/`lang=` — all ignored), so it's done here.
  // Without this, the widest image wins regardless of language, and a huge
  // non-English community upload can beat out every English option.
  const englishOnly = logos.filter((l) => l.language === PREFERRED_LANGUAGE);
  const langPool = englishOnly.length > 0 ? englishOnly : logos;

  const official = langPool.filter((l) => l.style === 'official');
  const pool = official.length > 0 ? official : langPool;
  return pool.reduce((best, l) => (l.width > best.width ? l : best), pool[0]);
}

async function fetchGameIcon(name) {
  const results = await sgdb(`/search/autocomplete/${encodeURIComponent(name)}`);
  if (results.length === 0) {
    console.warn(`  no SteamGridDB match for "${name}"`);
    return null;
  }

  const exact = results.find((r) => r.name.toLowerCase() === name.toLowerCase());
  const match = exact ?? results[0];
  if (!exact) console.warn(`  no exact match for "${name}", using closest: "${match.name}" (id ${match.id})`);

  const logos = await sgdb(`/logos/game/${match.id}`);
  const logo = pickBestLogo(logos);
  if (!logo) {
    console.warn(`  "${match.name}" (id ${match.id}) has no logo art on SteamGridDB`);
    return null;
  }

  const imgRes = await fetch(logo.thumb);
  if (!imgRes.ok) throw new Error(`Failed to download image for "${name}": ${imgRes.status}`);
  const bytes = Buffer.from(await imgRes.arrayBuffer());

  const ext = logo.mime === 'image/png' ? 'png' : 'jpg';
  const filename = `${slugify(name)}.${ext}`;
  await writeFile(path.join(OUT_DIR, filename), bytes);

  return {
    sgdbGameId: match.id,
    sgdbGameName: match.name,
    logoId: logo.id,
    language: logo.language,
    file: filename,
    sourceUrl: logo.url,
    author: logo.author?.name ?? null,
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const games = JSON.parse(await readFile(GAMES_FILE, 'utf-8'));
  const manifest = {};

  for (const name of games) {
    console.log(`Fetching "${name}"...`);
    try {
      const entry = await fetchGameIcon(name);
      if (entry) {
        manifest[name] = entry;
        console.log(`  saved assets/logos/${entry.file}`);
      }
    } catch (err) {
      console.error(`  error: ${err.message}`);
    }
  }

  await writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\nDone. ${Object.keys(manifest).length}/${games.length} games resolved.`);
  console.log('See assets/logos/manifest.json');
}

main();
