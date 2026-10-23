// Prueba de la integración con Capacitor: botón atrás de Android y barras
// del sistema. Simula el objeto `window.Capacitor` que inyecta la app nativa.
//
// Uso: npm test
import fs from 'node:fs/promises';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(import.meta.dirname, '..');
const html = await fs.readFile(path.join(ROOT, 'www', 'index.html'), 'utf8');

const calls = { style: [], back: [], exit: 0 };
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'https://localhost/',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.scrollTo = () => {};
    window.HTMLElement.prototype.scrollIntoView = function () {};
    window.Capacitor = {
      isNativePlatform: () => true,
      Plugins: {
        SystemBars: {
          setStyle: (o) => {
            calls.style.push(o.style);
            return Promise.resolve();
          },
        },
        App: {
          addListener: (ev, fn) => {
            if (ev === 'backButton') calls.back.push(fn);
            return Promise.resolve();
          },
          exitApp: () => {
            calls.exit++;
          },
        },
      },
    };
  },
});

const w = dom.window;
const doc = w.document;
const g = (expr) => w.eval(expr);

const results = [];
const check = (name, cond, extra = '') => {
  results.push(`${cond ? 'OK   ' : 'FALLA'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) process.exitCode = 1;
};

check('marca el documento como nativo', doc.documentElement.dataset.native === '1');
check('ajusta los iconos de la barra al tema claro', calls.style.includes('LIGHT'), calls.style.join(','));
check('registra el botón atrás', calls.back.length === 1);

const back = calls.back[0];

back();
check('atrás en el inicio cierra la app', calls.exit === 1);

w.go('det', 'r1');
back();
check('atrás desde el detalle vuelve a la lista', g('view') === 'rec');

w.drawer(1);
back();
check('atrás cierra el menú', !doc.getElementById('dr').classList.contains('on'));
check('no sale con el menú abierto', calls.exit === 1);

w.sh('<p>Prueba</p>');
back();
check('atrás cierra el modal', doc.getElementById('mdl').hidden === true);

w.go('ing');
w.ddt(doc.querySelector('.ddb'));
back();
check('atrás cierra el desplegable', !doc.querySelector('.dd.open'));
check('no sale antes de tiempo', calls.exit === 1, 'exitApp llamadas: ' + calls.exit);

console.log(results.join('\n'));
