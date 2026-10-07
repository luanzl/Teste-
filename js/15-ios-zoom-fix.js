/* Rede de segurança contra o "zoom travado" do iPhone.
   A causa do zoom foi corrigida no CSS (fonte dos campos compensada pelo zoom do
   app, ver 03-auth-login.css). Aqui fica só um plano B: se mesmo assim a página
   ficar ampliada depois de digitar num campo, volta para o tamanho normal
   sozinha — sem precisar abrir modal e fazer pinça. Não mexe em zoom que a pessoa
   fez de propósito (só age logo após sair de um campo de texto). */
(function(){
  const vv = window.visualViewport;
  const vp = document.getElementById('viewport');
  if(!vv || !vp) return;
  const ehCampo = el => !!el && el.matches && el.matches('input, textarea, select');

  function resetarZoom(){
    if(vv.scale <= 1.02) return;
    const original = vp.getAttribute('content') || 'width=device-width,initial-scale=1';
    const cover = /viewport-fit=cover/.test(original) ? ',viewport-fit=cover' : '';
    // Travar min/max em 1 por um instante faz o Safari voltar para 100%; depois restaura.
    vp.setAttribute('content', 'width=device-width,initial-scale=1,maximum-scale=1,minimum-scale=1' + cover);
    setTimeout(()=> vp.setAttribute('content', original), 400);
  }

  document.addEventListener('focusout', e=>{
    if(!ehCampo(e.target)) return;
    setTimeout(()=>{ if(!ehCampo(document.activeElement)) resetarZoom(); }, 300);
  });
})();
