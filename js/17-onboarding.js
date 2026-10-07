/* Onboarding interativo — tutorial da primeira abertura.
   - Abre sozinho uma única vez por usuário (neste aparelho), logo após o login.
   - Destaca cada elemento da interface com um balão explicativo.
   - Botões: Voltar · Avançar · Pular tutorial · Concluir.
   - Concluir ou pular marca como visto e o tutorial não aparece mais sozinho.
   - Pode ser reaberto em Configurações › "Ver tutorial do app".
   Depende só do que já existe no app: auth, v51OpenTab e os elementos do index.html. */
(function(){
  'use strict';

  var PREFIXO = '2l_onboarding_v1:';
  var vistoMemoria = {};          // plano B se o navegador bloquear o localStorage
  var ativo = false;
  var manual = false;
  var passos = [];
  var idx = 0;
  var raiz = null, spot = null, tip = null, btnPrim = null, btnVoltar = null, btnPular = null;
  var timerAuto = null, timerPos = null, rafPos = 0;

  /* ---------- Conteúdo dos passos ---------- */
  function menuConfigVisivel(){
    var m = document.querySelector('#navMenu .menu-item[data-tab="config"]');
    return !!m && !m.classList.contains('hidden');
  }

  var TODOS = [
    {
      icone: 'fa-hand-sparkles',
      titulo: 'Bem-vindo ao 2letters!',
      texto: function(){ return 'Em menos de um minuto você conhece o essencial do app. Vamos lá?'; }
    },
    {
      alvo: '#tab-dashboard .m8-grid',
      icone: 'fa-chart-pie',
      titulo: 'Seu painel do dia',
      texto: function(){ return 'Acompanhe a <b>receita de hoje</b>, os <b>atendimentos</b>, o total de <b>clientes</b> e os <b>pendentes</b>. Toque em um cartão para abrir a tela correspondente.'; }
    },
    {
      alvo: '#dpTabBar .tb-item[data-tab="agenda"]',
      icone: 'fa-calendar-check',
      titulo: 'Agenda',
      texto: function(){ return 'Veja os horários, crie agendamentos e acompanhe o status de cada um: <b>pendente</b>, <b>concluído</b> ou <b>cancelado</b>.'; }
    },
    {
      alvo: '#dpTabFab',
      icone: 'fa-plus',
      titulo: 'Ações rápidas',
      texto: function(){ return 'O botão <b>+</b> cria um novo agendamento, cliente ou serviço em um toque. Os atalhos podem ser personalizados.'; }
    },
    {
      alvo: '#dpTabBar .tb-item[data-tab="clientes"]',
      icone: 'fa-users',
      titulo: 'Clientes',
      texto: function(){ return 'Cadastre e encontre seus clientes em um só lugar.'; }
    },
    {
      alvo: '#btnToggleSaldo',
      icone: 'fa-bell',
      titulo: 'Notificações',
      texto: function(){ return 'Avisos e alertas do app aparecem aqui. O pontinho no sino indica que há novidades não lidas.'; }
    },
    {
      alvo: '#dpTbMenu',
      icone: 'fa-bars',
      titulo: 'Menu',
      texto: function(){ return 'Abre o menu lateral com as demais áreas do app, como <b>Financeiro</b>, <b>Serviços</b> e <b>Anamnese</b>, conforme o seu acesso.'; }
    },
    {
      icone: 'fa-circle-check',
      titulo: 'Tudo pronto!',
      texto: function(){
        return menuConfigVisivel()
          ? 'Agora é só começar. Para rever este tutorial quando quiser, vá em <b>Menu › Config › Ver tutorial do app</b>.'
          : 'Agora é só começar. Bom trabalho!';
      }
    }
  ];

  /* ---------- Persistência (por usuário, neste aparelho) ---------- */
  function uidAtual(){
    try{
      if (typeof auth !== 'undefined' && auth && auth.currentUser && auth.currentUser.uid) return String(auth.currentUser.uid);
    }catch(e){}
    return 'anon';
  }
  function chave(){ return PREFIXO + uidAtual(); }
  function jaVisto(){
    var k = chave();
    if (vistoMemoria[k]) return true;
    try{ return window.localStorage.getItem(k) === '1'; }catch(e){ return false; }
  }
  function marcarVisto(){
    var k = chave();
    vistoMemoria[k] = true;
    try{ window.localStorage.setItem(k, '1'); }catch(e){}
  }

  /* ---------- Utilidades de tela ---------- */
  function visivel(el){
    if (!el) return false;
    if (el.closest('[hidden],.hidden')) return false;
    var cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function limparPopups(){
    // Fecha o menu lateral e a folha de ações rápidas, se estiverem abertos
    var sb = document.getElementById('sidebar'); if (sb) sb.classList.remove('open');
    var ov = document.getElementById('overlay'); if (ov) ov.classList.remove('show');
    var sh = document.getElementById('dpSheet'); if (sh) sh.classList.remove('open');
    var bd = document.getElementById('dpSheetBackdrop'); if (bd) bd.classList.remove('open');
    var fab = document.getElementById('dpTabFab'); if (fab) fab.setAttribute('aria-expanded', 'false');
  }

  function irParaPainel(){
    limparPopups();
    try{ if (typeof v51OpenTab === 'function') v51OpenTab('dashboard'); }catch(e){}
    try{ window.scrollTo(0, 0); }catch(e){}
    try{ if (typeof window.dpTabBarSync === 'function') window.dpTabBarSync(); }catch(e){}
  }

  /* O app usa `html { zoom }` (Tamanho do app). Cada navegador interpreta as medidas de um jeito,
     então medimos como uma caixa de 100px aparece nas coordenadas do getBoundingClientRect
     e trabalhamos sempre nesse mesmo "espaço" (k = fator, W/H = tela). */
  function calibrar(){
    var a = document.createElement('div');
    a.style.cssText = 'position:fixed;left:100px;top:100px;width:100px;height:100px;visibility:hidden;pointer-events:none';
    var b = document.createElement('div');
    b.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;visibility:hidden;pointer-events:none';
    raiz.appendChild(a); raiz.appendChild(b);
    var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    raiz.removeChild(a); raiz.removeChild(b);
    return {
      k: (ra.width / 100) || 1,
      W: rb.width || window.innerWidth,
      H: rb.height || window.innerHeight
    };
  }

  function ajustarCaixa(el, k, l, t, w, h){
    el.style.left = (l / k) + 'px';
    el.style.top = (t / k) + 'px';
    el.style.width = (w / k) + 'px';
    el.style.height = (h / k) + 'px';
  }

  /* ---------- Posicionamento do destaque e do balão ---------- */
  function posicionar(){
    if (!ativo || !raiz) return;
    var p = passos[idx]; if (!p) return;
    var c = calibrar(), k = c.k, W = c.W, H = c.H;
    var m = 12 * k, gap = 14 * k;

    var alvo = p.alvo ? document.querySelector(p.alvo) : null;
    var temAlvo = !!alvo && visivel(alvo);
    raiz.classList.toggle('onb-centered', !temAlvo);

    var r = null;
    if (temAlvo){
      var b = alvo.getBoundingClientRect(), pad = 6 * k, borda = 4 * k;
      var l = Math.max(b.left - pad, borda), t = Math.max(b.top - pad, borda);
      var rr = Math.min(b.right + pad, W - borda), bb = Math.min(b.bottom + pad, H - borda);
      r = { l: l, t: t, w: Math.max(rr - l, 0), h: Math.max(bb - t, 0) };
      ajustarCaixa(spot, k, r.l, r.t, r.w, r.h);
    }

    // Mede o balão e escolhe o lado com mais espaço
    var tb = tip.getBoundingClientRect(), tw = tb.width, th = tb.height;
    var x, y, seta = null, sobrepoe = false;

    if (r){
      var abaixo = H - (r.t + r.h), acima = r.t, precisa = th + gap + m;
      var lado = abaixo >= precisa ? 'abaixo' : (acima >= precisa ? 'acima' : (abaixo >= acima ? 'abaixo' : 'acima'));
      y = lado === 'abaixo' ? (r.t + r.h + gap) : (r.t - gap - th);
      y = Math.min(Math.max(y, m), H - th - m);
      var cx = r.l + r.w / 2;
      x = Math.min(Math.max(cx - tw / 2, m), W - tw - m);
      sobrepoe = !(y + th <= r.t || y >= r.t + r.h || x + tw <= r.l || x >= r.l + r.w);
      if (!sobrepoe){
        var sx = Math.min(Math.max(cx - x - 7 * k, 16 * k), tw - 30 * k);
        seta = { classe: lado === 'abaixo' ? 'top' : 'bottom', left: sx };
      }
    } else {
      x = (W - tw) / 2;
      y = (H - th) / 2;
    }

    tip.style.left = (x / k) + 'px';
    tip.style.top = (y / k) + 'px';

    var elSeta = tip.querySelector('.onb-arrow');
    if (seta){
      elSeta.style.display = '';
      elSeta.className = 'onb-arrow ' + seta.classe;
      elSeta.style.left = (seta.left / k) + 'px';
    } else {
      elSeta.style.display = 'none';
    }
  }

  function agendarPosicao(){
    if (rafPos) return;
    rafPos = window.requestAnimationFrame(function(){ rafPos = 0; posicionar(); });
  }

  /* ---------- Exibição de um passo ---------- */
  function mostrar(i){
    if (!ativo) return;
    raiz.style.visibility = '';
    idx = Math.max(0, Math.min(i, passos.length - 1));
    var p = passos[idx];
    var ultimo = idx === passos.length - 1;

    limparPopups();

    tip.querySelector('.onb-ico i').className = 'fa-solid ' + p.icone;
    tip.querySelector('.onb-title').textContent = p.titulo;
    tip.querySelector('.onb-text').innerHTML = p.texto();   // textos fixos definidos acima
    tip.querySelector('[data-onb-passo]').textContent = 'Passo ' + (idx + 1) + ' de ' + passos.length;
    tip.querySelector('.onb-bar > i').style.width = ((idx + 1) / passos.length * 100) + '%';

    btnVoltar.hidden = idx === 0;
    btnPular.hidden = ultimo;
    btnPrim.textContent = ultimo ? 'Concluir' : 'Avançar';
    btnPrim.setAttribute('data-onb', ultimo ? 'concluir' : 'avancar');

    var alvo = p.alvo ? document.querySelector(p.alvo) : null;
    if (alvo){ try{ alvo.scrollIntoView({ block: 'nearest' }); }catch(e){} }

    posicionar();
    clearTimeout(timerPos);
    timerPos = setTimeout(function(){ if (ativo) posicionar(); }, 320);   // reajusta após animações

    try{ btnPrim.focus({ preventScroll: true }); }catch(e){}
  }

  function avancar(){ if (idx < passos.length - 1) mostrar(idx + 1); }
  function voltar(){ if (idx > 0) mostrar(idx - 1); }

  /* ---------- Montagem / encerramento ---------- */
  function montar(){
    raiz = document.createElement('div');
    raiz.id = 'onbRoot';
    raiz.className = 'onb-centered';
    raiz.style.visibility = 'hidden';   // só aparece quando o primeiro passo estiver pronto
    raiz.innerHTML =
      '<div class="onb-blocker"></div>' +
      '<div class="onb-spot"></div>' +
      '<div class="onb-tip" role="dialog" aria-modal="true" aria-live="polite" aria-labelledby="onbTitulo" aria-describedby="onbTexto">' +
        '<span class="onb-arrow top"></span>' +
        '<div class="onb-eyebrow"><span data-onb-passo></span></div>' +
        '<div class="onb-bar"><i></i></div>' +
        '<div class="onb-ico"><i class="fa-solid fa-hand-sparkles"></i></div>' +
        '<h3 class="onb-title" id="onbTitulo"></h3>' +
        '<p class="onb-text" id="onbTexto"></p>' +
        '<div class="onb-actions">' +
          '<button type="button" class="onb-btn onb-skip" data-onb="pular">Pular tutorial</button>' +
          '<span class="onb-spacer"></span>' +
          '<button type="button" class="onb-btn" data-onb="voltar">Voltar</button>' +
          '<button type="button" class="onb-btn onb-primary" data-onb="avancar">Avançar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(raiz);

    spot = raiz.querySelector('.onb-spot');
    tip = raiz.querySelector('.onb-tip');
    btnPular = raiz.querySelector('[data-onb="pular"]');
    btnVoltar = raiz.querySelector('[data-onb="voltar"]');
    btnPrim = raiz.querySelector('.onb-primary');

    raiz.addEventListener('click', function(e){
      var b = e.target.closest('[data-onb]');
      if (!b) return;
      var acao = b.getAttribute('data-onb');
      if (acao === 'avancar') avancar();
      else if (acao === 'voltar') voltar();
      else if (acao === 'pular') encerrar(true);
      else if (acao === 'concluir') encerrar(true);
    });

    document.addEventListener('keydown', teclado, true);
    window.addEventListener('resize', agendarPosicao);
    window.addEventListener('orientationchange', agendarPosicao);
    window.addEventListener('scroll', agendarPosicao, true);
  }

  function teclado(e){
    if (!ativo) return;
    if (e.key === 'Escape'){ e.preventDefault(); encerrar(true); return; }
    if (e.key === 'ArrowRight'){ e.preventDefault(); if (idx < passos.length - 1) avancar(); return; }
    if (e.key === 'ArrowLeft'){ e.preventDefault(); voltar(); return; }
    if (e.key === 'Tab'){
      // mantém o foco dentro do balão
      var foc = Array.prototype.filter.call(tip.querySelectorAll('button'), function(b){ return !b.hidden; });
      if (!foc.length) return;
      var primeiro = foc[0], ultimo = foc[foc.length - 1];
      if (e.shiftKey && document.activeElement === primeiro){ e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo){ e.preventDefault(); primeiro.focus(); }
      else if (!tip.contains(document.activeElement)){ e.preventDefault(); primeiro.focus(); }
    }
  }

  function encerrar(marcar){
    if (!ativo) return;
    ativo = false;
    clearTimeout(timerPos);
    document.removeEventListener('keydown', teclado, true);
    window.removeEventListener('resize', agendarPosicao);
    window.removeEventListener('orientationchange', agendarPosicao);
    window.removeEventListener('scroll', agendarPosicao, true);
    if (raiz && raiz.parentNode) raiz.parentNode.removeChild(raiz);
    raiz = spot = tip = btnPrim = btnVoltar = btnPular = null;
    if (marcar) marcarVisto();
    // Se foi aberto pelas Configurações, devolve a pessoa para lá
    if (manual){
      try{ if (typeof v51OpenTab === 'function') v51OpenTab('config'); }catch(e){}
    }
  }

  /* ---------- Início ---------- */
  function iniciar(viaConfig){
    if (ativo) return;
    manual = !!viaConfig;
    ativo = true;
    montar();
    irParaPainel();
    // Espera a tela do painel aparecer para só então escolher os passos possíveis
    // (alguns elementos somem conforme o acesso do usuário).
    setTimeout(function(){
      if (!ativo) return;
      passos = TODOS.filter(function(p){ return !p.alvo || visivel(document.querySelector(p.alvo)); });
      mostrar(0);
    }, 160);
  }

  /* ---------- Abertura automática (primeira vez) ---------- */
  function appPronto(){
    if (document.body.classList.contains('only-login')) return false;
    try{ if (typeof auth === 'undefined' || !auth || !auth.currentUser) return false; }catch(e){ return false; }
    var barra = document.getElementById('dpTabBar');
    return !!document.getElementById('tab-dashboard') && !!barra && visivel(barra);
  }

  function agendarAuto(){
    clearTimeout(timerAuto);
    var tentativas = 0;
    (function tentar(){
      if (ativo) return;
      if (document.body.classList.contains('only-login')) return;      // saiu antes de abrir
      if (appPronto()){
        if (!jaVisto()) iniciar(false);
        return;
      }
      if (++tentativas < 20) timerAuto = setTimeout(tentar, 600);
    })();
  }

  var estavaNoLogin = document.body.classList.contains('only-login');
  new MutationObserver(function(){
    var noLogin = document.body.classList.contains('only-login');
    if (noLogin === estavaNoLogin) return;
    estavaNoLogin = noLogin;
    if (noLogin){
      clearTimeout(timerAuto);
      if (ativo) encerrar(false);          // saiu da conta no meio do tutorial: não marca como visto
    } else {
      timerAuto = setTimeout(agendarAuto, 900);   // dá tempo de o app terminar de renderizar após o login
    }
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  if (!estavaNoLogin) timerAuto = setTimeout(agendarAuto, 900);

  /* ---------- Reabrir pelas Configurações ---------- */
  document.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('#btnVerTutorial');
    if (b){ e.preventDefault(); iniciar(true); }
  });

  window.onboarding = {
    iniciar: function(){ iniciar(true); },
    jaVisto: jaVisto
  };
})();
