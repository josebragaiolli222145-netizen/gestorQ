// Teste de fumaça: abre o GestorQ.html no Chromium, faz login como admin,
// navega por todas as páginas e falha se houver qualquer erro de JavaScript.
// As bibliotecas das CDNs são servidas a partir de node_modules (roda offline).
//   npm install && npm test
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const NM = path.join(ROOT, 'node_modules');
const CDN_MAP = [
  [/chart\.umd(\.min)?\.js/, 'chart.js/dist/chart.umd.js'],
  [/jspdf\.umd\.min/, 'jspdf/dist/jspdf.umd.min.js'],
  [/html2canvas/, 'html2canvas/dist/html2canvas.min.js'],
  [/xlsx\.full/, 'xlsx/dist/xlsx.full.min.js'],
  [/jszip/, 'jszip/dist/jszip.min.js'],
  [/zxing/, '@zxing/library/umd/index.min.js'],
  [/qrcode/, 'qrcodejs/qrcode.min.js'],
  [/firebase.*\/(firebase-[a-z-]+compat\.js)/, null],
];
const PAGES = ['Dashboard', 'Auditoria', 'Temperatura', 'Vencidos', 'Recebimento', 'Indicadores', 'PerdaVenda', 'Analise', 'GQLAnalise', 'Aprovacao', 'Diretor', 'PlanoAcao', 'Config'];

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1366, height: 850 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.route(/^https?:\/\//, route => {
    const url = route.request().url();
    for (const [re, file] of CDN_MAP) {
      const m = url.match(re);
      if (m) return route.fulfill({ path: path.join(NM, file || 'firebase/' + m[1]), contentType: 'application/javascript' });
    }
    return route.abort();
  });

  await page.goto('file://' + path.join(ROOT, 'GestorQ.html'), { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  const mode = await page.evaluate(() => document.compatMode);
  const stray = await page.evaluate(() => [...document.body.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).length);

  await page.fill('#loginUser', 'admin');
  await page.fill('#loginPass', '1234');
  await page.selectOption('#loginFuncao', 'administrador');
  await page.click('#btnLoginMain');
  await page.waitForTimeout(4000);
  const dashVisible = await page.evaluate(() => { const p = document.getElementById('pageDashboard'); return !!p && p.getClientRects().length > 0; });

  await page.evaluate(() => { const b = document.querySelector('.qx50-ov [data-a=ok]'); if (b) b.click(); });
  await page.waitForTimeout(1500);
  const painelHoje = await page.evaluate(() => !!document.querySelector('#gq51Hoje .gq-kpis'));
  const gs1 = await page.evaluate(() => { const r = window.gq51ParseGS1 && window.gq51ParseGS1('(01)07891000100103(17)261231(10)L42'); return !!r && r.codigo === '7891000100103' && r.validade === '2026-12-31' && r.lote === 'L42'; });

  const results = [];
  for (const name of PAGES) {
    const r = await page.evaluate(n => { try { goPage(n, document.querySelector(`[onclick*="goPage('${n}'"]`)); return 'ok'; } catch (e) { return e.message; } }, name);
    await page.waitForTimeout(1000);
    results.push(`${name}: ${r}`);
  }
  await browser.close();

  const checks = [
    ['modo padrão (não quirks)', mode === 'CSS1Compat'],
    ['sem texto solto na página', stray === 0],
    ['dashboard visível após login', dashVisible],
    ['painel de hoje (v51) no dashboard', painelHoje],
    ['leitura de código GS1', gs1],
    ['todas as páginas abrem', results.every(r => r.endsWith(': ok'))],
    ['nenhum erro de JavaScript', errors.length === 0],
  ];
  checks.forEach(([n, ok]) => console.log(`${ok ? '✔' : '✘'} ${n}`));
  if (errors.length) console.log('Erros:\n  ' + errors.join('\n  '));
  process.exit(checks.every(c => c[1]) ? 0 : 1);
})();
