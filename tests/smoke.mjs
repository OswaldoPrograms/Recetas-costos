// Prueba de humo de la app: carga www/index.html en un DOM y recorre las
// secciones principales. Se ejecuta en CI antes de compilar el APK.
//
// Uso: npm test
import fs from 'node:fs/promises';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';

const ROOT = path.resolve(import.meta.dirname, '..');
const html = await fs.readFile(path.join(ROOT, 'www', 'index.html'), 'utf8');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => {
  // jsdom no implementa scrollTo/scrollIntoView: no es un fallo de la app
  if (/Not implemented/.test(e.message)) return;
  errors.push('jsdomError: ' + e.message);
});
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    window.scrollTo = () => {};
    window.HTMLElement.prototype.scrollIntoView = function () {};
  },
});

const w = dom.window;
const doc = w.document;
const g = (expr) => w.eval(expr); // db, draft, view… son `let` de nivel superior
const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();

const results = [];
const check = (name, cond, extra = '') => {
  results.push(`${cond ? 'OK   ' : 'FALLA'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) process.exitCode = 1;
};

// 1. Arranque
const cards = doc.querySelectorAll('#lst .card');
check('arranca en "Mis recetas"', doc.querySelector('.top h2')?.textContent === 'Mis recetas');
check('pinta la receta de ejemplo', cards.length === 1, text(cards[0]?.querySelector('h3')));
check('muestra el costo por porción', /Costo \$/.test(text(cards[0])));

// 2. Detalle de receta
w.go('det', 'r1');
const det = text(doc.getElementById('v'));
check('detalle: nombre', det.includes('Galletas de avena'));
check('detalle: rinde 12 porciones', /rinde 12 porciones/.test(det));
check('detalle: ingredientes', doc.querySelectorAll('#v .li').length >= 7);
check('detalle: pasos', doc.querySelectorAll('#v ol.st li').length === 4);
check('detalle: precio sugerido', det.includes('Precio sugerido'));

// 3. Lista de compras de la receta
w.go('plan', 'r1');
check('lista de compras', text(doc.getElementById('v')).includes('Lista de compras'));

// 4. Crear compra
w.mkBuy();
const fecha = doc.getElementById('bd');
check('modal con fecha de hoy', !!fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha.value), fecha?.value);
w.addBuy();
check('compra creada y abierta', /Galletas de avena/.test(text(doc.getElementById('v'))));

// 5. Marcar como comprado
w.tg(0);
check('marca de comprado', doc.querySelector('.ck')?.getAttribute('aria-checked') === 'true');

// 6. Sección compras
w.go('shop');
check('compras guardadas', doc.querySelectorAll('.bc').length === 1);

// 7. Ingredientes
w.go('ing');
check('sección ingredientes', doc.querySelectorAll('.ig').length === 6);

// 8. Convertidor
w.go('info');
doc.getElementById('ca').value = '2';
doc.getElementById('cu').value = 'kg';
doc.getElementById('cw').value = 'g';
w.cv();
const conv = doc.getElementById('cr').textContent;
check('convertidor 2 kg → g', /2[,.]?000/.test(conv), conv);

// 9. Configuración y respaldo
w.go('cfg');
const bk = doc.getElementById('bk');
check('respaldo con datos', bk && JSON.parse(bk.value).rec.length === 1);

// 10. Alta de receta con cálculo en vivo
w.go('new');
g("draft.n='Prueba'; draft.por=4; draft.items=[{i:'i1',q:500,u:'g'}]; draft.price=10");
w.rl();
check('nueva receta calcula el costo', /Costo total/.test(text(doc.getElementById('lv'))));
w.saveRec();
check('guarda la receta', g('db.rec').length === 2, g('db.rec').map((r) => r.n).join(', '));

// 11. Persistencia
check('persiste en localStorage', w.localStorage.getItem('recetario-cafe-v1')?.includes('Prueba'));

// 12. En un navegador no se activa el modo nativo
check('sin Capacitor no hay modo nativo', !doc.documentElement.dataset.native);

console.log(results.join('\n'));
if (errors.length) {
  console.log('\nerrores de consola:\n' + errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('\nsin errores de consola');
}
