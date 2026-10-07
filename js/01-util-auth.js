/* Utilitários gerais + Firebase Auth (login)
   Parte 2 de 14 do antigo app.v2.js (dividido na Etapa de modularização).
   Linhas originais: 324-670. Nenhuma linha de código foi alterada nesta divisão. */

/* ======= UTIL ======= */
const $ = (sel, ctx=document)=>ctx.querySelector(sel);
const $$ = (sel, ctx=document)=>Array.from(ctx.querySelectorAll(sel));

/* ===== Segurança de renderização =====
   Qualquer pessoa com acesso ao estabelecimento (funcionários) consegue gravar texto
   arbitrário no Firestore. Por isso, TODO dado que veio da nuvem e vai para um
   innerHTML / atributo HTML passa por escapeHtml(). */
function escapeHtml(str){
  return String(str||'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}
// Só valores conhecidos de status chegam ao HTML / classe CSS.
function safeAgStatus(s){ s = String(s||'agendado'); return (s==='concluido' || s==='cancelado') ? s : 'agendado'; }
function safeFiStatus(s){ s = String(s||'aberto'); return s==='pago' ? 'pago' : 'aberto'; }
// Imagem vinda da nuvem: só data URL de imagem (nunca URL externa).
function isDataImageUrl(v){ return typeof v === 'string' && /^data:image\//i.test(v); }

function setSyncStatus(status, detail=''){
  try{
    let el=document.getElementById('syncStatus');
    if(!el){ el=document.createElement('div'); el.id='syncStatus'; el.setAttribute('aria-live','polite'); Object.assign(el.style,{position:'fixed',right:'12px',bottom:'12px',zIndex:'99999',padding:'7px 10px',borderRadius:'999px',fontSize:'12px',background:'rgba(15,23,42,.92)',color:'#fff',boxShadow:'0 4px 16px rgba(0,0,0,.2)',pointerEvents:'none',transition:'opacity .25s'}); document.body.appendChild(el); }
    el.textContent = status + (detail ? ' — '+detail : '');
    el.title = detail || status;
    el.style.opacity = '1';
    clearTimeout(setSyncStatus._t);
    if (status === 'Salvo') setSyncStatus._t = setTimeout(()=>{ el.style.opacity = '0'; }, 1800);
  }catch(e){ console.error('sync status',e); }
}

// Toast simples (não bloqueia a tela). Se não conseguir injetar, cai no alert.
function toast(msg, ms=2600){
  try{
    let el = document.getElementById('appToast');
    if(!el){
      el = document.createElement('div');
      el.id = 'appToast';
      el.setAttribute('role','status');
      el.setAttribute('aria-live','polite');
      document.body.appendChild(el);
    }
    el.textContent = String(msg||'');
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(()=>el.classList.remove('show'), ms);
  }catch(e){
    try{ alert(msg); }catch(_){}
  }
}
const money = (n, cur='BRL') => new Intl.NumberFormat('pt-BR',{style:'currency',currency:cur}).format(n||0);
const parseMoney = (s) => Number(String(s).replace(/\./g,'').replace(',','.').replace(/[^\d.-]/g,''))||0;
// Gera um identificador único. Usa crypto.randomUUID() (padrão do
// navegador, mais robusto) quando disponível, com um "de volta" para
// o método antigo em navegadores muito antigos que não têm suporte.
const uid = () => {
  try {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
  } catch(e) { /* noop */ }
  return Math.random().toString(36).slice(2)+Date.now().toString(36);
};
const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Datas vindas de input[type="date"] chegam como "YYYY-MM-DD".
// Em Safari/iOS, new Date("YYYY-MM-DD") é interpretado como UTC e pode
// renderizar/salvar um dia anterior dependendo do fuso.
function _isISODateOnly(v){
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}
function _parseISODateOnlyLocal(iso){
  if (!_isISODateOnly(iso)) return new Date(iso);
  const [y,m,d] = iso.split('-').map(n=>parseInt(n,10));
  // meio-dia local evita problemas de DST/UTC
  return new Date(y, (m||1)-1, d||1, 12, 0, 0, 0);
}
function _dateToISODateOnlyLocal(date){
  const d = (date instanceof Date) ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function formatDateBR(v){
  if (!v) return '';
  const d = _isISODateOnly(v) ? _parseISODateOnlyLocal(v) : new Date(v);
  return d.toLocaleDateString('pt-BR');
}

/* ======= FIREBASE AUTH (LOGIN) ======= */
let auth = null;
try {
  if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) {
    auth = firebase.auth();
  }
} catch(e) {
  console.error('Erro ao inicializar Firebase Auth:', e);
}


// Flag simples para controlar quando o usuário está no fluxo de criação de conta.
let modoCriarConta = false;
let modoEsqueciSenha = false;

function translateFirebaseError(code) {
  switch (code) {
    case 'auth/invalid-email':
      return 'E-mail inválido.';
    case 'auth/user-disabled':
      return 'Usuário desativado.';
    case 'auth/user-not-found':
      return 'Usuário não encontrado.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Senha incorreta.';
    case 'auth/requires-recent-login':
      return 'Por segurança, informe sua senha atual para trocar a senha.';
    case 'auth/email-already-in-use':
      return 'Esse e-mail já está em uso.';
    case 'auth/weak-password':
      return 'Senha muito fraca. Use pelo menos 8 caracteres.';
    case 'auth/network-request-failed':
      return 'Falha de rede. Verifique sua conexão com a internet.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.';
    case 'auth/unauthorized-domain':
      return 'Domínio não autorizado no Firebase Auth. Adicione o domínio do app na aba Autenticação > Configurações.';
    case 'auth/operation-not-allowed':
      return 'Tipo de login não habilitado no Firebase. Ative "E-mail/senha" em Autenticação > Método de login.';
    default:
      if (!code) return 'Ocorreu um erro ao autenticar. Tente novamente.';
      return 'Ocorreu um erro ao autenticar (' + code + '). Tente novamente ou fale com o suporte.';
  }
}
function setAuthMessage(msg) {
  const box = document.getElementById('authMessage');
  if (!box) return;
  box.textContent = msg || '';
}


function setAuthMode(mode) {
  const titleEl = document.getElementById('authTitle');
  const subEl = document.getElementById('authSubtitle');
  const groupSenha = document.getElementById('groupSenha');
  const groupConf = document.getElementById('groupConfirmSenha');
  const rememberRow = document.getElementById('authRememberRow');
  const googleBtn = document.getElementById('btnGoogleLogin');
  const forgotActions = document.getElementById('forgotActions');
  const btnEntrar = document.getElementById('btnEntrar');
  const btnCadastro = document.getElementById('btnCadastro');
  const btnResetSenha = document.getElementById('btnResetSenha');
  const btnAlterarSenha = document.getElementById('btnAlterarSenha');
  const btnVoltarLogin = document.getElementById('btnVoltarLogin');
  const authBottom = document.getElementById('authBottom');

  modoCriarConta = (mode === 'signup');
  modoEsqueciSenha = (mode === 'forgot');

  if (!titleEl || !subEl) return;

  if (mode === 'signup') {
    titleEl.textContent = 'Criar conta';
    subEl.textContent = 'Informe um e-mail válido, senha e confirmação de senha para criar sua conta de administrador.';

    if (groupConf) groupConf.classList.remove('hidden');
    if (groupSenha) groupSenha.classList.remove('hidden');
    if (rememberRow) rememberRow.classList.add('hidden');
    if (googleBtn) googleBtn.classList.add('hidden');
    if (forgotActions) forgotActions.classList.add('hidden');

    if (btnEntrar) btnEntrar.classList.add('hidden');
    if (btnCadastro) btnCadastro.classList.remove('hidden');
    if (btnResetSenha) btnResetSenha.classList.add('hidden');
    if (btnAlterarSenha) btnAlterarSenha.classList.add('hidden');
    if (btnVoltarLogin) btnVoltarLogin.classList.remove('hidden');

    if (authBottom) {
      authBottom.innerHTML = 'Use um <strong>e-mail válido</strong> e guarde bem sua senha. Esta conta será o administrador do sistema.';
    }

    const emailInput = document.getElementById('emailLogin');
    const senhaInput = document.getElementById('senhaLogin');
    const confInput  = document.getElementById('senhaLoginConf');
    if (emailInput) emailInput.value = '';
    if (senhaInput) senhaInput.value = '';
    if (confInput) confInput.value = '';
    if (emailInput) emailInput.focus();

    setAuthMessage('');
  } else if (mode === 'forgot') {
    titleEl.textContent = 'Recuperar senha';
    subEl.textContent = 'Informe o e-mail para receber o link de redefinição de senha.';

    if (groupSenha) groupSenha.classList.add('hidden');
    if (groupConf) groupConf.classList.add('hidden');
    if (rememberRow) rememberRow.classList.add('hidden');
    if (googleBtn) googleBtn.classList.add('hidden');
    if (forgotActions) forgotActions.classList.remove('hidden');

    if (btnEntrar) btnEntrar.classList.add('hidden');
    if (btnCadastro) btnCadastro.classList.add('hidden');
    if (btnResetSenha) btnResetSenha.classList.add('hidden');
    if (btnAlterarSenha) btnAlterarSenha.classList.add('hidden');
    if (btnVoltarLogin) btnVoltarLogin.classList.remove('hidden');

    if (authBottom) {
      authBottom.textContent = '';
    }

    setAuthMessage('');
  } else {
    titleEl.textContent = 'Entrar';
    subEl.textContent = 'Use seu e-mail e senha cadastrados.';

    if (groupSenha) groupSenha.classList.remove('hidden');
    if (groupConf) groupConf.classList.add('hidden');
    if (rememberRow) rememberRow.classList.remove('hidden');
    if (googleBtn) googleBtn.classList.remove('hidden');
    if (forgotActions) forgotActions.classList.add('hidden');

    if (btnEntrar) btnEntrar.classList.remove('hidden');
    if (btnCadastro) btnCadastro.classList.remove('hidden');
    if (btnResetSenha) btnResetSenha.classList.remove('hidden');
    if (btnAlterarSenha) btnAlterarSenha.classList.remove('hidden');
    if (btnVoltarLogin) btnVoltarLogin.classList.add('hidden');

    if (authBottom) {
      authBottom.innerHTML = 'Ainda não tem cadastro?<span class="auth-bottom-strong"> Crie sua conta com o botão “Criar conta”.</span>';
    }

    setAuthMessage('');
  }
}



function setAlterarSenhaMessage(msg, isError = true) {
  const box = document.getElementById('altSenhaMsg');
  if (!box) return;
  box.textContent = msg || '';
  if (isError) {
    box.style.color = 'var(--danger)';
  } else {
    box.style.color = '#4ade80';
  }
}

function abrirModalAlterarSenha() {
  const modal = document.getElementById('modalAlterarSenha');
  if (!modal) return;

  const emailLogin = document.getElementById('emailLogin');
  const altEmail = document.getElementById('altEmail');
  const altSenhaAtual = document.getElementById('altSenhaAtual');
  const altSenhaNova = document.getElementById('altSenhaNova');
  const altSenhaNova2 = document.getElementById('altSenhaNova2');

  if (altEmail && emailLogin) {
    altEmail.value = emailLogin.value;
  }
  if (altSenhaAtual) altSenhaAtual.value = '';
  if (altSenhaNova) altSenhaNova.value = '';
  if (altSenhaNova2) altSenhaNova2.value = '';
  setAlterarSenhaMessage('');

  modal.classList.remove('hidden');
}

function fecharModalAlterarSenha() {
  const modal = document.getElementById('modalAlterarSenha');
  if (!modal) return;
  modal.classList.add('hidden');
}

async function salvarNovaSenha() {
  if (!auth) {
    setAlterarSenhaMessage('Firebase Auth não está configurado.');
    return;
  }

  const emailEl = document.getElementById('altEmail');
  const atualEl = document.getElementById('altSenhaAtual');
  const novaEl  = document.getElementById('altSenhaNova');
  const nova2El = document.getElementById('altSenhaNova2');

  if (!emailEl || !atualEl || !novaEl || !nova2El) {
    setAlterarSenhaMessage('Campos de alteração de senha não encontrados.');
    return;
  }

  const email = (emailEl.value || '').trim();
  const senhaAtual = atualEl.value || '';
  const senhaNova  = novaEl.value || '';
  const senhaNova2 = nova2El.value || '';

  if (!email || !senhaAtual || !senhaNova || !senhaNova2) {
    setAlterarSenhaMessage('Preencha todos os campos.');
    return;
  }

  if (senhaNova.length < 8) {
    setAlterarSenhaMessage('A nova senha deve ter pelo menos 8 caracteres.');
    return;
  }

  if (senhaNova !== senhaNova2) {
    setAlterarSenhaMessage('A confirmação da nova senha não confere.');
    return;
  }

  if (senhaNova === senhaAtual) {
    setAlterarSenhaMessage('A nova senha deve ser diferente da atual.');
    return;
  }

  setAlterarSenhaMessage('Atualizando senha...', false);

  try {
    const cred = await auth.signInWithEmailAndPassword(email, senhaAtual);
    const user = cred && cred.user ? cred.user : null;
    if (!user) {
      setAlterarSenhaMessage('Não foi possível autenticar o usuário.');
      return;
    }

    await user.updatePassword(senhaNova);

    setAlterarSenhaMessage('Senha alterada com sucesso. Use a nova senha para entrar.', false);
    setTimeout(() => {
      const modal2 = document.getElementById('modalAlterarSenha');
      if(modal2) modal2.classList.add('hidden');
      const loginSenha = document.getElementById('loginSenha');
      if(loginSenha){ loginSenha.focus(); }
    }, 800);
    await auth.signOut();
  } catch (e) {
    console.error(e);
    const code = e && e.code ? e.code : null;
    setAlterarSenhaMessage(translateFirebaseError(code));
  }
}

// Sincroniza os novos campos de horário (dia inteiro / começa / termina)
// com os campos antigos agData/agHora, para manter compatibilidade.
const syncAgFormHiddenFields = () => {
  const diaInteiroEl = $('#agDiaInteiro');
  if (!diaInteiroEl) return;

  const inicioData = $('#agInicioData') ? ($('#agInicioData').value || todayISO()) : ($('#agData')?.value || todayISO());
  const inicioHora = $('#agInicioHora') ? $('#agInicioHora').value || '' : ($('#agHora')?.value || '');
  const fimData    = $('#agFimData')    ? ($('#agFimData').value    || inicioData) : inicioData;
  const fimHora    = $('#agFimHora')    ? $('#agFimHora').value    || '' : '';

  const diaInteiro = diaInteiroEl.checked;

  if ($('#agData')) $('#agData').value = inicioData;
  if ($('#agHora')) $('#agHora').value = diaInteiro ? '' : inicioHora;

  return { diaInteiro, inicioData, inicioHora, fimData, fimHora };
};


