(function(){
  'use strict';
  if (window.__GESTORQ_V52__) return;
  window.__GESTORQ_V52__ = true;

  /* ════════════════════════════════════════════════════════════════
     GestorQ v52 — Perda x Venda
     - Importador de planilhas com abas PERDAS e VENDAS (substitui o
       importador da aba Perdas): relatório de conferência, correção de
       datas, lançamentos em dobro, unidade (KG/UN), nome do setor e
       mesclagem sem apagar importações anteriores.
     - Página "Perda x Venda": quebra por produto, matriz de decisão,
       evolução diária, venda perdida, sugestão de compra e comparação
       com o período anterior.
     - Integra com a v51: faturamento do setor, pendências e Compras.
     ════════════════════════════════════════════════════════════════ */
  var KV = 'gq52_vendas', KP = 'gq52_produtos', KC = 'gq52_config', KR = 'gq52_ultima_importacao';
  var PERDAS = 'gestorq_perdas_master_rows_v42';
  var FINANCEIRO = /^(admin|administrador|gerente|subgerente|supervisor|diretor|prevencao|prevenção)$/i;
  var QUAD = {
    A: { n: 'Atacar', d: 'vende muito e perde muito', cls: 'gq52-qA', cor: '#ef4444' },
    B: { n: 'Rever compra/mix', d: 'vende pouco e perde muito', cls: 'gq52-qB', cor: '#f59e0b' },
    C: { n: 'Referência', d: 'vende muito e perde pouco', cls: 'gq52-qC', cor: '#10b981' },
    D: { n: 'Acompanhar', d: 'vende pouco e perde pouco', cls: 'gq52-qD', cor: '#94a3b8' }
  };

  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
  function load(k, d){ try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch(e){ return d; } }
  function saveLocal(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e){ notify('⚠️ Armazenamento do aparelho cheio. Exporte um backup e apague dados antigos.', 'warning'); return false; } }
  function notify(m, t){ try { (window.showNotification || function(x){ console.log(x); })(m, t || 'info'); } catch(e){} }
  function brl(n){ return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function pctFmt(n, c){ return (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: c == null ? 1 : c, maximumFractionDigits: c == null ? 1 : c }) + '%'; }
  function numFmt(n, c){ return (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: c == null ? 1 : c }); }
  function num(v){ if (typeof v === 'number') return isFinite(v) ? v : 0; var s = String(v == null ? '' : v).replace(/[R$\s]/g, ''); if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.'); var n = parseFloat(s); return isNaN(n) ? 0 : n; }
  function pad(n){ return String(n).padStart(2, '0'); }
  function iso(d){ return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function brDate(s){ var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : '—'; }
  function addDias(s, n){ var p = s.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]); d.setDate(d.getDate() + n); return iso(d); }
  function diasEntre(a, b){ var pa = a.split('-'), pb = b.split('-'); return Math.round((new Date(+pb[0], +pb[1] - 1, +pb[2]) - new Date(+pa[0], +pa[1] - 1, +pa[2])) / 86400000); }
  function normH(s){ return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase(); }
  function normCod(v){ var s = String(v == null ? '' : v).trim().replace(/\.0+$/, ''); if (/^\d+$/.test(s)) s = s.replace(/^0+(?=\d)/, ''); return s; }
  function curUser(){ try { return window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null); } catch(e){ return null; } }
  function veFin(){ var u = curUser(); return !!u && FINANCEIRO.test(String(u.role || '')); }
  function isShown(el){ return !!el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none'; }
  function unidadeDe(u, nome){
    var x = normH(u);
    if (/^(KG|KGS|QUILO|KILO|G|GR)$/.test(x)) return 'kg';
    if (/^(UN|UND|UNID|UNIDADE|PC|PCT|CX|BD|DZ)$/.test(x)) return 'un';
    return /\bKG\b/.test(normH(nome)) ? 'kg' : 'un';
  }
  function modal(html, opts){
    if (window.GQ51 && window.GQ51.modal) return window.GQ51.modal(html, opts);
    var ov = document.createElement('div'); ov.className = 'gq-ov'; ov.innerHTML = '<div class="gq-modal">' + html + '</div>';
    ov.close = function(){ ov.remove(); }; document.body.appendChild(ov); return ov;
  }
  function cfg(){ var c = load(KC, {}); c.metaPadrao = num(c.metaPadrao) > 0 && num(c.metaPadrao) < 100 ? num(c.metaPadrao) : 5; c.metas = c.metas && typeof c.metas === 'object' ? c.metas : {}; return c; }
  function metaDe(setor){ var c = cfg(), m = num(c.metas[setor]); return m > 0 && m < 100 ? m : c.metaPadrao; }

  /* ════════════════════════════════════════════════════════════════
     A) Leitura da planilha
     ════════════════════════════════════════════════════════════════ */
  var COLS = {
    data: ['DATA', 'DT', 'DIA', 'DATA MOVIMENTO'],
    codigo: ['CODIGO', 'COD', 'COD PRODUTO', 'CODIGO PRODUTO', 'EAN', 'SKU', 'PLU'],
    produto: ['PRODUTO', 'DESCRICAO', 'DESCRICAO PRODUTO', 'ITEM', 'NOME PRODUTO'],
    setorNome: ['NOME/DEPARTAMENTO', 'NOME DEPARTAMENTO', 'NOME DO DEPARTAMENTO', 'NOME/SETOR', 'SETOR', 'SECAO', 'CATEGORIA'],
    setorCod: ['DEPARTAMENTO', 'DEPTO', 'DPTO', 'COD DEPARTAMENTO', 'COD DEPTO'],
    unidade: ['FUNCAO', 'UNIDADE', 'UN', 'UND', 'MEDIDA', 'UNID'],
    qtd: ['QUANTIDADE', 'QTD', 'QTDE', 'QUANT'],
    valor: ['VALOR', 'VALOR TOTAL', 'TOTAL', 'CUSTO', 'CUSTO TOTAL', 'VENDA'],
    motivo: ['MOTIVO', 'CAUSA', 'TIPO PERDA', 'TIPO']
  };
  function mapear(head){
    var used = {}, idx = {};
    // 1ª passada: nome exato; 2ª: contém (sem roubar colunas já usadas)
    [true, false].forEach(function(exato){
      Object.keys(COLS).forEach(function(k){
        if (idx[k] != null) return;
        for (var n = 0; n < COLS[k].length && idx[k] == null; n++) {
          for (var c = 0; c < head.length; c++) {
            if (used[c]) continue;
            var h = head[c], alvo = COLS[k][n];
            if (!h) continue;
            if (k === 'setorCod' && h.indexOf('NOME') >= 0) continue;
            if (exato ? h === alvo : (alvo.length >= 3 && h.indexOf(alvo) >= 0)) { idx[k] = c; used[c] = 1; break; }
          }
        }
      });
    });
    return idx;
  }
  function lerData(v){
    var y, m, d, corrigida = false;
    if (v instanceof Date && !isNaN(v)) { y = v.getFullYear(); m = v.getMonth() + 1; d = v.getDate(); }
    else if (typeof v === 'number' && v > 20000 && v < 80000) { var x = new Date(Math.round((v - 25569) * 86400000)); y = x.getUTCFullYear(); m = x.getUTCMonth() + 1; d = x.getUTCDate(); }
    else {
      var s = String(v == null ? '' : v).trim(), r;
      if ((r = s.match(/^(\d{1,4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) { y = +r[1]; m = +r[2]; d = +r[3]; }
      else if ((r = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/))) { y = +r[3]; m = +r[2]; d = +r[1]; if (r[3].length === 2) y += 2000; }
      else return null;
    }
    if (y < 100) { y += 2000; corrigida = true; }            // "0026" → 2026
    if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
    return { iso: y + '-' + pad(m) + '-' + pad(d), corrigida: corrigida };
  }
  function lerAba(wb, nome){
    var aoa = window.XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, defval: '', raw: true });
    var hi = -1;
    for (var i = 0; i < Math.min(25, aoa.length); i++) {
      var h = (aoa[i] || []).map(normH);
      var hits = ['DATA', 'PRODUTO', 'VALOR', 'QUANTIDADE', 'CODIGO', 'DESCRICAO'].filter(function(k){ return h.some(function(x){ return x === k || x.indexOf(k) === 0; }); }).length;
      if (hits >= 3) { hi = i; break; }
    }
    if (hi < 0) return null;
    var head = aoa[hi].map(normH), idx = mapear(head);
    if (idx.data == null || idx.produto == null || idx.valor == null) return null;
    var nomeN = normH(nome);
    var tipo = /VENDA|FATUR/.test(nomeN) ? 'vendas' : /PERDA|QUEBRA|AVARIA/.test(nomeN) ? 'perdas' : null;
    var linhas = [], semData = 0, semValor = 0, corrigidas = 0, valorCorrigido = 0;
    for (var r = hi + 1; r < aoa.length; r++) {
      var row = aoa[r] || []; var g = function(k){ return idx[k] == null ? '' : row[idx[k]]; };
      var produto = String(g('produto') || '').trim(), valor = num(g('valor'));
      if (!produto && !valor) continue;                         // linha vazia
      var dt = lerData(g('data'));
      if (!dt) { semData++; continue; }
      if (!(valor > 0) || !produto) { semValor++; continue; }
      if (dt.corrigida) { corrigidas++; valorCorrigido += valor; }
      var setorNome = String(g('setorNome') || '').trim(), setorCod = String(g('setorCod') || '').trim().replace(/\.0+$/, '');
      linhas.push({ data: dt.iso, corrigida: dt.corrigida, codigo: normCod(g('codigo')), produto: produto, setor: setorNome || setorCod || '',
        setorCod: setorCod, unidade: idx.unidade != null ? unidadeDe(g('unidade'), produto) : unidadeDe('', produto),
        quantidade: num(g('qtd')) || (idx.qtd == null ? 1 : 0), valor: valor, motivo: String(g('motivo') || '').trim() });
    }
    return { nome: nome, tipo: tipo, linhas: linhas, semData: semData, semValor: semValor, corrigidas: corrigidas, valorCorrigido: valorCorrigido };
  }
  function lerArquivo(file, cb){
    if (typeof window.XLSX === 'undefined') return notify('Biblioteca de planilhas não carregada (precisa de internet na primeira abertura).', 'warning');
    var fr = new FileReader();
    fr.onload = function(e){
      try {
        var wb = window.XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
        var abas = wb.SheetNames.map(function(n){ return lerAba(wb, n); }).filter(Boolean);
        if (!abas.length) return notify('❌ Não encontrei colunas de DATA, PRODUTO e VALOR na planilha.', 'danger');
        var perdas = abas.filter(function(a){ return a.tipo === 'perdas'; })[0] || abas.filter(function(a){ return a.tipo !== 'vendas'; })[0] || null;
        var vendas = abas.filter(function(a){ return a.tipo === 'vendas'; })[0] || null;
        cb(analisar(file.name, perdas, vendas));
      } catch(err){ console.error('[v52 import]', err); notify('❌ Erro ao ler a planilha: ' + (err.message || err), 'danger'); }
    };
    fr.readAsArrayBuffer(file);
  }

  /* ── Conferência ───────────────────────────────────────────────── */
  function chave(r){ return [r.data, r.codigo || normH(r.produto), num(r.quantidade).toFixed(3), num(r.valor).toFixed(2)].join('|'); }
  function analisar(arquivo, P, V){
    var a = { arquivo: arquivo, P: P, V: V, dups: [], precos: [], semVenda: [], nomesDif: 0, diasSemPerda: [] };
    if (P) {
      var cont = {}; P.linhas.forEach(function(r){ var k = chave(r); cont[k] = (cont[k] || 0) + 1; });
      var vistos = {};
      P.linhas.forEach(function(r, i){ var k = chave(r); if (cont[k] > 1) { if (vistos[k]) { r.dup = true; a.dups.push(r); } vistos[k] = 1; } });
    }
    if (P && V) {
      var pv = {}, pp = {};
      V.linhas.forEach(function(r){ var o = pv[r.codigo] || (pv[r.codigo] = { v: 0, q: 0, nome: r.produto }); o.v += r.valor; o.q += r.quantidade; });
      P.linhas.forEach(function(r){ if (r.dup) return; var o = pp[r.codigo] || (pp[r.codigo] = { v: 0, q: 0, nome: r.produto }); o.v += r.valor; o.q += r.quantidade; });
      Object.keys(pp).forEach(function(c){
        var p = pp[c], v = pv[c];
        if (!v) { a.semVenda.push(p.nome); return; }
        if (normH(v.nome) !== normH(p.nome)) a.nomesDif++;
        if (p.q > 0 && v.q > 0) { var ratio = (p.v / p.q) / (v.v / v.q); if (ratio > 1.0) a.precos.push({ nome: p.nome, ratio: ratio, pPerda: p.v / p.q, pVenda: v.v / v.q }); }
      });
      a.precos.sort(function(x, y){ return y.ratio - x.ratio; });
      var diasV = {}, diasP = {};
      V.linhas.forEach(function(r){ diasV[r.data] = 1; }); P.linhas.forEach(function(r){ diasP[r.data] = 1; });
      a.diasSemPerda = Object.keys(diasV).filter(function(d){ return !diasP[d]; }).sort();
    }
    return a;
  }
  var MOTIVOS = ['Não informado', 'Vencido', 'Avaria/Quebra', 'Furto', 'Quebra operacional', 'Erro de recebimento', 'Temperatura/Deterioração', 'Erro de inventário', 'Doação', 'Outros'];
  function abrirConferencia(a){
    var P = a.P, V = a.V;
    var totP = P ? P.linhas.reduce(function(s, r){ return s + r.valor; }, 0) : 0, totV = V ? V.linhas.reduce(function(s, r){ return s + r.valor; }, 0) : 0;
    var datas = [].concat(P ? P.linhas : [], V ? V.linhas : []).map(function(r){ return r.data; }).sort();
    var setores = {}; if (P) P.linhas.forEach(function(r){ if (r.setor) setores[r.setor] = 1; });
    var semMotivo = P ? P.linhas.filter(function(r){ return !r.motivo; }).length : 0;
    var issue = function(id, marcado, titulo, detalhe){ return '<label class="gq52-issue">' + (id ? '<input type="checkbox" id="' + id + '"' + (marcado ? ' checked' : '') + '>' : '<span>ℹ️</span>') + '<span><b>' + titulo + '</b>' + (detalhe ? '<small>' + detalhe + '</small>' : '') + '</span></label>'; };
    var corr = (P ? P.corrigidas : 0) + (V ? V.corrigidas : 0), corrV = (P ? P.valorCorrigido : 0) + (V ? V.valorCorrigido : 0);
    var html = '<h3>📥 Conferência da importação</h3><p><b>' + esc(a.arquivo) + '</b> · ' + (datas.length ? brDate(datas[0]) + ' a ' + brDate(datas[datas.length - 1]) : '') + '</p>' +
      '<div class="gq-kpis" style="grid-template-columns:repeat(2,1fr)">' +
        '<div class="gq-kpi danger" style="cursor:default"><div class="l">Perdas' + (P ? ' (aba ' + esc(P.nome) + ')' : '') + '</div><div class="v">' + brl(totP) + '</div><div class="s">' + (P ? P.linhas.length + ' lançamentos · ' + Object.keys(setores).map(esc).join(', ') : 'aba de perdas não encontrada') + '</div></div>' +
        '<div class="gq-kpi ok" style="cursor:default"><div class="l">Vendas' + (V ? ' (aba ' + esc(V.nome) + ')' : '') + '</div><div class="v">' + brl(totV) + '</div><div class="s">' + (V ? V.linhas.length + ' linhas' : 'sem aba de vendas — a quebra não poderá ser calculada') + '</div></div></div>' +
      '<div class="gq52-issues">' +
        (corr ? issue('gq52FixData', true, 'Corrigir ' + corr + ' data(s) com ano errado (ex.: 0026 → 2026)', brl(corrV) + ' em lançamentos. Desmarque para ignorar essas linhas.') : '') +
        (a.dups.length ? issue(null, false, a.dups.length + ' lançamento(s) de perda em dobro serão importados uma vez só', a.dups.slice(0, 4).map(function(r){ return esc(r.produto) + ' ' + brDate(r.data) + ' (' + numFmt(r.quantidade, 3) + ' · ' + brl(r.valor) + ')'; }).join('; ') + (a.dups.length > 4 ? '…' : '') + ' — mesmo produto, dia, quantidade e valor.') : '') +
        (a.precos.length ? issue(null, false, '<span class="gq52-warn">Conferir unidade/preço de ' + a.precos.length + ' produto(s)</span>: a perda está valendo mais que o preço de venda', a.precos.slice(0, 5).map(function(x){ return esc(x.nome) + ' (perda ' + brl(x.pPerda) + ' × venda ' + brl(x.pVenda) + ')'; }).join('; ')) : '') +
        (a.semVenda.length ? issue(null, false, a.semVenda.length + ' produto(s) com perda e sem venda no período', a.semVenda.slice(0, 6).map(esc).join(', ')) : '') +
        (a.nomesDif ? issue(null, false, a.nomesDif + ' produto(s) com nomes diferentes entre as abas', 'O cruzamento é feito pelo código, então isso não afeta o cálculo.') : '') +
        (a.diasSemPerda.length ? issue(null, false, a.diasSemPerda.length + ' dia(s) com venda e sem lançamento de perda', a.diasSemPerda.map(brDate).join(', ') + ' — confirme se a rotina de lançamento foi feita.') : '') +
        ((P ? P.semData + P.semValor : 0) + (V ? V.semData + V.semValor : 0) ? issue(null, false, ((P ? P.semData + P.semValor : 0) + (V ? V.semData + V.semValor : 0)) + ' linha(s) ignorada(s) sem data válida ou com valor zerado', '') : '') +
      '</div>' +
      '<div class="gq-form">' +
        (semMotivo ? '<label style="grid-column:1/-1">Motivo para os ' + semMotivo + ' lançamentos sem motivo<select id="gq52Motivo">' + MOTIVOS.map(function(m){ return '<option>' + m + '</option>'; }).join('') + '</select></label>' : '') + '</div>' +
      '<div class="gq52-issues">' +
        (V ? issue('gq52Fat', true, 'Usar as vendas como faturamento do setor em Indicadores', 'Calcula o índice de perdas do setor automaticamente.') : '') +
        (P ? issue('gq52Pend', true, 'Criar pendências para os 5 produtos com maior perda', 'Com responsável e prazo, no Plano de ação.') : '') +
      '</div><p style="font-size:.76rem">Importações anteriores são mantidas: lançamentos já existentes não são duplicados.</p>' +
      '<div class="row"><button class="gq-btn" data-x="c">Cancelar</button><button class="gq-btn pri" data-x="ok">Importar</button></div>';
    var ov = modal(html);
    var box = ov.querySelector('.gq-modal'); if (box) box.classList.add('gq52-modal');
    ov.addEventListener('click', function(e){
      var x = e.target.getAttribute && e.target.getAttribute('data-x'); if (!x) return;
      if (x === 'c') return ov.close();
      var op = { fixData: !$('gq52FixData') || $('gq52FixData').checked, dedup: true,
        motivo: $('gq52Motivo') ? $('gq52Motivo').value : '', fat: !!($('gq52Fat') && $('gq52Fat').checked), pend: !!($('gq52Pend') && $('gq52Pend').checked) };
      ov.close();
      gravar(a, op);
    });
  }

  /* ── Gravação (mescla, sem apagar o que já existe) ─────────────── */
  function mesclar(existentes, novas, ajustar){
    var mapa = {}; existentes.forEach(function(r){ var k = chave(r); (mapa[k] = mapa[k] || []).push(r); });
    var add = 0, ja = 0;
    novas.forEach(function(r){
      var k = chave(r), l = mapa[k];
      if (l && l.length) { var old = l.shift(); ja++; if (ajustar) ajustar(old, r); return; }
      existentes.push(r); add++;
    });
    return { add: add, ja: ja };
  }
  function gravar(a, op){
    var P = a.P, V = a.V, res = { arquivo: a.arquivo, em: new Date().toISOString() };
    var filtra = function(l){ return l.filter(function(r){ return (op.fixData || !r.corrigida) && !(op.dedup && r.dup); }); };
    // catálogo de produtos (unidade e setor)
    var prod = load(KP, {});
    if (P) P.linhas.forEach(function(r){ if (!r.codigo) return; var o = prod[r.codigo] || (prod[r.codigo] = {}); o.nome = r.produto; o.unidade = r.unidade; if (r.setor) o.setor = r.setor; if (r.setorCod) o.setorCod = r.setorCod; });
    // arquivo de um setor só (ex.: planilha do Hortifruti): as vendas herdam esse setor
    var setoresP = {}; if (P) P.linhas.forEach(function(r){ if (r.setor) setoresP[r.setor] = 1; });
    var unico = Object.keys(setoresP).length === 1 ? Object.keys(setoresP)[0] : '';
    if (V) V.linhas.forEach(function(r){ if (!r.codigo) return; var o = prod[r.codigo] || (prod[r.codigo] = { nome: r.produto, unidade: r.unidade }); if (!o.nomeVenda) o.nomeVenda = r.produto; if (!o.setor && unico) o.setor = unico; });
    saveLocal(KP, prod);
    if (P) {
      var rows = load(PERDAS, null); if (!Array.isArray(rows)) rows = load('gestorq_perdas_unified_rows_v1', []) || [];
      var novas = filtra(P.linhas).map(function(r){
        return { data: r.data, mes: r.data.slice(0, 7), ano: r.data.slice(0, 4), codigo: r.codigo, produto: r.produto, departamento: r.setor || 'SEM DEPARTAMENTO',
          motivo: r.motivo || op.motivo || 'Não informado', quantidade: r.quantidade || 1, valor: r.valor };
      });
      var m = mesclar(rows, novas, function(old, nv){
        if (/^\d+$/.test(String(old.departamento || '')) && nv.departamento) old.departamento = nv.departamento; // "127" → nome do setor
        if ((!old.motivo || old.motivo === 'Não informado') && nv.motivo && nv.motivo !== 'Não informado') old.motivo = nv.motivo;
      });
      try { localStorage.setItem(PERDAS, JSON.stringify(rows)); localStorage.setItem('gestorq_perdas_unified_rows_v1', JSON.stringify(rows)); }
      catch(e){ return notify('⚠️ Sem espaço para gravar as perdas.', 'warning'); }
      res.perdas = { add: m.add, ja: m.ja, total: novas.reduce(function(s, r){ return s + r.valor; }, 0) };
      try { if (window.GestorQFinalBI) { window.GestorQFinalBI.loadRows(); if (typeof window.GestorQFinalBI.render === 'function') window.GestorQFinalBI.render(); } } catch(e){}
    }
    if (V) {
      var vend = load(KV, []);
      var vn = filtra(V.linhas).map(function(r){ return { data: r.data, codigo: r.codigo, produto: r.produto, quantidade: r.quantidade, valor: r.valor }; });
      var mv = mesclar(vend, vn);
      if (!saveLocal(KV, vend)) return;
      res.vendas = { add: mv.add, ja: mv.ja, total: vn.reduce(function(s, r){ return s + r.valor; }, 0) };
    }
    var datas = [].concat(P ? P.linhas : [], V ? V.linhas : []).filter(function(r){ return op.fixData || !r.corrigida; }).map(function(r){ return r.data; }).sort();
    res.de = datas[0]; res.ate = datas[datas.length - 1];
    res.avisos = { dups: op.dedup ? a.dups.length : 0, corrigidas: op.fixData ? (P ? P.corrigidas : 0) + (V ? V.corrigidas : 0) : 0, precos: a.precos.slice(0, 10), semVenda: a.semVenda, diasSemPerda: a.diasSemPerda };
    if (op.fat && V) res.fat = atualizarFaturamento();
    if (op.pend && P) res.pend = criarPendencias(res.de, res.ate);
    saveLocal(KR, res);
    pv.de = res.de; pv.ate = res.ate; pv.setor = '';
    notify('✅ Importado: ' + (res.perdas ? res.perdas.add + ' perda(s) nova(s)' : '') + (res.vendas ? ' · ' + res.vendas.add + ' venda(s) nova(s)' : '') + ((res.perdas && res.perdas.ja) || (res.vendas && res.vendas.ja) ? ' · ' + ((res.perdas ? res.perdas.ja : 0) + (res.vendas ? res.vendas.ja : 0)) + ' já existiam' : '') + '.', 'success');
    try { if (window.GQ51) window.GQ51.refresh(); } catch(e){}
    try { window.goPage('PerdaVenda', $('navGQ52PV')); } catch(e){}
    setTimeout(render, 80);
  }

  /* ════════════════════════════════════════════════════════════════
     Cálculos
     ════════════════════════════════════════════════════════════════ */
  function perdasRows(){ var r = load(PERDAS, null); if (!Array.isArray(r) || !r.length) r = load('gestorq_perdas_unified_rows_v1', []); return (r || []).filter(function(x){ return x && x.data && num(x.valor) > 0; }); }
  function setorDeCodigo(){
    var prod = load(KP, {}), m = {};
    Object.keys(prod).forEach(function(c){ if (prod[c].setor) m[c] = prod[c].setor; });
    perdasRows().forEach(function(r){ var c = normCod(r.codigo); if (c && r.departamento && !/^\d+$/.test(r.departamento)) m[c] = r.departamento; });
    return m;
  }
  function calcular(de, ate, setor){
    var prod = load(KP, {}), setCod = setorDeCodigo(), g = {}, dias = {};
    var item = function(c, nome){ return g[c] || (g[c] = { codigo: c, produto: nome, setor: setCod[c] || '', unidade: (prod[c] && prod[c].unidade) || unidadeDe('', nome), perda: 0, qp: 0, venda: 0, qv: 0, diasP: {} }); };
    var dia = function(d){ return dias[d] || (dias[d] = { v: 0, p: 0 }); };
    perdasRows().forEach(function(r){
      if (r.data < de || r.data > ate) return;
      var c = normCod(r.codigo) || 'N:' + normH(r.produto), s = (r.departamento && !/^\d+$/.test(r.departamento)) ? r.departamento : (setCod[c] || r.departamento || '');
      if (setor && s !== setor) return;
      var o = item(c, r.produto); o.setor = o.setor || s; o.perda += num(r.valor); o.qp += num(r.quantidade); o.diasP[r.data] = 1; o.produto = o.produto || r.produto;
      dia(r.data).p += num(r.valor);
    });
    load(KV, []).forEach(function(r){
      if (r.data < de || r.data > ate) return;
      var c = normCod(r.codigo) || 'N:' + normH(r.produto), s = setCod[c] || '';
      if (setor && s !== setor) return;
      var o = item(c, r.produto); o.venda += num(r.valor); o.qv += num(r.quantidade);
      dia(r.data).v += num(r.valor);
    });
    var lista = Object.keys(g).map(function(k){ return g[k]; });
    var temVenda = lista.some(function(o){ return o.venda > 0; });
    var nDiasV = Object.keys(dias).filter(function(d){ return dias[d].v > 0; }).length || Object.keys(dias).length || 1;
    lista.forEach(function(o){
      o.quebra = (o.venda + o.perda) > 0 ? o.perda / (o.venda + o.perda) * 100 : 0;
      o.pVenda = o.qv > 0 ? o.venda / o.qv : null;
      o.pPerda = o.qp > 0 ? o.perda / o.qp : null;
      o.ratio = o.pVenda && o.pPerda ? o.pPerda / o.pVenda : null;
      o.vendaPerdida = o.pVenda ? o.qp * o.pVenda : o.perda;
      o.meta = metaDe(o.setor);
      o.vendaDia = o.qv / nDiasV; o.entradaDia = (o.qv + o.qp) / nDiasV;
    });
    var comPerda = lista.filter(function(o){ return o.perda > 0; });
    var vendasOrd = comPerda.map(function(o){ return o.venda; }).sort(function(a, b){ return a - b; });
    var medV = vendasOrd.length ? vendasOrd[Math.floor(vendasOrd.length / 2)] : 0;
    lista.forEach(function(o){
      var alto = o.venda >= medV && o.venda > 0, perde = o.quebra >= o.meta;
      o.q = alto && perde ? 'A' : !alto && perde ? 'B' : alto ? 'C' : 'D';
      o.sug = sugestao(o);
    });
    var tot = { perda: 0, venda: 0, vendaPerdida: 0, kg: 0, un: 0 };
    lista.forEach(function(o){ tot.perda += o.perda; tot.venda += o.venda; tot.vendaPerdida += o.vendaPerdida; if (o.unidade === 'kg') tot.kg += o.qp; else tot.un += o.qp; });
    tot.quebra = (tot.venda + tot.perda) > 0 ? tot.perda / (tot.venda + tot.perda) * 100 : 0;
    var diasLista = Object.keys(dias).sort();
    var semLanc = diasLista.filter(function(d){ return dias[d].v > 0 && !dias[d].p; });
    return { lista: lista, comPerda: comPerda, tot: tot, dias: dias, diasLista: diasLista, semLanc: semLanc, medV: medV, temVenda: temVenda, nDiasV: nDiasV };
  }
  function sugestao(o){
    if (!(o.perda > 0)) return '';
    var u = o.unidade === 'kg' ? 'kg' : 'un', casas = u === 'kg' ? 1 : 0;
    if (!(o.qv > 0)) return 'Sem venda no período: suspender a compra e conferir o cadastro/código.';
    if (o.quebra < o.meta) return 'Dentro da meta.';
    var red = Math.round(o.qp / (o.qv + o.qp) * 100);
    var txt = 'Comprar ~' + numFmt(o.vendaDia, casas) + ' ' + u + '/dia (hoje entram ~' + numFmt(o.entradaDia, casas) + ' ' + u + '/dia, −' + red + '%).';
    if (o.q === 'B' && o.quebra >= 40) txt = 'Perde quase tanto quanto vende: avaliar tirar do mix ou comprar só sob encomenda. ' + txt;
    else if (o.q === 'A') txt = 'Revisar exposição, manuseio e rotação (PEPS). ' + txt;
    return txt;
  }
  function periodoPadrao(){
    var ds = perdasRows().map(function(r){ return r.data; }).concat(load(KV, []).map(function(r){ return r.data; })).sort();
    var r = load(KR, null);
    if (r && r.de && r.ate) return { de: r.de, ate: r.ate };
    if (!ds.length) { var h = iso(new Date()); return { de: h.slice(0, 8) + '01', ate: h }; }
    var ate = ds[ds.length - 1]; return { de: addDias(ate, -29) < ds[0] ? ds[0] : addDias(ate, -29), ate: ate };
  }

  /* ════════════════════════════════════════════════════════════════
     C) Integrações com a v51
     ════════════════════════════════════════════════════════════════ */
  function atualizarFaturamento(){
    if (!window.GQ51) return 0;
    var setCod = setorDeCodigo(), fat = window.GQ51.load('gq51_faturamento', {}) || {}, porMes = {};
    load(KV, []).forEach(function(r){ var s = setCod[normCod(r.codigo)]; if (!s) return; var m = r.data.slice(0, 7); var o = porMes[m] || (porMes[m] = {}); o[s] = (o[s] || 0) + num(r.valor); });
    var n = 0;
    Object.keys(porMes).forEach(function(m){
      var f = fat[m] || { total: 0, setores: {} }; f.setores = f.setores || {};
      Object.keys(porMes[m]).forEach(function(s){ f.setores[s] = Math.round(porMes[m][s] * 100) / 100; n++; });
      fat[m] = f;
    });
    window.GQ51.save('gq51_faturamento', fat);
    return n;
  }
  function criarPendencias(de, ate){
    if (!window.GQ51) return 0;
    var c = calcular(de, ate, ''), abertas = window.GQ51.getAcoes().filter(function(a){ return a && a.status !== 'concluida'; }).map(function(a){ return String(a.what || ''); });
    var n = 0;
    c.comPerda.sort(function(a, b){ return b.perda - a.perda; }).slice(0, 5).forEach(function(o){
      var what = 'Reduzir perda de ' + o.produto;
      if (abertas.some(function(w){ return w.indexOf(what) === 0; })) return;
      window.GQ51.novaAcao({ what: what + ' (' + brl(o.perda) + (c.temVenda ? ', quebra ' + pctFmt(o.quebra) : '') + ')',
        why: 'Importação de perdas de ' + brDate(de) + ' a ' + brDate(ate) + '. ' + (o.sug || ''), where: o.setor || '',
        when: addDias(iso(new Date()), 3), prioridade: o.quebra >= 20 ? 'alta' : 'media', origem: 'perdas' });
      n++;
    });
    return n;
  }
  function comprasHtml(dias){
    var ate = iso(new Date()), r = load(KR, null);
    var c = calcular(addDias(ate, -(dias || 60)), ate, '');
    if (!c.temVenda && r && r.de) c = calcular(r.de, r.ate, '');
    var l = c.comPerda.filter(function(o){ return o.qv > 0 && o.quebra >= o.meta; }).sort(function(a, b){ return b.perda - a.perda; }).slice(0, 30);
    if (!l.length) return '';
    return '<div class="gq-section"><h3>🥬 Quebra acima da meta (perdas x vendas importadas)</h3><p class="gq-sub">Produtos que perdem mais do que a meta do setor. Sugestão de compra com base na venda média diária.</p>' +
      '<div class="gq-tbl-wrap"><table class="gq-tbl"><thead><tr><th>Produto</th><th class="n">Quebra</th><th class="n">Perda</th><th>Sugestão</th></tr></thead><tbody>' +
      l.map(function(o){ return '<tr><td><b>' + esc(o.produto) + '</b><div style="font-size:.72rem;color:var(--gq-text-2)">' + esc(o.setor) + '</div></td><td class="n">' + pctFmt(o.quebra) + '</td><td class="n">' + brl(o.perda) + '</td><td><div class="gq52-sug">' + esc(o.sug) + '</div></td></tr>'; }).join('') +
      '</tbody></table></div></div>';
  }
  window.GQ52 = { comprasHtml: comprasHtml, calcular: calcular, parseData: lerData };

  /* ════════════════════════════════════════════════════════════════
     B) Página Perda x Venda
     ════════════════════════════════════════════════════════════════ */
  var pv = { de: null, ate: null, setor: '', ordem: 'perda', busca: '', charts: {} };
  function ensurePage(){
    if ($('pagePerdaVenda') || !$('mainScroll')) return;
    var pg = document.createElement('div'); pg.id = 'pagePerdaVenda'; pg.className = 'page';
    $('mainScroll').appendChild(pg);
    pg.addEventListener('click', onClick); pg.addEventListener('change', onChange);
  }
  function setupNav(){
    var nav = $('pwaNav'); if (!nav || $('navGQ52PV')) return;
    var ref = $('navGQLAnalise'); if (!ref) return;
    var b = document.createElement('button'); b.className = 'nav-btn'; b.id = 'navGQ52PV'; b.setAttribute('aria-label', 'Perda x Venda');
    b.setAttribute('onclick', "goPage('PerdaVenda',this)");
    b.innerHTML = '<svg class="nav-ico" viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg><span class="nl">Perda x Venda</span>';
    nav.insertBefore(b, ref.nextSibling);
    var side = $('gq51SideInd');
    if (side && !$('gq52SidePV')) { var it = side.cloneNode(true); it.id = 'gq52SidePV'; it.setAttribute('onclick', "goPage('PerdaVenda',document.getElementById('navGQ52PV'));closeSideMenu()"); it.textContent = '🥬 Perda x Venda (quebra por produto)'; side.parentNode.insertBefore(it, side.nextSibling); }
  }
  function syncPerm(){
    var ok = veFin();
    ['navGQ52PV', 'gq52SidePV'].forEach(function(id){ var el = $(id); if (el && el.__ok !== ok) { el.style.display = ok ? '' : 'none'; el.__ok = ok; } });
    var acts = document.querySelector('#pageGQFinal .gqf-actions');
    if (acts && ok && !$('gq52BtnPV')) {
      var b = document.createElement('button'); b.id = 'gq52BtnPV'; b.type = 'button'; b.textContent = '🥬 Perda x Venda';
      b.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); window.goPage('PerdaVenda', $('navGQ52PV')); });
      acts.insertBefore(b, acts.firstChild.nextSibling);
    }
  }
  // O botão "Importar XLSX" da aba Perdas passa a usar este importador (com conferência e sem apagar dados)
  window.addEventListener('change', function(e){
    var t = e.target; if (!t || t.id !== 'gqfFile') return;
    e.stopImmediatePropagation();
    var f = t.files && t.files[0]; t.value = ''; if (f) lerArquivo(f, abrirConferencia);
  }, true);

  function render(){
    var pg = $('pagePerdaVenda'); if (!pg) return;
    Object.keys(pv.charts).forEach(function(k){ try { pv.charts[k].destroy(); } catch(e){} }); pv.charts = {};
    if (!veFin()) { pg.innerHTML = '<div class="gq-empty">Esta página mostra valores financeiros e está disponível para gestão e prevenção de perdas.</div>'; return; }
    if (!pv.de) { var p = periodoPadrao(); pv.de = p.de; pv.ate = p.ate; }
    var c = calcular(pv.de, pv.ate, pv.setor);
    var len = diasEntre(pv.de, pv.ate) + 1, prev = calcular(addDias(pv.de, -len), addDias(pv.de, -1), pv.setor);
    var prevMap = {}; prev.lista.forEach(function(o){ prevMap[o.codigo] = o; });
    var setores = {}; Object.keys(load(KP, {})).forEach(function(k){ var s = load(KP, {})[k].setor; if (s) setores[s] = 1; }); perdasRows().forEach(function(r){ if (r.departamento && !/^\d+$/.test(r.departamento)) setores[r.departamento] = 1; });
    var meta = metaDe(pv.setor), r = load(KR, null);
    var head = '<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:10px;flex-wrap:wrap;margin:4px 0 12px">' +
      '<div><h2 style="margin:0;font-size:1.35rem;font-weight:800">Perda x Venda</h2><p class="gq-sub" style="margin:2px 0 0">Quebra por produto = perda ÷ (venda + perda). Mostra onde está o dinheiro e o que mudar na compra.</p></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="gq-btn pri" data-a="importar">📥 Importar planilha</button><button class="gq-btn" data-a="xlsx">📊 Exportar Excel</button><input type="file" id="gq52File" accept=".xlsx,.xls,.csv" style="display:none"></div></div>' +
      '<div class="gq-section"><div class="gq-form"><label>De<input type="date" data-f="de" value="' + esc(pv.de) + '"></label><label>Até<input type="date" data-f="ate" value="' + esc(pv.ate) + '"></label>' +
      '<label>Setor<select data-f="setor"><option value="">Todos</option>' + Object.keys(setores).sort().map(function(s){ return '<option' + (s === pv.setor ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></label>' +
      '<label>Meta de quebra' + (pv.setor ? ' do setor' : ' padrão') + ' (%)<input type="number" step="0.1" min="0.1" max="99" data-f="meta" value="' + meta + '"></label></div></div>';
    if (!c.lista.length) {
      pg.innerHTML = head + '<div class="gq-empty">Nenhum dado no período.<br>Importe uma planilha com as abas <b>PERDAS</b> (CODIGO, PRODUTO, DEPARTAMENTO, NOME/DEPARTAMENTO, Função, DATA, QUANTIDADE, VALOR) e <b>VENDAS</b> (DATA, CODIGO, PRODUTO, QUANTIDADE, VALOR).<br><button class="gq-btn pri" data-a="importar">📥 Importar planilha</button></div>';
      return;
    }
    var dq = prev.tot.venda + prev.tot.perda > 0 ? c.tot.quebra - prev.tot.quebra : null;
    var qCls = !c.temVenda ? '' : c.tot.quebra <= meta ? 'ok' : c.tot.quebra <= meta * 1.5 ? 'warn' : 'danger';
    var delta = function(v){ return v == null ? '' : '<span class="gq52-delta ' + (v > 0 ? 'gq52-up">▲ ' : 'gq52-down">▼ ') + pctFmt(Math.abs(v)) + ' p.p.</span>'; };
    var kpis = '<div class="gq52-kpis">' +
      '<div class="gq-kpi ' + qCls + '" style="cursor:default"><div class="l">Quebra do período</div><div class="v">' + (c.temVenda ? pctFmt(c.tot.quebra) : '—') + delta(c.temVenda ? dq : null) + '</div><div class="s">' + (c.temVenda ? 'meta ' + pctFmt(meta) + (dq != null ? ' · vs período anterior' : '') : 'importe a aba VENDAS para calcular') + '</div></div>' +
      '<div class="gq-kpi danger" style="cursor:default"><div class="l">Perdas (valor lançado)</div><div class="v">' + brl(c.tot.perda) + '</div><div class="s">' + c.comPerda.length + ' produtos · ' + numFmt(c.tot.kg, 1) + ' kg + ' + numFmt(c.tot.un, 0) + ' un</div></div>' +
      '<div class="gq-kpi ok" style="cursor:default"><div class="l">Vendas</div><div class="v">' + brl(c.tot.venda) + '</div><div class="s">' + c.nDiasV + ' dia(s) com venda</div></div>' +
      '<div class="gq-kpi warn" style="cursor:default"><div class="l">Venda que deixou de acontecer</div><div class="v">' + brl(c.tot.vendaPerdida) + '</div><div class="s">quantidade perdida × preço médio de venda</div></div>' +
      '<div class="gq-kpi" style="cursor:default"><div class="l">Concentração</div><div class="v">' + concentracao(c) + '</div><div class="s">produtos somam 80% da perda</div></div>' +
      '<div class="gq-kpi ' + (c.semLanc.length ? 'warn' : 'ok') + '" style="cursor:default"><div class="l">Dias sem lançamento de perda</div><div class="v">' + c.semLanc.length + '</div><div class="s">' + (c.semLanc.length ? c.semLanc.slice(0, 4).map(brDate).join(', ') + (c.semLanc.length > 4 ? '…' : '') : 'rotina em dia') + '</div></div></div>';
    var cont = { A: 0, B: 0, C: 0, D: 0 }; c.comPerda.forEach(function(o){ cont[o.q]++; });
    var matriz = c.temVenda ? '<div class="gq-section"><h3>🎯 Matriz de decisão</h3><p class="gq-sub">Cada bolha é um produto (tamanho = R$ perdido). Linha vertical: venda mediana; horizontal: meta de quebra.</p>' +
      '<div class="gq52-chart"><canvas id="gq52Scatter"></canvas></div><div class="gq52-quad">' + ['A', 'B', 'C', 'D'].map(function(k){ return '<div><b><span class="gq52-q ' + QUAD[k].cls + '">' + QUAD[k].n + '</span> ' + cont[k] + '</b>' + QUAD[k].d + '</div>'; }).join('') + '</div></div>' : '';
    var diario = '<div class="gq-section"><h3>📅 Dia a dia</h3><p class="gq-sub">Vendas, perdas e quebra diária. Barras laranja: dia com venda e sem perda lançada (falha na rotina). Nesses dias a quebra fica em branco.</p><div class="gq52-chart sm"><canvas id="gq52Diario"></canvas></div></div>';
    var busca = normH(pv.busca);
    var lista = c.comPerda.filter(function(o){ return !busca || normH(o.produto).indexOf(busca) >= 0 || o.codigo.indexOf(busca) >= 0; })
      .sort(function(a, b){ return pv.ordem === 'quebra' ? b.quebra - a.quebra : pv.ordem === 'venda' ? b.vendaPerdida - a.vendaPerdida : b.perda - a.perda; });
    var tabela = '<div class="gq-section"><h3>🥬 Quebra por produto</h3><div class="gq-form" style="margin-bottom:10px"><label>Ordenar por<select data-f="ordem">' +
      [['perda', 'Maior perda (R$)'], ['quebra', 'Maior quebra (%)'], ['venda', 'Maior venda perdida']].map(function(o){ return '<option value="' + o[0] + '"' + (pv.ordem === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
      '</select></label><label>Buscar produto<input data-f="busca" value="' + esc(pv.busca) + '" placeholder="nome ou código"></label></div>' +
      '<div class="gq-tbl-wrap"><table class="gq-tbl gq52-tbl"><thead><tr><th>Produto</th><th>Quadrante</th><th class="n">Venda</th><th class="n">Perda</th><th class="n">Quebra</th><th class="n">Qtd perdida</th><th class="n">R$/un perda × venda</th><th>Sugestão</th><th></th></tr></thead><tbody>' +
      lista.slice(0, 80).map(function(o){
        var p = prevMap[o.codigo], d = p && (p.venda + p.perda) > 0 && c.temVenda ? o.quebra - p.quebra : null;
        return '<tr><td class="prod"><b>' + esc(o.produto) + '</b><div style="font-size:.72rem;color:var(--gq-text-2)">' + esc(o.codigo.indexOf('N:') === 0 ? '' : o.codigo) + (o.setor ? ' · ' + esc(o.setor) : '') + '</div></td>' +
          '<td>' + (c.temVenda ? '<span class="gq52-q ' + QUAD[o.q].cls + '">' + QUAD[o.q].n + '</span>' : '—') + '</td>' +
          '<td class="n">' + brl(o.venda) + '</td><td class="n"><b>' + brl(o.perda) + '</b></td>' +
          '<td class="n">' + (c.temVenda ? '<b style="color:' + (o.quebra >= o.meta ? 'var(--gq-danger)' : 'var(--gq-ok)') + '">' + pctFmt(o.quebra) + '</b>' + delta(d) : '—') + '</td>' +
          '<td class="n">' + numFmt(o.qp, o.unidade === 'kg' ? 2 : 0) + ' ' + o.unidade + '</td>' +
          '<td class="n">' + (o.ratio ? brl(o.pPerda) + ' × ' + brl(o.pVenda) + (o.ratio > 1 ? ' <span class="gq52-warn" title="Perda valendo mais que a venda: conferir unidade/preço">⚠️</span>' : '') : '—') + '</td>' +
          '<td><div class="gq52-sug">' + esc(o.sug) + '</div></td>' +
          '<td><button class="gq-btn sm" data-a="pend" data-cod="' + esc(o.codigo) + '" title="Criar pendência para este produto">＋ Pendência</button></td></tr>';
      }).join('') + '</tbody></table></div>' + (lista.length > 80 ? '<p class="gq-sub">Mostrando 80 de ' + lista.length + '. Use a busca ou exporte para Excel.</p>' : '') + '</div>';
    var rel = r ? '<details class="gq-section"><summary style="cursor:pointer;font-weight:800">📋 Última importação: ' + esc(r.arquivo) + ' (' + esc(new Date(r.em).toLocaleString('pt-BR')) + ')</summary><div class="gq-sub" style="margin-top:8px">' +
      (r.perdas ? 'Perdas: ' + r.perdas.add + ' novas, ' + r.perdas.ja + ' já existiam (' + brl(r.perdas.total) + '). ' : '') + (r.vendas ? 'Vendas: ' + r.vendas.add + ' novas, ' + r.vendas.ja + ' já existiam (' + brl(r.vendas.total) + '). ' : '') +
      (r.avisos && r.avisos.corrigidas ? r.avisos.corrigidas + ' data(s) corrigida(s). ' : '') + (r.avisos && r.avisos.dups ? r.avisos.dups + ' lançamento(s) em dobro removido(s). ' : '') +
      (r.fat ? 'Faturamento atualizado em Indicadores. ' : '') + (r.pend ? r.pend + ' pendência(s) criada(s). ' : '') +
      (r.avisos && r.avisos.precos && r.avisos.precos.length ? '<br>⚠️ Conferir preço/unidade: ' + r.avisos.precos.map(function(x){ return esc(x.nome); }).join(', ') + '.' : '') + '</div></details>' : '';
    pg.innerHTML = head + kpis + rel + matriz + diario + tabela;
    desenhar(c, meta);
  }
  function concentracao(c){
    var l = c.comPerda.map(function(o){ return o.perda; }).sort(function(a, b){ return b - a; }), tot = c.tot.perda, ac = 0, n = 0;
    for (var i = 0; i < l.length && ac < tot * 0.8; i++) { ac += l[i]; n++; }
    return n + ' de ' + l.length;
  }
  function desenhar(c, meta){
    if (typeof window.Chart !== 'function') return;
    var dark = document.documentElement.getAttribute('data-theme') === 'dark', tc = dark ? '#9fb0c8' : '#55627a', gc = dark ? 'rgba(148,163,184,.15)' : 'rgba(15,23,42,.08)';
    var sc = $('gq52Scatter');
    if (sc) {
      var maxP = Math.max.apply(null, c.comPerda.map(function(o){ return o.perda; }).concat([1]));
      var ds = ['A', 'B', 'C', 'D'].map(function(k){
        return { label: QUAD[k].n, backgroundColor: QUAD[k].cor + 'aa', borderColor: QUAD[k].cor,
          data: c.comPerda.filter(function(o){ return o.q === k && o.venda > 0; }).map(function(o){ return { x: o.venda, y: Math.min(o.quebra, 100), r: 4 + Math.sqrt(o.perda / maxP) * 16, nome: o.produto, perda: o.perda }; }) };
      });
      var maxX = Math.max.apply(null, c.comPerda.map(function(o){ return o.venda; }).concat([10]));
      ds.push({ type: 'line', label: 'Meta', data: [{ x: 0, y: meta }, { x: maxX * 1.05, y: meta }], borderColor: '#f59e0b', borderDash: [6, 4], pointRadius: 0, borderWidth: 1.5 });
      ds.push({ type: 'line', label: 'Venda mediana', data: [{ x: c.medV, y: 0 }, { x: c.medV, y: 100 }], borderColor: tc, borderDash: [4, 4], pointRadius: 0, borderWidth: 1 });
      try {
        pv.charts.s = new window.Chart(sc.getContext('2d'), { type: 'bubble', data: { datasets: ds },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: tc, filter: function(i){ return i.text !== 'Venda mediana'; } } },
            tooltip: { callbacks: { label: function(x){ var d = x.raw; return d.nome ? d.nome + ': venda ' + brl(d.x) + ', quebra ' + pctFmt(d.y) + ', perda ' + brl(d.perda) : x.dataset.label; } } } },
            scales: { x: { type: 'logarithmic', title: { display: true, text: 'Venda no período (R$, escala log)', color: tc }, ticks: { color: tc, callback: function(v){ var s = String(v); return /^[125]/.test(s) ? 'R$ ' + Number(v).toLocaleString('pt-BR') : ''; } }, grid: { color: gc } },
              y: { min: 0, max: 100, title: { display: true, text: 'Quebra (%)', color: tc }, ticks: { color: tc, callback: function(v){ return v + '%'; } }, grid: { color: gc } } } } });
      } catch(e){ console.warn('[v52 matriz]', e); }
    }
    var dc = $('gq52Diario');
    if (dc) {
      var L = c.diasLista;
      try {
        pv.charts.d = new window.Chart(dc.getContext('2d'), { data: { labels: L.map(function(d){ return d.slice(8, 10) + '/' + d.slice(5, 7); }), datasets: [
          { type: 'bar', label: 'Vendas (R$)', data: L.map(function(d){ return +c.dias[d].v.toFixed(2); }), backgroundColor: 'rgba(79,107,255,.55)', borderRadius: 4, yAxisID: 'y' },
          { type: 'bar', label: 'Perdas (R$)', data: L.map(function(d){ return +c.dias[d].p.toFixed(2); }), backgroundColor: L.map(function(d){ return c.dias[d].v > 0 && !c.dias[d].p ? 'rgba(245,158,11,.9)' : 'rgba(239,68,68,.75)'; }), borderRadius: 4, yAxisID: 'y' },
          { type: 'line', label: 'Quebra (%)', data: L.map(function(d){ var x = c.dias[d]; return x.p > 0 && x.v + x.p > 0 ? +(x.p / (x.v + x.p) * 100).toFixed(2) : null; }), borderColor: '#f59e0b', backgroundColor: '#f59e0b', tension: 0, yAxisID: 'y1', spanGaps: false } ] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: tc } }, tooltip: { callbacks: { label: function(x){ return x.dataset.yAxisID === 'y1' ? 'Quebra: ' + pctFmt(x.parsed.y) : x.dataset.label + ': ' + brl(x.parsed.y); } } } },
            scales: { x: { ticks: { color: tc }, grid: { display: false } }, y: { ticks: { color: tc, callback: function(v){ return 'R$ ' + Number(v).toLocaleString('pt-BR'); } }, grid: { color: gc } },
              y1: { position: 'right', min: 0, ticks: { color: tc, callback: function(v){ return v + '%'; } }, grid: { display: false } } } } });
      } catch(e){ console.warn('[v52 diario]', e); }
    }
  }
  function exportar(){
    if (typeof window.XLSX === 'undefined') return notify('Biblioteca de Excel não carregada.', 'warning');
    var c = calcular(pv.de, pv.ate, pv.setor);
    var linhas = c.comPerda.sort(function(a, b){ return b.perda - a.perda; }).map(function(o){
      return [o.codigo.indexOf('N:') === 0 ? '' : o.codigo, o.produto, o.setor, o.unidade, +o.venda.toFixed(2), +o.qv.toFixed(3), +o.perda.toFixed(2), +o.qp.toFixed(3), +o.quebra.toFixed(2), o.meta, QUAD[o.q].n, +o.vendaPerdida.toFixed(2), o.ratio ? +o.ratio.toFixed(2) : '', o.sug];
    });
    var ws = window.XLSX.utils.aoa_to_sheet([['Código', 'Produto', 'Setor', 'Unidade', 'Venda R$', 'Qtd vendida', 'Perda R$', 'Qtd perdida', 'Quebra %', 'Meta %', 'Quadrante', 'Venda perdida R$', 'Preço perda/venda', 'Sugestão']].concat(linhas));
    var wd = window.XLSX.utils.aoa_to_sheet([['Data', 'Vendas R$', 'Perdas R$', 'Quebra %']].concat(c.diasLista.map(function(d){ var x = c.dias[d]; return [brDate(d), +x.v.toFixed(2), +x.p.toFixed(2), x.v + x.p > 0 ? +(x.p / (x.v + x.p) * 100).toFixed(2) : '']; })));
    var wb = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(wb, ws, 'Quebra por produto'); window.XLSX.utils.book_append_sheet(wb, wd, 'Dia a dia');
    window.XLSX.writeFile(wb, 'gestorq_perda_x_venda_' + pv.de + '_' + pv.ate + '.xlsx');
  }
  function onClick(e){
    var b = e.target.closest('[data-a]'); if (!b) return;
    var a = b.getAttribute('data-a');
    if (a === 'importar') { var f = $('gq52File'); if (f) { f.value = ''; f.click(); } }
    else if (a === 'xlsx') exportar();
    else if (a === 'pend') {
      if (!window.GQ51) return;
      var cod = b.getAttribute('data-cod'), o = calcular(pv.de, pv.ate, pv.setor).lista.filter(function(x){ return x.codigo === cod; })[0]; if (!o) return;
      window.GQ51.novaAcao({ what: 'Reduzir perda de ' + o.produto + ' (' + brl(o.perda) + ', quebra ' + pctFmt(o.quebra) + ')', why: o.sug, where: o.setor, when: addDias(iso(new Date()), 3), prioridade: o.quebra >= 20 ? 'alta' : 'media', origem: 'perdas' });
      notify('✅ Pendência criada para ' + o.produto + '.', 'success'); b.disabled = true; b.textContent = '✓ Criada';
    }
  }
  function onChange(e){
    var el = e.target, f = el.getAttribute('data-f');
    if (el.id === 'gq52File' && el.files && el.files[0]) return lerArquivo(el.files[0], abrirConferencia);
    if (!f) return;
    if (f === 'meta') { var c = cfg(), v = num(el.value); if (!(v > 0 && v < 100)) return; if (pv.setor) c.metas[pv.setor] = v; else c.metaPadrao = v; saveLocal(KC, c); }
    else if (f === 'de' || f === 'ate') { if (/^\d{4}-\d{2}-\d{2}$/.test(el.value)) pv[f] = el.value; if (pv.de > pv.ate) { var t = pv.de; pv.de = pv.ate; pv.ate = t; } }
    else pv[f] = el.value;
    render();
  }

  /* ── Ciclo ─────────────────────────────────────────────────────── */
  var visto = false;
  function tick(){
    if (!document.body.classList.contains('qx50-auth')) return;
    ensurePage(); setupNav(); syncPerm();
    var shown = isShown($('pagePerdaVenda'));
    if (shown && !visto) render();
    visto = shown;
  }
  function boot(){ setInterval(function(){ try { tick(); } catch(e){ console.error('[v52]', e); } }, 1000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
