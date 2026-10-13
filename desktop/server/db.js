/* ════════════════════════════════════════════════════════════════════
   GestorQ Desktop — banco de dados (SQLite via node:sqlite)

   Duas camadas:
   1) kv: espelho fiel de tudo que o app grava (é a "fonte da verdade").
      O app continua funcionando exatamente como antes; nada se perde.
   2) Tabelas estruturadas (perdas, vendas, vencidos, acoes, temperaturas,
      destinos, usuarios) atualizadas a cada gravação, para relatórios em SQL,
      Power BI/Excel (via ODBC SQLite) ou qualquer ferramenta de dados.
   ════════════════════════════════════════════════════════════════════ */
'use strict';
const { DatabaseSync } = require('node:sqlite');

const ESQUEMA = [
  /* v1 */ `
  CREATE TABLE IF NOT EXISTS kv (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS perdas (
    id INTEGER PRIMARY KEY, data TEXT, mes TEXT, codigo TEXT, produto TEXT,
    departamento TEXT, motivo TEXT, quantidade REAL, valor REAL
  );
  CREATE INDEX IF NOT EXISTS ix_perdas_data ON perdas(data);
  CREATE INDEX IF NOT EXISTS ix_perdas_codigo ON perdas(codigo);
  CREATE TABLE IF NOT EXISTS vendas (
    id INTEGER PRIMARY KEY, data TEXT, mes TEXT, codigo TEXT, produto TEXT, quantidade REAL, valor REAL
  );
  CREATE INDEX IF NOT EXISTS ix_vendas_data ON vendas(data);
  CREATE INDEX IF NOT EXISTS ix_vendas_codigo ON vendas(codigo);
  CREATE TABLE IF NOT EXISTS vencidos (
    id TEXT, codigo TEXT, produto TEXT, quantidade REAL, validade TEXT, valor_unit REAL, setor TEXT, lote TEXT, cadastrado_em TEXT
  );
  CREATE TABLE IF NOT EXISTS acoes (
    id TEXT, o_que TEXT, por_que TEXT, onde TEXT, quem TEXT, prazo TEXT, status TEXT, prioridade TEXT, origem TEXT, criado_por TEXT, criado_em TEXT, concluida_em TEXT
  );
  CREATE TABLE IF NOT EXISTS temperaturas (
    id TEXT, equipamento TEXT, valor REAL, minimo REAL, maximo REAL, status TEXT, registrado_em TEXT, responsavel TEXT, acao_corretiva TEXT, origem TEXT
  );
  CREATE TABLE IF NOT EXISTS destinos (
    id TEXT, data TEXT, produto TEXT, codigo TEXT, setor TEXT, validade TEXT, quantidade REAL, valor_unit REAL,
    valor_total REAL, destino TEXT, desconto_pct REAL, recuperado REAL, registrado_por TEXT
  );
  CREATE TABLE IF NOT EXISTS usuarios (
    usuario TEXT, nome TEXT, funcao TEXT, filial TEXT, ativo INTEGER
  );
  CREATE VIEW IF NOT EXISTS vw_perdas_mes_setor AS
    SELECT mes, departamento, COUNT(*) AS lancamentos, ROUND(SUM(valor), 2) AS valor, ROUND(SUM(quantidade), 3) AS quantidade
    FROM perdas GROUP BY mes, departamento;
  CREATE VIEW IF NOT EXISTS vw_quebra_produto_mes AS
    WITH p AS (SELECT mes, codigo, MAX(produto) AS produto, MAX(departamento) AS setor, SUM(valor) AS perda, SUM(quantidade) AS qtd_perdida FROM perdas GROUP BY mes, codigo),
         v AS (SELECT mes, codigo, SUM(valor) AS venda, SUM(quantidade) AS qtd_vendida FROM vendas GROUP BY mes, codigo)
    SELECT p.mes, p.codigo, p.produto, p.setor, ROUND(p.perda, 2) AS perda, ROUND(COALESCE(v.venda, 0), 2) AS venda,
           ROUND(100.0 * p.perda / (p.perda + COALESCE(v.venda, 0)), 2) AS quebra_pct, p.qtd_perdida, v.qtd_vendida
    FROM p LEFT JOIN v ON v.mes = p.mes AND v.codigo = p.codigo;
  `
];

function abrir(arquivo, log) {
  const db = new DatabaseSync(arquivo);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;');
  const versao = db.prepare('PRAGMA user_version').get().user_version;
  for (let v = versao; v < ESQUEMA.length; v++) {
    db.exec('BEGIN');
    try { db.exec(ESQUEMA[v]); db.exec('PRAGMA user_version = ' + (v + 1)); db.exec('COMMIT'); }
    catch (e) { db.exec('ROLLBACK'); throw e; }
    if (log) log('banco migrado para a versão', v + 1);
  }
  return db;
}

function lerTudo(db) {
  const out = {};
  for (const r of db.prepare('SELECT chave, valor FROM kv').all()) out[r.chave] = r.valor;
  return out;
}

/* ── Projeção das chaves do app para tabelas estruturadas ────────── */
const num = v => { if (typeof v === 'number') return isFinite(v) ? v : null; const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? null : n; };
const txt = v => (v == null ? null : String(v));
const arr = j => { try { const v = JSON.parse(j); return Array.isArray(v) ? v : (v && Array.isArray(v.rows) ? v.rows : []); } catch (e) { return []; } };
const PROJECOES = {
  gestorq_perdas_master_rows_v42: { tabela: 'perdas', colunas: ['data', 'mes', 'codigo', 'produto', 'departamento', 'motivo', 'quantidade', 'valor'],
    linha: r => [txt(r.data), txt(r.mes || String(r.data || '').slice(0, 7)), txt(r.codigo), txt(r.produto), txt(r.departamento), txt(r.motivo), num(r.quantidade), num(r.valor)] },
  gq52_vendas: { tabela: 'vendas', colunas: ['data', 'mes', 'codigo', 'produto', 'quantidade', 'valor'],
    linha: r => [txt(r.data), txt(String(r.data || '').slice(0, 7)), txt(r.codigo), txt(r.produto), num(r.quantidade), num(r.valor)] },
  vencidosData: { tabela: 'vencidos', colunas: ['id', 'codigo', 'produto', 'quantidade', 'validade', 'valor_unit', 'setor', 'lote', 'cadastrado_em'],
    linha: r => [txt(r.id), txt(r.codigo), txt(r.nome || r.produto), num(r.qtd != null ? r.qtd : r.quantidade), txt(r.validade), num(r.valorUnit != null ? r.valorUnit : r.valor), txt(r.setor), txt(r.lote), txt(r.cadastradoEm)] },
  acoesPlano: { tabela: 'acoes', colunas: ['id', 'o_que', 'por_que', 'onde', 'quem', 'prazo', 'status', 'prioridade', 'origem', 'criado_por', 'criado_em', 'concluida_em'],
    linha: r => [txt(r.id), txt(r.what), txt(r.why), txt(r.where), txt(r.who), txt(r.when), txt(r.status), txt(r.prioridade), txt(r.origem), txt(r.criadoPor), txt(r.criadoEm), txt(r.concluidaEm)] },
  tempLog: { tabela: 'temperaturas', colunas: ['id', 'equipamento', 'valor', 'minimo', 'maximo', 'status', 'registrado_em', 'responsavel', 'acao_corretiva', 'origem'],
    linha: r => [txt(r.id), txt(r.equip), num(r.val), num(r.min), num(r.max), txt(r.status), txt(r.ts), txt(r.responsavel), txt(r.acaoCorretiva), txt(r.origem)] },
  gq51_destinos: { tabela: 'destinos', colunas: ['id', 'data', 'produto', 'codigo', 'setor', 'validade', 'quantidade', 'valor_unit', 'valor_total', 'destino', 'desconto_pct', 'recuperado', 'registrado_por'],
    linha: r => [txt(r.id), txt(r.data), txt(r.produto), txt(r.codigo), txt(r.setor), txt(r.validade), num(r.qtd), num(r.valorUnit), num(r.total), txt(r.destino), num(r.pct), num(r.recuperado), txt(r.por)] },
  // senhas NÃO são copiadas para a tabela estruturada
  users: { tabela: 'usuarios', colunas: ['usuario', 'nome', 'funcao', 'filial', 'ativo'],
    linha: r => [txt(r.username), txt(r.name || r.nome), txt(r.role), txt(r.filial), r.ativo === false || r.active === false || r.bloqueado ? 0 : 1] }
};
function projetar(db, chave, valor) {
  const p = PROJECOES[chave]; if (!p) return;
  db.prepare('DELETE FROM ' + p.tabela).run();
  if (valor == null) return;
  const ins = db.prepare('INSERT INTO ' + p.tabela + ' (' + p.colunas.join(',') + ') VALUES (' + p.colunas.map(() => '?').join(',') + ')');
  for (const r of arr(valor)) { if (r && typeof r === 'object') ins.run(...p.linha(r)); }
}

function gravar(db, corpo) {
  const set = corpo && typeof corpo.set === 'object' && corpo.set ? corpo.set : {};
  const remove = Array.isArray(corpo && corpo.remove) ? corpo.remove : [];
  const agora = new Date().toISOString();
  let gravadas = 0, removidas = 0;
  db.exec('BEGIN');
  try {
    if (corpo && corpo.clear === true) {
      removidas += db.prepare('DELETE FROM kv').run().changes;
      for (const k of Object.keys(PROJECOES)) projetar(db, k, null);
    }
    const up = db.prepare('INSERT INTO kv (chave, valor, atualizado_em) VALUES (?, ?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em');
    const del = db.prepare('DELETE FROM kv WHERE chave = ?');
    for (const k of Object.keys(set)) {
      if (typeof k !== 'string' || k.length > 500) continue;
      up.run(k, String(set[k]), agora); gravadas++;
      projetar(db, k, String(set[k]));
    }
    for (const k of remove) { if (typeof k !== 'string') continue; removidas += del.run(k).changes; projetar(db, k, null); }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return { gravadas, removidas };
}

function resumo(db) {
  const out = {};
  for (const t of ['kv', 'perdas', 'vendas', 'vencidos', 'acoes', 'temperaturas', 'destinos', 'usuarios']) out[t] = db.prepare('SELECT COUNT(*) AS n FROM ' + t).get().n;
  return out;
}
function perdasMensal(db) { return db.prepare('SELECT * FROM vw_perdas_mes_setor ORDER BY mes DESC, valor DESC').all(); }
function quebraProduto(db, de, ate) {
  return db.prepare(`
    WITH p AS (SELECT codigo, MAX(produto) AS produto, MAX(departamento) AS setor, SUM(valor) AS perda FROM perdas WHERE data BETWEEN ? AND ? GROUP BY codigo),
         v AS (SELECT codigo, SUM(valor) AS venda FROM vendas WHERE data BETWEEN ? AND ? GROUP BY codigo)
    SELECT p.codigo, p.produto, p.setor, ROUND(p.perda, 2) AS perda, ROUND(COALESCE(v.venda, 0), 2) AS venda,
           ROUND(100.0 * p.perda / (p.perda + COALESCE(v.venda, 0)), 2) AS quebra_pct
    FROM p LEFT JOIN v ON v.codigo = p.codigo ORDER BY p.perda DESC`).all(de, ate, de, ate);
}
function backup(db, destino) {
  const esc = destino.replace(/'/g, "''");
  db.exec("VACUUM INTO '" + esc + "'");
}

module.exports = { abrir, lerTudo, gravar, resumo, perdasMensal, quebraProduto, backup };
