#!/usr/bin/env node
// Genera los iconos de Android, la PWA y las pantallas de inicio a partir del
// logo vectorial en assets/icon.svg.
//
// Uso: npm run icons
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
const SRC = path.join(ROOT, 'assets', 'icon.svg');

// Color de fondo del logo (muestreado del propio SVG)
const CREAM = '#FAEACF';
// Redondeo de las esquinas, como fracción del lado
const RADIUS = 0.225;

// Proporción del lienzo adaptativo (108dp) que ocupa la ilustración: llena el
// área visible (72dp) y se recorta un poco bajo la máscara del launcher.
const ADAPTIVE_ART = 0.72;
// Icono "maskable" de la PWA: margen suficiente para cualquier máscara.
const MASKABLE_ART = 0.8;
// Tamaño del logo en la pantalla de inicio, respecto al lado menor.
const SPLASH_ART = 0.42;

let cached = null;

/** SVG limpio: sin metadatos XMP ni el cuadrado blanco opaco del fondo. */
async function artwork() {
  if (cached) return cached;
  let svg = await fs.readFile(SRC, 'utf8');
  svg = svg.replace(/<metadata[\s\S]*?<\/metadata>/i, '');
  // Illustrator lo escribe como <path ...></path>, no como <path .../>.
  svg = svg.replace(/<path\b[^>]*fill="#FEFEFD"[^>]*>(?:<\/path>)?/gi, '');
  cached = Buffer.from(svg, 'utf8');
  return cached;
}

/** El logo renderizado a `size` px (transparente fuera del marco redondeado). */
async function art(size) {
  const px = Math.max(1, Math.round(size));
  return sharp(await artwork())
    .resize(px, px, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

const maskSvg = (size, shape) => {
  const body =
    shape === 'circle'
      ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/>`
      : shape === 'square'
        ? `<rect width="${size}" height="${size}" fill="#fff"/>`
        : `<rect width="${size}" height="${size}" rx="${size * RADIUS}" ry="${size * RADIUS}" fill="#fff"/>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${body}</svg>`);
};

/**
 * Icono opaco sobre el crema del logo (las sombras del dibujo se funden con él)
 * y recortado a la forma pedida: 'rounded', 'circle' o 'square'.
 */
async function icon(size, { scale = 1, shape = 'rounded' } = {}) {
  const inner = Math.round(size * scale);
  const logo = await art(inner);
  const composed = await sharp({
    create: { width: size, height: size, channels: 4, background: CREAM },
  })
    .composite([
      { input: logo, left: Math.round((size - inner) / 2), top: Math.round((size - inner) / 2) },
    ])
    .png()
    .toBuffer();

  if (shape === 'square') return composed;
  return sharp(composed).composite([{ input: maskSvg(size, shape), blend: 'dest-in' }]).png().toBuffer();
}

/**
 * Icono con transparencia (el que usa Android como capa frontal adaptativa:
 * se apoya sobre la capa de fondo crema).
 */
async function transparentIcon(size, { scale = 1 } = {}) {
  const inner = Math.round(size * scale);
  const logo = await art(inner);
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: logo, left: Math.round((size - inner) / 2), top: Math.round((size - inner) / 2) },
    ])
    .png()
    .toBuffer();
}

/** Pantalla de inicio: fondo liso del logo + logo centrado. */
async function splash(w, h) {
  const inner = Math.round(Math.min(w, h) * SPLASH_ART);
  const logo = await art(inner);
  return sharp({ create: { width: w, height: h, channels: 3, background: CREAM } })
    .composite([{ input: logo, left: Math.round((w - inner) / 2), top: Math.round((h - inner) / 2) }])
    .png()
    .toBuffer();
}

const assetsDir = path.join(ROOT, 'assets');
const iconsDir = path.join(ROOT, 'www', 'icons');
await fs.mkdir(iconsDir, { recursive: true });

// --- Fuentes maestras ---
await fs.writeFile(path.join(assetsDir, 'icon.png'), await icon(1024));
await fs.writeFile(path.join(assetsDir, 'icon-foreground.png'), await transparentIcon(1024, { scale: ADAPTIVE_ART }));
await fs.writeFile(
  path.join(assetsDir, 'icon-background.png'),
  await sharp({ create: { width: 1024, height: 1024, channels: 3, background: CREAM } }).png().toBuffer(),
);
await fs.writeFile(path.join(assetsDir, 'splash.png'), await splash(2732, 2732));

// --- PWA ---
await fs.writeFile(path.join(iconsDir, 'icon-192.png'), await icon(192));
await fs.writeFile(path.join(iconsDir, 'icon-512.png'), await icon(512));
await fs.writeFile(path.join(iconsDir, 'icon-maskable-512.png'), await icon(512, { scale: MASKABLE_ART, shape: 'square' }));
await fs.writeFile(path.join(iconsDir, 'apple-touch-icon.png'), await icon(180, { shape: 'square' }));

// --- Android: iconos ---
const launcher = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [dpi, size] of Object.entries(launcher)) {
  const dir = path.join(RES, `mipmap-${dpi}`);
  await fs.writeFile(path.join(dir, 'ic_launcher.png'), await icon(size));
  await fs.writeFile(path.join(dir, 'ic_launcher_round.png'), await icon(size, { shape: 'circle' }));
  // Lienzo adaptativo: 108dp = 2.25 veces el icono de 48dp
  const fg = Math.round(size * 2.25);
  await fs.writeFile(path.join(dir, 'ic_launcher_foreground.png'), await transparentIcon(fg, { scale: ADAPTIVE_ART }));
}

// --- Android: pantalla de inicio (mismos tamaños que la plantilla) ---
const splashes = {
  'drawable/splash.png': [480, 320],
  'drawable-land-mdpi/splash.png': [480, 320],
  'drawable-land-hdpi/splash.png': [800, 480],
  'drawable-land-xhdpi/splash.png': [1280, 720],
  'drawable-land-xxhdpi/splash.png': [1600, 960],
  'drawable-land-xxxhdpi/splash.png': [1920, 1280],
  'drawable-port-mdpi/splash.png': [320, 480],
  'drawable-port-hdpi/splash.png': [480, 800],
  'drawable-port-xhdpi/splash.png': [720, 1280],
  'drawable-port-xxhdpi/splash.png': [960, 1600],
  'drawable-port-xxxhdpi/splash.png': [1280, 1920],
};

for (const [rel, [w, h]] of Object.entries(splashes)) {
  const file = path.join(RES, ...rel.split('/'));
  try {
    await fs.access(path.dirname(file));
  } catch {
    continue; // esa densidad no existe en el proyecto
  }
  await fs.writeFile(file, await splash(w, h));
}

console.log(`Iconos y pantallas de inicio generados desde ${path.relative(ROOT, SRC)}`);
