#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════
   GestorQ Desktop — servidor local (back-end)
   - Serve o app (front-end) em http://127.0.0.1:<porta>
   - Banco de dados SQLite (arquivo gestorq.db na pasta de dados)
   - API protegida por token de sessão + checagem de Host (só esta máquina)
   - Backup automático diário (mantém 30 dias)
   - Encerra sozinho após 15 min sem nenhuma janela do app aberta
   Sem dependências externas: usa só o Node.js (>= 22.13) e o node:sqlite.
   ════════════════════════════════════════════════════════════════════ */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const db = require('./db');

const VERSAO = require('./versao.json').versao;
const args = process.argv.slice(2);
function arg(nome, padrao) { const i = args.indexOf('--' + nome); return i >= 0 && args[i + 1] ? args[i + 1] : padrao; }

const RAIZ = path.resolve(__dirname, '..');
const APP_DIR = path.join(RAIZ, 'app');
const DADOS = path.resolve(arg('dados', process.env.GESTORQ_DADOS || path.join(RAIZ, 'dados')));
const PORTA_BASE = parseInt(arg('porta', process.env.GESTORQ_PORTA || '8741'), 10);
const OCIOSO_MS = parseInt(arg('ocioso-min', '15'), 10) * 60 * 1000;
const LIMITE_CORPO = 60 * 1024 * 1024;
const DONO = (() => { try { return os.userInfo().username; } catch (e) { return ''; } })();

// Arquivos e pastas criados só com permissão do próprio usuário (Linux/macOS)
try { process.umask(0o077); } catch (e) {}
for (const d of [DADOS, path.join(DADOS, 'logs'), path.join(DADOS, 'backups')]) fs.mkdirSync(d, { recursive: true, mode: 0o700 });
// Token fixo por instalação, guardado num arquivo que só o dono lê.
// Não vai dentro da página: o atalho abre o app com #t=<token>.
const TOKEN_ARQ = path.join(DADOS, 'token');
let TOKEN = '';
try { TOKEN = fs.readFileSync(TOKEN_ARQ, 'utf8').trim(); } catch (e) {}
if (!/^[0-9a-f]{48}$/.test(TOKEN)) { TOKEN = crypto.randomBytes(24).toString('hex'); fs.writeFileSync(TOKEN_ARQ, TOKEN, { mode: 0o600 }); }
const LOG = path.join(DADOS, 'logs', 'servidor.log');
function log(...m) {
  const linha = new Date().toISOString() + ' ' + m.join(' ') + '\n';
  try { if (fs.existsSync(LOG) && fs.statSync(LOG).size > 5 * 1024 * 1024) fs.renameSync(LOG, LOG + '.1'); fs.appendFileSync(LOG, linha); } catch (e) {}
  if (process.stdout.isTTY) process.stdout.write(linha);
}

const banco = db.abrir(path.join(DADOS, 'gestorq.db'), log);

/* ── Backups ──────────────────────────────────────────────────────── */
function backup(motivo) {
  try {
    const hoje = new Date().toISOString().slice(0, 10);
    // O backup do dia é sempre atualizado (início, a cada 6 h e ao encerrar); o manual gera um arquivo à parte.
    const destino = path.join(DADOS, 'backups', 'gestorq-' + hoje + (motivo === 'manual' ? '-' + Date.now() : '') + '.db');
    const tmp = destino + '.tmp';
    try { fs.unlinkSync(tmp); } catch (e) {}
    db.backup(banco, tmp);
    fs.renameSync(tmp, destino);
    const lista = fs.readdirSync(path.join(DADOS, 'backups')).filter(f => /^gestorq-.*\.db$/.test(f)).sort();
    const limite = Date.now() - 30 * 86400000;
    for (const f of lista) { const p = path.join(DADOS, 'backups', f); if (fs.statSync(p).mtimeMs < limite) fs.unlinkSync(p); }
    log('backup', motivo, path.basename(destino));
    return path.basename(destino);
  } catch (e) { log('ERRO backup', e.message); return null; }
}

/* ── Arquivos do app ──────────────────────────────────────────────── */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.wasm': 'application/wasm' };
let indexCache = null;
function servirArquivo(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const alvo = path.resolve(APP_DIR, '.' + rel);
  if (!alvo.startsWith(APP_DIR + path.sep)) return responder(res, 403, { erro: 'acesso negado' });
  if (rel === '/index.html') {
    if (!indexCache) indexCache = fs.readFileSync(alvo, 'utf8');
    const html = indexCache.replace('__GESTORQ_VERSAO__', VERSAO);
    res.writeHead(200, Object.assign({ 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }, SEG));
    return res.end(html);
  }
  fs.stat(alvo, (err, st) => {
    if (err || !st.isFile()) return responder(res, 404, { erro: 'não encontrado' });
    res.writeHead(200, Object.assign({ 'Content-Type': MIME[path.extname(alvo).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'max-age=3600' }, SEG));
    fs.createReadStream(alvo).pipe(res);
  });
}

/* ── Utilidades HTTP ──────────────────────────────────────────────── */
// Cabeçalhos de segurança: impede abrir o app dentro de outro site (iframe)
const SEG = { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "frame-ancestors 'none'" };
function responder(res, status, obj) {
  const corpo = JSON.stringify(obj);
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, SEG));
  res.end(corpo);
}
function lerCorpo(req) {
  return new Promise((ok, falha) => {
    let tam = 0; const partes = [];
    req.on('data', c => { tam += c.length; if (tam > LIMITE_CORPO) { falha(new Error('corpo grande demais')); req.destroy(); } else partes.push(c); });
    req.on('end', () => { try { ok(partes.length ? JSON.parse(Buffer.concat(partes).toString('utf8')) : {}); } catch (e) { falha(new Error('JSON inválido')); } });
    req.on('error', falha);
  });
}

/* ── Janela ativa ─────────────────────────────────────────────────────
   Só uma janela (sessão) grava por vez, mesmo que estejam em navegadores
   diferentes. A janela ativa manda sinal de vida; se sumir por 150 s, outra
   pode assumir. "Usar esta janela" assume na hora. */
let sessaoAtiva = { id: '', visto: 0 };
function sessaoOk(req, assumir) {
  const id = String(req.headers['x-gestorq-sessao'] || '');
  if (!/^[0-9a-z]{8,64}$/i.test(id)) return false;
  const viva = sessaoAtiva.id && Date.now() - sessaoAtiva.visto < 150000;
  if (!viva || sessaoAtiva.id === id || assumir) { sessaoAtiva = { id, visto: Date.now() }; return true; }
  return false;
}

/* ── API ──────────────────────────────────────────────────────────── */
async function api(req, res, rota, porta) {
  const tokenOk = req.headers['x-gestorq-token'] === TOKEN;
  if (tokenOk) ultimoUso = Date.now();   // só o próprio app mantém o servidor ligado
  if (rota === '/api/health') return responder(res, 200, { ok: true, app: 'gestorq', versao: VERSAO, dono: DONO });
  // Só o próprio app (aberto pelo atalho, que conhece o token) pode usar a API.
  if (!tokenOk) return responder(res, 401, { erro: 'token inválido' });
  if (req.method === 'POST' && !String(req.headers['content-type'] || '').startsWith('application/json')) return responder(res, 415, { erro: 'use application/json' });

  const assumir = new URL(req.url, 'http://x').searchParams.get('assumir') === '1';
  if (rota === '/api/storage' && req.method === 'GET') {
    if (!sessaoOk(req, assumir)) return responder(res, 409, { erro: 'outra janela ativa' });
    return responder(res, 200, { chaves: db.lerTudo(banco), inicializado: db.inicializado(banco) });
  }
  if (rota === '/api/sessao' && req.method === 'POST') return responder(res, sessaoOk(req, assumir) ? 200 : 409, {});
  if (rota === '/api/sessao/sair' && req.method === 'POST') { if (sessaoAtiva.id === String(req.headers['x-gestorq-sessao'] || '')) sessaoAtiva = { id: '', visto: 0 }; return responder(res, 200, {}); }
  if (rota === '/api/storage' && req.method === 'POST') {
    if (!sessaoOk(req, false)) return responder(res, 409, { erro: 'outra janela ativa' });
    const corpo = await lerCorpo(req);
    const r = db.gravar(banco, corpo);
    return responder(res, 200, { ok: true, gravadas: r.gravadas, removidas: r.removidas });
  }
  if (rota === '/api/resumo' && req.method === 'GET') return responder(res, 200, { versao: VERSAO, porta, dados: DADOS, tabelas: db.resumo(banco) });
  if (rota === '/api/relatorios/perdas-mensal' && req.method === 'GET') return responder(res, 200, { linhas: db.perdasMensal(banco) });
  if (rota === '/api/relatorios/quebra-produto' && req.method === 'GET') {
    const q = new URL(req.url, 'http://x').searchParams;
    return responder(res, 200, { linhas: db.quebraProduto(banco, q.get('de') || '0000-00-00', q.get('ate') || '9999-12-31') });
  }
  if (rota === '/api/backup' && req.method === 'POST') { const f = backup('manual'); return responder(res, f ? 200 : 500, { ok: !!f, arquivo: f, pasta: path.join(DADOS, 'backups') }); }
  if (rota === '/api/backups' && req.method === 'GET') return responder(res, 200, { pasta: path.join(DADOS, 'backups'), arquivos: fs.readdirSync(path.join(DADOS, 'backups')).filter(f => f.endsWith('.db')).sort().reverse() });
  if (rota === '/api/sair' && req.method === 'POST') { responder(res, 200, { ok: true }); setTimeout(encerrar, 200); return; }
  return responder(res, 404, { erro: 'rota inexistente' });
}

/* ── Servidor ─────────────────────────────────────────────────────── */
let ultimoUso = Date.now();
function criarServidor(porta) {
  return http.createServer(async (req, res) => {
    // Proteção contra "DNS rebinding": só aceita Host desta máquina.
    const host = String(req.headers.host || '');
    if (host !== '127.0.0.1:' + porta && host !== 'localhost:' + porta) return responder(res, 403, { erro: 'host não permitido' });
    const rota = req.url.split('?')[0];
    try {
      if (rota.startsWith('/api/')) return await api(req, res, rota, porta);
      if (req.method !== 'GET' && req.method !== 'HEAD') return responder(res, 405, { erro: 'método não permitido' });
      return servirArquivo(req, res, req.url);
    } catch (e) {
      log('ERRO', req.method, rota, e.stack || e.message);
      if (!res.headersSent) responder(res, 500, { erro: 'erro interno (detalhes no log do servidor)' });
    }
  });
}

function jaRodando(porta) {
  return new Promise(ok => {
    const r = http.get({ host: '127.0.0.1', port: porta, path: '/api/health', timeout: 800 }, res => {
      let b = ''; res.on('data', c => b += c); res.on('end', () => { try { const j = JSON.parse(b); ok(j.app === 'gestorq' ? (String(j.dono).toLowerCase() === DONO.toLowerCase() ? 'meu' : 'outro') : 'outro'); } catch (e) { ok('outro'); } });
    });
    r.on('error', () => ok('livre')); r.on('timeout', () => { r.destroy(); ok('outro'); });
  });
}

let servidor = null;
function encerrar() {
  log('encerrando');
  try { backup('saida'); } catch (e) {}
  try { banco.close(); } catch (e) {}
  try { if (servidor) servidor.close(); } catch (e) {}
  process.exit(0);
}

async function iniciar() {
  for (let p = PORTA_BASE; p < PORTA_BASE + 10; p++) {
    const estado = await jaRodando(p);
    if (estado === 'meu') { log('já existe um GestorQ deste usuário na porta', p); fs.writeFileSync(path.join(DADOS, 'porta.txt'), String(p)); process.exit(0); }
    if (estado === 'outro') continue;   // porta de outro usuário/programa: tenta a próxima
    const ok = await new Promise(res => {
      const s = criarServidor(p);
      s.once('error', () => res(false));
      s.listen(p, '127.0.0.1', () => { servidor = s; res(true); });
    });
    if (ok) {
      fs.writeFileSync(path.join(DADOS, 'porta.txt'), String(p));
      log('GestorQ', VERSAO, 'rodando em http://127.0.0.1:' + p, '| dados:', DADOS);
      backup('diario');
      setInterval(() => backup('diario'), 6 * 3600 * 1000).unref();
      setInterval(() => { if (Date.now() - ultimoUso > OCIOSO_MS) { log('sem uso há', OCIOSO_MS / 60000, 'min'); encerrar(); } }, 30000).unref();
      return;
    }
  }
  log('ERRO: nenhuma porta livre entre', PORTA_BASE, 'e', PORTA_BASE + 9);
  process.exit(1);
}
process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);
process.on('uncaughtException', e => log('ERRO não tratado', e.stack || e.message));
iniciar();
