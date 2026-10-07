/* Tamanho do app (zoom) + ajuste de layout do cabeçalho fixo
   Parte 5 de 14 do antigo app.v2.js (dividido na Etapa de modularização).
   Linhas originais: 1369-1418. Nenhuma linha de código foi alterada nesta divisão. */

/* ======= Tamanho geral do app (zoom) ======= */
function applyAppZoom(pct){
  const n = Number(pct);
  const val = (isFinite(n) && n > 0) ? (n/100) : 0.85;
  document.documentElement.style.setProperty('--app-zoom', val);
}

/* ======= Layout: altura do cabeçalho fixo =======
   O cabeçalho (.app-header) é "position: fixed", então o conteúdo
   abaixo dele (.wrap) precisa de um padding-top exatamente igual à
   altura real do cabeçalho — senão a primeira linha do conteúdo
   (ex.: "VISÃO GERAL" no topo do dashboard) fica escondida atrás do
   cabeçalho vermelho em repouso, e só aparece durante o "elástico" do
   scroll no iOS quando o dedo arrasta a tela para baixo.
   Antes esse cálculo era feito uma única vez no DOMContentLoaded, cedo
   demais (antes das fontes/ícones terminarem de carregar), então o
   padding ficava menor do que o cabeçalho realmente renderizado depois.
   Agora usamos um ResizeObserver, que mantém o espaçamento sempre
   sincronizado com o tamanho real do cabeçalho, em qualquer momento. */
function syncAppHeaderHeight(){
  try{
    const header = document.querySelector('.app-header');
    if (!header) return;
    const h = header.offsetHeight || 0;
    if (h > 0){
      document.documentElement.style.setProperty('--app-header-h', h + 'px');
      const wrap = document.querySelector('.wrap');
      if (wrap) wrap.style.paddingTop = h + 'px';
    }
  }catch(e){ /* noop */ }
}
function initAppHeaderHeightSync(){
  try{
    const header = document.querySelector('.app-header');
    if (!header) return;
    syncAppHeaderHeight();
    if (window.__appHeaderRO) return; // evita observers duplicados
    if (typeof ResizeObserver !== 'undefined'){
      const ro = new ResizeObserver(()=> syncAppHeaderHeight());
      ro.observe(header);
      window.__appHeaderRO = ro;
    }
    // Reforça o cálculo após fontes/imagens carregarem, quando o
    // ResizeObserver não estiver disponível (navegadores muito antigos).
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncAppHeaderHeight).catch(()=>{});
    window.addEventListener('load', syncAppHeaderHeight);
  }catch(e){ /* noop */ }
}

