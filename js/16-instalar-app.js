/* Botão "Baixar app": aparece só quando o app é aberto pelo navegador
   (fora do app instalado na tela inicial). Balança no canto da tela;
   ao tocar, instala (Android/Chrome) ou mostra o passo a passo (iPhone). */
(function(){
  function instalado(){
    return (window.navigator.standalone === true) ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }
  if (instalado()) return;

  const ua = navigator.userAgent || '';
  const ehIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let promptInstalar = null;

  window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); promptInstalar = e; });
  window.addEventListener('appinstalled', ()=>{ remover(); });

  function remover(){
    ['btnInstalarApp','instalarAppSheet'].forEach(id=>{ const el = document.getElementById(id); if (el) el.remove(); });
  }

  function abrirPassos(){
    if (document.getElementById('instalarAppSheet')) return;
    const passos = ehIOS
      ? `<li>Toque no botão <b>Compartilhar</b> <i class="fa-solid fa-arrow-up-from-bracket"></i> do navegador.</li>
         <li>Role e toque em <b>Adicionar à Tela de Início</b>.</li>
         <li>Toque em <b>Adicionar</b>. O ícone do 2letters aparece na tela inicial.</li>`
      : `<li>Abra o menu do navegador (<b>⋮</b>).</li>
         <li>Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</li>
         <li>Confirme. O ícone do 2letters aparece na tela inicial.</li>`;
    const d = document.createElement('div');
    d.id = 'instalarAppSheet';
    d.innerHTML = `<div class="ia-backdrop"></div>
      <div class="ia-card" role="dialog" aria-modal="true">
        <h3>Baixar o app</h3>
        <p>Instale o 2letters na tela inicial do celular para abrir como um aplicativo.</p>
        <ol>${passos}</ol>
        <button type="button" class="btn btn-secondary" id="iaFechar">Entendi</button>
      </div>`;
    document.body.appendChild(d);
    const fechar = ()=> d.remove();
    d.querySelector('.ia-backdrop').onclick = fechar;
    d.querySelector('#iaFechar').onclick = fechar;
  }

  async function aoTocar(){
    if (promptInstalar){
      try{
        promptInstalar.prompt();
        await promptInstalar.userChoice;
      }catch(e){ /* noop */ }
      promptInstalar = null;
      return;
    }
    abrirPassos();
  }

  function criar(){
    try{ if (sessionStorage.getItem('iaOculto') === '1') return; }catch(e){}
    if (document.getElementById('btnInstalarApp')) return;
    const w = document.createElement('div');
    w.id = 'btnInstalarApp';
    w.innerHTML = `<button type="button" class="ia-main"><i class="fa-solid fa-download"></i><span>Baixar app</span></button>
      <button type="button" class="ia-x" aria-label="Fechar">✕</button>`;
    document.body.appendChild(w);
    w.querySelector('.ia-main').onclick = aoTocar;
    w.querySelector('.ia-x').onclick = ()=>{
      try{ sessionStorage.setItem('iaOculto','1'); }catch(e){}
      w.remove();
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', criar);
  else criar();
})();
