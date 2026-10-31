// Genera www/data.js con personajes, armas y sets desde el paquete genshin-db.
const fs = require('fs');
const path = require('path');
const gdb = require('genshin-db');
try { gdb.setOptions({ v4Props: true }); } catch (e) {}

const pick = (o, ...ks) => { for (const k of ks) if (o && o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k]; return undefined; };
const r1 = n => Math.round(n * 10) / 10;
const norm = s => String(s || '').replace(/[’‘`]/g, "'").toLowerCase().trim();

// Convierte una estadística secundaria al formato de la app (porcentajes en %, MA en valor plano).
function mapStat(label, v) {
  const t = norm(label);
  if (!t || !Number.isFinite(v)) return null;
  if (t.includes('crit rate')) return ['cr', r1(v * 100)];
  if (t.includes('crit dmg')) return ['cd', r1(v * 100)];
  if (t.includes('mastery')) return ['em', r1(v < 5 ? v * 100 : v)];
  if (t.includes('energy') || t.includes('heal')) return null;
  if (t.includes('dmg bonus') || t.includes('physical')) return ['dmg', r1(v * 100)];
  if (/^hp/.test(t)) return ['hpP', r1(v * 100)];
  if (/^def/.test(t)) return ['dfP', r1(v * 100)];
  if (/^atk/.test(t)) return ['atkP', r1(v * 100)];
  return null;
}
const ELS = ['Pyro', 'Hydro', 'Anemo', 'Electro', 'Dendro', 'Cryo', 'Geo'];
const elOf = c => { const t = String(pick(c, 'elementText', 'element') || ''); return ELS.find(e => t.toLowerCase().includes(e.toLowerCase())) || ''; };

const names = list => (Array.isArray(list) ? list : []);
const out = { chars: {}, weapons: {}, sets: {} };
const problems = [];

// ---------- Personajes ----------
const cNames = names(gdb.characters('names', { matchCategories: true }));
let dumped = false;
for (const n of cNames) {
  try {
    const c = gdb.characters(n);
    if (!c) continue;
    if (!dumped) { console.log('Campos de personaje:', Object.keys(c).join(', ')); dumped = true; }
    if (typeof c.stats !== 'function') { problems.push('sin stats(): ' + n); continue; }
    const s = c.stats(90);
    if (!s) { problems.push('sin stats a nivel 90: ' + n); continue; }
    const e = { el: elOf(c), atk: r1(s.attack), hp: Math.round(s.hp), def: r1(s.defense) };
    const m = mapStat(pick(c, 'substatText', 'substat'), s.specialized);
    if (m) e[m[0]] = m[1];
    e.wt = String(pick(c, 'weaponText', 'weapontype') || '');
    e.rar = Number(pick(c, 'rarity')) || 0;
    out.chars[String(pick(c, 'name') || n)] = e;
  } catch (err) { problems.push('personaje ' + n + ': ' + err.message); }
}

// ---------- Armas ----------
const wNames = names(gdb.weapons('names', { matchCategories: true }));
dumped = false;
for (const n of wNames) {
  try {
    const w = gdb.weapons(n);
    if (!w) continue;
    if (!dumped) { console.log('Campos de arma:', Object.keys(w).join(', ')); dumped = true; }
    if (typeof w.stats !== 'function') { problems.push('sin stats(): ' + n); continue; }
    let s = null;
    for (const lv of [90, 70]) { s = w.stats(lv); if (s) break; }
    if (!s) { problems.push('sin stats: ' + n); continue; }
    const e = { atk: r1(s.attack) };
    const m = mapStat(pick(w, 'mainStatText', 'substat'), s.specialized);
    if (m) e[m[0]] = m[1];
    e.wt = String(pick(w, 'weaponText', 'weapontype') || '');
    e.rar = Number(pick(w, 'rarity')) || 0;
    out.weapons[String(pick(w, 'name') || n)] = e;
  } catch (err) { problems.push('arma ' + n + ': ' + err.message); }
}

// ---------- Sets de artefactos ----------
// Bonos numericos de 2 piezas (el paquete solo trae el texto). Lo que no esta aqui queda en 0 y se muestra el texto.
const A = 18, ELE = 15;
const NUM2 = {
  "gladiator's finale": { atkP: A }, "shimenawa's reminiscence": { atkP: A }, "wanderer's troupe": { em: 80 },
  "noblesse oblige": {}, "bloodstained chivalry": { dmg: 25 }, "pale flame": { dmg: 25 },
  "viridescent venerer": { dmg: ELE, el: 'Anemo' }, "crimson witch of flames": { dmg: ELE, el: 'Pyro' },
  "lavawalker": {}, "thundering fury": { dmg: ELE, el: 'Electro' }, "blizzard strayer": { dmg: ELE, el: 'Cryo' },
  "heart of depth": { dmg: ELE, el: 'Hydro' }, "archaic petra": { dmg: ELE, el: 'Geo' },
  "deepwood memories": { dmg: ELE, el: 'Dendro' }, "gilded dreams": { em: 80 }, "desert pavilion chronicle": { dmg: ELE, el: 'Anemo' },
  "flower of paradise lost": { em: 80 }, "nymph's dream": { dmg: ELE, el: 'Hydro' }, "vourukasha's glow": { hpP: 20 },
  "vermillion hereafter": { atkP: A }, "echoes of an offering": { atkP: A }, "husk of opulent dreams": { dfP: 30 },
  "tenacity of the millelith": { hpP: 20 }, "berserker": { cr: 12 }, "instructor": { em: 80 },
  "defender's will": { dfP: 30 }, "brave heart": { atkP: A }, "resolution of sojourner": { atkP: A },
  "nighttime whispers in the echoing woods": { atkP: A }, "fragment of harmonic whimsy": { atkP: A },
  "unfinished reverie": { atkP: A }, "night of the sky's unveiling": { em: 80 }, "golden troupe": {},
  "retracing bolide": {}, "martial artist": {}, "gambler": {}, "marechaussee hunter": {}
};
const sNames = names(gdb.artifacts('names', { matchCategories: true }));
dumped = false;
for (const n of sNames) {
  try {
    const a = gdb.artifacts(n);
    if (!a) continue;
    if (!dumped) { console.log('Campos de artefacto:', Object.keys(a).join(', ')); dumped = true; }
    const name = String(pick(a, 'name') || n);
    const e = { ...(NUM2[norm(name)] || {}) };
    e.t2 = String(pick(a, '2pc', 'effect2Pc') || '').slice(0, 300);
    e.t4 = String(pick(a, '4pc', 'effect4Pc') || '').slice(0, 400);
    out.sets[name] = e;
  } catch (err) { problems.push('set ' + n + ': ' + err.message); }
}

// ---------- Salida ----------
let ver = '?';
try { ver = JSON.parse(fs.readFileSync(path.join(__dirname, 'node_modules', 'genshin-db', 'package.json'), 'utf8')).version; } catch (e) {}
const meta = { src: 'genshin-db ' + ver, date: new Date().toISOString().slice(0, 10), chars: Object.keys(out.chars).length, weapons: Object.keys(out.weapons).length, sets: Object.keys(out.sets).length };
console.log(JSON.stringify(meta));
if (problems.length) console.log('Avisos (' + problems.length + '):\n' + problems.slice(0, 40).join('\n'));
if (meta.chars < 20 || meta.weapons < 50) { console.error('Datos insuficientes: no se escribe data.js'); process.exit(1); }
fs.writeFileSync(path.join(__dirname, 'www', 'data.js'), 'window.GENSHIN_DATA=' + JSON.stringify(out) + ';window.GENSHIN_META=' + JSON.stringify(meta) + ';\n');
console.log('www/data.js escrito');
