/* Listener em tempo real de funcionários + Storage (upload de imagens)
   Parte 4 de 14 do antigo app.v2.js (dividido na Etapa de modularização).
   Linhas originais: 1117-1368. Nenhuma linha de código foi alterada nesta divisão. */

/* ======= LISTENER REALTIME (FUNCIONÁRIOS) ======= */
// Mantém a lista de funcionários sempre sincronizada com o Firestore, evitando "sumir" ao atualizar.
let _perfisUnsub = null;

function stopPerfisListener(){
  try { if (typeof _perfisUnsub === 'function') _perfisUnsub(); } catch(_) {}
  _perfisUnsub = null;
}

function startPerfisListener(ownerId){
  try{
    if (!window.db || !ownerId) return;
    stopPerfisListener();

    _perfisUnsub = db.collection(PERFIS_COLLECTION)
      .where('ownerId','==', String(ownerId))
      .onSnapshot((snap)=>{
        const remotos = [];
        snap.forEach(doc=>{
          const d = doc.data() || {};
          d.id = doc.id; // nunca confiar no campo id gravado dentro do documento
          remotos.push(d);
        });

        // (Opcional) garante o próprio admin no array
        const uidStr = (auth && auth.currentUser && auth.currentUser.uid) ? String(auth.currentUser.uid) : '';
        if (uidStr && !remotos.some(p => String(p.id) === uidStr)){
          const adminLocal = (state.perfis || []).find(p => String(p.id) === uidStr);
          if (adminLocal) remotos.push(adminLocal);
        }

        state.perfis = remotos;
        try { if (typeof renderPerfis === 'function') renderPerfis(); } catch(_) {}
        try { if (typeof renderFuncionarios === 'function') renderFuncionarios(); } catch(_) {}
        try { if (typeof renderUsuarios === 'function') renderUsuarios(); } catch(_) {}
      }, (err)=>{
        console.error('Erro no listener de perfis_usuarios', err);
      });
  }catch(e){
    console.error('Erro ao iniciar listener de perfis_usuarios', e);
  }
}

/* ======= STORAGE ======= */
function loadPerfis(){
  // Cloud-first: não carregamos mais a lista de funcionários do localStorage.
  // Mantemos apenas um cache opcional, mas a fonte de verdade é o Firestore.
  state.perfis = [];
  try { renderPerfis(); } catch(_) {}

  // Se já houver usuário autenticado, carregamos a base do Firestore.
  try {
    if (auth && auth.currentUser && auth.currentUser.uid) {
      // mantém a lista atualizada em tempo real
      startPerfisListener(String(auth.currentUser.uid));
    }
  } catch(e) { console.error(e); }

  // Trata retorno do login com Google via redirect
  try {
    if (auth && typeof auth.getRedirectResult === 'function') {
      auth.getRedirectResult().then(function(cred){
        if (cred && cred.user && cred.user.email) {
          const emailLower = cred.user.email.toLowerCase();
          integrarUsuarioAoSistema(emailLower);
        }
      }).catch(function(e){
        console.error(e);
      });
    }
  } catch(e) {
    console.error(e);
  }


}
function savePerfis(){
  // Cloud-only: a lista de funcionários deve ficar centralizada na nuvem.
  try { syncPerfisToFirestore(); } catch(e){ console.error(e); }
}

function ensurePerfilData(pid){
  // Cloud-only: não cria nada em localStorage.
  // Mantido apenas para compatibilidade com chamadas antigas.
  return;
}
async function loadPerfil(pid){
  // Cloud-only: pid é ignorado; usamos o usuário logado (uid).
  try{
    if(!auth || !auth.currentUser){
      throw new Error('Usuário não autenticado.');
    }
    const uidStr = String(auth.currentUser.uid);
    state.perfilId = uidStr;

    // ===== PERFIL (ROLE) =====
    // Agora o papel (admin x funcionário) vem do Firestore.
    // Regras:
    // 1) Se existir doc perfis_usuarios/{uid} -> usamos ele.
    // 2) Se não existir, o acesso é NEGADO (nunca herdamos perfil de outro uid
    //    por coincidência de e-mail; o cadastro de admin cria o próprio perfil).
    let meuPerfil = null;
    try {
      if (window.db) {
        const refUid = db.collection(PERFIS_COLLECTION).doc(uidStr);
        const docUid = await refUid.get();
        if (docUid && docUid.exists) {
          meuPerfil = Object.assign({}, docUid.data() || {}, { id: uidStr });
        }

        if (!meuPerfil) {
          // Segurança: login existente sem perfil NÃO recebe privilégio administrativo.
          try { await auth.signOut(); } catch(_) {}
          document.body.classList.add('only-login');
          if ($('#loginCard')) $('#loginCard').classList.remove('hidden');
          if ($('#sidebar')) $('#sidebar').classList.add('hidden');
          setAuthMessage('Seu usuário não possui acesso ativo a este estabelecimento. Entre em contato com o administrador.');
          return;
        }
      }
    } catch(e) {
      console.error('Erro ao resolver perfil do usuário', e);
    }

    
// Bloqueio por inativação (modo recomendado: Firestore).
// Se o perfil estiver inativo, derruba o login imediatamente e impede acesso ao app.
if (meuPerfil && (meuPerfil.ativo === false || String(meuPerfil.situacao || '').toLowerCase() === 'inativo')) {
  try { await auth.signOut(); } catch(_) {}
  document.body.classList.add('only-login');
  if ($('#loginCard')) $('#loginCard').classList.remove('hidden');
  if ($('#sidebar')) $('#sidebar').classList.add('hidden');
  setAuthMessage('Seu acesso está INATIVO. Fale com o administrador para reativar.');
  return;
}

// Carrega a lista de perfis visíveis para este login:
    // - Admin: todos os perfis do ownerId (inclui o próprio)
    // - Funcionário: apenas o próprio perfil
    state.perfis = [];
    if (meuPerfil) {
      if (meuPerfil.isAdmin) {
        // inicia listener realtime para a lista de funcionários
        startPerfisListener(meuPerfil.ownerId || uidStr);
        await syncPerfisFromFirestore({ ownerId: meuPerfil.ownerId || uidStr });
        // garante que o próprio admin está na lista
        if (!(state.perfis || []).some(p => String(p.id) === uidStr)) {
          state.perfis = (state.perfis || []).concat([meuPerfil]);
        }
      } else {
        // Funcionário também recebe a lista do próprio estabelecimento para
        // seleção de responsável, sem ganhar poderes administrativos.
        await syncPerfisFromFirestore({ ownerId: meuPerfil.ownerId });
        if (!(state.perfis||[]).some(p=>String(p.id)===uidStr)) state.perfis=(state.perfis||[]).concat([meuPerfil]);
      }
    }

    // dados pessoais privados do próprio usuário (com migração automática do legado)
    try { await carregarPrivadoDoUsuario(uidStr, meuPerfil); }
    catch (e) { console.error('Dados pessoais privados', e); state.privado = state.privado || {}; }

    // carrega do Firestore (cfg + subcoleções)
    const dataOwnerId = String((meuPerfil && meuPerfil.ownerId) || (meuPerfil && meuPerfil.isAdmin ? uidStr : ''));
    if (!dataOwnerId) throw new Error('Perfil sem ownerId válido.');
    const loaded = await loadCloudState(dataOwnerId);
    state.cfg = Object.assign({}, state.cfg, loaded.cfg || {});
    state.data = loaded.data || {clientes:[],servicos:[],agenda:[],tx:[],fiados:[],an:[],usuarios:[],backups:[], lastLogin:''};

    // Migração/garantia de campos
    if (!Array.isArray(state.data.fiados)) state.data.fiados = [];

    // garante autosave reativo
    attachCloudAutosave();

    applyTheme(state.cfg.tema);
    // Novo padrão de tamanho = 85%. Uma única vez, qualquer valor antigo salvo (90%, 95%...)
    // volta para 85%. Depois disso, o tamanho que a pessoa escolher em Configurações é respeitado.
    if (!state.cfg.zoomPadrao85){
      state.cfg.appZoom = 85;
      state.cfg.zoomPadrao85 = true;
    }
    applyAppZoom(state.cfg.appZoom || 85);
    if ($('#cfgZoom')) $('#cfgZoom').value = String(state.cfg.appZoom || 85);

    // aplicar UI config
    if ($('#cfgEstudio')) $('#cfgEstudio').value = state.cfg.estudio||'';
    if ($('#cfgMoeda'))   $('#cfgMoeda').value   = state.cfg.moeda||'BRL';
    if ($('#cfgTema'))    $('#cfgTema').value    = state.cfg.tema||'auto';
    if (typeof sincronizarCampoAcento === 'function') sincronizarCampoAcento();
    if ($('#cfgWpp24'))   $('#cfgWpp24').checked = !!state.cfg.wpp24;
    if ($('#cfgWpp2'))    $('#cfgWpp2').checked  = !!state.cfg.wpp2;
    if ($('#cfgAutoBackup')) $('#cfgAutoBackup').checked = !!state.cfg.autoBackup;
    if ($('#cfgMsgWpp'))  $('#cfgMsgWpp').value = state.cfg.msgWpp||'';
    if ($('#cfgMsgWppConcluido')) $('#cfgMsgWppConcluido').value = state.cfg.msgWppConcluido||'';
    if ($('#cfgMsgWppCancelado')) $('#cfgMsgWppCancelado').value = state.cfg.msgWppCancelado||'';
    if ($('#cfgPixChave')) $('#cfgPixChave').value = state.cfg.pixChave||'';

    if ($('#corAg') && state.cfg.cores) $('#corAg').value = state.cfg.cores.ag;
    if ($('#corCo') && state.cfg.cores) $('#corCo').value = state.cfg.cores.co;
    if ($('#corCa') && state.cfg.cores) $('#corCa').value = state.cfg.cores.ca;
    if (state.cfg.cores){
      document.documentElement.style.setProperty('--cor-ag', state.cfg.cores.ag);
      document.documentElement.style.setProperty('--cor-co', state.cfg.cores.co);
      document.documentElement.style.setProperty('--cor-ca', state.cfg.cores.ca);
    }

    document.body.classList.remove('only-login');
    const userBoxEl = $('#userBox');
    if (userBoxEl) userBoxEl.classList.remove('hidden');

    const userRoleEl = $('#userRole');
    if (userRoleEl) {
      const pa = getPerfilAtual();
      userRoleEl.textContent = (pa && pa.isAdmin) ? 'Administrador' : 'Funcionário';
    }

    renderMeuUsuario();
    renderSidebarPerfil();

    if ($('#loginCard')) $('#loginCard').classList.add('hidden');
    if ($('#sidebar')) $('#sidebar').classList.remove('hidden');

    if ($('#tab-dashboard') && !document.querySelector('.tabpane.show')) {
      // Após o login, a tela inicial deve sempre ser o Dashboard
      // (Visão Geral), não a última aba usada.
      $('#tab-dashboard').classList.add('show');
      $('#tab-dashboard').classList.add('active');
      $$('#navMenu .menu-item').forEach(b=>b.classList.remove('active'));
      const menuDashboard = document.querySelector('#navMenu .menu-item[data-tab="dashboard"]');
      if (menuDashboard) menuDashboard.classList.add('active');
    }

    // permissões: como cada login é dono de si, podemos manter abas liberadas
    try { aplicarPermissoesPerfil(); } catch(e){}

    state.data.lastLogin = new Date().toISOString();
    scheduleCloudSync(50);

    refreshAll();
    refreshSystemStats();
    refreshDbStatus();
  }catch(e){
    console.error(e);
    setAuthMessage('Erro ao carregar seus dados na nuvem. Verifique conexão e regras do Firestore.');
  }
}
function savePerfil(){
  // Cloud-only: agenda persistência na nuvem
  scheduleCloudSync();
}

