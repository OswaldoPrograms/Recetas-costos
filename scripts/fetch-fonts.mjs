// Descarga las tipografías de Google Fonts a www/fonts para que la app
// funcione sin conexión (necesario en Android/iOS con Capacitor).
// Uso: node scripts/fetch-fonts.mjs
import fs from 'node:fs/promises';
import path from 'node:path';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const FAMILIES = [
  ['Caveat', 'Caveat:wght@500;700', 'caveat'],
  ['Fraunces', 'Fraunces:opsz,wght@9..144,500;9..144,700', 'fraunces'],
  ['Nunito', 'Nunito:wght@400;600;700', 'nunito'],
];

const SUBSETS = ['latin', 'latin-ext'];
const outDir = path.join('www', 'fonts');

await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });

const blocks = [];
const report = [];
const cached = new Map(); // url remota -> archivo local (varias @font-face comparten archivo)

for (const [name, spec, slug] of FAMILIES) {
  const url = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const css = await res.text();

  const re = /\/\*\s*([a-z-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g;
  let m;
  let i = 0;
  while ((m = re.exec(css)) !== null) {
    const subset = m[1];
    if (!SUBSETS.includes(subset)) continue;

    let face = m[2];
    const srcUrl = /url\((https:[^)]+\.woff2)\)/.exec(face);
    if (!srcUrl) continue;

    let file = cached.get(srcUrl[1]);
    if (!file) {
      file = `${slug}-${subset}-${i++}.woff2`;
      const bin = await fetch(srcUrl[1], { headers: { 'User-Agent': UA } });
      if (!bin.ok) throw new Error(`${name}: font HTTP ${bin.status}`);
      const buf = Buffer.from(await bin.arrayBuffer());
      await fs.writeFile(path.join(outDir, file), buf);
      cached.set(srcUrl[1], file);

      report.push(
        `${name.padEnd(9)} ${subset.padEnd(10)} ${String(buf.length).padStart(7)} B  ${file}`,
      );
    }
    face = face.replace(srcUrl[0], `url("./${file}")`);
    blocks.push(face);
  }
}

const header =
  '/* Tipografías alojadas localmente. Generado por scripts/fetch-fonts.mjs\n' +
  '   Licencia SIL Open Font License 1.1 — https://fonts.google.com */\n';
await fs.writeFile(path.join(outDir, 'fonts.css'), header + blocks.join('\n') + '\n');

console.log(report.join('\n'));
console.log('total @font-face:', blocks.length);
