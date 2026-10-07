/* Estado global do app (state, perfis, permissões)
   Parte 3 de 14 do antigo app.v2.js (dividido na Etapa de modularização).
   Linhas originais: 671-1116. Nenhuma linha de código foi alterada nesta divisão. */

/* ======= ESTADO ======= */
let state = {
  perfilId: null,
  perfis: [],
  privado: {},   // dados pessoais SÓ do usuário logado (perfis_usuarios/{uid}/private/perfil)
  mostrarInativos: false,
  visaoDono: { funcionarioId: '__all__', mes: '', ranking: true },
  cfg: {estudio:'2letters', moeda:'BRL', tema:'auto', logoBase64:null,
        wpp24:true, wpp2:true, autoBackup:false,
        msgWpp:'Olá! Lembrando do seu horário em {{DATA}} ({{HORA}}).' ,
        msgWppConcluido:'Obrigado por fechar com a gente em {{DATA}} ({{HORA}})! Qualquer dúvida sobre os cuidados é só chamar.',
        msgWppCancelado:'Seu horário de {{SERVICO}} em {{DATA}} ({{HORA}}) foi cancelado. Se quiser remarcar é só responder aqui.',
        pixChave:'',
        cores:{ag:'#3b82f6', co:'#22c55e', ca:'#ef4444'},
        appZoom: 85 },
  data: {clientes:[], servicos:[], agenda:[], tx:[], fiados:[], an:[], usuarios:[], backups:[], lastLogin:''}
}

let agEditId = null;
;


// Helper para saber se o perfil atual é administrador.
// Regras:
// - Se o campo isAdmin existir, usamos ele.
// - Para compatibilidade com versões antigas, se não tiver isAdmin
//   consideramos o primeiro perfil da lista como administrador.

function isPerfilAdmin(pid){
  const perfis = state.perfis || [];
  const perfil = perfis.find(p => p.id === pid);
  if (!perfil) return false;

  if (typeof perfil.isAdmin === 'boolean') return perfil.isAdmin;

  const hasExplicit = perfis.some(p => typeof p.isAdmin === 'boolean');
  if (hasExplicit) return false;

  return perfis.length > 0 && perfis[0].id === perfil.id;
}


// Retorna o objeto do perfil atualmente logado
function getPerfilAtual(){
  return (state.perfis || []).find(p => p.id === state.perfilId) || null;
}

// UID do estabelecimento que é dono dos dados operacionais.
function getDataOwnerId(){
  const perfil = getPerfilAtual();
  if (perfil && perfil.ownerId) return String(perfil.ownerId);
  if (perfil && perfil.isAdmin && perfil.id) return String(perfil.id);
  return '';
}

function getCurrentActorId(){
  return (auth && auth.currentUser && auth.currentUser.uid) ? String(auth.currentUser.uid) : '';
}

function getCurrentActorName(){
  const p = getPerfilAtual();
  return p ? (p.nome || p.email || 'Usuário') : 'Usuário';
}

const DEFAULT_PERMISSIONS = {agenda:true, clientes:true, financeiro:true, anamnese:true};
function getPerfilPermissions(perfil){
  if (!perfil || isPerfilAdmin(perfil.id)) return Object.assign({}, DEFAULT_PERMISSIONS);
  return Object.assign({}, DEFAULT_PERMISSIONS, perfil.permissions || {});
}
function canAccessArea(area){
  const p=getPerfilAtual();
  if(!p) return false;
  if(isPerfilAdmin(p.id)) return true;
  return getPerfilPermissions(p)[area] !== false;
}
function cloudColAllowed(col){
  const p=getPerfilAtual(); if(!p || isPerfilAdmin(p.id)) return true;
  const map={clientes:'clientes',agenda:'agenda',servicos:'agenda',tx:'financeiro',fiados:'financeiro',an:'anamnese'};
  if(col==='audit') return true;
  if(col==='backups' || col==='usuarios') return false;
  return map[col] ? canAccessArea(map[col]) : true;
}
// Leitura na nuvem. A auditoria é gravada por todos, mas só o administrador a lê
// (as regras V9 recusam a leitura para funcionários; aqui o app nem tenta).
function cloudColReadable(col){
  if(col==='audit'){ const p=getPerfilAtual(); return !!(p && isPerfilAdmin(p.id)); }
  return cloudColAllowed(col);
}
function auditLog(action, entity, entityId, summary, extra={}){
  try{
    if(!state || !state.data) return;
    if(!Array.isArray(state.data.audit)) state.data.audit=[];
    const entry = Object.assign({
      id: uid(), action, entity, entityId:String(entityId||''), summary:String(summary||''),
      actorUid:getCurrentActorId(), actorName:getCurrentActorName(), ownerId:getDataOwnerId(),
      at:new Date().toISOString()
    }, extra||{});
    state.data.audit.push(entry);
    // Cada evento de auditoria é criado uma única vez na nuvem — nunca
    // reescrito depois — para que a trilha de auditoria seja confiável.
    cloudSaveDoc('audit', entry);
    if(state.data.audit.length>1000) state.data.audit.splice(0,state.data.audit.length-1000);
  }catch(e){ console.error('auditLog',e); }
}

// Retorna true se o perfil do funcionário estiver ativo
function isFuncionarioAtivo(p){
  if (!p) return false;
  if (p.ativo === false) return false;
  if (String(p.situacao || '').toLowerCase() === 'inativo') return false;
  return true;
}


function setMeuUsuarioMessage(msg, isError = true) {
  const box = document.getElementById('meuUsuarioMsg');
  if (!box) return;
  box.textContent = msg || '';
  if (!msg) return;
  box.style.color = isError ? 'var(--danger)' : 'var(--success)';
}


function atualizarAvatarPerfil(perfil){
  try{ atualizarCapaPerfil(perfil); }catch(e){}
  // Usa createElement em vez de innerHTML para o <img>, já que
  // perfil.avatar pode conter dados vindos do próprio usuário — assim
  // o valor nunca é interpretado como HTML, só como um endereço de
  // imagem.
  const avatarMain = document.querySelector('.perfil-avatar');
  if (avatarMain){
    if (perfil && isDataImageUrl(perfil.avatar)){
      const img = document.createElement('img');
      img.src = perfil.avatar;
      img.alt = 'Avatar';
      avatarMain.replaceChildren(img);
    } else {
      avatarMain.innerHTML = '<i class="fa-solid fa-user"></i>';
    }
  }
  const avatarSidebar = document.querySelector('.sidebar-avatar');
  if (avatarSidebar){
    if (perfil && isDataImageUrl(perfil.avatar)){
      const img2 = document.createElement('img');
      img2.src = perfil.avatar;
      img2.alt = 'Avatar';
      avatarSidebar.replaceChildren(img2);
    } else {
      avatarSidebar.innerHTML = '<i class="fa-regular fa-user"></i>';
    }
  }
}

// Foto de capa do perfil: aparece no topo da tela "Meu usuário" e no fundo do cartão do menu lateral.
// Montada por createElement (e não por texto HTML) porque o dado vem do próprio usuário.
function atualizarCapaPerfil(perfil){
  const capa = perfil && typeof perfil.capa === 'string' && /^data:image\//.test(perfil.capa) ? perfil.capa : '';

  const box = document.getElementById('perfilCapa');
  if (box){
    const antiga = box.querySelector('img.perfil-capa-img');
    if (antiga) antiga.remove();
    if (capa){
      const img = document.createElement('img');
      img.className = 'perfil-capa-img'; img.alt = 'Capa'; img.src = capa;
      box.insertBefore(img, box.firstChild);
    }
    box.classList.toggle('has-capa', !!capa);
    const rm = document.getElementById('btnMeuUsuarioCapaRemover');
    if (rm) rm.classList.toggle('hidden', !capa);
  }

  const side = document.querySelector('.sidebar-profile');
  if (side){
    const antigaS = side.querySelector(':scope > .sidebar-capa');
    if (antigaS) antigaS.remove();
    if (capa){
      const wrap = document.createElement('div');
      wrap.className = 'sidebar-capa'; wrap.setAttribute('aria-hidden','true');
      const img = document.createElement('img');
      img.alt = ''; img.src = capa;
      wrap.appendChild(img);
      side.insertBefore(wrap, side.firstChild);
    }
    side.classList.toggle('has-capa', !!capa);
  }
}

function renderMeuUsuario() {
  const perfil = getPerfilAtual();
  if (!perfil) return;
  const nomeEl = document.getElementById('meuNome');
  const emailEl = document.getElementById('meuEmail');
  const loginEl = document.getElementById('meuLogin');
  const cpfEl = document.getElementById('meuCpfCnpj');
  const endEl = document.getElementById('meuEndereco');
  const contatoEl = document.getElementById('meuContato');
  const empresaEl = document.getElementById('meuEmpresa');
  const categoriaEl = document.getElementById('meuCategoriaServico');
  const ocultarEmailEl = document.getElementById('meuOcultarEmail');

  if (nomeEl) nomeEl.value = perfil.nome || '';
  if (emailEl) emailEl.value = perfil.email || '';
  if (loginEl) loginEl.value = perfil.email || '';
  const priv = state.privado || {};
  if (cpfEl) cpfEl.value = priv.cpfCnpj || '';
  if (endEl) endEl.value = priv.endereco || '';
  if (contatoEl) contatoEl.value = priv.contato || '';
  if (empresaEl) empresaEl.value = priv.empresa || '';
  if (categoriaEl) categoriaEl.value = perfil.categoriaServico || '';
  if (ocultarEmailEl) ocultarEmailEl.checked = !!perfil.ocultarEmail;

  atualizarAvatarPerfil(perfil);
  renderSidebarPerfil();
}

function renderSidebarPerfil(){
  const perfil = getPerfilAtual();
  atualizarAvatarPerfil(perfil);
  const nome = perfil && perfil.nome ? perfil.nome : '—';
  const ocultarEmail = perfil && perfil.ocultarEmail;
  const email = (!ocultarEmail && perfil && perfil.email) ? perfil.email : '';
  const categoria = perfil && perfil.categoriaServico ? perfil.categoriaServico : '';
  const roleFallback = isPerfilAdmin(state.perfilId) ? 'Administrador' : 'Funcionário';
  const role = categoria || roleFallback;

  const nomeEl = document.getElementById('sbNome');
  const emailEl = document.getElementById('sbEmail');
  const studioEl = document.getElementById('sbStudio');
  const roleEl = document.getElementById('sbRole');
  const endEl = document.getElementById('sbEndereco');
  const contatoEl = document.getElementById('sbContato');
  const empresaEl = document.getElementById('sbEmpresa');

  const priv = state.privado || {};
  const empresa = priv.empresa || '';
  const endereco = priv.endereco || '';
  const contato = priv.contato || '';

  if (nomeEl) nomeEl.textContent = nome;

  // E-mail, função, endereço e contato só aparecem se tiverem valor preenchido
  const updateInfoRow = (spanEl, value) => {
    if (!spanEl || !spanEl.parentElement) return;
    spanEl.textContent = value || '';
    const row = spanEl.parentElement;
    row.style.display = value ? '' : 'none';
  };

  updateInfoRow(emailEl, email);
  updateInfoRow(roleEl, role);
  updateInfoRow(endEl, endereco);
  updateInfoRow(contatoEl, contato);

  // Mostra o nome da empresa apenas uma vez (na linha onde antes era "Studio LH")
  if (studioEl) {
    studioEl.textContent = empresa || '';
    studioEl.style.display = empresa ? 'block' : 'none';
  }

  // Linha extra de empresa não é mais necessária; mantém vazia/oculta
  if (empresaEl) {
    empresaEl.textContent = '';
    empresaEl.style.display = 'none';
  }
}


async function salvarMeuUsuario() {
  const perfil = getPerfilAtual();
  if (!perfil) {
    setMeuUsuarioMessage('Nenhum perfil carregado.');
    return;
  }

  const nomeEl = document.getElementById('meuNome');
  const emailEl = document.getElementById('meuEmail');
  const loginEl = document.getElementById('meuLogin');
  const cpfEl = document.getElementById('meuCpfCnpj');
  const endEl = document.getElementById('meuEndereco');
  const contatoEl = document.getElementById('meuContato');
  const empresaEl = document.getElementById('meuEmpresa');
  const categoriaEl = document.getElementById('meuCategoriaServico');
  const ocultarEmailEl = document.getElementById('meuOcultarEmail');
  const novaSenhaEl = document.getElementById('meuNovaSenha');
  const novaSenha2El = document.getElementById('meuNovaSenha2');
  const senhaAtualEl = document.getElementById('meuSenhaAtual');

  const nome = nomeEl ? nomeEl.value.trim() : '';
  const email = emailEl ? emailEl.value.trim() : '';
  const cpf = cpfEl ? cpfEl.value.trim() : '';
  const endereco = endEl ? endEl.value.trim() : '';
  const contato = contatoEl ? contatoEl.value.trim() : '';
  const empresa = empresaEl ? empresaEl.value.trim() : '';
  const categoriaServico = categoriaEl ? categoriaEl.value.trim() : '';
  const ocultarEmail = ocultarEmailEl ? !!ocultarEmailEl.checked : false;
  const novaSenha = novaSenhaEl ? novaSenhaEl.value : '';
  const novaSenha2 = novaSenha2El ? novaSenha2El.value : '';
  const senhaAtual = senhaAtualEl ? senhaAtualEl.value : '';

  if (!nome || !email) {
    setMeuUsuarioMessage('Nome e e-mail são obrigatórios.');
    return;
  }

  if (novaSenha || novaSenha2) {
    if (novaSenha.length < 8) {
      setMeuUsuarioMessage('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (novaSenha !== novaSenha2) {
      setMeuUsuarioMessage('A confirmação da nova senha não confere.');
      return;
    }
    if (!senhaAtual) {
      setMeuUsuarioMessage('Digite sua senha atual para trocar a senha.', true);
      if (senhaAtualEl) senhaAtualEl.focus();
      return;
    }
    if (novaSenha === senhaAtual) {
      setMeuUsuarioMessage('A nova senha deve ser diferente da atual.', true);
      return;
    }
    // Confirma a senha atual ANTES de salvar qualquer coisa (o Firebase exige login recente
    // para trocar senha; sem isso dava o erro auth/requires-recent-login).
    const u = auth && auth.currentUser;
    if (!u) {
      setMeuUsuarioMessage('Sessão expirada. Entre novamente para trocar a senha.', true);
      return;
    }
    const temSenha = (u.providerData || []).some(p => p.providerId === 'password');
    if (!temSenha) {
      setMeuUsuarioMessage('Esta conta entra com o Google e não tem senha para trocar.', true);
      return;
    }
    try {
      setMeuUsuarioMessage('Confirmando senha atual...', false);
      const cred = firebase.auth.EmailAuthProvider.credential(u.email, senhaAtual);
      await u.reauthenticateWithCredential(cred);
    } catch (e) {
      console.error('Erro ao reautenticar', e);
      setMeuUsuarioMessage(translateFirebaseError(e.code) || 'Não foi possível confirmar a senha atual.', true);
      return;
    }
  }

  // Atualiza dados locais do perfil
  perfil.nome = nome;
  perfil.email = email;
  perfil.categoriaServico = categoriaServico;
  perfil.ocultarEmail = ocultarEmail;
  // CPF/CNPJ, endereço, contato e empresa são dados pessoais: ficam num
  // documento privado (só o próprio usuário lê), não no perfil que os colegas veem.
  state.privado = { cpfCnpj: cpf, endereco: endereco, contato: contato, empresa: empresa };
  // login sempre segue o e-mail
  if (loginEl) loginEl.value = email;

  savePerfis();
  renderPerfis && renderPerfis();

  let privadoOk = true;
  try { await salvarPrivadoDoUsuario(); }
  catch (e) { privadoOk = false; console.error('Erro ao salvar dados pessoais privados', e); }

  // Atualiza senha no Firebase, se solicitado
  if (novaSenha && auth && auth.currentUser) {
    try {
      await auth.currentUser.updatePassword(novaSenha);
    } catch (e) {
      console.error('Erro ao atualizar senha do usuário logado', e);
      setMeuUsuarioMessage(translateFirebaseError(e.code) || 'Erro ao atualizar a senha.', true);
      return;
    }
  }

  if (privadoOk) setMeuUsuarioMessage('Dados atualizados com sucesso.', false);
  else setMeuUsuarioMessage('Dados salvos, mas CPF/CNPJ, endereço, contato e empresa não puderam ser gravados. Tente novamente.', true);

  if (novaSenhaEl) novaSenhaEl.value = '';
  if (novaSenha2El) novaSenha2El.value = '';
  if (senhaAtualEl) senhaAtualEl.value = '';

  renderSidebarPerfil();
}



// Aplica permissões de acordo com o perfil atual (admin x funcionário)
function aplicarPermissoesPerfil(){
  const perfil = getPerfilAtual();
  const isAdmin = perfil && isPerfilAdmin(perfil.id);

  // Aba / menu de Funcionários (Usuários)
  const usuariosTab = document.querySelector('#tab-usuarios');
  const usuariosMenuItem = document.querySelector('#navMenu .menu-item[data-tab="usuarios"]');

  // Aba / menu Visão do Dono
  const visaoDonoTab = document.querySelector('#tab-visao-dono');
  const visaoDonoMenuItem = document.querySelector('#navMenu .menu-item[data-tab="visao-dono"]');

  // Aba / menu Admin (backup / banco de dados)
  const adminTab = document.querySelector('#tab-admin');
  const adminMenuItem = document.querySelector('#navMenu .menu-item[data-tab="admin"]');

  // Aba / menu Config (configurações globais)
  const configTab = document.querySelector('#tab-config');
  const configMenuItem = document.querySelector('#navMenu .menu-item[data-tab="config"]');

  if (isAdmin){
    if (usuariosTab) usuariosTab.classList.remove('hidden');
    if (usuariosMenuItem) usuariosMenuItem.classList.remove('hidden');

    if (visaoDonoTab) visaoDonoTab.classList.remove('hidden');
    if (visaoDonoMenuItem) visaoDonoMenuItem.classList.remove('hidden');

    if (adminTab) adminTab.classList.remove('hidden');
    if (adminMenuItem) adminMenuItem.classList.remove('hidden');

    if (configTab) configTab.classList.remove('hidden');
    if (configMenuItem) configMenuItem.classList.remove('hidden');
  } else {
    if (usuariosTab) usuariosTab.classList.add('hidden');
    if (usuariosMenuItem) usuariosMenuItem.classList.add('hidden');

    if (visaoDonoTab) visaoDonoTab.classList.add('hidden');
    if (visaoDonoMenuItem) visaoDonoMenuItem.classList.add('hidden');

    if (adminTab) adminTab.classList.add('hidden');
    if (adminMenuItem) adminMenuItem.classList.add('hidden');

    if (configTab) configTab.classList.add('hidden');
    if (configMenuItem) configMenuItem.classList.add('hidden');
  }

  const areaTabs = {agenda:'agenda', servicos:'agenda', clientes:'clientes', financeiro:'financeiro', anamnese:'anamnese'};
  Object.entries(areaTabs).forEach(([tab,area])=>{
    const pane=document.querySelector('#tab-'+tab);
    const menu=document.querySelector('#navMenu .menu-item[data-tab="'+tab+'"]');
    const ok=isAdmin || canAccessArea(area);
    if(pane) pane.classList.toggle('hidden', !ok);
    if(menu) menu.classList.toggle('hidden', !ok);
  });
}
// A lista de perfis/funcionários agora é **cloud-first**.
// Mantemos a chave apenas como cache opcional (não é mais fonte de verdade).
const LS_KEY = 'studioLH__perfis';             // cache opcional (legado)
const NS = (pid) => `studioLH__${pid}__data`;  // namespace por perfil
const CFG = (pid) => `studioLH__${pid}__cfg`;


// Coleção no Firestore para armazenar todos os perfis/funcionários de forma centralizada
const PERFIS_COLLECTION = 'perfis_usuarios';

/* ======= DADOS PESSOAIS PRIVADOS =======
   CPF/CNPJ, endereço, contato e empresa ficavam em perfis_usuarios/{uid}, que os
   colegas do estabelecimento conseguem ler. Agora ficam em
   perfis_usuarios/{uid}/private/perfil (só o próprio usuário lê e grava).
   Migração automática, uma vez por usuário, no próximo login: copia para o
   documento privado e SÓ DEPOIS apaga os campos do documento público. */
const PRIVATE_FIELDS = ['cpfCnpj', 'endereco', 'contato', 'empresa'];

function _privadoRef(uidStr){
  return db.collection(PERFIS_COLLECTION).doc(String(uidStr)).collection('private').doc('perfil');
}

async function _removerCamposPrivadosPublicos(uidStr){
  try{
    const del = firebase.firestore.FieldValue.delete();
    const upd = {};
    PRIVATE_FIELDS.forEach(k => { upd[k] = del; });
    await db.collection(PERFIS_COLLECTION).doc(String(uidStr)).update(upd);
    return true;
  }catch(e){
    console.warn('Não foi possível limpar os campos pessoais do perfil público', e);
    return false;
  }
}

function _limparPrivadosLocais(uidStr){
  (state.perfis || []).forEach(p => {
    if (p && String(p.id) === String(uidStr)) PRIVATE_FIELDS.forEach(k => { delete p[k]; });
  });
}

async function salvarPrivadoDoUsuario(){
  const uidStr = String(state.perfilId || '');
  if (!window.db || !uidStr) return;
  const d = {};
  PRIVATE_FIELDS.forEach(k => { d[k] = String((state.privado || {})[k] || '').slice(0, 300); });
  await _privadoRef(uidStr).set(d, { merge: true });
  const perfil = getPerfilAtual();
  if (perfil && PRIVATE_FIELDS.some(k => k in perfil)){
    if (await _removerCamposPrivadosPublicos(uidStr)) _limparPrivadosLocais(uidStr);
  }
}

// legado = documento público do próprio usuário (pode ainda ter os campos antigos)
async function carregarPrivadoDoUsuario(uidStr, legado){
  state.privado = {};
  if (!window.db || !uidStr) return;
  uidStr = String(uidStr);
  let priv = {}, leituraOk = true;
  try{
    const snap = await _privadoRef(uidStr).get();
    if (snap && snap.exists) priv = snap.data() || {};
  }catch(e){
    leituraOk = false;
    console.error('Erro ao ler dados pessoais privados', e);
  }
  const out = {};
  let temLegado = false;
  PRIVATE_FIELDS.forEach(k => {
    const noLegado = !!legado && Object.prototype.hasOwnProperty.call(legado, k);
    if (noLegado) temLegado = true;
    // o documento privado (se tiver a chave) sempre vence o legado
    const fonte = Object.prototype.hasOwnProperty.call(priv, k) ? priv[k] : (noLegado ? legado[k] : '');
    out[k] = (typeof fonte === 'string') ? fonte.slice(0, 300) : '';
  });
  state.privado = out;

  if (leituraOk && temLegado){
    try{
      await _privadoRef(uidStr).set(out, { merge: true });
      if (await _removerCamposPrivadosPublicos(uidStr)){
        PRIVATE_FIELDS.forEach(k => { if (legado) delete legado[k]; });
        _limparPrivadosLocais(uidStr);
      }
    }catch(e){
      console.warn('Migração dos dados pessoais para o documento privado adiada', e);
    }
  }
}

/**
 * Sincroniza a lista local de perfis com o Firestore (envia tudo que está no state.perfis).
 * Mantém a lista centralizada para que outros dispositivos possam enxergar os mesmos funcionários.
 */
async function syncPerfisToFirestore(){
  try{
    if (!window.db || !Array.isArray(state.perfis)) return;
    const perfis = state.perfis || [];
    if (!perfis.length) return;

    const meuId = String(state.perfilId || '');
    const souAdmin = isPerfilAdmin(meuId);
    // Funcionário só pode gravar o próprio documento (a regra do
    // Firestore recusaria os demais); admin pode gravar qualquer
    // perfil do seu estabelecimento.
    const alvo = souAdmin ? perfis : perfis.filter(p => p && String(p.id) === meuId);
    if (!alvo.length) return;

    const batch = db.batch();
    alvo.forEach(p=>{
      if (!p || !p.id) return;
      const data = Object.assign({}, p);
      delete data.senhaHash; // a senha de segurança não mora mais aqui
      PRIVATE_FIELDS.forEach(k => { delete data[k]; }); // dados pessoais só no documento privado
      if (data.email) data.emailLower = String(data.email).toLowerCase();
      const ref = db.collection(PERFIS_COLLECTION).doc(String(p.id));
      batch.set(ref, data, { merge:true });
    });
    await batch.commit();
  }catch(e){
    console.error('Erro ao sincronizar perfis para Firestore', e);
  }
}

/**
 * Carrega perfis do Firestore e mescla com o que estiver salvo localmente.
 * Se não houver nada remoto mas existir algo local, envia os dados locais para o Firestore.
 */
// Carrega perfis do Firestore.
// - Se passar { ownerId }, lista todos os perfis/funcionários daquele administrador.
// - Se passar { email }, busca um perfil específico (útil para descobrir o papel do usuário logado).
async function syncPerfisFromFirestore(opts){
  try{
    if (!window.db) return;

    const o = opts || {};
    let query = db.collection(PERFIS_COLLECTION);
    if (o.ownerId) {
      query = query.where('ownerId', '==', String(o.ownerId));
    }
    if (o.email) {
      query = query.where('emailLower','==', String(o.email).toLowerCase());
    }

    const snap = await query.get();
    const remotos = [];
    snap.forEach(doc=>{
      const d = doc.data() || {};
      d.id = doc.id; // nunca confiar no campo id gravado dentro do documento
      remotos.push(d);
    });

    if (remotos.length){
      const mapa = new Map();
      (state.perfis || []).forEach(p=>{
        if (p && p.id) mapa.set(String(p.id), p);
      });
      remotos.forEach(p=>{
        if (!p || !p.id) return;
        const idStr = String(p.id);
        const atual = mapa.get(idStr) || {};
        mapa.set(idStr, Object.assign({}, atual, p));
      });
      state.perfis = Array.from(mapa.values());
      if (typeof renderPerfis === 'function') renderPerfis();
    }
  }catch(e){
    console.error('Erro ao carregar perfis do Firestore', e);
  }
}




