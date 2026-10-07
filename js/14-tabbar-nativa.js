/* Barra de navegação nativa com botão central (+) — "Opção 5".
   Depende de funções globais já existentes: v51OpenTab, v51DashboardAction,
   dpRunQuickAction, renderListaAtalhosDisponiveis, openCfgModal (12/13). Tudo
   é chamado só no clique, então a ordem de carregamento não é crítica. */
(function(){
  const bar = document.getElementById('dpTabBar');
  const fab = document.getElementById('dpTabFab');
  const sheet = document.getElementById('dpSheet');
  const backdrop = document.getElementById('dpSheetBackdrop');
  if(!bar || !fab || !sheet || !backdrop) return;

  const navItem = tab => document.querySelector('#navMenu .menu-item[data-tab="'+tab+'"]');
  const tabVisivel = tab => { const m = navItem(tab); return !!m && !m.classList.contains('hidden'); };

  /* ---------- Folha ---------- */
  function sheetAberta(){ return sheet.classList.contains('open'); }
  function abrirSheet(){
    if(fab.hidden) return;
    try{ if(typeof renderDpAtalhosExtras === 'function') renderDpAtalhosExtras(); }catch(e){}
    sync();
    sheet.classList.add('open'); backdrop.classList.add('open');
    fab.setAttribute('aria-expanded', 'true');
    sheet.setAttribute('aria-hidden', 'false');
  }
  function fecharSheet(){
    sheet.classList.remove('open'); backdrop.classList.remove('open');
    fab.setAttribute('aria-expanded', 'false');
    sheet.setAttribute('aria-hidden', 'true');
  }

  /* ---------- Sincroniza estado (ativo / permissões) com o menu lateral ---------- */
  function sync(){
    const ativoBtn = document.querySelector('#navMenu .menu-item.active');
    const ativo = ativoBtn ? ativoBtn.dataset.tab : '';

    let algumaAba = false;
    bar.querySelectorAll('.tb-item[data-tab]').forEach(b=>{
      const ok = tabVisivel(b.dataset.tab);
      b.hidden = !ok;
      if(ok) algumaAba = true;
      const on = ok && b.dataset.tab === ativo;
      b.classList.toggle('active', on);
      if(on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    // "Menu" fica destacado quando a tela atual é uma que não tem botão próprio na barra
    const menuBtn = document.getElementById('dpTbMenu');
    if(menuBtn){
      const temBotao = !!bar.querySelector('.tb-item[data-tab="'+ativo+'"]:not([hidden])');
      menuBtn.classList.toggle('active', !!ativo && !temBotao);
    }

    // Ações da folha: some quem o perfil atual não pode acessar (ex.: funcionário sem Financeiro)
    let algumaAcao = false;
    sheet.querySelectorAll('[data-needs]').forEach(el=>{
      const ok = el.dataset.needs.split('|').some(tabVisivel);
      el.hidden = !ok;
      if(ok) algumaAcao = true;
    });
    const extrasTitle = document.getElementById('dpSheetExtrasTitle');
    const extras = document.getElementById('dpSheetExtras');
    if(extrasTitle && extras) extrasTitle.hidden = !extras.querySelector('[data-needs]:not([hidden])');

    fab.hidden = !algumaAcao;
    if(fab.hidden && sheetAberta()) fecharSheet();
    if(typeof atualizaTeclado === 'function') atualizaTeclado();
  }
  window.dpTabBarSync = sync;

  /* ---------- Cliques na barra ---------- */
  bar.addEventListener('click', e=>{
    const b = e.target.closest('.tb-item');
    if(!b) return;
    fecharSheet();
    if(b.id === 'dpTbMenu'){ const h = document.getElementById('btnMenu'); if(h) h.click(); return; }
    const tab = b.dataset.tab; if(!tab) return;
    if(tab === 'agenda' && typeof v51DashboardAction === 'function') v51DashboardAction('agenda');
    else if(typeof v51OpenTab === 'function') v51OpenTab(tab);
    try{ window.scrollTo(0, 0); }catch(_){}
    sync();
  });

  fab.addEventListener('click', ()=>{ sheetAberta() ? fecharSheet() : abrirSheet(); });
  backdrop.addEventListener('click', fecharSheet);
  document.addEventListener('keydown', e=>{ if(e.key === 'Escape' && sheetAberta()) fecharSheet(); });
  // Tocar em qualquer outro lugar (ex.: botão do menu no cabeçalho) também fecha a folha
  document.addEventListener('click', e=>{
    if(sheetAberta() && !e.target.closest('#dpSheet') && !e.target.closest('#dpTabFab')) fecharSheet();
  });

  /* ---------- Cliques na folha ---------- */
  sheet.addEventListener('click', e=>{
    const acao = e.target.closest('[data-dp-action]');
    if(acao){ fecharSheet(); if(typeof dpRunQuickAction === 'function') dpRunQuickAction(acao.dataset.dpAction); return; }
    const nav = e.target.closest('[data-dp-nav]');
    if(nav){ fecharSheet(); if(typeof v51OpenTab === 'function') v51OpenTab(nav.dataset.dpNav); return; }
    if(e.target.closest('#dpSheetCustomize')){
      fecharSheet();
      try{ if(typeof renderListaAtalhosDisponiveis === 'function') renderListaAtalhosDisponiveis(); }catch(_){}
      if(typeof openCfgModal === 'function') openCfgModal('modalAddAtalho');
    }
  });

  /* ---------- Esconde a barra enquanto o teclado está aberto ----------
     Só esconde se houver um campo de texto focado E o teclado realmente aberto
     (visualViewport encolheu). Assim, um foco programático que não abre o teclado
     (comum no iPhone) não faz a barra sumir à toa. Sem visualViewport: confia no foco. */
  const vv = window.visualViewport;
  let baseH = vv ? Math.max(vv.height, window.innerHeight) : 0;
  const campoDeTexto = el => !!el && el.matches && el.matches('textarea, input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=range]):not([type=file]):not([type=color])');
  function atualizaTeclado(){
    const el = document.activeElement;
    const foco = campoDeTexto(el) && el.offsetParent !== null; // campo em aba oculta não conta
    if(vv && !foco) baseH = Math.max(vv.height, window.innerHeight); // recalibra sem teclado
    const tecladoAberto = !vv || (baseH - vv.height) > 120;
    const esconder = foco && tecladoAberto;
    bar.classList.toggle('tb-kb', esconder);
    if(esconder && sheetAberta()) fecharSheet();
  }
  let kbTimer = null;
  const agendaTeclado = ()=>{ clearTimeout(kbTimer); kbTimer = setTimeout(atualizaTeclado, 120); };
  document.addEventListener('focusin', agendaTeclado);
  document.addEventListener('focusout', agendaTeclado);
  if(vv) vv.addEventListener('resize', agendaTeclado);
  window.addEventListener('orientationchange', ()=> setTimeout(atualizaTeclado, 400));

  /* ---------- Observa o menu lateral: cobre todos os pontos do app que mudam a aba ---------- */
  const nav = document.getElementById('navMenu');
  if(nav && typeof MutationObserver !== 'undefined'){
    new MutationObserver(sync).observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'] });
  }
  sync();
  window.addEventListener('load', sync);
})();
