/* Autofill de login (Chrome/Safari)
   Parte 14 de 14 do antigo app.v2.js (dividido na Etapa de modularização).
   Linhas originais: 6144-6178. Nenhuma linha de código foi alterada nesta divisão. */

/* ======= LOGIN AUTOFILL ======= */
window.addEventListener('load', ()=>{
  // Cloud-first: não fazemos autofill baseado em perfis locais.
});


// Observação: o ajuste dinâmico de espaçamento para o cabeçalho fixo
// (padding-top de .wrap) agora é feito de forma robusta por
// initAppHeaderHeightSync()/syncAppHeaderHeight() (ver início deste
// arquivo), usando ResizeObserver para nunca ficar desatualizado —
// substituindo o cálculo único e antecipado que havia aqui antes.


// ===== Config Modals (Notificações / Cores / Ações / Segurança) =====
function openCfgModal(id){
  const el = document.getElementById(id);
  if(!el) return;
  el.classList.remove('hidden');
}
function closeCfgModal(id){
  const el = document.getElementById(id);
  if(!el) return;
  el.classList.add('hidden');
}
function initCfgModals(){
  document.querySelectorAll('[data-open]').forEach(btn=>{
    btn.addEventListener('click', ()=> openCfgModal(btn.getAttribute('data-open')));
  });
  document.querySelectorAll('[data-close]').forEach(btn=>{
    btn.addEventListener('click', ()=> closeCfgModal(btn.getAttribute('data-close')));
  });
}

// ensure init runs
document.addEventListener('DOMContentLoaded', initCfgModals);