if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}

document.addEventListener("DOMContentLoaded", () => {
  const header = document.querySelector(".app-header");
  const wrap = document.querySelector(".wrap");
  function fixPadding() {
    if (!header || !wrap) return;
    const h = header.offsetHeight;
    wrap.style.paddingTop = (h + 8) + "px";
  }
  fixPadding();
  window.addEventListener("resize", fixPadding);
});

document.addEventListener('DOMContentLoaded', () => {
  const busca = document.getElementById('buscaAgenda');
  const filtros = document.getElementById('agFiltrosRapidosBusca');
  if (!busca || !filtros) return;

  const abrir = () => { filtros.classList.add('ag-busca-aberta'); document.body.classList.add('agenda-busca-aberta'); };
  const fechar = (ev) => {
    if (busca.contains(ev.target) || filtros.contains(ev.target)) return;
    filtros.classList.remove('ag-busca-aberta');
    document.body.classList.remove('agenda-busca-aberta');
  };

  busca.addEventListener('focus', abrir);
  busca.addEventListener('click', abrir);
  document.addEventListener('pointerdown', fechar);
});
