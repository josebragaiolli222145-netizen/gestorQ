(function(){
  'use strict';
  if (window.__GESTORQ_V51__) return;
  window.__GESTORQ_V51__ = true;

  /* ════════════════════════════════════════════════════════════════
     Utilidades
     ════════════════════════════════════════════════════════════════ */
  var K = {
    destinos: 'gq51_destinos',        // destino dado a produtos próximos do vencimento
    motivos:  'gq51_motivos',         // motivo atribuído a lançamentos de perda importados
    fat:      'gq51_faturamento',     // faturamento por mês (total e por setor)
    cfg:      'gq51_config',          // formato da loja, meta, faixas de rebaixa
    fotos:    'gq51_fotos',           // fotos de evidência das pendências (só local)
    feito:    'gq51_lista_feita',     // itens marcados na "Minha lista de hoje"
    loja:     'gq51_modo_loja'
  };
  var PERDAS_STORE = 'gestorq_perdas_master_rows_v42';
  var MOTIVOS = ['Vencido', 'Avaria/Quebra', 'Furto', 'Quebra operacional', 'Erro de recebimento', 'Temperatura/Deterioração', 'Erro de inventário', 'Doação', 'Outros'];
  var FORMATOS = {
    vizinhanca:   { n: 'Mercado de vizinhança', v: 3.30 },
    convencional: { n: 'Supermercado convencional', v: 2.79 },
    hiper:        { n: 'Hipermercado', v: 2.11 },
    atacarejo:    { n: 'Atacarejo', v: 1.85 }
  };
  var GESTAO = /^(admin|administrador|gerente|subgerente|supervisor|diretor)$/i;
  var FINANCEIRO = /^(admin|administrador|gerente|subgerente|supervisor|diretor|prevencao|prevenção)$/i; // vê perdas em R$ e Indicadores
  var MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
  function load(k, def){ try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; } catch(e){ return def; } }
  function save(k, v){
    try { localStorage.setItem(k, JSON.stringify(v)); }
    catch(e){ notify('⚠️ Armazenamento do aparelho cheio. Exporte um backup e apague dados antigos.', 'warning'); return false; }
    cloudPush(k);
    return true;
  }
  function notify(m, t){ try { (window.showNotification || function(x){ console.log(x); })(m, t || 'info'); } catch(e){} }
  function brl(n){ return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function pctFmt(n){ return (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'; }
  function num(v){ if (typeof v === 'number') return v; var s = String(v == null ? '' : v).replace(/[R$\s]/g, ''); if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.'); var n = parseFloat(s); return isNaN(n) ? 0 : n; }
  function pad(n){ return String(n).padStart(2, '0'); }
  function iso(d){ d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function mesAtual(){ return iso().slice(0, 7); }
  function mesNome(m){ var p = String(m || '').split('-'); return p.length === 2 ? MESES[+p[1] - 1] + '/' + p[0] : m; }
  function brDate(s){ var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : (s || '—'); }
  function diasAte(v){
    var m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return null;
    var a = new Date(+m[1], +m[2] - 1, +m[3]); var h = new Date(); h.setHours(0, 0, 0, 0);
    return Math.round((a - h) / 86400000);
  }
  function addDias(n){ var d = new Date(); d.setDate(d.getDate() + n); return iso(d); }
  function uid(p){ return (p || 'gq') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
  function curUser(){ try { return window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null); } catch(e){ return null; } }
  function userName(){ var u = curUser(); return (u && (u.name || u.nome || u.username)) || '—'; }
  function isGestao(){ var u = curUser(); return !!u && GESTAO.test(String(u.role || '')); }
  function veFinanceiro(){ var u = curUser(); return !!u && FINANCEIRO.test(String(u.role || '')); }
  function isAdmin(){ var u = curUser(); return !!u && /^(admin|administrador)$/i.test(String(u.role || '')); }
  function isShown(el){ return !!el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none'; }
  function go(page){ try { window.goPage(page, document.querySelector('[onclick*="goPage(\'' + page + '\'"]')); } catch(e){} }
  function logAct(a, d){ try { if (typeof window.logAction === 'function') window.logAction(a, d); } catch(e){} }

  var ICO = {
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    temp: '<path d="M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z"/>',
    task: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>',
    money: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 8v8M10 8v8M13 8v8M17 8v8"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>'
  };
  var RE_IMG = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/;
  function fotoOk(f){ return !!f && typeof f.img === 'string' && RE_IMG.test(f.img); }
  function ico(n){ return '<svg class="gq-ico" viewBox="0 0 24 24">' + (ICO[n] || '') + '</svg>'; }

  /* ════════════════════════════════════════════════════════════════
     Acesso aos dados do app (sem duplicar)
     ════════════════════════════════════════════════════════════════ */
  function getVenc(){ return Array.isArray(window.vencidosData) ? window.vencidosData : load('vencidosData', []); }
  function persistVenc(){
    try { if (typeof window.saveVencidos === 'function') window.saveVencidos(); else localStorage.setItem('vencidosData', JSON.stringify(getVenc())); } catch(e){}
    try { if (typeof window.renderVencidos === 'function') window.renderVencidos(); } catch(e){}
  }
  function itemVal(p){
    var q = num(p.qtd != null ? p.qtd : (p.quantidade != null ? p.quantidade : 1)) || 1;
    var u = num(p.valorUnit != null ? p.valorUnit : (p.valor != null ? p.valor : 0));
    return { q: q, u: u, total: q * u };
  }
  function getAcoes(){ return Array.isArray(window.acoesData) ? window.acoesData : load('acoesPlano', []); }
  function persistAcao(acao){
    var arr = getAcoes();
    if (acao && arr.indexOf(acao) < 0) arr.push(acao);
    try { localStorage.setItem('acoesPlano', JSON.stringify(arr)); } catch(e){ notify('⚠️ Sem espaço para salvar a pendência.', 'warning'); }
    if (acao && window.fbMode === 'cloud' && window.db && window.fbFilial) {
      try { window.db.collection('filiais').doc(window.fbFilial).collection('planoAcao').doc(acao.id).set(acao).catch(function(){}); } catch(e){}
    }
    try { if (typeof window.renderPlanoAcao === 'function' && isShown($('pagePlanoAcao'))) window.renderPlanoAcao(); } catch(e){}
  }
  function limpa(t, max){ return String(t == null ? '' : t).replace(/[<>]/g, '').slice(0, max || 300); }
  function novaAcao(o){
    var u = curUser();
    ['what', 'why', 'where', 'who', 'how'].forEach(function(k){ if (o[k] != null) o[k] = limpa(o[k]); });
    var a = {
      id: 'ac_' + Date.now() + Math.floor(Math.random() * 1000),
      what: o.what, why: o.why || '', where: o.where || '', who: o.who || userName(), when: o.when || iso(),
      how: o.how || '', howMuch: 0, prioridade: o.prioridade || 'media', status: 'aberta',
      filial: window.fbFilial || (u && u.filial) || '', criadoPor: userName(), criadoEm: new Date().toISOString(),
      subtarefas: [], progresso: 0, origem: o.origem || 'gestorq'
    };
    persistAcao(a);
    return a;
  }
  function getTempLog(){ return load('tempLog', []); }
  function motivoKey(r){ return [r.data, r.codigo || '', r.produto, Number(r.valor).toFixed(2)].join('|'); }
  function perdasRows(){
    var rows = load(PERDAS_STORE, null);
    if (!Array.isArray(rows) || !rows.length) rows = load('gestorq_perdas_unified_rows_v1', []);
    var mot = load(K.motivos, {});
    return (rows || []).filter(function(r){ return r && r.data && num(r.valor); }).map(function(r){
      var o = {}; for (var k in r) o[k] = r[k];
      o.valor = num(r.valor); o.quantidade = num(r.quantidade) || 1;
      o.mes = o.mes || String(r.data).slice(0, 7);
      o.departamento = o.departamento || o.setor || '—';
      var m = mot[motivoKey(o)]; if (m) o.motivo = m;
      if (!o.motivo) o.motivo = 'Não informado';
      return o;
    });
  }
  function addPerda(p){
    var rows = load(PERDAS_STORE, null);
    if (!Array.isArray(rows)) rows = load('gestorq_perdas_unified_rows_v1', []) || [];
    var data = p.data || iso();
    var row = { data: data, mes: data.slice(0, 7), ano: data.slice(0, 4), codigo: String(p.codigo || ''), produto: p.produto,
      departamento: p.setor || '—', motivo: p.motivo || 'Outros', quantidade: num(p.quantidade) || 1, valor: num(p.valor) };
    rows.push(row);
    try { localStorage.setItem(PERDAS_STORE, JSON.stringify(rows)); localStorage.setItem('gestorq_perdas_unified_rows_v1', JSON.stringify(rows)); }
    catch(e){ notify('⚠️ Sem espaço para registrar a perda.', 'warning'); return; }
    try { if (window.GestorQFinalBI && typeof window.GestorQFinalBI.loadRows === 'function') window.GestorQFinalBI.loadRows(); } catch(e){}
  }
  function cfg(){
    var c = load(K.cfg, {});
    if (!FORMATOS[c.formato]) c.formato = 'convencional';
    c.meta = num(c.meta); if (!(c.meta > 0 && c.meta < 100)) c.meta = FORMATOS[c.formato].v;
    if (!Array.isArray(c.faixas) || c.faixas.length !== 4) c.faixas = [50, 35, 25, 15];
    c.faixas = c.faixas.map(function(x){ return Math.max(0, Math.min(90, Math.round(num(x)))); });
    return c;
  }
  function sugestao(d){
    if (d == null || d > 7) return null;
    if (d < 0) return { pct: 0, vencido: true };
    var f = cfg().faixas;
    return { pct: d <= 1 ? f[0] : d <= 3 ? f[1] : d <= 5 ? f[2] : f[3] };
  }
  function badgeDias(d){
    if (d == null) return '<span class="gq-badge gq-b-ok">sem data</span>';
    if (d < 0) return '<span class="gq-badge gq-b-venc">vencido há ' + (-d) + 'd</span>';
    if (d === 0) return '<span class="gq-badge gq-b-venc">vence hoje</span>';
    if (d <= 3) return '<span class="gq-badge gq-b-crit">' + d + ' dia' + (d > 1 ? 's' : '') + '</span>';
    if (d <= 7) return '<span class="gq-badge gq-b-at">' + d + ' dias</span>';
    return '<span class="gq-badge gq-b-ok">' + d + ' dias</span>';
  }

  /* ── Sincronização opcional dos dados novos com o Firebase ───────── */
  var CLOUD_KEYS = [K.destinos, K.motivos, K.fat, K.cfg];
  function cloudOk(){ return window.fbMode === 'cloud' && window.db && window.fbFilial; }
  function cloudPush(k){
    if (CLOUD_KEYS.indexOf(k) < 0) return;
    var ts = Date.now();
    try { localStorage.setItem(k + '__ts', String(ts)); } catch(e){}
    if (!cloudOk()) return;
    try { window.db.collection('filiais').doc(window.fbFilial).collection('gestorq_v51').doc(k).set({ json: localStorage.getItem(k), updatedAt: ts }).catch(function(){}); } catch(e){}
  }
  var pulled = false;
  function cloudPull(){
    if (pulled || !cloudOk()) return; pulled = true;
    CLOUD_KEYS.forEach(function(k){
      try {
        window.db.collection('filiais').doc(window.fbFilial).collection('gestorq_v51').doc(k).get().then(function(s){
          if (!s || !s.exists) return;
          var d = s.data() || {}; var lt = +localStorage.getItem(k + '__ts') || 0;
          if (d.json && d.updatedAt > lt) { var obj = {}; try { obj[k] = JSON.parse(d.json); } catch(e){ return; } var ok = validarBackup(obj); if (ok[k] === undefined) return; localStorage.setItem(k, JSON.stringify(ok[k])); localStorage.setItem(k + '__ts', String(Math.min(+d.updatedAt || 0, Date.now()))); dirty = true; }
        }).catch(function(){});
      } catch(e){}
    });
  }

  /* ── Modal genérico ────────────────────────────────────────────── */
  function modal(html, opts){
    opts = opts || {};
    var ov = document.createElement('div'); ov.className = 'gq-ov';
    ov.innerHTML = '<div class="gq-modal" role="dialog" aria-modal="true">' + html + '</div>';
    if (!opts.locked) ov.addEventListener('click', function(e){ if (e.target === ov) close(); });
    function close(){ if (opts.onClose) try { opts.onClose(); } catch(e){} ov.remove(); }
    ov.close = close;
    document.body.appendChild(ov);
    var f = ov.querySelector('input,select,textarea'); if (f) setTimeout(function(){ try { f.focus(); } catch(e){} }, 40);
    return ov;
  }

  /* ════════════════════════════════════════════════════════════════
     Marca única: "Qualtrix" → "GestorQ" nos textos visíveis
     ════════════════════════════════════════════════════════════════ */
  var RE_BRAND = /Qualtrix|QUALTRIX/g;
  function brandText(n){
    if (n.nodeType !== 3 || !RE_BRAND.test(n.nodeValue)) return;
    RE_BRAND.lastIndex = 0;
    var p = n.parentNode; if (p && /^(SCRIPT|STYLE|TEXTAREA|INPUT)$/.test(p.nodeName)) return;
    n.nodeValue = n.nodeValue.replace(/Qualtrix/g, 'GestorQ').replace(/QUALTRIX/g, 'GESTORQ');
  }
  function brandFix(root){
    if (!root) return;
    if (root.nodeType === 3) { brandText(root); return; }
    if (root.nodeType !== 1 || /^(SCRIPT|STYLE)$/.test(root.nodeName)) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n, list = [];
    while ((n = w.nextNode())) list.push(n);
    list.forEach(brandText);
    var attrs = root.querySelectorAll ? root.querySelectorAll('[title*="Qualtrix"],[placeholder*="Qualtrix"],[aria-label*="Qualtrix"]') : [];
    Array.prototype.forEach.call(attrs, function(el){ ['title', 'placeholder', 'aria-label'].forEach(function(a){ var v = el.getAttribute(a); if (v && v.indexOf('Qualtrix') >= 0) el.setAttribute(a, v.replace(/Qualtrix/g, 'GestorQ')); }); });
    RE_BRAND.lastIndex = 0;
  }
  function brandObserve(){
    brandFix(document.body);
    if (/Qualtrix/.test(document.title)) document.title = document.title.replace(/Qualtrix/g, 'GestorQ');
    var pending = [], t = null;
    new MutationObserver(function(muts){
      muts.forEach(function(m){
        if (m.type === 'characterData') pending.push(m.target);
        else for (var i = 0; i < m.addedNodes.length; i++) pending.push(m.addedNodes[i]);
      });
      if (!t) t = setTimeout(function(){ var p = pending; pending = []; t = null; p.forEach(function(n){ if (n.isConnected) brandFix(n); }); }, 300);
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  /* ════════════════════════════════════════════════════════════════
     Cabeçalho: menu do usuário (reúne tema, salvar, novidades etc.)
     ════════════════════════════════════════════════════════════════ */
  function setupHeader(){
    var av = $('hdrAvatar'); if (!av || av.__gq51) return; av.__gq51 = true;
    av.title = 'Menu do usuário';
    av.addEventListener('click', function(e){ e.preventDefault(); e.stopImmediatePropagation(); toggleUserMenu(av); }, true);
  }
  function toggleUserMenu(anchor){
    var m = $('gq51UserMenu'); if (m) { m.remove(); return; }
    var u = curUser() || {};
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var items = [
      ['perfil', '👤', 'Meu perfil e configurações', ''],
      ['busca', '🔍', 'Buscar em tudo', 'Ctrl+K'],
      ['tema', dark ? '☀️' : '🌙', dark ? 'Tema claro' : 'Tema escuro', ''],
      ['loja', '🖐️', 'Modo chão de loja', document.body.classList.contains('gq51-loja') ? 'ligado' : 'desligado'],
      ['salvar', '💾', 'Salvar agora', ''],
      ['novidades', '🆕', 'Novidades', '']
    ];
    [['q18Launcher', '🏢', 'BI Enterprise'], ['v22WorkspaceBtn', '✦', 'Workspace'], ['ultraDockBtn', '☰', 'Central de operações'], ['ultraPaletteBtn', '⌘', 'Comandos']].forEach(function(x){
      if ($(x[0])) items.push(['btn:' + x[0], x[1], x[2], '']);
    });
    if (isAdmin()) { items.push(['codigo', '🔑', 'Novo código de recuperação', '']); if ($('qx-diag-btn')) items.push(['diag', '🔧', 'Diagnóstico do Firebase', '']); }
    if (typeof window.logout === 'function') items.push(['sair', '🚪', 'Sair', '']);
    m = document.createElement('div'); m.id = 'gq51UserMenu';
    m.innerHTML = '<div class="hd"><b>' + esc(u.name || u.username || 'Usuário') + '</b><span>' + esc(u.role || '') + (u.filial ? ' · ' + esc(u.filial) : '') + '</span></div>' +
      items.map(function(i){ return '<button data-a="' + i[0] + '"><span>' + i[1] + '</span>' + i[2] + (i[3] ? '<span class="k">' + i[3] + '</span>' : '') + '</button>'; }).join('');
    document.body.appendChild(m);
    var r = anchor.getBoundingClientRect();
    m.style.top = (r.bottom + 8) + 'px';
    m.style.left = Math.max(8, Math.min(window.innerWidth - m.offsetWidth - 8, r.left + r.width / 2 - m.offsetWidth / 2)) + 'px';
    m.addEventListener('click', function(e){
      var b = e.target.closest('button'); if (!b) return;
      var a = b.getAttribute('data-a'); m.remove();
      try {
        if (a === 'perfil') go('Config');
        else if (a === 'busca') { if (typeof window.abrirBuscaGlobal === 'function') window.abrirBuscaGlobal(); else if ($('hdrSearchBtn')) $('hdrSearchBtn').click(); }
        else if (a === 'tema') { if (typeof window.toggleDark === 'function') window.toggleDark(); }
        else if (a === 'loja') setModoLoja(!document.body.classList.contains('gq51-loja'));
        else if (a === 'salvar') { if (typeof window.saveData === 'function') window.saveData(true); }
        else if (a === 'novidades') { if (typeof window.abrirChangelog === 'function') window.abrirChangelog(); }
        else if (a === 'codigo') { if (typeof window.qxGerarCodigoRecuperacao === 'function') window.qxGerarCodigoRecuperacao(); }
        else if (a === 'diag') $('qx-diag-btn').click();
        else if (a.indexOf('btn:') === 0 && $(a.slice(4))) $(a.slice(4)).click();
        else if (a === 'sair') window.logout();
      } catch(err){ console.warn('[v51 menu]', err); }
    });
    setTimeout(function(){ document.addEventListener('click', function off(ev){ if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('click', off, true); } }, true); }, 0);
  }
  function setModoLoja(on){
    document.body.classList.toggle('gq51-loja', on);
    try { localStorage.setItem(K.loja, on ? '1' : '0'); } catch(e){}
    notify(on ? '🖐️ Modo chão de loja ligado: botões maiores e mais contraste.' : 'Modo chão de loja desligado.', 'info');
  }

  /* ════════════════════════════════════════════════════════════════
     Navegação agrupada + Indicadores + botão Escanear
     ════════════════════════════════════════════════════════════════ */
  function navLabel(txt){ var d = document.createElement('div'); d.className = 'gq51-navlabel'; d.textContent = txt; return d; }
  function setupNav(){
    var nav = $('pwaNav'); if (!nav || nav.__gq51 || !$('navDash')) return; nav.__gq51 = true;
    var before = function(ref, el){ if (ref && ref.parentNode === nav) nav.insertBefore(el, ref); };
    before($('navAudit'), navLabel('Operação'));
    before($('navCfg'), navLabel('Sistema'));
    var ind = document.createElement('button');
    ind.className = 'nav-btn'; ind.id = 'navGQ51Ind'; ind.setAttribute('aria-label', 'Indicadores');
    ind.setAttribute('onclick', "goPage('Indicadores',this)");
    ind.innerHTML = '<svg class="nav-ico" viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg><span class="nl">Indicadores</span>';
    var gestaoRef = $('navAnalise') || $('navGQLAnalise') || $('navCfg');
    before(gestaoRef, navLabel('Gestão'));
    before(gestaoRef, ind);
    var scan = document.createElement('button');
    scan.className = 'nav-btn'; scan.id = 'gq51NavScan'; scan.setAttribute('aria-label', 'Escanear produto');
    scan.innerHTML = '<span class="gq51-scan-circle">' + ico('scan') + '</span><span class="nl">Escanear</span>';
    scan.addEventListener('click', function(e){ e.preventDefault(); openScanner(); });
    var venc = $('navVenc');
    if (venc && venc.nextSibling) nav.insertBefore(scan, venc.nextSibling); else nav.appendChild(scan);
    // Menu lateral ("Mais"): atalho para Indicadores
    var side = $('sideMenu');
    if (side && !$('gq51SideInd')) {
      var first = side.querySelector('[onclick*="goPage(\'Dashboard\'"]');
      if (first) {
        var it = first.cloneNode(true); it.id = 'gq51SideInd';
        it.setAttribute('onclick', "goPage('Indicadores',document.getElementById('navGQ51Ind'));closeSideMenu()");
        it.textContent = '📊 Indicadores, Compras e Pendências';
        first.parentNode.insertBefore(it, first.nextSibling);
      }
    }
  }
  function syncIndVisibility(){
    var ind = $('navGQ51Ind'), ref = $('navGQLAnalise'); if (!ind) return;
    var hidden = !veFinanceiro() || (ref && ref.style.display === 'none');
    var side = $('gq51SideInd'); if (side) side.style.display = hidden ? 'none' : '';
    if (ind.__h !== hidden) { ind.style.display = hidden ? 'none' : ''; ind.__h = hidden; }
  }
  function ensurePage(){
    if ($('pageIndicadores')) return;
    var ms = $('mainScroll'); if (!ms) return;
    var pg = document.createElement('div'); pg.id = 'pageIndicadores'; pg.className = 'page';
    ms.appendChild(pg);
  }

  /* ════════════════════════════════════════════════════════════════
     Fase 1 — Painel de hoje (Dashboard)
     ════════════════════════════════════════════════════════════════ */
  function resumo(){
    var hoje = iso(), mes = mesAtual();
    var venc = getVenc(), vencidos = [], ate3 = [], ate7 = [];
    venc.forEach(function(p){ var d = diasAte(p.validade); if (d == null) return; if (d < 0) vencidos.push(p); else if (d <= 3) ate3.push(p); else if (d <= 7) ate7.push(p); });
    var somar = function(a){ return a.reduce(function(s, p){ return s + itemVal(p).total; }, 0); };
    var rows = perdasRows().filter(function(r){ return r.mes === mes; });
    var perdasMes = rows.reduce(function(s, r){ return s + r.valor; }, 0);
    var fat = load(K.fat, {})[mes]; var fatTotal = fat ? num(fat.total) : 0;
    var c = cfg();
    var acoes = getAcoes().filter(function(a){ return a && a.status !== 'concluida'; });
    var atrasadas = acoes.filter(function(a){ return a.when && a.when < hoje; });
    var temps = getTempLog().filter(function(t){ return t && t.ts && iso(new Date(t.ts)) === hoje; });
    var crit = temps.filter(function(t){ return t.status === 'crit'; });
    var semAcao = crit.filter(function(t){ return !t.acaoCorretiva; });
    var dest = load(K.destinos, []).filter(function(x){ return x && String(x.data).slice(0, 7) === mes; });
    var salvos = dest.reduce(function(s, x){ return s + num(x.recuperado); }, 0);
    return { vencidos: vencidos, ate3: ate3, ate7: ate7, vVal: somar(vencidos), v3Val: somar(ate3), perdasMes: perdasMes, fatTotal: fatTotal,
      indice: fatTotal > 0 ? perdasMes / fatTotal * 100 : null, meta: c.meta, bench: FORMATOS[c.formato], acoes: acoes, atrasadas: atrasadas,
      temps: temps, crit: crit, semAcao: semAcao, salvos: salvos, dest: dest, mes: mes };
  }
  function renderHoje(){
    var pd = $('pageDashboard'); if (!pd) return;
    var sec = $('gq51Hoje');
    if (!sec) { sec = document.createElement('section'); sec.id = 'gq51Hoje'; pd.insertBefore(sec, pd.firstChild); sec.addEventListener('click', onHojeClick); }
    var r = resumo();
    var perdaCls = r.indice == null ? '' : r.indice <= r.meta ? 'ok' : r.indice <= r.bench.v ? 'warn' : 'danger';
    var perdaSub = r.indice == null ? 'Informe o faturamento para ver o % →' : pctFmt(r.indice) + ' do faturamento · meta ' + pctFmt(r.meta);
    var vCls = r.vencidos.length ? 'danger' : r.ate3.length ? 'warn' : 'ok';
    var pCls = r.atrasadas.length ? 'danger' : r.acoes.length ? 'warn' : 'ok';
    var tCls = r.semAcao.length ? 'danger' : r.crit.length ? 'warn' : r.temps.length ? 'ok' : 'warn';
    var u = curUser();
    var saud = (function(){ var h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; })();
    sec.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:10px;flex-wrap:wrap;margin:4px 0 12px">' +
        '<div><div style="font-size:.8rem;color:var(--gq-text-2)">' + esc(saud) + ', ' + esc((u && (u.name || u.username)) || '') + '</div>' +
        '<h2 style="margin:2px 0 0;font-size:1.35rem;font-weight:800;color:var(--gq-text)">Painel de hoje</h2></div>' +
        '<div style="font-size:.78rem;color:var(--gq-text-2)">' + new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) + '</div>' +
      '</div>' +
      '<div class="gq-kpis">' +
        (veFinanceiro()
          ? '<button class="gq-kpi ' + perdaCls + '" data-go="ind:indice"><div class="l">' + ico('money') + 'Perdas do mês</div><div class="v">' + brl(r.perdasMes) + '</div><div class="s">' + perdaSub + '</div></button>'
          : '<button class="gq-kpi" data-go="venc"><div class="l">' + ico('tag') + 'Vencendo em até 7 dias</div><div class="v">' + r.ate7.length + '</div><div class="s">produto(s) para acompanhar</div></button>') +
        '<button class="gq-kpi ' + vCls + '" data-go="venc"><div class="l">' + ico('clock') + 'Vencendo em até 3 dias</div><div class="v">' + brl(r.v3Val) + '</div><div class="s">' + r.ate3.length + ' produto(s)' + (r.vencidos.length ? ' · <b style="color:var(--gq-danger)">' + r.vencidos.length + ' vencido(s)</b>' : '') + '</div></button>' +
        '<button class="gq-kpi ' + pCls + '" data-go="ind:pendencias"><div class="l">' + ico('task') + 'Pendências abertas</div><div class="v">' + r.acoes.length + '</div><div class="s">' + (r.atrasadas.length ? '<b style="color:var(--gq-danger)">' + r.atrasadas.length + ' atrasada(s)</b>' : 'nenhuma atrasada') + '</div></button>' +
        '<button class="gq-kpi ' + tCls + '" data-go="temp"><div class="l">' + ico('temp') + 'Temperatura hoje</div><div class="v">' + r.crit.length + ' fora</div><div class="s">' + (r.temps.length ? r.temps.length + ' leitura(s)' + (r.semAcao.length ? ' · <b style="color:var(--gq-danger)">' + r.semAcao.length + ' sem ação</b>' : '') : 'nenhuma leitura hoje') + '</div></button>' +
      '</div>' +
      (!veFinanceiro() ? '' : '<div class="gq-strip">💚 <span>Este mês as rebaixas, devoluções e doações recuperaram <b>' + brl(r.salvos) + '</b> em ' + r.dest.length + ' destino(s) registrado(s).</span>' +
        '<button class="gq-btn sm" data-go="venc" style="margin-left:auto">Agir agora</button></div>') +
      '<div class="gq-section"><h3>' + ico('check') + 'Minha lista de hoje</h3><p class="gq-sub">Tarefas do dia para a sua função. Marque o que já foi feito.</p>' +
        '<div class="gq-list">' + renderLista(r) + '</div></div>';
  }
  function tarefas(r){
    var t = [], g = isGestao(), nome = userName().toLowerCase();
    if (r.vencidos.length) t.push({ id: 'venc-retirar', cls: 'danger', ic: 'alert', t: 'Retirar ' + r.vencidos.length + ' produto(s) vencido(s) da área de venda', d: brl(r.vVal) + ' em produtos — registre o destino (descarte ou devolução)', go: 'venc', b: 'Tratar' });
    if (r.ate3.length) t.push({ id: 'venc-rebaixar', cls: 'warn', ic: 'tag', t: 'Rebaixar ' + r.ate3.length + ' produto(s) que vencem em até 3 dias', d: brl(r.v3Val) + ' em risco — imprima as etiquetas com o desconto sugerido', go: 'venc', b: 'Rebaixar' });
    if (!r.temps.length) t.push({ id: 'temp-ler', cls: 'warn', ic: 'temp', t: 'Registrar as temperaturas dos equipamentos', d: 'Nenhuma leitura registrada hoje', go: 'temp', b: 'Registrar' });
    r.semAcao.forEach(function(x){ t.push({ id: 'temp-acao-' + x.id, cls: 'danger', ic: 'temp', t: 'Ação corretiva: ' + (x.equip || 'equipamento') + ' a ' + x.val + '°C', d: 'Leitura fora da faixa sem ação registrada', go: 'tempacao:' + x.id, b: 'Registrar ação' }); });
    var hoje = iso();
    var minhas = r.acoes.filter(function(a){ return a.when && a.when <= hoje; });
    if (!g) { var mine = minhas.filter(function(a){ return String(a.who || '').toLowerCase().indexOf(nome) >= 0; }); if (mine.length) minhas = mine; }
    minhas.sort(function(a, b){ return String(a.when).localeCompare(String(b.when)); }).slice(0, 5).forEach(function(a){
      t.push({ id: 'acao-' + a.id, cls: a.when < hoje ? 'danger' : '', ic: 'task', t: 'Pendência: ' + a.what, d: 'Responsável: ' + (a.who || '—') + ' · prazo ' + brDate(a.when) + (a.when < hoje ? ' (atrasada)' : ''), go: 'ind:pendencias', b: 'Abrir' });
    });
    if (g && !(r.fatTotal > 0)) t.push({ id: 'fat-' + r.mes, cls: '', ic: 'money', t: 'Informar o faturamento de ' + mesNome(r.mes), d: 'Necessário para calcular o índice de perdas e comparar com o mercado', go: 'ind:indice', b: 'Informar' });
    if (g && comprasRecorrentes(60).some(function(x){ return x.ocorr >= 2; })) t.push({ id: 'compras-' + iso(), cls: '', ic: 'cart', t: 'Revisar o relatório para Compras', d: 'Há produtos vencendo repetidamente — ajuste os pedidos', go: 'ind:compras', b: 'Ver' });
    return t;
  }
  function renderLista(r){
    var t = tarefas(r);
    var f = load(K.feito, {}); var feitos = f.data === iso() ? (f.ids || {}) : {};
    if (!t.length) return '<div class="gq-empty">✅ Tudo em dia por aqui. Bom trabalho!</div>';
    return t.map(function(x){
      var done = !!feitos[x.id];
      return '<div class="gq-task ' + x.cls + (done ? ' done' : '') + '"><input type="checkbox" data-feito="' + esc(x.id) + '"' + (done ? ' checked' : '') + ' aria-label="Marcar como feito">' +
        '<div class="ic">' + ico(x.ic) + '</div><div class="tx"><div class="t">' + esc(x.t) + '</div><div class="d">' + esc(x.d) + '</div></div>' +
        '<button class="gq-btn sm" data-go="' + esc(x.go) + '">' + esc(x.b) + '</button></div>';
    }).join('');
  }
  function onHojeClick(e){
    var cb = e.target.closest('[data-feito]');
    if (cb) {
      var f = load(K.feito, {}); if (f.data !== iso()) f = { data: iso(), ids: {} };
      f.ids[cb.getAttribute('data-feito')] = cb.checked; save(K.feito, f);
      cb.closest('.gq-task').classList.toggle('done', cb.checked); return;
    }
    var b = e.target.closest('[data-go]'); if (b) navTo(b.getAttribute('data-go'));
  }
  function navTo(g){
    if (!g) return;
    if (g === 'venc') { go('Vencidos'); setTimeout(function(){ var p = $('gq51Agir'); if (p) p.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 350); }
    else if (g === 'temp') go('Temperatura');
    else if (g.indexOf('tempacao:') === 0) { var id = g.slice(9); var reg = getTempLog().find(function(x){ return x.id === id; }); if (reg) abrirAcaoTemp(reg); }
    else if (g.indexOf('ind:') === 0) { ind.tab = g.slice(4); go('Indicadores'); setTimeout(renderInd, 60); }
  }

  /* ════════════════════════════════════════════════════════════════
     Fase 1 — Vencidos: agir antes de vencer (rebaixa e destino)
     ════════════════════════════════════════════════════════════════ */
  function renderAgir(){
    var pg = $('pageVencidos'); if (!pg) return;
    var box = $('gq51Agir');
    if (!box) {
      box = document.createElement('section'); box.id = 'gq51Agir'; box.className = 'gq-section';
      var ref = $('perdasSummary') || $('vencStats');
      if (ref && ref.parentNode) ref.parentNode.insertBefore(box, ref); else pg.appendChild(box);
      box.addEventListener('click', onAgirClick);
    }
    var lista = getVenc().map(function(p){ return { p: p, d: diasAte(p.validade) }; })
      .filter(function(x){ return x.d != null && x.d <= 7; })
      .sort(function(a, b){ return a.d - b.d; });
    var total = lista.reduce(function(s, x){ return s + itemVal(x.p).total; }, 0);
    var head = '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">' +
      '<div><h3>' + ico('tag') + 'Agir antes de vencer</h3><p class="gq-sub">Produtos que vencem em até 7 dias, com desconto sugerido. Registre o destino de cada um para medir quanto foi recuperado.</p></div>' +
      '<button class="gq-btn pri" data-a="scan">' + ico('scan') + 'Ler código GS1</button></div>';
    if (!lista.length) { box.innerHTML = head + '<div class="gq-empty">Nenhum produto vence nos próximos 7 dias. 👍</div>'; return; }
    var rows = lista.slice(0, 40).map(function(x){
      var p = x.p, v = itemVal(p), s = sugestao(x.d), id = esc(p.id);
      var reb = p.gq51Rebaixa ? ' <span class="gq-badge gq-b-ok">rebaixado ' + Math.round(num(p.gq51Rebaixa.pct)) + '%</span>' : '';
      var sug = s.vencido ? '<b style="color:var(--gq-danger)">Retirar da venda</b>' :
        '<b>' + s.pct + '% off</b><div style="font-size:.74rem;color:var(--gq-text-2)">' + brl(v.u) + ' → <b style="color:var(--gq-ok)">' + brl(v.u * (1 - s.pct / 100)) + '</b></div>';
      var acts = (s.vencido ? '' : '<button class="gq-btn sm" data-a="etiqueta" data-id="' + id + '">🏷️ Etiqueta</button><button class="gq-btn sm ok" data-a="vendido" data-id="' + id + '">Vendido</button><button class="gq-btn sm" data-a="doado" data-id="' + id + '">Doado</button>') +
        '<button class="gq-btn sm" data-a="devolvido" data-id="' + id + '">Devolvido</button><button class="gq-btn sm danger" data-a="descartado" data-id="' + id + '">Descartado</button>';
      return '<tr><td><b>' + esc(p.nome || p.produto || '—') + '</b>' + reb + '<div style="font-size:.74rem;color:var(--gq-text-2)">' + esc(p.setor || '—') + (p.codigo && p.codigo !== '—' ? ' · ' + esc(p.codigo) : '') + (p.lote ? ' · lote ' + esc(p.lote) : '') + '</div></td>' +
        '<td>' + badgeDias(x.d) + '<div style="font-size:.72rem;color:var(--gq-text-2);margin-top:3px">' + brDate(p.validade) + '</div></td>' +
        '<td class="n">' + v.q + ' × ' + brl(v.u) + '<div><b>' + brl(v.total) + '</b></div></td><td>' + sug + '</td>' +
        '<td><div style="display:flex;gap:6px;flex-wrap:wrap">' + acts + '</div></td></tr>';
    }).join('');
    box.innerHTML = head +
      '<div class="gq-legend" style="margin-bottom:8px"><span><b>' + lista.length + '</b> produto(s)</span><span>Valor em risco: <b>' + brl(total) + '</b></span><span>Descontos: ' + (function(f){ return '≤1d ' + f[0] + '% · ≤3d ' + f[1] + '% · ≤5d ' + f[2] + '% · ≤7d ' + f[3] + '%'; })(cfg().faixas) + ' (ajuste em Indicadores → Integrações)</span></div>' +
      '<div class="gq-tbl-wrap"><table class="gq-tbl"><thead><tr><th>Produto</th><th>Validade</th><th class="n">Qtd × valor</th><th>Sugestão</th><th>Destino</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      (lista.length > 40 ? '<p class="gq-sub" style="margin-top:8px">… e mais ' + (lista.length - 40) + ' produto(s). Trate os primeiros da lista.</p>' : '');
  }
  function acharItem(id){ var arr = getVenc(); for (var i = 0; i < arr.length; i++) if (String(arr[i].id) === String(id)) return arr[i]; return null; }
  function onAgirClick(e){
    var b = e.target.closest('[data-a]'); if (!b) return;
    var a = b.getAttribute('data-a');
    if (a === 'scan') return openScanner();
    var p = acharItem(b.getAttribute('data-id')); if (!p) return notify('Produto não encontrado (a lista pode ter sido atualizada).', 'warning');
    if (a === 'etiqueta') return imprimirEtiqueta(p);
    abrirDestino(p, a);
  }
  var DEST_TXT = { vendido: 'Vendido com rebaixa', doado: 'Doado', devolvido: 'Devolvido / trocado com o fornecedor', descartado: 'Descartado' };
  function abrirDestino(p, destino){
    var d = diasAte(p.validade), v = itemVal(p), s = sugestao(d) || { pct: 0 };
    var pctIni = Math.max(0, Math.min(90, Math.round(num(p.gq51Rebaixa ? p.gq51Rebaixa.pct : s.pct))));
    var ov = modal('<h3>' + esc(DEST_TXT[destino]) + '</h3><p><b>' + esc(p.nome || p.produto) + '</b> · ' + v.q + ' un. · ' + brl(v.total) + '</p>' +
      '<div class="gq-form"><label>Quantidade<input id="gq51DQ" type="number" min="1" max="' + v.q + '" value="' + v.q + '"></label>' +
      (destino === 'vendido' ? '<label>Desconto aplicado (%)<input id="gq51DP" type="number" min="0" max="90" value="' + pctIni + '"></label>' : '') + '</div>' +
      '<p style="margin-top:10px">' + (destino === 'descartado' ? 'Será lançado como perda (motivo "Vencido") no painel de Perdas.' : destino === 'doado' ? 'Será lançado como perda (motivo "Doação") — conta como destino social, não como desperdício.' : destino === 'devolvido' ? 'O valor volta como crédito do fornecedor e conta como recuperado.' : 'O valor vendido conta como recuperado.') + '</p>' +
      '<div class="gq-err" id="gq51DErr"></div><div class="row"><button class="gq-btn" data-x="c">Cancelar</button><button class="gq-btn pri" data-x="ok">Confirmar</button></div>');
    ov.addEventListener('click', function(e){
      var x = e.target.getAttribute && e.target.getAttribute('data-x'); if (!x) return;
      if (x === 'c') return ov.close();
      var q = Math.floor(num($('gq51DQ').value)); var pc = destino === 'vendido' ? num($('gq51DP').value) : 0;
      if (!(q >= 1 && q <= v.q)) { $('gq51DErr').textContent = 'Quantidade entre 1 e ' + v.q + '.'; return; }
      if (pc < 0 || pc > 90) { $('gq51DErr').textContent = 'Desconto entre 0 e 90%.'; return; }
      registrarDestino(p, destino, q, pc); ov.close();
    });
  }
  function registrarDestino(p, destino, q, pc){
    var v = itemVal(p), bruto = q * v.u;
    var recuperado = destino === 'vendido' ? bruto * (1 - pc / 100) : destino === 'devolvido' ? bruto : 0;
    var reg = { id: uid('dst'), ts: new Date().toISOString(), data: iso(), produto: p.nome || p.produto || '—', codigo: p.codigo || '', setor: p.setor || '',
      validade: p.validade || '', qtd: q, valorUnit: v.u, total: bruto, destino: destino, pct: pc, recuperado: recuperado,
      desconto: destino === 'vendido' ? bruto - recuperado : 0, por: userName() };
    var arr = load(K.destinos, []); arr.push(reg); save(K.destinos, arr);
    if (destino === 'descartado' || destino === 'doado') addPerda({ data: iso(), codigo: p.codigo, produto: reg.produto, setor: reg.setor, quantidade: q, valor: bruto, motivo: destino === 'doado' ? 'Doação' : 'Vencido' });
    var lista = getVenc(), i = lista.indexOf(p);
    if (i >= 0) {
      if (q >= v.q) lista.splice(i, 1);
      else if (p.qtd != null) p.qtd = v.q - q; else p.quantidade = v.q - q;
      persistVenc();
    }
    logAct('Destino de produto', reg.produto + ': ' + DEST_TXT[destino] + ' (' + q + ' un.)');
    notify('✅ ' + DEST_TXT[destino] + ' registrado' + (recuperado ? ' — ' + brl(recuperado) + ' recuperado' : '') + '.', 'success');
    dirty = true; renderAgir();
  }
  function imprimirEtiqueta(p){
    var d = diasAte(p.validade), s = sugestao(d) || { pct: 15 }, v = itemVal(p);
    var pct = Math.max(0, Math.min(90, Math.round(num(p.gq51Rebaixa ? p.gq51Rebaixa.pct : s.pct)))), novo = v.u * (1 - pct / 100);
    p.gq51Rebaixa = { pct: pct, em: new Date().toISOString() }; persistVenc();
    var w = window.open('', '_blank', 'width=420,height=360');
    if (!w) return notify('Permita pop-ups para imprimir a etiqueta.', 'warning');
    w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Etiqueta de rebaixa</title><style>' +
      'body{font-family:Arial,sans-serif;margin:0;padding:14px}.e{border:3px solid #111;border-radius:10px;padding:12px;width:300px}' +
      '.t{font-size:13px;font-weight:700;text-transform:uppercase}.o{font-size:14px;text-decoration:line-through;color:#555;margin-top:6px}' +
      '.n{font-size:40px;font-weight:900;line-height:1}.p{display:inline-block;background:#e31e24;color:#fff;font-weight:900;padding:4px 10px;border-radius:6px;font-size:18px;margin:6px 0}' +
      '.v{font-size:12px;margin-top:6px}@media print{button{display:none}}</style></head><body><div class="e">' +
      '<div class="t">' + esc(p.nome || p.produto) + '</div><div class="p">-' + esc(pct) + '% OFF</div>' +
      '<div class="o">De ' + esc(brl(v.u)) + '</div><div class="n">' + esc(brl(novo)) + '</div>' +
      '<div class="v">Consumir até ' + esc(brDate(p.validade)) + (p.codigo && p.codigo !== '—' ? ' · Cód. ' + esc(p.codigo) : '') + '</div></div>' +
      '<button onclick="print()" style="margin-top:12px;padding:8px 14px">Imprimir</button></body></html>');
    w.document.close();
    setTimeout(function(){ try { w.print(); } catch(e){} }, 400);
    renderAgir();
  }
  function setupVencEmpty(){
    var e = $('vencEmpty'); if (!e || e.__gq51) return; e.__gq51 = true;
    var b = document.createElement('button'); b.className = 'gq-btn pri'; b.style.marginTop = '12px';
    b.innerHTML = ico('scan') + 'Escanear o primeiro produto';
    b.addEventListener('click', openScanner); e.appendChild(b);
  }

  /* ════════════════════════════════════════════════════════════════
     Fase 3 — Leitura de código GS1 (DataMatrix / GS1-128 / EAN)
     ════════════════════════════════════════════════════════════════ */
  var GS1_FIXO = { '00': 18, '01': 14, '02': 14, '11': 6, '12': 6, '13': 6, '15': 6, '16': 6, '17': 6, '20': 2 };
  var GS1_VAR = { '10': 1, '21': 1, '22': 1, '30': 1, '37': 1, '240': 1, '241': 1 };
  function parseGS1(raw){
    var s = String(raw || '').trim(); if (!s) return null;
    var GS = String.fromCharCode(29);
    s = s.replace(/^\][A-Za-z][0-9]/, '').replace(/<GS>|\{GS\}|\\x1d/gi, GS);
    var o = {};
    if (/^\(\d{2,4}\)/.test(s)) {
      var re = /\((\d{2,4})\)([^(]*)/g, m;
      while ((m = re.exec(s))) o[m[1]] = m[2].split(GS).join('').trim();
    } else if (/^\d{8,14}$/.test(s)) {
      o['01'] = s;
    } else {
      var i = 0, guard = 0;
      while (i < s.length && guard++ < 30) {
        if (s[i] === GS) { i++; continue; }
        var a2 = s.substr(i, 2), a3 = s.substr(i, 3);
        if (GS1_FIXO[a2] != null) { o[a2] = s.substr(i + 2, GS1_FIXO[a2]); i += 2 + GS1_FIXO[a2]; continue; }
        if (/^3[1-6]/.test(a2)) { o[s.substr(i, 4)] = s.substr(i + 4, 6); i += 10; continue; }
        var ai = GS1_VAR[a3] ? a3 : GS1_VAR[a2] ? a2 : null;
        if (ai) { var j = s.indexOf(GS, i + ai.length); if (j < 0) j = s.length; o[ai] = s.substring(i + ai.length, j); i = j; continue; }
        break;
      }
    }
    var r = { raw: raw };
    var g = o['01'] || o['02'];
    if (g) { g = g.replace(/\D/g, ''); r.codigo = (g.length === 14 && g[0] === '0') ? g.slice(1) : g; }
    var d = o['17'] || o['15'] || o['16'] || o['12'];
    if (d && /^\d{6}$/.test(d)) {
      var yr = 2000 + +d.slice(0, 2), mm = +d.slice(2, 4), dd = +d.slice(4, 6);
      if (mm >= 1 && mm <= 12) { if (dd === 0) dd = new Date(yr, mm, 0).getDate(); r.validade = yr + '-' + pad(mm) + '-' + pad(dd); }
    }
    if (o['10']) r.lote = o['10'];
    if (o['3103']) r.pesoKg = +o['3103'] / 1000;
    r.ok = !!(r.codigo || r.validade);
    return r;
  }
  window.gq51ParseGS1 = parseGS1;

  var reader = null;
  function stopCam(){ try { if (reader) reader.reset(); } catch(e){} reader = null; }
  function openScanner(){
    var setores = ''; var sel = $('vencSetor');
    if (sel) setores = Array.prototype.map.call(sel.options, function(o){ return '<option value="' + esc(o.value) + '">' + esc(o.textContent) + '</option>'; }).join('');
    var ov = modal('<h3>' + ico('scan') + ' Ler código do produto</h3>' +
      '<p>Aponte a câmera para o código 2D (DataMatrix GS1) ou de barras. Com leitor USB/Bluetooth, clique no campo abaixo e faça a leitura.</p>' +
      '<video id="gq51Video" playsinline muted></video><div class="gq-err" id="gq51CamMsg"></div>' +
      '<div class="gq-form" style="margin-top:8px"><label style="grid-column:1/-1">Código lido ou digitado<input id="gq51Raw" autocomplete="off" placeholder="(01)07891234567895(17)261231(10)L123"></label></div>' +
      '<div id="gq51Parsed" class="gq-sub" style="margin-top:8px"></div>' +
      '<div class="gq-form" style="margin-top:6px">' +
        '<label style="grid-column:1/-1">Produto *<input id="gq51PNome" placeholder="Nome do produto"></label>' +
        '<label>Código<input id="gq51PCod"></label><label>Lote<input id="gq51PLote"></label>' +
        '<label>Validade *<input id="gq51PVal" type="date"></label><label>Quantidade *<input id="gq51PQtd" type="number" min="1" value="1"></label>' +
        '<label>Valor unit. (R$)<input id="gq51PVu" type="number" min="0" step="0.01"></label>' +
        (setores ? '<label>Setor<select id="gq51PSet">' + setores + '</select></label>' : '<label>Setor<input id="gq51PSet"></label>') +
      '</div><div class="gq-err" id="gq51PErr"></div>' +
      '<div class="row"><button class="gq-btn" data-x="c">Fechar</button><button class="gq-btn pri" data-x="ok">Cadastrar em Vencidos</button></div>', { onClose: stopCam });
    var raw = $('gq51Raw');
    raw.addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); aplicarCodigo(raw.value); } });
    raw.addEventListener('change', function(){ aplicarCodigo(raw.value); });
    ov.addEventListener('click', function(e){
      var x = e.target.getAttribute && e.target.getAttribute('data-x'); if (!x) return;
      if (x === 'c') return ov.close();
      if (salvarDoScanner()) ov.close();
    });
    iniciarCamera();
  }
  function iniciarCamera(){
    var msg = $('gq51CamMsg'), video = $('gq51Video');
    if (!window.ZXing || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { if (video) video.style.display = 'none'; if (msg) msg.textContent = 'Câmera indisponível neste navegador — digite o código ou use um leitor.'; return; }
    try {
      var Z = window.ZXing, hints = new Map(), F = Z.BarcodeFormat;
      hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [F.DATA_MATRIX, F.QR_CODE, F.CODE_128, F.EAN_13, F.EAN_8]);
      reader = new Z.BrowserMultiFormatReader(hints);
      var cb = function(res){ if (res) { var t = res.getText(); $('gq51Raw').value = t; aplicarCodigo(t); stopCam(); if (video) video.style.display = 'none'; } };
      var p = typeof reader.decodeFromConstraints === 'function'
        ? reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, 'gq51Video', cb)
        : reader.decodeFromVideoDevice(undefined, 'gq51Video', cb);
      if (p && p.catch) p.catch(function(){ if (video) video.style.display = 'none'; if (msg) msg.textContent = 'Não foi possível abrir a câmera (permissão negada?). Digite o código ou use um leitor.'; });
    } catch(e){ if (video) video.style.display = 'none'; if (msg) msg.textContent = 'Câmera indisponível — digite o código.'; }
  }
  function aplicarCodigo(txt){
    var r = parseGS1(txt), out = $('gq51Parsed'); if (!out) return;
    if (!r || !r.ok) { out.innerHTML = '<span style="color:var(--gq-warn)">Código não reconhecido. Preencha os campos manualmente.</span>'; return; }
    if (r.codigo) $('gq51PCod').value = r.codigo;
    if (r.validade) $('gq51PVal').value = r.validade;
    if (r.lote) $('gq51PLote').value = r.lote;
    var conhecido = null;
    if (r.codigo) {
      getVenc().concat(load(K.destinos, [])).some(function(p){ if (String(p.codigo) === r.codigo && (p.nome || p.produto)) { conhecido = p; return true; } return false; });
    }
    if (conhecido) {
      if (!$('gq51PNome').value) $('gq51PNome').value = conhecido.nome || conhecido.produto;
      var vu = conhecido.valorUnit != null ? conhecido.valorUnit : null; if (vu != null && !$('gq51PVu').value) $('gq51PVu').value = vu;
      if (conhecido.setor && $('gq51PSet')) $('gq51PSet').value = conhecido.setor;
    }
    out.innerHTML = '✅ Lido: ' + (r.codigo ? 'código <b>' + esc(r.codigo) + '</b>' : '') + (r.validade ? ' · validade <b>' + brDate(r.validade) + '</b>' : '') + (r.lote ? ' · lote <b>' + esc(r.lote) + '</b>' : '') + (conhecido ? ' · produto já conhecido' : '');
    var n = $('gq51PNome'); if (n && !n.value) n.focus(); else { var q = $('gq51PQtd'); if (q) q.focus(); }
  }
  function salvarDoScanner(){
    var nome = $('gq51PNome').value.trim(), val = $('gq51PVal').value, qtd = Math.floor(num($('gq51PQtd').value)), err = $('gq51PErr');
    if (!nome) { err.textContent = 'Informe o nome do produto.'; return false; }
    if (!val) { err.textContent = 'Informe a validade.'; return false; }
    if (!(qtd >= 1)) { err.textContent = 'Informe a quantidade.'; return false; }
    var item = { id: Date.now(), codigo: $('gq51PCod').value.trim() || '—', nome: nome, qtd: qtd, validade: val,
      valorUnit: num($('gq51PVu').value), setor: ($('gq51PSet') && $('gq51PSet').value) || '', lote: $('gq51PLote').value.trim(),
      cadastradoEm: new Date().toLocaleString('pt-BR'), historico: [], origem: 'scanner' };
    getVenc().push(item);
    if (!Array.isArray(window.vencidosData)) { try { localStorage.setItem('vencidosData', JSON.stringify(getVenc())); } catch(e){} }
    persistVenc();
    try { if (typeof window.calcularPerdas === 'function') window.calcularPerdas(); } catch(e){}
    logAct('Produto cadastrado por leitura', nome + ' — validade ' + brDate(val));
    notify('✅ ' + nome + ' cadastrado em Vencidos.', 'success');
    dirty = true;
    return true;
  }
  window.gq51AbrirScanner = openScanner;

  /* ════════════════════════════════════════════════════════════════
     Fase 3 — Temperatura fora da faixa exige ação corretiva
     ════════════════════════════════════════════════════════════════ */
  function wrapTemperatura(){
    var orig = window.registrarTemperatura;
    if (typeof orig !== 'function' || orig.__gq51) return;
    var w = function(){
      var acao = (($('qxtAcaoCorr') || {}).value || '').trim();
      var antes = (getTempLog()[0] || {}).id;
      var r = orig.apply(this, arguments);
      setTimeout(function(){
        var reg = getTempLog()[0];
        if (!reg || reg.id === antes || reg.status !== 'crit' || reg.acaoCorretiva) return;
        if (acao.length >= 3) salvarAcaoTemp(reg, acao); else abrirAcaoTemp(reg);
      }, 60);
      return r;
    };
    w.__gq51 = true;
    window.registrarTemperatura = w;
  }
  function abrirAcaoTemp(reg){
    var faixa = (reg.min != null && reg.max != null) ? reg.min + '°C a ' + reg.max + '°C' : 'faixa definida';
    var ov = modal('<h3>🌡️ Ação corretiva obrigatória</h3><p><b>' + esc(reg.equip) + '</b> registrou <b style="color:var(--gq-danger)">' + esc(reg.val) + '°C</b> (permitido: ' + esc(faixa) + '). Informe o que foi feito — exigência das boas práticas (registro de não conformidade).</p>' +
      '<div class="gq-chips">' + ['Termostato ajustado', 'Produtos transferidos para outro equipamento', 'Porta estava aberta — fechada', 'Manutenção acionada', 'Produtos avaliados e descartados'].map(function(c){ return '<button data-chip="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>' +
      '<div class="gq-form"><label style="grid-column:1/-1">Ação tomada *<textarea id="gq51TAcao" rows="3" placeholder="Descreva a ação corretiva"></textarea></label></div>' +
      '<div class="gq-err" id="gq51TErr"></div><div class="row"><button class="gq-btn pri" data-x="ok">Salvar ação corretiva</button></div>', { locked: true });
    ov.addEventListener('click', function(e){
      var c = e.target.getAttribute && e.target.getAttribute('data-chip');
      if (c) { var t = $('gq51TAcao'); t.value = t.value ? t.value + '; ' + c : c; return; }
      if (e.target.getAttribute && e.target.getAttribute('data-x') === 'ok') {
        var txt = $('gq51TAcao').value.trim();
        if (txt.length < 5) { $('gq51TErr').textContent = 'Descreva a ação (mínimo 5 caracteres).'; return; }
        salvarAcaoTemp(reg, txt); ov.close();
      }
    });
  }
  function salvarAcaoTemp(reg, txt){
    var log = getTempLog(), agora = new Date().toISOString();
    log.forEach(function(r){ if (r.id === reg.id) { r.acaoCorretiva = txt; r.acaoPor = userName(); r.acaoEm = agora; } });
    try { localStorage.setItem('tempLog', JSON.stringify(log)); } catch(e){}
    if (Array.isArray(window.tempLog)) window.tempLog.forEach(function(r){ if (r.id === reg.id) { r.acaoCorretiva = txt; r.acaoPor = userName(); r.acaoEm = agora; } });
    novaAcao({ what: 'Verificar ' + reg.equip + ' — temperatura ' + reg.val + '°C fora da faixa', why: 'Ação imediata registrada: ' + txt,
      where: reg.equip, who: userName(), when: addDias(1), prioridade: 'alta', origem: 'temperatura' });
    logAct('Ação corretiva de temperatura', reg.equip + ': ' + txt);
    notify('✅ Ação corretiva salva e pendência de verificação criada.', 'success');
    try { if (typeof window.renderTempLog === 'function') window.renderTempLog(); } catch(e){}
    dirty = true;
  }

  /* ════════════════════════════════════════════════════════════════
     Fase 2 — Página Indicadores
     ════════════════════════════════════════════════════════════════ */
  var ind = { tab: 'indice', mes: null, compDias: 60, pendFiltro: 'abertas', chart: null };
  var TABS = [['indice', 'Perda x faturamento'], ['motivos', 'Motivos (Pareto)'], ['compras', 'Relatório para Compras'], ['pendencias', 'Pendências'], ['destinos', 'Destinos'], ['integracoes', 'Integrações e ajustes']];
  function renderInd(){
    var pg = $('pageIndicadores'); if (!pg) return;
    if (!pg.__gq51) { pg.__gq51 = true; pg.addEventListener('click', onIndClick); pg.addEventListener('change', onIndChange); }
    if (!ind.mes) ind.mes = mesAtual();
    if (!veFinanceiro()) ind.tab = 'pendencias'; // demais funções: só as pendências
    if (ind.chart) { try { ind.chart.destroy(); } catch(e){} ind.chart = null; }
    var body = '';
    try {
      body = ind.tab === 'motivos' ? tabMotivos() : ind.tab === 'compras' ? tabCompras() : ind.tab === 'pendencias' ? tabPendencias() :
        ind.tab === 'destinos' ? tabDestinos() : ind.tab === 'integracoes' ? tabIntegracoes() : tabIndice();
    } catch(e){ console.error('[v51 indicadores]', e); body = '<div class="gq-empty">Não foi possível montar esta aba.</div>'; }
    pg.innerHTML = '<div style="margin:4px 0 12px"><h2 style="margin:0;font-size:1.35rem;font-weight:800;color:var(--gq-text)">Indicadores</h2>' +
      '<p class="gq-sub" style="margin:2px 0 0;color:var(--gq-text-2);font-size:.82rem">Índice de perdas, motivos, compras, pendências e destinos dos produtos.</p></div>' +
      '<div class="gq-tabs">' + TABS.filter(function(t){ return veFinanceiro() || t[0] === 'pendencias'; }).map(function(t){ return '<button data-tab="' + t[0] + '" class="' + (ind.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('') + '</div>' + body;
    if (ind.tab === 'motivos') desenharPareto();
  }

  /* ── Perda x faturamento ───────────────────────────────────────── */
  function tabIndice(){
    var c = cfg(), fatAll = load(K.fat, {}), f = fatAll[ind.mes] || { total: 0, setores: {} };
    var rows = perdasRows().filter(function(r){ return r.mes === ind.mes; });
    var perdas = rows.reduce(function(s, r){ return s + r.valor; }, 0);
    var idx = num(f.total) > 0 ? perdas / num(f.total) * 100 : null, b = FORMATOS[c.formato];
    var escala = Math.max(idx || 0, b.v, c.meta) * 1.3 || 5;
    var cor = idx == null ? 'var(--gq-text-2)' : idx <= c.meta ? 'var(--gq-ok)' : idx <= b.v ? 'var(--gq-warn)' : 'var(--gq-danger)';
    var porSetor = {}; rows.forEach(function(r){ porSetor[r.departamento] = (porSetor[r.departamento] || 0) + r.valor; });
    Object.keys(f.setores || {}).forEach(function(s){ if (!(s in porSetor)) porSetor[s] = 0; });
    var setores = Object.keys(porSetor).sort(function(a, b2){ return porSetor[b2] - porSetor[a]; });
    var hist = Object.keys(fatAll).sort().slice(-6).map(function(m){
      var pm = perdasRows().filter(function(r){ return r.mes === m; }).reduce(function(s, r){ return s + r.valor; }, 0), ft = num(fatAll[m].total);
      return '<tr><td>' + esc(mesNome(m)) + '</td><td class="n">' + brl(pm) + '</td><td class="n">' + brl(ft) + '</td><td class="n">' + (ft > 0 ? pctFmt(pm / ft * 100) : '—') + '</td></tr>';
    }).join('');
    return '<div class="gq-section"><h3>' + ico('chart') + 'Índice de perdas do mês</h3><p class="gq-sub">Perdas ÷ faturamento. Compare com a sua meta e com a média do mercado (9ª Pesquisa Abrappe de Perdas no Varejo, 2025).</p>' +
      '<div class="gq-form"><label>Mês<input type="month" data-ind="mes" value="' + esc(ind.mes) + '"></label>' +
      '<label>Formato da loja<select data-ind="formato">' + Object.keys(FORMATOS).map(function(k){ return '<option value="' + k + '"' + (k === c.formato ? ' selected' : '') + '>' + FORMATOS[k].n + ' (' + pctFmt(FORMATOS[k].v) + ')</option>'; }).join('') + '</select></label>' +
      '<label>Meta (%)<input type="number" step="0.01" min="0" data-ind="meta" value="' + c.meta + '"></label>' +
      '<label>Faturamento do mês (R$)<input type="number" step="0.01" min="0" id="gq51FatTotal" value="' + (num(f.total) || '') + '" placeholder="ex.: 850000"></label>' +
      '<label>&nbsp;<button class="gq-btn pri" data-a="salvarFat">Salvar</button></label></div>' +
      (!(num(f.total) > 0) && Object.keys(f.setores || {}).length ? '<p class="gq-sub" style="margin-top:12px">ℹ️ Há faturamento só por setor (soma ' + brl(Object.keys(f.setores).reduce(function(t, k){ return t + num(f.setores[k]); }, 0)) + '). Informe o total da loja para o índice geral; o índice por setor está logo abaixo.</p>' : '') +
      '<p class="gq-sub" style="margin-top:8px">Aqui o índice é perda ÷ faturamento (padrão Abrappe). Na página Perda x Venda, a quebra por produto é perda ÷ (venda + perda), por isso os números diferem um pouco.</p>' +
      '<div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-top:16px"><div style="font-size:2.2rem;font-weight:900;color:' + cor + '" class="gq-num">' + (idx == null ? '—' : pctFmt(idx)) + '</div>' +
      '<div style="color:var(--gq-text-2);font-size:.86rem">' + brl(perdas) + ' em perdas' + (num(f.total) > 0 ? ' sobre ' + brl(f.total) + ' de faturamento' : ' · informe o faturamento para calcular') + '</div></div>' +
      '<div class="gq-bar"><i style="width:' + Math.min(100, (idx || 0) / escala * 100) + '%;background:' + cor + '"></i>' +
      '<em style="left:' + (c.meta / escala * 100) + '%" title="Meta"></em><em style="left:' + (b.v / escala * 100) + '%;background:var(--gq-danger)" title="Mercado"></em></div>' +
      '<div class="gq-legend"><span>▮ Sua loja</span><span>│ Meta ' + pctFmt(c.meta) + '</span><span style="color:var(--gq-danger)">│ Média ' + esc(b.n.toLowerCase()) + ' ' + pctFmt(b.v) + '</span></div>' +
      (idx != null ? '<p class="gq-sub" style="margin-top:10px">' + (idx <= c.meta ? '✅ Dentro da meta.' : idx <= b.v ? '⚠️ Acima da meta, mas abaixo da média do mercado.' : '🚨 Acima da média do mercado para o seu formato — priorize os motivos e setores com maior valor.') + '</p>' : '') + '</div>' +
      '<div class="gq-section"><h3>Por setor</h3><p class="gq-sub">Informe o faturamento de cada setor (opcional) para ver o índice por setor.</p>' +
      (setores.length ? '<div class="gq-tbl-wrap"><table class="gq-tbl"><thead><tr><th>Setor</th><th class="n">Perdas</th><th class="n">Faturamento do setor</th><th class="n">Índice</th></tr></thead><tbody>' +
        setores.map(function(s){ var fs = num((f.setores || {})[s]); return '<tr><td>' + esc(s) + '</td><td class="n">' + brl(porSetor[s]) + '</td><td class="n"><input class="gq-in" style="max-width:150px;text-align:right" type="number" step="0.01" min="0" data-fatsetor="' + esc(s) + '" value="' + (fs || '') + '"></td><td class="n">' + (fs > 0 ? pctFmt(porSetor[s] / fs * 100) : '—') + '</td></tr>'; }).join('') +
        '</tbody></table></div><div style="margin-top:10px"><button class="gq-btn pri" data-a="salvarFatSetor">Salvar faturamento por setor</button></div>'
        : '<div class="gq-empty">Sem perdas lançadas em ' + esc(mesNome(ind.mes)) + '. Importe a planilha em Perdas ou registre na aba Motivos.</div>') + '</div>' +
      (hist ? '<div class="gq-section"><h3>Últimos meses</h3><div class="gq-tbl-wrap"><table class="gq-tbl"><thead><tr><th>Mês</th><th class="n">Perdas</th><th class="n">Faturamento</th><th class="n">Índice</th></tr></thead><tbody>' + hist + '</tbody></table></div></div>' : '');
  }

  /* ── Motivos (Pareto) ──────────────────────────────────────────── */
  function rowsPeriodo(){ var r = perdasRows(); return ind.mes === 'todos' ? r : r.filter(function(x){ return x.mes === ind.mes; }); }
  function paretoData(){
    var g = {}; rowsPeriodo().forEach(function(r){ g[r.motivo] = (g[r.motivo] || 0) + r.valor; });
    var tot = 0, arr = Object.keys(g).map(function(k){ tot += g[k]; return { k: k, v: g[k] }; }).sort(function(a, b){ return b.v - a.v; });
    var ac = 0; arr.forEach(function(x){ ac += x.v; x.pct = tot ? x.v / tot * 100 : 0; x.acum = tot ? ac / tot * 100 : 0; });
    return { arr: arr, tot: tot };
  }
  function tabMotivos(){
    var meses = {}; perdasRows().forEach(function(r){ meses[r.mes] = 1; }); meses[mesAtual()] = 1;
    var opts = '<option value="todos"' + (ind.mes === 'todos' ? ' selected' : '') + '>Todo o período</option>' + Object.keys(meses).sort().reverse().map(function(m){ return '<option value="' + esc(m) + '"' + (m === ind.mes ? ' selected' : '') + '>' + esc(mesNome(m)) + '</option>'; }).join('');
    var pd = paretoData();
    var semMotivo = rowsPeriodo().filter(function(r){ return r.motivo === 'Não informado'; });
    var setores = {}; semMotivo.forEach(function(r){ setores[r.departamento] = 1; });
    var motOpts = function(sel){ return MOTIVOS.map(function(m){ return '<option' + (m === sel ? ' selected' : '') + '>' + m + '</option>'; }).join(''); };
    var setorOpts = ''; var vs = $('vencSetor'); if (vs) setorOpts = Array.prototype.map.call(vs.options, function(o){ return o.value ? '<option>' + esc(o.value) + '</option>' : ''; }).join('');
    return '<div class="gq-section"><h3>' + ico('chart') + 'Perdas por motivo</h3><p class="gq-sub">Os motivos que somam 80% do valor são as prioridades (princípio de Pareto).</p>' +
      '<div class="gq-form" style="max-width:320px"><label>Período<select data-ind="mesMot">' + opts + '</select></label></div>' +
      (pd.arr.length ? '<div class="gq-grid2" style="margin-top:12px"><div class="gq-chart"><canvas id="gq51Pareto"></canvas></div>' +
        '<div class="gq-tbl-wrap"><table class="gq-tbl"><thead><tr><th>Motivo</th><th class="n">Valor</th><th class="n">%</th><th class="n">Acumulado</th></tr></thead><tbody>' +
        pd.arr.map(function(x){ return '<tr><td>' + (x.acum - x.pct < 80 ? '🎯 ' : '') + esc(x.k) + '</td><td class="n">' + brl(x.v) + '</td><td class="n">' + pctFmt(x.pct) + '</td><td class="n">' + pctFmt(x.acum) + '</td></tr>'; }).join('') +
        '<tr><td><b>Total</b></td><td class="n"><b>' + brl(pd.tot) + '</b></td><td></td><td></td></tr></tbody></table></div></div>'
        : '<div class="gq-empty" style="margin-top:10px">Sem lançamentos de perda no período.</div>') + '</div>' +
      (semMotivo.length ? '<div class="gq-section"><h3>Classificar lançamentos sem motivo (' + semMotivo.length + ')</h3><p class="gq-sub">Lançamentos importados sem a coluna "motivo". Classifique em lote por setor ou um a um.</p>' +
        '<div class="gq-form"><label>Setor<select id="gq51LoteSetor">' + Object.keys(setores).map(function(s){ return '<option>' + esc(s) + '</option>'; }).join('') + '</select></label>' +
        '<label>Motivo<select id="gq51LoteMot">' + motOpts('Vencido') + '</select></label><label>&nbsp;<button class="gq-btn pri" data-a="classLote">Aplicar ao setor</button></label></div>' +
        '<div class="gq-tbl-wrap" style="margin-top:10px"><table class="gq-tbl"><thead><tr><th>Data</th><th>Produto</th><th>Setor</th><th class="n">Valor</th><th>Motivo</th></tr></thead><tbody>' +
        semMotivo.slice(0, 80).map(function(r){ return '<tr><td>' + brDate(r.data) + '</td><td>' + esc(r.produto) + '</td><td>' + esc(r.departamento) + '</td><td class="n">' + brl(r.valor) + '</td><td><select class="gq-in" data-motivo="' + esc(motivoKey(r)) + '"><option value="">—</option>' + motOpts('') + '</select></td></tr>'; }).join('') +
        '</tbody></table></div>' + (semMotivo.length > 80 ? '<p class="gq-sub">Mostrando 80 de ' + semMotivo.length + '. Use a classificação por setor para os demais.</p>' : '') + '</div>' : '') +
      '<div class="gq-section"><h3>Registrar perda</h3><p class="gq-sub">Lançamento manual (avaria, furto identificado, quebra etc.). Aparece também no painel de Perdas.</p>' +
      '<div class="gq-form"><label>Data<input type="date" id="gq51PrData" value="' + iso() + '"></label><label style="grid-column:span 2">Produto *<input id="gq51PrProd"></label>' +
      '<label>Código<input id="gq51PrCod"></label><label>Setor<input id="gq51PrSet" list="gq51SetList"><datalist id="gq51SetList">' + setorOpts + '</datalist></label>' +
      '<label>Quantidade<input type="number" min="0" step="0.001" id="gq51PrQtd" value="1"></label><label>Valor total (R$) *<input type="number" min="0" step="0.01" id="gq51PrVal"></label>' +
      '<label>Motivo<select id="gq51PrMot">' + motOpts('Avaria/Quebra') + '</select></label><label>&nbsp;<button class="gq-btn pri" data-a="regPerda">Registrar</button></label></div></div>';
  }
  function desenharPareto(){
    var cv = $('gq51Pareto'); if (!cv || typeof window.Chart !== 'function') return;
    var pd = paretoData(), dark = document.documentElement.getAttribute('data-theme') === 'dark', tc = dark ? '#9fb0c8' : '#55627a', gc = dark ? 'rgba(148,163,184,.15)' : 'rgba(15,23,42,.08)';
    try {
      ind.chart = new window.Chart(cv.getContext('2d'), {
        data: { labels: pd.arr.map(function(x){ return x.k; }), datasets: [
          { type: 'bar', label: 'Valor (R$)', data: pd.arr.map(function(x){ return +x.v.toFixed(2); }), backgroundColor: pd.arr.map(function(x){ return x.acum - x.pct < 80 ? '#4f6bff' : '#64748b'; }), borderRadius: 6, yAxisID: 'y' },
          { type: 'line', label: '% acumulado', data: pd.arr.map(function(x){ return +x.acum.toFixed(1); }), borderColor: '#f59e0b', backgroundColor: '#f59e0b', tension: .25, yAxisID: 'y1' } ] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: tc } },
          tooltip: { callbacks: { label: function(c){ return c.dataset.yAxisID === 'y1' ? c.parsed.y + '%' : brl(c.parsed.y); } } } },
          scales: { x: { ticks: { color: tc }, grid: { display: false } },
            y: { ticks: { color: tc, callback: function(v){ return 'R$ ' + Number(v).toLocaleString('pt-BR'); } }, grid: { color: gc } },
            y1: { position: 'right', min: 0, max: 100, ticks: { color: tc, callback: function(v){ return v + '%'; } }, grid: { display: false } } } }
      });
    } catch(e){ console.warn('[v51 pareto]', e); }
  }

  /* ── Relatório para Compras ────────────────────────────────────── */
  function comprasRecorrentes(dias){
    var lim = addDias(-dias), g = {};
    var add = function(cod, prod, setor, data, qtd, valor, desc){
      var k = (cod && cod !== '—' ? cod : '') + '|' + String(prod || '').toUpperCase(); if (!prod) return;
      var o = g[k] || (g[k] = { codigo: cod && cod !== '—' ? cod : '', produto: prod, setor: setor || '', ocorr: 0, qtd: 0, perdido: 0, ultima: '' });
      o.ocorr++; o.qtd += num(qtd); o.perdido += num(valor) + num(desc || 0); if (data > o.ultima) o.ultima = data; if (!o.setor && setor) o.setor = setor;
    };
    load(K.destinos, []).forEach(function(d){ if (d.data >= lim && d.destino !== 'devolvido') add(d.codigo, d.produto, d.setor, d.data, d.qtd, d.destino === 'vendido' ? 0 : d.total, d.desconto); });
    // perdas com motivo "Vencido" lançadas fora do fluxo de destinos (ex.: planilha importada)
    var jaContado = {};
    load(K.destinos, []).forEach(function(d){ if (d.destino === 'descartado') jaContado[d.data + '|' + String(d.produto).toUpperCase() + '|' + num(d.total).toFixed(2)] = 1; });
    perdasRows().forEach(function(r){
      if (r.data < lim || r.motivo !== 'Vencido') return;
      if (jaContado[r.data + '|' + String(r.produto).toUpperCase() + '|' + r.valor.toFixed(2)]) return;
      add(r.codigo, r.produto, r.departamento, r.data, r.quantidade, r.valor, 0);
    });
    return Object.keys(g).map(function(k){ var o = g[k]; o.sug = o.ocorr >= 3 ? 'Reduzir o pedido em ~30% e revisar o giro' : o.ocorr === 2 ? 'Reduzir o pedido em ~15%' : 'Acompanhar'; return o; })
      .sort(function(a, b){ return b.ocorr - a.ocorr || b.perdido - a.perdido; });
  }
  function tabCompras(){
    var lista = comprasRecorrentes(ind.compDias);
    return '<div class="gq-section"><h3>' + ico('cart') + 'Relatório para Compras</h3><p class="gq-sub">Produtos que venceram, foram rebaixados ou descartados no período. "Produto vencido é resultado de uma compra ruim" — use para ajustar pedidos e negociar trocas.</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end"><div class="gq-form" style="min-width:200px"><label>Período<select data-ind="compDias">' + [30, 60, 90, 180].map(function(d){ return '<option value="' + d + '"' + (d === ind.compDias ? ' selected' : '') + '>Últimos ' + d + ' dias</option>'; }).join('') + '</select></label></div>' +
      '<button class="gq-btn" data-a="compXlsx">📊 Exportar Excel</button><button class="gq-btn" data-a="compPrint">🖨️ Imprimir</button></div>' +
      (lista.length ? '<div class="gq-tbl-wrap" style="margin-top:12px"><table class="gq-tbl"><thead><tr><th>Produto</th><th>Setor</th><th class="n">Ocorrências</th><th class="n">Qtd</th><th class="n">R$ perdido</th><th>Última</th><th>Sugestão</th></tr></thead><tbody>' +
        lista.map(function(o){ return '<tr><td><b>' + esc(o.produto) + '</b>' + (o.codigo ? '<div style="font-size:.72rem;color:var(--gq-text-2)">' + esc(o.codigo) + '</div>' : '') + '</td><td>' + esc(o.setor || '—') + '</td><td class="n">' + o.ocorr + '</td><td class="n">' + o.qtd.toLocaleString('pt-BR') + '</td><td class="n">' + brl(o.perdido) + '</td><td>' + brDate(o.ultima) + '</td><td>' + (o.ocorr >= 3 ? '🔴 ' : o.ocorr === 2 ? '🟠 ' : '') + esc(o.sug) + '</td></tr>'; }).join('') +
        '</tbody></table></div>' : '<div class="gq-empty" style="margin-top:12px">Nada no período. O relatório se alimenta dos destinos registrados em Vencidos e das perdas com motivo "Vencido".</div>') + '</div>' +
      (window.GQ52 && typeof window.GQ52.comprasHtml === 'function' ? window.GQ52.comprasHtml(ind.compDias) : '');
  }
  function exportarCompras(){
    if (typeof window.XLSX === 'undefined') return notify('Biblioteca de Excel não carregada.', 'warning');
    var l = comprasRecorrentes(ind.compDias);
    var ws = window.XLSX.utils.aoa_to_sheet([['Produto', 'Código', 'Setor', 'Ocorrências', 'Quantidade', 'R$ perdido', 'Última ocorrência', 'Sugestão']].concat(l.map(function(o){ return [o.produto, o.codigo, o.setor, o.ocorr, o.qtd, +o.perdido.toFixed(2), brDate(o.ultima), o.sug]; })));
    var wb = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(wb, ws, 'Compras');
    window.XLSX.writeFile(wb, 'gestorq_compras_' + iso() + '.xlsx');
  }
  function imprimirCompras(){
    var l = comprasRecorrentes(ind.compDias), w = window.open('', '_blank'); if (!w) return notify('Permita pop-ups para imprimir.', 'warning');
    w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Relatório para Compras — GestorQ</title><style>body{font-family:Arial,sans-serif;padding:20px;color:#0f172a}h1{font-size:18px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border-bottom:1px solid #e2e8f0;padding:6px;text-align:left}th{background:#f1f5f9}td.n{text-align:right}</style></head><body>' +
      '<h1>Relatório para Compras — últimos ' + esc(ind.compDias) + ' dias</h1><p>Gerado em ' + esc(new Date().toLocaleString('pt-BR')) + ' — GestorQ</p><table><tr><th>Produto</th><th>Setor</th><th>Ocorr.</th><th>Qtd</th><th>R$ perdido</th><th>Última</th><th>Sugestão</th></tr>' +
      l.map(function(o){ return '<tr><td>' + esc(o.produto) + ' ' + esc(o.codigo) + '</td><td>' + esc(o.setor) + '</td><td class="n">' + o.ocorr + '</td><td class="n">' + o.qtd + '</td><td class="n">' + esc(brl(o.perdido)) + '</td><td>' + esc(brDate(o.ultima)) + '</td><td>' + esc(o.sug) + '</td></tr>'; }).join('') + '</table></body></html>');
    w.document.close(); setTimeout(function(){ try { w.print(); } catch(e){} }, 400);
  }

  /* ── Pendências (usa o mesmo cadastro do Plano de ação 5W2H) ────── */
  function tabPendencias(){
    var hoje = iso(), fotos = load(K.fotos, {});
    var todas = getAcoes().filter(Boolean);
    var lista = todas.filter(function(a){
      if (ind.pendFiltro === 'abertas') return a.status !== 'concluida';
      if (ind.pendFiltro === 'atrasadas') return a.status !== 'concluida' && a.when && a.when < hoje;
      if (ind.pendFiltro === 'concluidas') return a.status === 'concluida';
      return true;
    }).sort(function(a, b){ return String(a.when || '').localeCompare(String(b.when || '')); });
    var pr = { critica: '🔴 Crítica', alta: '🟠 Alta', media: '🟡 Média', baixa: '🟢 Baixa' };
    return '<div class="gq-section"><h3>' + ico('task') + 'Nova pendência</h3><p class="gq-sub">Toda não conformidade vira tarefa com responsável, prazo e foto de evidência. As pendências também aparecem no Plano de ação (5W2H).</p>' +
      '<div class="gq-form"><label style="grid-column:span 2">O que fazer *<input id="gq51AcWhat" placeholder="ex.: Trocar borracha da porta da câmara 2"></label>' +
      '<label>Responsável *<input id="gq51AcWho" value="' + esc(userName()) + '"></label><label>Prazo *<input type="date" id="gq51AcWhen" value="' + addDias(2) + '"></label>' +
      '<label>Prioridade<select id="gq51AcPri"><option value="media">Média</option><option value="alta">Alta</option><option value="critica">Crítica</option><option value="baixa">Baixa</option></select></label>' +
      '<label>&nbsp;<button class="gq-btn pri" data-a="novaAcao">Criar</button></label></div></div>' +
      '<div class="gq-section"><div class="gq-tabs" style="margin-bottom:8px">' + [['abertas', 'Abertas'], ['atrasadas', 'Atrasadas'], ['concluidas', 'Concluídas'], ['todas', 'Todas']].map(function(f){ return '<button data-pend="' + f[0] + '" class="' + (ind.pendFiltro === f[0] ? 'on' : '') + '">' + f[1] + '</button>'; }).join('') + '</div>' +
      (lista.length ? '<div class="gq-list">' + lista.map(function(a){
        var atras = a.status !== 'concluida' && a.when && a.when < hoje, fs = fotos[a.id] || [];
        return '<div class="gq-task ' + (atras ? 'danger' : a.status === 'concluida' ? 'done' : '') + '" style="align-items:flex-start">' +
          '<div class="ic">' + ico(a.status === 'concluida' ? 'check' : 'task') + '</div><div class="tx"><div class="t">' + esc(a.what) + '</div>' +
          '<div class="d">' + esc(pr[a.prioridade] || a.prioridade || '') + ' · ' + esc(a.who || '—') + ' · prazo ' + brDate(a.when) + (atras ? ' · <b style="color:var(--gq-danger)">ATRASADA</b>' : '') + (a.origem && a.origem !== 'gestorq' ? ' · origem: ' + esc(a.origem) : '') + '</div>' +
          (a.why ? '<div class="d">' + esc(a.why) + '</div>' : '') +
          (fs.length ? '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">' + fs.map(function(f, i){ if (!fotoOk(f)) return ''; return '<img class="gq-thumb" src="' + esc(f.img) + '" alt="' + esc(f.tipo) + '" title="' + esc(f.tipo + ' — ' + brDate(f.data)) + '" data-foto="' + esc(a.id) + ':' + i + '">'; }).join('') + '</div>' : '') +
          '</div><div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">' +
          (a.status !== 'concluida' ? '<button class="gq-btn sm" data-a="foto" data-tipo="antes" data-id="' + esc(a.id) + '">📷 Antes</button><button class="gq-btn sm" data-a="foto" data-tipo="depois" data-id="' + esc(a.id) + '">📷 Depois</button><button class="gq-btn sm ok" data-a="concluir" data-id="' + esc(a.id) + '">Concluir</button>' : '<span class="gq-badge gq-b-ok">concluída</span>') +
          '</div></div>';
      }).join('') + '</div>' : '<div class="gq-empty">Nenhuma pendência neste filtro.</div>') +
      '<input type="file" accept="image/*" capture="environment" id="gq51FotoIn" style="display:none"></div>';
  }
  function comprimirFoto(file, cb){
    var fr = new FileReader();
    fr.onload = function(){
      var img = new Image();
      img.onload = function(){
        var m = 900, w = img.width, h = img.height, s = Math.min(1, m / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        cb(c.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = function(){ notify('Imagem inválida.', 'warning'); };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  }
  var fotoAlvo = null;
  function concluirAcao(id){
    var a = getAcoes().find(function(x){ return x && x.id === id; }); if (!a) return;
    var fs = load(K.fotos, {})[id] || [];
    var fim = function(){ a.status = 'concluida'; a.progresso = 100; a.concluidaEm = new Date().toISOString(); a.concluidaPor = userName(); persistAcao(a); notify('✅ Pendência concluída.', 'success'); dirty = true; renderInd(); };
    if (!fs.some(function(f){ return f.tipo === 'depois'; })) {
      var ov = modal('<h3>Concluir sem foto?</h3><p>Não há foto "depois" como evidência. Recomendado anexar para auditorias.</p><div class="row"><button class="gq-btn" data-x="c">Voltar</button><button class="gq-btn ok" data-x="ok">Concluir mesmo assim</button></div>');
      ov.addEventListener('click', function(e){ var x = e.target.getAttribute && e.target.getAttribute('data-x'); if (x === 'c') ov.close(); if (x === 'ok') { ov.close(); fim(); } });
    } else fim();
  }

  /* ── Destinos ───────────────────────────────────────────────────── */
  function tabDestinos(){
    var arr = load(K.destinos, []).slice().reverse(), g = {};
    arr.forEach(function(d){ if (!d || !DEST_TXT.hasOwnProperty(d.destino)) return; var o = g[d.destino] || (g[d.destino] = { n: 0, total: 0, rec: 0 }); o.n++; o.total += num(d.total); o.rec += num(d.recuperado); });
    return '<div class="gq-section"><h3>' + ico('tag') + 'Destino dos produtos</h3><p class="gq-sub">Histórico do que foi feito com produtos próximos do vencimento.</p>' +
      '<div class="gq-kpis">' + ['vendido', 'devolvido', 'doado', 'descartado'].map(function(k){ var o = g[k] || { n: 0, total: 0, rec: 0 }; return '<div class="gq-kpi ' + (k === 'descartado' ? 'danger' : k === 'doado' ? 'warn' : 'ok') + '" style="cursor:default"><div class="l">' + esc(DEST_TXT[k]) + '</div><div class="v">' + o.n + '</div><div class="s">' + brl(o.total) + (o.rec ? ' · recuperado ' + brl(o.rec) : '') + '</div></div>'; }).join('') + '</div>' +
      '<div style="margin-bottom:10px"><button class="gq-btn" data-a="destXlsx">📊 Exportar Excel</button></div>' +
      (arr.length ? '<div class="gq-tbl-wrap"><table class="gq-tbl"><thead><tr><th>Data</th><th>Produto</th><th>Destino</th><th class="n">Qtd</th><th class="n">Valor</th><th class="n">Recuperado</th><th>Por</th></tr></thead><tbody>' +
        arr.slice(0, 200).map(function(d){ return '<tr><td>' + brDate(d.data) + '</td><td>' + esc(d.produto) + '<div style="font-size:.72rem;color:var(--gq-text-2)">' + esc(d.setor || '') + '</div></td><td>' + esc(DEST_TXT[d.destino] || d.destino) + (d.pct ? ' (' + esc(d.pct) + '%)' : '') + '</td><td class="n">' + esc(d.qtd) + '</td><td class="n">' + brl(d.total) + '</td><td class="n">' + brl(d.recuperado) + '</td><td>' + esc(d.por || '') + '</td></tr>'; }).join('') +
        '</tbody></table></div>' : '<div class="gq-empty">Nenhum destino registrado ainda. Use "Agir antes de vencer" na página Vencidos.</div>') + '</div>';
  }

  /* ── Integrações e ajustes ─────────────────────────────────────── */
  function tabIntegracoes(){
    var c = cfg();
    return '<div class="gq-section"><h3>Faixas de desconto sugerido</h3><p class="gq-sub">Percentual sugerido conforme os dias até o vencimento. Produto vencido nunca é sugerido para venda.</p>' +
      '<div class="gq-form"><label>Até 1 dia (%)<input type="number" min="0" max="90" id="gq51F0" value="' + c.faixas[0] + '"></label><label>Até 3 dias (%)<input type="number" min="0" max="90" id="gq51F1" value="' + c.faixas[1] + '"></label>' +
      '<label>Até 5 dias (%)<input type="number" min="0" max="90" id="gq51F2" value="' + c.faixas[2] + '"></label><label>Até 7 dias (%)<input type="number" min="0" max="90" id="gq51F3" value="' + c.faixas[3] + '"></label>' +
      '<label>&nbsp;<button class="gq-btn pri" data-a="salvarFaixas">Salvar</button></label></div></div>' +
      '<div class="gq-section"><h3>Importar faturamento (planilha)</h3><p class="gq-sub">Arquivo .xlsx ou .csv exportado do ERP/PDV com as colunas <b>mês</b> (ou data), <b>valor</b> e, opcionalmente, <b>setor</b>. Valores do mesmo mês/setor são somados.</p>' +
      '<input type="file" accept=".xlsx,.xls,.csv" id="gq51ImpFat" class="gq-in"></div>' +
      '<div class="gq-section"><h3>Importar leituras de sensores de temperatura</h3><p class="gq-sub">Arquivo .xlsx ou .csv exportado do datalogger/sensor com <b>equipamento</b>, <b>temperatura</b>, <b>data/hora</b> e, opcionalmente, <b>mínima</b> e <b>máxima</b>. Leituras fora da faixa geram uma pendência por equipamento e dia.</p>' +
      '<input type="file" accept=".xlsx,.xls,.csv" id="gq51ImpSensor" class="gq-in"></div>' +
      '<div class="gq-section"><h3>Backup dos dados novos</h3><p class="gq-sub">Destinos, motivos, faturamento, ajustes e fotos de evidência. O backup geral do app continua em Configurações.</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="gq-btn" data-a="bkpExp">⬇️ Exportar (JSON)</button><label class="gq-btn" style="cursor:pointer">⬆️ Importar<input type="file" accept=".json" id="gq51BkpIn" style="display:none"></label></div>' +
      '<p class="gq-sub" style="margin-top:10px">Integração direta com ERP ou com sensores em tempo real depende da API do fornecedor. Enquanto isso, use as importações por planilha acima.</p></div>';
  }
  function lerPlanilha(file, cb){
    if (typeof window.XLSX === 'undefined') return notify('Biblioteca de planilhas não carregada.', 'warning');
    var fr = new FileReader();
    fr.onload = function(e){
      try {
        var wb = window.XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
        var rows = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        cb(rows);
      } catch(err){ notify('Não foi possível ler a planilha: ' + err.message, 'danger'); }
    };
    fr.readAsArrayBuffer(file);
  }
  function col(row, nomes){
    var keys = Object.keys(row), norm = function(s){ return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); };
    for (var i = 0; i < nomes.length; i++) for (var j = 0; j < keys.length; j++) if (norm(keys[j]).indexOf(nomes[i]) >= 0) return row[keys[j]];
    return '';
  }
  function toDate(v){
    if (v instanceof Date && !isNaN(v)) return v;
    var s = String(v || '').trim(), m;
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/))) return new Date(+(m[3].length === 2 ? '20' + m[3] : m[3]), +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
    if ((m = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?(?:[T\s](\d{2}):(\d{2}))?/))) return new Date(+m[1], +m[2] - 1, +(m[3] || 1), +(m[4] || 0), +(m[5] || 0));
    if ((m = s.match(/^(\d{1,2})\/(\d{4})$/))) return new Date(+m[2], +m[1] - 1, 1);
    if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 86400000));
    return null;
  }
  function importarFaturamento(rows){
    var fat = load(K.fat, {}), n = 0, novo = {};
    rows.forEach(function(r){
      var d = toDate(col(r, ['mes', 'competencia', 'data', 'periodo'])), v = num(col(r, ['valor', 'faturamento', 'venda', 'total', 'receita'])), s = String(col(r, ['setor', 'departamento', 'secao', 'depto']) || '').trim();
      if (!d || !(v > 0)) return;
      var m = iso(d).slice(0, 7), o = novo[m] || (novo[m] = { total: 0, setores: {}, temTotal: false });
      if (s) o.setores[s] = (o.setores[s] || 0) + v; else { o.total += v; o.temTotal = true; }
      n++;
    });
    Object.keys(novo).forEach(function(m){
      var o = novo[m], f = fat[m] || { total: 0, setores: {} };
      f.setores = f.setores || {};
      Object.keys(o.setores).forEach(function(s){ f.setores[s] = o.setores[s]; });
      f.total = o.temTotal ? o.total : Object.keys(f.setores).reduce(function(t, s){ return t + num(f.setores[s]); }, 0);
      fat[m] = f;
    });
    save(K.fat, fat);
    notify(n ? '✅ ' + n + ' linha(s) de faturamento importada(s) (' + Object.keys(novo).map(mesNome).join(', ') + ').' : '⚠️ Nenhuma linha válida (verifique as colunas mês e valor).', n ? 'success' : 'warning');
    if (n) { ind.mes = Object.keys(novo).sort().pop(); ind.tab = 'indice'; renderInd(); }
  }
  function importarSensores(rows){
    var log = getTempLog(), n = 0, fora = {}, filial = window.fbFilial || ((curUser() || {}).filial) || '—';
    rows.forEach(function(r, i){
      var eq = String(col(r, ['equipamento', 'sensor', 'camara', 'local', 'equip']) || '').trim(), t = num(col(r, ['temperatura', 'temp', 'valor', 'leitura']));
      var d = toDate(col(r, ['data', 'hora', 'timestamp', 'momento'])); var mi = col(r, ['minima', 'min']), ma = col(r, ['maxima', 'max']);
      if (!eq || !d || col(r, ['temperatura', 'temp', 'valor', 'leitura']) === '') return;
      mi = mi === '' ? null : num(mi); ma = ma === '' ? null : num(ma);
      var st = (mi != null && ma != null) ? (t < mi || t > ma ? 'crit' : 'ok') : 'ok';
      var reg = { id: 'temp_imp_' + d.getTime() + '_' + i, equip: eq, val: t, min: mi, max: ma, status: st, obs: 'Importado de sensor', responsavel: 'Sensor', filial: filial, ts: d.toISOString(), origem: 'sensor' };
      log.push(reg); n++;
      if (st === 'crit') { var k = eq + '|' + iso(d); if (!fora[k]) fora[k] = reg; }
    });
    log.sort(function(a, b){ return String(b.ts).localeCompare(String(a.ts)); });
    if (log.length > 3000) log = log.slice(0, 3000);
    try { localStorage.setItem('tempLog', JSON.stringify(log)); } catch(e){ return notify('⚠️ Sem espaço para importar as leituras.', 'warning'); }
    if (Array.isArray(window.tempLog)) { window.tempLog.length = 0; Array.prototype.push.apply(window.tempLog, log); }
    Object.keys(fora).forEach(function(k){ var r = fora[k]; novaAcao({ what: 'Verificar ' + r.equip + ' — sensor registrou ' + r.val + '°C fora da faixa em ' + brDate(iso(new Date(r.ts))), why: 'Leitura importada do sensor', where: r.equip, when: addDias(1), prioridade: 'alta', origem: 'sensor' }); });
    try { if (typeof window.renderTempLog === 'function') window.renderTempLog(); if (typeof window.renderTempGauges === 'function') window.renderTempGauges(); } catch(e){}
    notify(n ? '✅ ' + n + ' leitura(s) importada(s); ' + Object.keys(fora).length + ' pendência(s) criada(s).' : '⚠️ Nenhuma leitura válida (colunas equipamento, temperatura e data/hora).', n ? 'success' : 'warning');
    dirty = true;
  }

  /* Backup: aceita só o formato esperado de cada chave (evita injeção de HTML/valores estranhos) */
  function validarBackup(d){
    var out = {}, isObj = function(x){ return x && typeof x === 'object' && !Array.isArray(x); };
    var txt = function(x, m){ return String(x == null ? '' : x).replace(/[<>"]/g, '').slice(0, m || 200); };
    var data = function(x){ return /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : ''; };
    if (Array.isArray(d[K.destinos])) out[K.destinos] = d[K.destinos].filter(function(x){ return isObj(x) && DEST_TXT.hasOwnProperty(x.destino) && data(x.data); }).map(function(x){
      return { id: txt(x.id, 60), ts: txt(x.ts, 40), data: data(x.data), produto: txt(x.produto), codigo: txt(x.codigo, 40), setor: txt(x.setor, 80), validade: data(x.validade),
        qtd: num(x.qtd), valorUnit: num(x.valorUnit), total: num(x.total), destino: x.destino, pct: Math.max(0, Math.min(90, num(x.pct))), recuperado: num(x.recuperado), desconto: num(x.desconto), por: txt(x.por, 80) }; });
    if (isObj(d[K.motivos])) { var m = {}; Object.keys(d[K.motivos]).forEach(function(k){ if (MOTIVOS.indexOf(d[K.motivos][k]) >= 0) m[txt(k, 400)] = d[K.motivos][k]; }); out[K.motivos] = m; }
    if (isObj(d[K.fat])) { var f = {}; Object.keys(d[K.fat]).forEach(function(k){ var v = d[K.fat][k]; if (!/^\d{4}-\d{2}$/.test(k) || !isObj(v)) return; var st = {}; if (isObj(v.setores)) Object.keys(v.setores).forEach(function(s2){ st[txt(s2, 80)] = num(v.setores[s2]); }); f[k] = { total: num(v.total), setores: st }; }); out[K.fat] = f; }
    if (isObj(d[K.cfg])) out[K.cfg] = { formato: FORMATOS[d[K.cfg].formato] ? d[K.cfg].formato : 'convencional', meta: num(d[K.cfg].meta), faixas: Array.isArray(d[K.cfg].faixas) ? d[K.cfg].faixas.slice(0, 4).map(num) : undefined };
    if (isObj(d[K.fotos])) { var fo = {}; Object.keys(d[K.fotos]).forEach(function(k){ var l = d[K.fotos][k]; if (Array.isArray(l)) { var ok = l.filter(fotoOk).map(function(x){ return { tipo: x.tipo === 'depois' ? 'depois' : 'antes', data: data(x.data), por: txt(x.por, 80), img: x.img }; }); if (ok.length) fo[txt(k, 60)] = ok; } }); out[K.fotos] = fo; }
    return out;
  }

  /* ── Eventos da página Indicadores ─────────────────────────────── */
  function onIndClick(e){
    var t = e.target.closest('[data-tab]'); if (t) { ind.tab = t.getAttribute('data-tab'); if (ind.tab === 'indice' && ind.mes === 'todos') ind.mes = mesAtual(); return renderInd(); }
    var p = e.target.closest('[data-pend]'); if (p) { ind.pendFiltro = p.getAttribute('data-pend'); return renderInd(); }
    var f = e.target.closest('[data-foto]');
    if (f) { var parts = f.getAttribute('data-foto').split(':'), ft = (load(K.fotos, {})[parts[0]] || [])[+parts[1]]; if (fotoOk(ft)) modal('<h3>Evidência — ' + esc(ft.tipo) + '</h3><p>' + esc(brDate(ft.data)) + ' · ' + esc(ft.por || '') + '</p><img src="' + esc(ft.img) + '" style="width:100%;border-radius:12px">'); return; }
    var b = e.target.closest('[data-a]'); if (!b) return;
    var a = b.getAttribute('data-a');
    if (a === 'salvarFat') {
      var fat = load(K.fat, {}), cur = fat[ind.mes] || { total: 0, setores: {} }; cur.total = num($('gq51FatTotal').value); fat[ind.mes] = cur; save(K.fat, fat);
      notify('✅ Faturamento de ' + mesNome(ind.mes) + ' salvo.', 'success'); dirty = true; renderInd();
    } else if (a === 'salvarFatSetor') {
      var fat2 = load(K.fat, {}), c2 = fat2[ind.mes] || { total: 0, setores: {} }; c2.setores = c2.setores || {};
      Array.prototype.forEach.call(document.querySelectorAll('[data-fatsetor]'), function(i){ var v = num(i.value); if (v > 0) c2.setores[i.getAttribute('data-fatsetor')] = v; else delete c2.setores[i.getAttribute('data-fatsetor')]; });
      if (!(num(c2.total) > 0)) c2.total = Object.keys(c2.setores).reduce(function(s, k){ return s + num(c2.setores[k]); }, 0);
      fat2[ind.mes] = c2; save(K.fat, fat2); notify('✅ Faturamento por setor salvo.', 'success'); renderInd();
    } else if (a === 'classLote') {
      var setor = $('gq51LoteSetor').value, mot = $('gq51LoteMot').value, mm = load(K.motivos, {}), n = 0;
      rowsPeriodo().forEach(function(r){ if (r.motivo === 'Não informado' && r.departamento === setor) { mm[motivoKey(r)] = mot; n++; } });
      save(K.motivos, mm); notify('✅ ' + n + ' lançamento(s) de ' + setor + ' classificados como ' + mot + '.', 'success'); renderInd();
    } else if (a === 'regPerda') {
      var prod = $('gq51PrProd').value.trim(), val = num($('gq51PrVal').value);
      if (!prod || !(val > 0)) return notify('Informe produto e valor total.', 'warning');
      addPerda({ data: $('gq51PrData').value || iso(), produto: prod, codigo: $('gq51PrCod').value.trim(), setor: $('gq51PrSet').value.trim() || '—', quantidade: num($('gq51PrQtd').value) || 1, valor: val, motivo: $('gq51PrMot').value });
      logAct('Perda registrada', prod + ' — ' + brl(val)); notify('✅ Perda registrada.', 'success'); dirty = true; renderInd();
    } else if (a === 'compXlsx') exportarCompras();
    else if (a === 'compPrint') imprimirCompras();
    else if (a === 'novaAcao') {
      var w = $('gq51AcWhat').value.trim(), who = $('gq51AcWho').value.trim(), when = $('gq51AcWhen').value;
      if (!w || !who || !when) return notify('Preencha o que fazer, responsável e prazo.', 'warning');
      novaAcao({ what: w, who: who, when: when, prioridade: $('gq51AcPri').value, origem: 'pendencia' });
      notify('✅ Pendência criada.', 'success'); dirty = true; renderInd();
    } else if (a === 'foto') { fotoAlvo = { id: b.getAttribute('data-id'), tipo: b.getAttribute('data-tipo') }; var fi = $('gq51FotoIn'); if (fi) { fi.value = ''; fi.click(); } }
    else if (a === 'concluir') concluirAcao(b.getAttribute('data-id'));
    else if (a === 'destXlsx') {
      if (typeof window.XLSX === 'undefined') return notify('Biblioteca de Excel não carregada.', 'warning');
      var ds = load(K.destinos, []);
      var ws = window.XLSX.utils.aoa_to_sheet([['Data', 'Produto', 'Código', 'Setor', 'Validade', 'Destino', 'Desconto %', 'Qtd', 'Valor', 'Recuperado', 'Por']].concat(ds.map(function(d){ return [brDate(d.data), d.produto, d.codigo, d.setor, brDate(d.validade), DEST_TXT[d.destino] || d.destino, d.pct, d.qtd, +num(d.total).toFixed(2), +num(d.recuperado).toFixed(2), d.por]; })));
      var wb = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(wb, ws, 'Destinos'); window.XLSX.writeFile(wb, 'gestorq_destinos_' + iso() + '.xlsx');
    } else if (a === 'salvarFaixas') {
      var fx = [0, 1, 2, 3].map(function(i){ return Math.max(0, Math.min(90, Math.round(num($('gq51F' + i).value)))); });
      var cc = load(K.cfg, {}); cc.faixas = fx; save(K.cfg, cc); notify('✅ Faixas de desconto salvas.', 'success');
    } else if (a === 'bkpExp') {
      var data = { versao: 'gestorq-v51', exportadoEm: new Date().toISOString() };
      Object.keys(K).forEach(function(k){ data[K[k]] = load(K[k], null); });
      var blob = new Blob([JSON.stringify(data)], { type: 'application/json' }), aEl = document.createElement('a');
      aEl.href = URL.createObjectURL(blob); aEl.download = 'gestorq_v51_backup_' + iso() + '.json'; document.body.appendChild(aEl); aEl.click(); aEl.remove();
    }
  }
  function onIndChange(e){
    var el = e.target, k = el.getAttribute('data-ind');
    if (k === 'mes' || k === 'mesMot') { ind.mes = el.value || mesAtual(); return renderInd(); }
    if (k === 'compDias') { ind.compDias = +el.value || 60; return renderInd(); }
    if (k === 'formato' || k === 'meta') {
      var c = load(K.cfg, {});
      if (k === 'formato') { c.formato = el.value; c.meta = FORMATOS[el.value].v; } else c.meta = num(el.value);
      save(K.cfg, c); dirty = true; return renderInd();
    }
    var mk = el.getAttribute('data-motivo');
    if (mk) { var mm = load(K.motivos, {}); if (el.value) mm[mk] = el.value; else delete mm[mk]; save(K.motivos, mm); return; }
    if (el.id === 'gq51FotoIn' && el.files && el.files[0] && fotoAlvo) {
      var alvo = fotoAlvo;
      comprimirFoto(el.files[0], function(img){
        var fs = load(K.fotos, {}); (fs[alvo.id] = fs[alvo.id] || []).push({ tipo: alvo.tipo, data: iso(), por: userName(), img: img });
        if (save(K.fotos, fs)) { notify('📷 Foto "' + alvo.tipo + '" anexada.', 'success'); renderInd(); }
      });
    }
    if (el.id === 'gq51ImpFat' && el.files && el.files[0]) lerPlanilha(el.files[0], importarFaturamento);
    if (el.id === 'gq51ImpSensor' && el.files && el.files[0]) lerPlanilha(el.files[0], importarSensores);
    if (el.id === 'gq51BkpIn' && el.files && el.files[0]) {
      var fr = new FileReader();
      fr.onload = function(){
        try {
          var d = JSON.parse(fr.result); if (!d || d.versao !== 'gestorq-v51') throw new Error('arquivo não é um backup do GestorQ v51');
          var limpo = validarBackup(d);
          var aplicar = function(){ Object.keys(limpo).forEach(function(k){ save(k, limpo[k]); }); notify('✅ Backup importado.', 'success'); dirty = true; renderInd(); };
          if (cloudOk()) {
            var ov = modal('<h3>Importar backup?</h3><p>Você está no modo nuvem: destinos, motivos, faturamento e ajustes importados serão enviados para todas as lojas da filial.</p><div class="row"><button class="gq-btn" data-x="c">Cancelar</button><button class="gq-btn pri" data-x="ok">Importar</button></div>');
            ov.addEventListener('click', function(ev){ var x = ev.target.getAttribute && ev.target.getAttribute('data-x'); if (x === 'c') ov.close(); if (x === 'ok') { ov.close(); aplicar(); } });
          } else aplicar();
        } catch(err){ notify('❌ ' + err.message, 'danger'); }
      };
      fr.readAsText(el.files[0]);
    }
  }

  /* ════════════════════════════════════════════════════════════════
     Ciclo de atualização
     ════════════════════════════════════════════════════════════════ */
  var dirty = true, lastRender = 0, vis = {};
  function logged(){ return document.body.classList.contains('qx50-auth'); }
  function tick(){
    var on = logged();
    document.body.classList.toggle('gq51-on', on);
    if (!on) return;
    setupHeader(); setupNav(); syncIndVisibility(); ensurePage(); setupVencEmpty(); wrapTemperatura(); cloudPull();
    var now = Date.now(), refresh = dirty || now - lastRender > 30000;
    var pages = { d: $('pageDashboard'), v: $('pageVencidos'), i: $('pageIndicadores') };
    ['d', 'v', 'i'].forEach(function(k){
      var shown = isShown(pages[k]), became = shown && !vis[k]; vis[k] = shown;
      if (!shown || !(became || refresh)) return;
      try {
        if (k === 'd') renderHoje();
        else if (k === 'v') renderAgir();
        else if (became) renderInd(); // a página Indicadores só redesenha ao abrir ou após ações (preserva o que está sendo digitado)
      } catch(e){ console.error('[v51 render ' + k + ']', e); }
    });
    if (refresh) { dirty = false; lastRender = now; }
    // Temperatura abria sem nenhuma aba de conteúdo: abre a de registro livre
    var pt = $('pageTemperatura'), tShown = isShown(pt);
    if (tShown && !vis.t && typeof window.setTempTab === 'function') {
      var abas = ['tempTabAfericao', 'tempTabConfigurar', 'tempTabRegistro', 'tempTabHACCP', 'tempTabHistorico'];
      if (!abas.some(function(id){ return isShown($(id)); }) && $('tempTabRegistro')) { try { window.setTempTab('registro', $('ttRegistro')); } catch(e){} }
    }
    vis.t = tShown;
    // Plano de ação abria mostrando 0/0/0 até alguém chamar renderPlanoAcao()
    var pa = $('pagePlanoAcao'), paShown = isShown(pa);
    if (paShown && !vis.pa && typeof window.renderPlanoAcao === 'function') { try { window.renderPlanoAcao(); } catch(e){} }
    vis.pa = paShown;
  }
  function wrapRenderVencidos(){
    var o = window.renderVencidos; if (typeof o !== 'function' || o.__gq51) return;
    var w = function(){ var r = o.apply(this, arguments); dirty = true; return r; }; w.__gq51 = true; window.renderVencidos = w;
  }
  // API mínima para a camada v52 (Perda x Venda)
  // Atenção: GQ51.modal recebe HTML cru — quem chama precisa escapar os dados.
  window.GQ51 = Object.freeze({ novaAcao: novaAcao, getAcoes: getAcoes, save: save, load: load, veFinanceiro: veFinanceiro, modal: modal, MOTIVOS: MOTIVOS.slice(), refresh: function(){ dirty = true; } });

  function boot(){
    try { if (localStorage.getItem(K.loja) === '1') document.body.classList.add('gq51-loja'); } catch(e){}
    try { brandObserve(); } catch(e){ console.warn('[v51 marca]', e); }
    window.addEventListener('storage', function(){ dirty = true; });
    setInterval(function(){ try { wrapRenderVencidos(); tick(); } catch(e){ console.error('[v51 tick]', e); } }, 1000);
    setTimeout(function(){ try { tick(); } catch(e){} }, 300);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
