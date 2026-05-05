#!/usr/bin/env node
// Seed the local library with a known-good set of canonical anime mal_ids.
// Run with the dev server up: `node scripts/seed.mjs`.

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

// [user_label, mal_id_of_canonical_show]
const ENTRIES = [
  ['My Hero Academia', 31964],
  ['Solo Leveling', 52299],
  ['Jujutsu Kaisen', 40748],
  ['Attack on Titan', 16498],
  ['Demon Slayer: Kimetsu no Yaiba', 38000],
  ['Kaiju No. 8', 52588],
  ['Dr. Stone', 38691],
  ["Hell's Paradise: Jigokuraku", 46569],
  ['The Rising of the Shield Hero', 35790],
  ['Baki', 34443],
  ['Fullmetal Alchemist: Brotherhood', 5114],
  ['Sakamoto Days', 58939],
  ['Chainsaw Man', 44511],
  ['Gachiakuta', 59062],
  ['Fire Force', 38671],
  ['Spy x Family', 50265],
  ['Blue Lock', 49596],
  ['Tokyo Revengers', 42249],
  ['Naruto', 20],
  ['Hunter x Hunter (2011)', 11061],
  ['Yu-Gi-Oh! Duel Monsters', 481],
  ['Yu-Gi-Oh! Duel Monsters GX', 482],
  ['Black Clover', 34572],
  ["Kuroko's Basketball", 11771],
  ['Dandadan', 57334],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function addEntry(malId) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${BASE}/api/entries`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ malId }),
    });
    if (res.ok) return res.json();
    if (res.status === 429 || res.status === 502 || res.status === 503) {
      const backoff = 2000 + attempt * 2000;
      console.warn(`  retry ${attempt + 1} in ${backoff}ms (status=${res.status})`);
      await sleep(backoff);
      continue;
    }
    throw new Error(`status=${res.status} body=${await res.text()}`);
  }
  throw new Error('exhausted retries');
}

let added = 0;
let existing = 0;
let missed = 0;

for (const [label, malId] of ENTRIES) {
  try {
    const result = await addEntry(malId);
    const tag = result.existed ? 'already' : 'added';
    if (result.existed) existing += 1;
    else added += 1;
    const title = result.data?.anime?.title ?? '?';
    console.log(`${result.existed ? '·' : '✓'} ${label.padEnd(36)} → ${title} (mal_id=${malId}) [${tag}]`);
  } catch (err) {
    console.error(`✗ ${label.padEnd(36)} (mal_id=${malId}) — ${err.message}`);
    missed += 1;
  }
  await sleep(1500);
}

console.log(`\nDone. added=${added} existing=${existing} missed=${missed}`);
