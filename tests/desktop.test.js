// Teste do pacote desktop (Linux): instala num HOME temporário, sobe o servidor,
// abre o app no Chromium, grava dados, confere no SQLite e num navegador "zerado".
//   npm run desktop && npm run test:desktop
const path = require('path'), fs = require('fs'), os = require('os'), { execFileSync, spawn } = require('child_process');
const { chromium } = require('playwright');
const { DatabaseSync } = require('node:sqlite');
const ROOT = path.resolve(__dirname, '..');
const PKG = fs.readdirSync(path.join(ROOT, 'dist')).find(f => /^GestorQ-Desktop-Linux-.*\.tar\.gz$/.test(f));
const PLANILHA = process.env.PLANILHA; // opcional: planilha real com abas PERDAS e VENDAS

(async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gq-home-'));
  execFileSync('tar', ['-xzf', path.join(ROOT, 'dist', PKG), '-C', home]);
  const env = Object.assign({}, process.env, { HOME: home, GESTORQ_SEM_JANELA: '1' });
  execFileSync('bash', [path.join(home, 'GestorQ', 'instalar.sh')], { env, stdio: 'pipe' });
  const launcher = path.join(home, '.local/share/gestorq/programa/gestorq.sh');
  // o instalador já abriu em segundo plano; o lançador deve reaproveitar o servidor
  await new Promise(r => setTimeout(r, 1500));
  const url = execFileSync('bash', [launcher], { env }).toString().trim();
  const dados = path.join(home, '.local/share/gestorq/dados');
  const res = [];
  const ok = (n, c, extra) => { res.push([n, !!c]); console.log((c ? '✔ ' : '✘ ') + n + (extra ? '  (' + extra + ')' : '')); };
  ok('instalação e servidor no ar', /^http:\/\/127\.0\.0\.1:\d+\/$/.test(url), url);

  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const errors = [], net = [];
  async function abrir() {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 850 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.accept().catch(() => {}));
    page.on('request', r => { if (!r.url().startsWith(url) && !/fonts\.(googleapis|gstatic)\.com/.test(r.url())) net.push(r.url()); });
    await page.route(u => !String(u).startsWith(url), r => r.abort()); // simula computador sem internet
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(3500);
    return { ctx, page };
  }
  let { ctx, page } = await abrir();
  ok('bibliotecas carregadas sem internet', await page.evaluate(() => typeof Chart === 'function' && typeof XLSX === 'object' && !!window.jspdf && typeof firebase === 'object'));
  await page.fill('#loginUser', 'admin'); await page.fill('#loginPass', '1234'); await page.selectOption('#loginFuncao', 'administrador');
  await page.click('#btnLoginMain'); await page.waitForTimeout(4000);
  await page.evaluate(() => { const b = document.querySelector('.qx50-ov [data-a=ok]'); if (b) b.click(); });
  await page.evaluate(() => {
    const d = new Date(); d.setDate(d.getDate() + 2);
    window.vencidosData.push({ id: 991, codigo: '7891', nome: 'Teste Desktop Iogurte', qtd: 4, validade: d.toISOString().slice(0, 10), valorUnit: 3.5, setor: 'Laticínios', historico: [] });
    saveVencidos();
  });
  if (PLANILHA) {
    await page.evaluate(() => goPage('PerdaVenda', document.getElementById('navGQ52PV'))); await page.waitForTimeout(1200);
    await page.setInputFiles('#gq52File', PLANILHA); await page.waitForTimeout(1500);
    await page.click('.gq-ov [data-x=ok]'); await page.waitForTimeout(2500);
  }
  await page.evaluate(() => goPage('Config', document.getElementById('navCfg'))); await page.waitForTimeout(2500);
  ok('painel do banco em Configurações', await page.evaluate(() => /gestorq\.db/.test((document.getElementById('gqDesktopCard') || {}).innerText || '')));
  await page.waitForTimeout(1500);

  const db = new DatabaseSync(path.join(dados, 'gestorq.db'), { readOnly: true });
  const venc = db.prepare("SELECT produto, quantidade FROM vencidos WHERE produto = 'Teste Desktop Iogurte'").get();
  ok('gravação do app chegou ao banco (tabela vencidos)', venc && venc.quantidade === 4);
  ok('usuários sem senha na tabela estruturada', db.prepare("SELECT COUNT(*) n FROM usuarios WHERE usuario='admin'").get().n === 1 && !db.prepare('PRAGMA table_info(usuarios)').all().some(c => /senha|password/i.test(c.name)));
  if (PLANILHA) {
    const p = db.prepare('SELECT COUNT(*) n, ROUND(SUM(valor),2) v FROM perdas').get();
    const v = db.prepare('SELECT COUNT(*) n, ROUND(SUM(valor),2) v FROM vendas').get();
    const q = db.prepare("SELECT ROUND(100.0*SUM(perda)/(SUM(perda)+SUM(venda)),2) q FROM (SELECT p.codigo, p.perda, COALESCE(v.venda,0) venda FROM (SELECT codigo, SUM(valor) perda FROM perdas GROUP BY codigo) p LEFT JOIN (SELECT codigo, SUM(valor) venda FROM vendas GROUP BY codigo) v USING(codigo))").get();
    ok('planilha importada no banco (perdas/vendas)', p.n > 0 && v.n > 0, 'perdas ' + p.n + ' = R$ ' + p.v + ' · vendas ' + v.n + ' = R$ ' + v.v + ' · quebra dos produtos com perda ' + q.q + '%');
    ok('visão vw_quebra_produto_mes', db.prepare('SELECT COUNT(*) n FROM vw_quebra_produto_mes').get().n > 0);
  }
  db.close();
  await ctx.close();

  // navegador "zerado" (perfil novo): os dados precisam vir do banco
  ({ ctx, page } = await abrir());
  ok('dados voltam do banco num navegador zerado', await page.evaluate(() => (JSON.parse(localStorage.getItem('vencidosData') || '[]')).some(p => p.nome === 'Teste Desktop Iogurte')));
  await ctx.close();
  ok('backup automático criado', fs.readdirSync(path.join(dados, 'backups')).some(f => f.endsWith('.db')));
  const r401 = await fetch(url + 'api/storage').then(r => r.status);
  ok('API recusa acesso sem token', r401 === 401);
  ok('nenhum acesso à internet', net.length === 0, net.slice(0, 3).join(' '));
  ok('nenhum erro de JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  try { await fetch(url + 'api/health'); execFileSync('pkill', ['-f', path.join(home, '.local/share/gestorq/programa/runtime/node')]); } catch (e) {}
  process.exit(res.every(r => r[1]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
