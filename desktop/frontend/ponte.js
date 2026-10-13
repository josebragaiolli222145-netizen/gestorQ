/* ════════════════════════════════════════════════════════════════════
   GestorQ Desktop — ponte entre o app e o banco de dados
   Roda ANTES de qualquer outro script da página:
   1) pega o token de acesso (o atalho abre o app com #t=<token>);
   2) reenvia alterações que ficaram pendentes da última vez (diário);
   3) carrega todos os dados do banco (SQLite) para o armazenamento do app;
   4) toda gravação do app (localStorage.setItem/removeItem/clear) vai para o
      banco em lotes (~0,4 s), com diário local até o banco confirmar;
   5) só uma janela do GestorQ grava por vez (evita uma janela apagar o que a
      outra salvou);
   6) avisa se o servidor parar de responder.
   ════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var ls, ss; try { ls = window.localStorage; ss = window.sessionStorage; } catch(e){ return; }
  var SP = Storage.prototype, oSet = SP.setItem, oRem = SP.removeItem, oClr = SP.clear, oGet = SP.getItem;
  var DIARIO = '__gq_pend';                 // chaves reservadas da ponte (não vão para o banco)
  function reservada(k){ return String(k).indexOf('__gq_') === 0; }
  window.GQ_DESKTOP = { versao: '__GESTORQ_VERSAO__', online: true };
  // Definido antes de qualquer saída antecipada: mesmo uma janela bloqueada não deve tentar a nuvem
  Object.defineProperty(window, 'GQ_DESKTOP_LOCAL', { configurable: true, get: function(){ try { return oGet.call(ls, 'gqDesktopNuvem') !== '1'; } catch(e){ return true; } } });
  try { if (window.GQ_DESKTOP_LOCAL && oGet.call(ls, 'appMode') !== 'local') oSet.call(ls, 'appMode', 'local'); } catch(e){}

  /* Token: vem no endereço (#t=...) e fica guardado só nesta janela */
  var TOKEN = '';
  var m = /[#&]t=([0-9a-f]{48})/.exec(location.hash || '');
  if (m) { TOKEN = m[1]; try { oSet.call(ss, 'gqToken', TOKEN); } catch(e){} try { history.replaceState(null, '', location.pathname + location.search); } catch(e){} }
  else { try { TOKEN = oGet.call(ss, 'gqToken') || ''; } catch(e){} }

  function bloquearTela(titulo, texto, botao){
    var mostrar = function(){
      var d = document.getElementById('gqDesktopBloqueio');
      if (!d) {
        d = document.createElement('div'); d.id = 'gqDesktopBloqueio';
        d.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(2,6,23,.92);display:flex;align-items:center;justify-content:center;padding:20px;font-family:system-ui,sans-serif';
        d.innerHTML = '<div style="max-width:440px;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:18px;padding:24px;text-align:center"><h2 style="margin:0 0 8px;font-size:1.15rem"></h2><p style="margin:0;color:#94a3b8;line-height:1.5"></p><div class="gq-acao" style="margin-top:16px"></div></div>';
        document.body.appendChild(d);
      }
      d.querySelector('h2').textContent = titulo; d.querySelector('p').textContent = texto;
      var acao = d.querySelector('.gq-acao'); acao.innerHTML = '';
      if (botao) {
        var b = document.createElement('button'); b.textContent = botao.texto;
        b.style.cssText = 'padding:10px 16px;border-radius:10px;border:0;background:#4f46e5;color:#fff;font-weight:700;cursor:pointer';
        b.onclick = botao.acao; acao.appendChild(b);
      }
    };
    if (document.body) mostrar(); else document.addEventListener('DOMContentLoaded', mostrar);
  }
  function aviso(txt, erro){
    var mostrar = function(){
      var el = document.getElementById('gqDesktopAviso');
      if (!el) {
        el = document.createElement('div'); el.id = 'gqDesktopAviso';
        el.style.cssText = 'position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:2147483646;padding:10px 16px;border-radius:12px;font:600 13px/1.3 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.4);max-width:92vw';
        document.body.appendChild(el);
      }
      el.style.background = erro ? '#7f1d1d' : '#064e3b'; el.style.color = '#fff'; el.style.border = '1px solid ' + (erro ? '#ef4444' : '#10b981');
      el.textContent = txt; el.style.display = txt ? '' : 'none';
    };
    if (document.body) mostrar(); else document.addEventListener('DOMContentLoaded', mostrar);
  }
  if (!TOKEN) { window.GQ_DESKTOP.online = false; bloquearTela('Abra o GestorQ pelo atalho', 'Por segurança, o GestorQ só funciona quando aberto pelo atalho "GestorQ" da Área de Trabalho ou do Menu Iniciar.'); return; }

  /* Sessão desta janela: o servidor só aceita gravações da janela ativa
     (vale também entre navegadores/perfis diferentes) */
  var SESSAO = '';
  try { SESSAO = oGet.call(ss, 'gqSessao') || ''; } catch(e){}
  if (!/^[0-9a-f]{32}$/.test(SESSAO)) {
    var rnd = new Uint8Array(16); crypto.getRandomValues(rnd);
    SESSAO = Array.prototype.map.call(rnd, function(b){ return ('0' + b.toString(16)).slice(-2); }).join('');
    try { oSet.call(ss, 'gqSessao', SESSAO); } catch(e){}
  }
  function cab(json){ var h = { 'X-GestorQ-Token': TOKEN, 'X-GestorQ-Sessao': SESSAO }; if (json) h['Content-Type'] = 'application/json'; return h; }
  function usarEstaJanela(){ try { oSet.call(ss, 'gqRoubar', '1'); } catch(e){} location.reload(); }
  function outraJanela(){
    window.GQ_DESKTOP.online = false;
    bloquearTela('O GestorQ está aberto em outra janela', 'Para não misturar alterações, só uma janela salva por vez. Feche a outra janela ou clique abaixo para continuar nesta (a outra para de salvar).',
      { texto: 'Usar esta janela', acao: usarEstaJanela });
  }
  var roubar = false; try { roubar = oGet.call(ss, 'gqRoubar') === '1'; oRem.call(ss, 'gqRoubar'); } catch(e){}

  function xhrSync(metodo, url, corpo){
    var x = new XMLHttpRequest();
    x.open(metodo, url, false);
    x.setRequestHeader('X-GestorQ-Token', TOKEN);
    x.setRequestHeader('X-GestorQ-Sessao', SESSAO);
    if (corpo) x.setRequestHeader('Content-Type', 'application/json');
    x.send(corpo ? JSON.stringify(corpo) : null);
    return x;
  }
  function lerDiario(){ try { return JSON.parse(oGet.call(ls, DIARIO) || '{}') || {}; } catch(e){ return {}; } }
  function gravarDiario(d){ try { if (Object.keys(d).length) oSet.call(ls, DIARIO, JSON.stringify(d)); else oRem.call(ls, DIARIO); } catch(e){} }

  /* 1) Reenvia o que ficou pendente da última vez ------------------------ */
  if (roubar) { try { xhrSync('POST', '/api/sessao?assumir=1', {}); } catch(e){} }
  var diario = lerDiario();
  if (Object.keys(diario).length) {
    var pend0 = { set: {}, remove: [], clear: false };
    Object.keys(diario).forEach(function(k){ var v = oGet.call(ls, k); if (diario[k] === 1 && v != null) pend0.set[k] = v; else if (diario[k] === 0) pend0.remove.push(k); });
    try { if (xhrSync('POST', '/api/storage', pend0).status === 200) gravarDiario({}); } catch(e){}
  }

  /* 2) Carrega do banco -------------------------------------------------- */
  var resp = null;
  try { var r = xhrSync('GET', '/api/storage'); if (r.status === 200) resp = JSON.parse(r.responseText); else if (r.status === 401 || r.status === 409) resp = r.status; } catch(e){}
  if (resp === 401) { window.GQ_DESKTOP.online = false; bloquearTela('Acesso expirado', 'Feche esta janela e abra o GestorQ de novo pelo atalho.'); return; }
  if (resp === 409) { outraJanela(); return; }
  if (!resp) { window.GQ_DESKTOP.online = false; bloquearTela('Banco de dados indisponível', 'Não foi possível ler o banco de dados do GestorQ. Feche esta janela e abra o GestorQ de novo pelo atalho.'); return; }
  var dados = resp.chaves || {};
  var temLocal = false; for (var i = 0; i < ls.length; i++) { if (!reservada(ls.key(i))) { temLocal = true; break; } }

  if (!resp.inicializado && temLocal) {
    // Banco novo e esta janela já tem dados: pergunta antes de copiar (nunca sobrescreve sem perguntar)
    if (window.confirm('O banco de dados do GestorQ está vazio, mas este computador tem dados de uma sessão anterior.\n\nCopiar esses dados para o banco?')) {
      var tudo = {}; for (var j = 0; j < ls.length; j++) { var k0 = ls.key(j); if (!reservada(k0)) tudo[k0] = ls.getItem(k0); }
      var ok = false; try { ok = xhrSync('POST', '/api/storage', { set: tudo }).status === 200; } catch(e){}
      if (!ok) { window.GQ_DESKTOP.online = false; bloquearTela('Não foi possível copiar os dados', 'Nada foi apagado. Feche esta janela e tente abrir o GestorQ de novo.'); return; }
      dados = tudo;
    }
  }
  var bloqueadas = {};   // chaves que não couberam no navegador: nunca são enviadas de volta (protege o banco)
  oClr.call(ls);
  Object.keys(dados).forEach(function(k){
    try { oSet.call(ls, k, dados[k]); }
    catch(e){ bloqueadas[k] = 1; console.warn('[GestorQ] sem espaço no navegador para', k); }
  });
  if (Object.keys(bloqueadas).length) aviso('⚠️ Alguns dados são grandes demais para esta janela e ficaram só no banco: ' + Object.keys(bloqueadas).join(', ') + '. Faça um backup e limpe dados antigos.', true);

  /* 3) Envia gravações ---------------------------------------------------- */
  var ativa = true;
  var pend = { set: {}, remove: {}, clear: false }, timer = null, enviando = false;
  function temPend(){ return pend.clear || Object.keys(pend.set).length || Object.keys(pend.remove).length; }
  function agendar(){ if (!timer) timer = setTimeout(enviar, 400); }
  function anotar(k, tipo){ var d = lerDiario(); d[k] = tipo; gravarDiario(d); }
  function pacote(){
    var p = { set: pend.set, remove: Object.keys(pend.remove), clear: pend.clear };
    pend = { set: {}, remove: {}, clear: false };
    return p;
  }
  function devolver(p){
    if (p.clear) pend.clear = true;
    Object.keys(p.set).forEach(function(k){ if (!(k in pend.set) && !(k in pend.remove)) pend.set[k] = p.set[k]; });
    p.remove.forEach(function(k){ if (!(k in pend.set)) pend.remove[k] = 1; });
  }
  function enviar(){
    timer = null;
    if (enviando || !ativa || !temPend()) return;
    enviando = true;
    var p = pacote();
    fetch('/api/storage', { method: 'POST', headers: cab(true), body: JSON.stringify(p) })
      .then(function(res){
        if (res.status === 401) { devolver(p); ativa = false; bloquearTela('Acesso expirado', 'Feche esta janela e abra o GestorQ de novo pelo atalho. As alterações pendentes serão enviadas ao reabrir.'); return; }
        if (res.status === 409) { devolver(p); ativa = false; outraJanela(); return; }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        // banco confirmou: tira do diário só o que foi enviado e não mudou de novo
        var d = lerDiario();
        Object.keys(p.set).forEach(function(k){ if (!(k in pend.set) && !(k in pend.remove)) delete d[k]; });
        p.remove.forEach(function(k){ if (!(k in pend.set) && !(k in pend.remove)) delete d[k]; });
        gravarDiario(d);
        if (!window.GQ_DESKTOP.online) aviso('');
        window.GQ_DESKTOP.online = true;
      })
      .catch(function(){ devolver(p); window.GQ_DESKTOP.online = false; aviso('⚠️ Sem conexão com o banco do GestorQ. As alterações estão guardadas e serão salvas assim que ele voltar.', true); setTimeout(agendar, 3000); })
      .then(function(){ enviando = false; if (temPend() && ativa) agendar(); });
  }
  SP.setItem = function(k, v){
    oSet.call(this, k, v);
    if (this === ls && ativa) { k = String(k); if (reservada(k) || bloqueadas[k]) return; pend.set[k] = String(v); delete pend.remove[k]; anotar(k, 1); agendar(); }
  };
  SP.removeItem = function(k){
    oRem.call(this, k);
    if (this === ls && ativa) { k = String(k); if (reservada(k)) return; delete pend.set[k]; pend.remove[k] = 1; delete bloqueadas[k]; anotar(k, 0); agendar(); }
  };
  SP.clear = function(){
    var d = lerDiario();
    oClr.call(this);
    if (this === ls && ativa) { pend = { set: {}, remove: {}, clear: true }; gravarDiario(d); agendar(); }
  };
  // Ao fechar a janela: tenta enviar o resto (o diário garante o reenvio na próxima abertura)
  window.addEventListener('pagehide', function(){
    if (!ativa) return;
    if (temPend()) {
      var corpo = JSON.stringify(pacote());
      if (corpo.length < 60000) { try { fetch('/api/storage', { method: 'POST', keepalive: true, headers: cab(true), body: corpo }); } catch(e){} }
    }
    // libera a vaga de "janela ativa" (a gravação acima chega antes por ser do mesmo endereço e enviada primeiro)
    try { fetch('/api/sessao/sair', { method: 'POST', keepalive: true, headers: cab(true), body: '{}' }); } catch(e){}
  });

  /* 4) Só uma janela grava por vez ---------------------------------------- */
  function pegarJanela(roubar){
    if (!navigator.locks) return;
    navigator.locks.request('gestorq-janela-ativa', roubar ? { steal: true } : { ifAvailable: true }, function(lock){
      if (!lock) {
        ativa = false;
        bloquearTela('O GestorQ já está aberto em outra janela', 'Para não misturar alterações, use uma janela por vez.',
          { texto: 'Usar esta janela', acao: usarEstaJanela });
        return;
      }
      return new Promise(function(){});   // mantém esta janela como a ativa enquanto estiver aberta
    }).catch(function(){
      // outra janela assumiu: esta para de gravar (o que estava pendente fica no diário)
      ativa = false;
      bloquearTela('O GestorQ foi aberto em outra janela', 'Esta janela parou de salvar. Feche-a e continue na outra.');
    });
  }
  pegarJanela(roubar);

  /* No computador o banco é local. O modo Online (Firebase) só é usado se o
     usuário escolher "Online" na tela de login (a escolha fica salva). */
  try { if (window.GQ_DESKTOP_LOCAL && ls.getItem('appMode') !== 'local') ls.setItem('appMode', 'local'); } catch(e){}
  document.addEventListener('click', function(e){
    var b = e.target && e.target.closest ? e.target.closest('#btnModeCloud,#btnModeLocal') : null; if (!b) return;
    try { if (b.id === 'btnModeCloud') ls.setItem('gqDesktopNuvem', '1'); else ls.removeItem('gqDesktopNuvem'); } catch(x){}
  }, true);

  /* 5) Sinal de vida (mantém o servidor ligado enquanto o app está aberto) */
  setInterval(function(){
    if (!ativa) return;
    fetch('/api/sessao', { method: 'POST', cache: 'no-store', headers: cab(true), body: '{}' }).then(function(r){
      if (r.status === 409) { ativa = false; outraJanela(); return; }
      if (r.ok && !window.GQ_DESKTOP.online) { window.GQ_DESKTOP.online = true; aviso(''); agendar(); }
    }).catch(function(){ window.GQ_DESKTOP.online = false; aviso('⚠️ O servidor do GestorQ parou. Abra o GestorQ de novo pelo atalho — as alterações pendentes serão enviadas.', true); });
  }, 45000);

  /* Service worker não é usado no desktop (evita servir versão antiga em cache) */
  try { if (navigator.serviceWorker) navigator.serviceWorker.register = function(){ return Promise.reject(new Error('desativado no GestorQ Desktop')); }; } catch(e){}

  /* API para outras telas (backup, resumo do banco) */
  window.GQ_DESKTOP.api = function(metodo, rota, corpo){
    return fetch(rota, { method: metodo, headers: cab(true), body: corpo ? JSON.stringify(corpo) : undefined }).then(function(r){ return r.json(); });
  };
  window.GQ_DESKTOP.salvarAgora = enviar;
})();
