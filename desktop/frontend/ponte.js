/* ════════════════════════════════════════════════════════════════════
   GestorQ Desktop — ponte entre o app e o banco de dados
   Roda ANTES de qualquer outro script da página:
   1) carrega todos os dados do banco (SQLite) para o armazenamento do app;
   2) toda gravação do app (localStorage.setItem/removeItem/clear) é
      enviada ao banco em lotes (a cada ~0,4 s) — nada fica só no navegador;
   3) mostra um aviso se o servidor parar de responder.
   ════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var TOKEN = '__GESTORQ_TOKEN__';
  var ls; try { ls = window.localStorage; } catch(e){ return; }
  var SP = Storage.prototype, oSet = SP.setItem, oRem = SP.removeItem, oClr = SP.clear;
  window.GQ_DESKTOP = { versao: '__GESTORQ_VERSAO__', online: true };

  function xhrSync(metodo, url, corpo){
    var x = new XMLHttpRequest();
    x.open(metodo, url, false);
    x.setRequestHeader('X-GestorQ-Token', TOKEN);
    if (corpo) x.setRequestHeader('Content-Type', 'application/json');
    x.send(corpo ? JSON.stringify(corpo) : null);
    return x;
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

  /* 1) Carregar do banco ------------------------------------------------ */
  var dados = null;
  try {
    var r = xhrSync('GET', '/api/storage');
    if (r.status === 200) dados = JSON.parse(r.responseText).chaves || {};
  } catch(e){}
  if (!dados) { window.GQ_DESKTOP.online = false; aviso('⚠️ Não foi possível ler o banco de dados do GestorQ. Feche e abra o app de novo.', true); return; }

  if (!Object.keys(dados).length && ls.length) {
    // Banco novo e o navegador já tinha dados desta mesma origem: envia tudo para o banco.
    var tudo = {}; for (var i = 0; i < ls.length; i++) { var k = ls.key(i); tudo[k] = ls.getItem(k); }
    try { xhrSync('POST', '/api/storage', { set: tudo }); } catch(e){}
  } else {
    oClr.call(ls);
    Object.keys(dados).forEach(function(k){ try { oSet.call(ls, k, dados[k]); } catch(e){ console.warn('[GestorQ] sem espaço para carregar', k); } });
  }

  /* 2) Enviar gravações ------------------------------------------------- */
  var pend = { set: {}, remove: {}, clear: false }, timer = null, enviando = false;
  function temPend(){ return pend.clear || Object.keys(pend.set).length || Object.keys(pend.remove).length; }
  function agendar(){ if (!timer) timer = setTimeout(enviar, 400); }
  function pacote(){
    var p = { set: pend.set, remove: Object.keys(pend.remove), clear: pend.clear };
    pend = { set: {}, remove: {}, clear: false };
    return p;
  }
  function devolver(p){
    // falhou: devolve para a fila sem sobrescrever gravações mais novas
    if (p.clear) pend.clear = true;
    Object.keys(p.set).forEach(function(k){ if (!(k in pend.set) && !(k in pend.remove)) pend.set[k] = p.set[k]; });
    p.remove.forEach(function(k){ if (!(k in pend.set)) pend.remove[k] = 1; });
  }
  function enviar(){
    timer = null;
    if (enviando || !temPend()) return;
    enviando = true;
    var p = pacote();
    fetch('/api/storage', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-GestorQ-Token': TOKEN }, body: JSON.stringify(p) })
      .then(function(res){ if (!res.ok) throw new Error('HTTP ' + res.status); if (!window.GQ_DESKTOP.online) aviso(''); window.GQ_DESKTOP.online = true; })
      .catch(function(){ devolver(p); window.GQ_DESKTOP.online = false; aviso('⚠️ Sem conexão com o banco do GestorQ. As alterações serão salvas assim que ele voltar.', true); setTimeout(agendar, 3000); })
      .then(function(){ enviando = false; if (temPend()) agendar(); });
  }
  SP.setItem = function(k, v){
    oSet.call(this, k, v);
    if (this === ls) { k = String(k); pend.set[k] = String(v); delete pend.remove[k]; agendar(); }
  };
  SP.removeItem = function(k){
    oRem.call(this, k);
    if (this === ls) { k = String(k); delete pend.set[k]; pend.remove[k] = 1; agendar(); }
  };
  SP.clear = function(){
    oClr.call(this);
    if (this === ls) { pend = { set: {}, remove: {}, clear: true }; agendar(); }
  };
  // Ao fechar a janela: envia o que faltar (keepalive mantém o envio mesmo com a página fechando)
  window.addEventListener('pagehide', function(){
    if (!temPend()) return;
    var corpo = JSON.stringify(pacote());
    try { fetch('/api/storage', { method: 'POST', keepalive: corpo.length < 60000, headers: { 'Content-Type': 'application/json', 'X-GestorQ-Token': TOKEN }, body: corpo }); } catch(e){}
  });

  /* No computador o banco é local. O modo Online (Firebase) só é usado se o
     usuário escolher "Online" na tela de login (a escolha fica salva). */
  Object.defineProperty(window, 'GQ_DESKTOP_LOCAL', { configurable: true, get: function(){ try { return ls.getItem('gqDesktopNuvem') !== '1'; } catch(e){ return true; } } });
  try { if (window.GQ_DESKTOP_LOCAL && ls.getItem('appMode') !== 'local') ls.setItem('appMode', 'local'); } catch(e){}
  document.addEventListener('click', function(e){
    var b = e.target && e.target.closest ? e.target.closest('#btnModeCloud,#btnModeLocal') : null; if (!b) return;
    try { if (b.id === 'btnModeCloud') ls.setItem('gqDesktopNuvem', '1'); else ls.removeItem('gqDesktopNuvem'); } catch(x){}
  }, true);

  /* 3) Sinal de vida (mantém o servidor ligado enquanto o app está aberto) */
  setInterval(function(){
    fetch('/api/health', { cache: 'no-store' }).then(function(r){ if (r.ok && !window.GQ_DESKTOP.online) { window.GQ_DESKTOP.online = true; aviso(''); agendar(); } })
      .catch(function(){ window.GQ_DESKTOP.online = false; aviso('⚠️ O servidor do GestorQ parou. Feche esta janela e abra o GestorQ de novo pelo atalho.', true); });
  }, 60000);

  /* Service worker não é usado no desktop (evita servir versão antiga em cache) */
  try { if (navigator.serviceWorker) navigator.serviceWorker.register = function(){ return Promise.reject(new Error('desativado no GestorQ Desktop')); }; } catch(e){}

  /* API para outras telas (backup, resumo do banco) */
  window.GQ_DESKTOP.api = function(metodo, rota, corpo){
    return fetch(rota, { method: metodo, headers: { 'Content-Type': 'application/json', 'X-GestorQ-Token': TOKEN }, body: corpo ? JSON.stringify(corpo) : undefined }).then(function(r){ return r.json(); });
  };
  window.GQ_DESKTOP.salvarAgora = enviar;
})();
