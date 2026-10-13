/* GestorQ Desktop — cartão "Banco de dados" na página Configurações */
(function(){
  'use strict';
  if (!window.GQ_DESKTOP || !window.GQ_DESKTOP.api) return;
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
  function aviso(m, t){ try { (window.showNotification || alert)(m, t || 'info'); } catch(e){} }
  var NOMES = { kv: 'Chaves do app', perdas: 'Perdas', vendas: 'Vendas', vencidos: 'Vencidos', acoes: 'Pendências/ações', temperaturas: 'Temperaturas', destinos: 'Destinos', usuarios: 'Usuários' };

  function render(card){
    card.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><h3 style="margin:0;font-size:1rem">🖥️ GestorQ Desktop — banco de dados</h3><span style="font-size:.75rem;opacity:.75">versão ' + esc(window.GQ_DESKTOP.versao) + '</span></div><p style="font-size:.8rem;opacity:.8;margin:6px 0 10px">Carregando…</p>';
    window.GQ_DESKTOP.api('GET', '/api/resumo').then(function(r){
      var t = r.tabelas || {};
      card.querySelector('p').outerHTML =
        '<p style="font-size:.8rem;opacity:.85;margin:6px 0 10px">Todos os dados ficam no arquivo <b>gestorq.db</b> (SQLite) em <code style="word-break:break-all">' + esc(r.dados) + '</code>. Backup automático todo dia (30 dias guardados) na subpasta <b>backups</b>.</p>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:12px">' +
        Object.keys(NOMES).map(function(k){ return '<div style="border:1px solid var(--gq-border,#334155);border-radius:10px;padding:8px 10px"><div style="font-size:.68rem;opacity:.75;text-transform:uppercase;font-weight:800">' + NOMES[k] + '</div><div style="font-size:1.15rem;font-weight:800">' + (Number(t[k]) || 0).toLocaleString('pt-BR') + '</div></div>'; }).join('') + '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="gq-btn pri" data-gqd="backup">💾 Fazer backup agora</button><button type="button" class="gq-btn" data-gqd="atualizar">↻ Atualizar</button><button type="button" class="gq-btn" data-gqd="sair">⏻ Encerrar servidor</button></div>' +
        '<p style="font-size:.74rem;opacity:.7;margin-top:10px">Para relatórios fora do app: o banco tem as tabelas perdas, vendas, vencidos, acoes, temperaturas, destinos e usuarios, e as visões vw_perdas_mes_setor e vw_quebra_produto_mes (abra com DB Browser for SQLite, Excel/Power BI via ODBC ou Python).</p>';
    }).catch(function(){ card.querySelector('p').textContent = 'Não foi possível consultar o banco agora.'; });
  }
  function onClick(e){
    var b = e.target.closest('[data-gqd]'); if (!b) return;
    var a = b.getAttribute('data-gqd'), card = document.getElementById('gqDesktopCard');
    if (a === 'atualizar') return render(card);
    if (a === 'backup') {
      if (window.GQ_DESKTOP.salvarAgora) window.GQ_DESKTOP.salvarAgora();
      setTimeout(function(){ window.GQ_DESKTOP.api('POST', '/api/backup', {}).then(function(r){ aviso(r.ok ? '✅ Backup criado: ' + r.arquivo : '❌ Falha no backup.', r.ok ? 'success' : 'danger'); }); }, 600);
    }
    if (a === 'sair') {
      if (!confirm('Encerrar o servidor do GestorQ? A janela do app deixará de salvar até ser aberta de novo pelo atalho.')) return;
      if (window.GQ_DESKTOP.salvarAgora) window.GQ_DESKTOP.salvarAgora();
      setTimeout(function(){ window.GQ_DESKTOP.api('POST', '/api/sair', {}).then(function(){ aviso('Servidor encerrado. Pode fechar a janela.', 'info'); }).catch(function(){}); }, 800);
    }
  }
  setInterval(function(){
    var pg = document.getElementById('pageConfig'); if (!pg || !pg.getClientRects().length) return;
    if (document.getElementById('gqDesktopCard')) return;
    var card = document.createElement('div'); card.id = 'gqDesktopCard'; card.className = 'card gq-section';
    card.style.marginBottom = '14px';
    card.addEventListener('click', onClick);
    var alvo = pg.querySelector('.module-shell') || pg;
    alvo.insertBefore(card, alvo.firstChild);
    render(card);
  }, 1000);
})();
