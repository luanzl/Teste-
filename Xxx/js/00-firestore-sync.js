/* Firestore: núcleo de sincronização (nuvem, coleções, granular save/delete)
   Parte 1 de 14 do antigo app.v2.js (dividido na Etapa de modularização).
   Linhas originais: 1-323. Nenhuma linha de código foi alterada nesta divisão. */


// Atualiza lista de funcionários quando uma aba de cadastro notificar que um novo funcionário foi criado
window.addEventListener('message', function(ev){
  try {
    if (!ev || !ev.data) return;
    if (ev.origin !== window.location.origin) return; // só aceita a própria origem
    if (ev.data.type === 'FUNCIONARIO_ADICIONADO') {
      if (typeof loadPerfis === 'function') {
        loadPerfis();
      } else if (typeof renderPerfis === 'function') {
        renderPerfis();
        if (typeof renderFuncionarios === 'function') renderFuncionarios();
      }
    }
  } catch(e){
    console.error(e);
  }
});

// fallback para garantir que o botão Alterar senha sempre funcione
document.addEventListener('click', function(ev){
  const t = ev.target;
  if (!t) return;
  if (t.id === 'btnAlterarSenha') {
    try { abrirModalAlterarSenha(); } catch(e){ console.error(e); }
  }
});




/* ======= FIRESTORE (NUVEM 100% + SUBCOLEÇÕES) ======= */
// Estrutura:
// perfis/{uid} (doc) -> cfg, createdAt, updatedAt, lastLogin
// perfis/{uid}/{colecao}/{docId} -> itens (clientes, servicos, agenda, an, tx, usuarios, backups)
//
// OBS: Mantemos state.data em memória para a UI, mas persistimos SEM localStorage.

const CLOUD_COLS = ['clientes','servicos','agenda','an','tx','fiados','usuarios','backups','audit'];

// Guarda os IDs carregados do Firestore para conseguirmos deletar itens removidos.
const _cloudIndex = {
  clientes: new Set(),
  servicos: new Set(),
  agenda: new Set(),
  an: new Set(),
  tx: new Set(),
  usuarios: new Set(),
  backups: new Set(),
  audit: new Set()
};

function _ensureId(item){
  if (!item) return uid();
  if (!item.id) item.id = uid();
  return item.id;
}

async function ensureCloudUserRoot(uidStr){
  if(!window.db || !uidStr) return;
  const ref = db.collection('perfis').doc(String(uidStr));
  const snap = await ref.get();
  if (snap.exists) return;
  await ref.set({
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLogin: ''
  }, { merge: true });
}

// Documentos lidos da nuvem podem ter sido gravados por outro usuário (inclusive
// mal-intencionado) com o TIPO errado (ex.: "data" numérico) e travar uma tela do
// administrador. Aqui os campos de texto viram texto e as listas viram listas.
const _CAMPOS_TEXTO = ['nome','data','dataBr','clienteNome','clienteId','servico','servicoId','servicoNome','status','tipo','desc','cat','obs','zap','telefone','email','nasc','aniv','inicioHora','fimHora','hora','venc','responsavelId','responsavelNome','actorName','actorUid','summary','entity','entityId','action','at','forma','metodo','modelo','termos','assinatura','avatar','createdByName','updatedByName'];
const _CAMPOS_LISTA = ['parcelas','respostas','campos'];
function _normalizarDoc(col, v){
  if (!v || typeof v !== 'object') return {};
  _CAMPOS_TEXTO.forEach(k => {
    if (!Object.prototype.hasOwnProperty.call(v, k)) return;
    const x = v[k];
    if (typeof x === 'string') return;
    v[k] = (typeof x === 'number' || typeof x === 'boolean') ? String(x) : '';
  });
  _CAMPOS_LISTA.forEach(k => {
    if (Object.prototype.hasOwnProperty.call(v, k) && !Array.isArray(v[k])) v[k] = [];
  });
  return v;
}

async function loadCloudState(uidStr){
  if(!window.db || !uidStr) throw new Error('Firestore não inicializado ou uid vazio.');
  await ensureCloudUserRoot(uidStr);

  const rootRef = db.collection('perfis').doc(String(uidStr));
  const rootSnap = await rootRef.get();
  const root = rootSnap.exists ? rootSnap.data() : {};
  const cfg = Object.assign({}, state.cfg, (root.cfg || {}));

  const data = {clientes:[],servicos:[],agenda:[],tx:[],fiados:[],an:[],usuarios:[],backups:[],audit:[], lastLogin: root.lastLogin || ''};

  // Carrega cada subcoleção
  for (const col of CLOUD_COLS){
    try{
      if(!cloudColReadable(col)){ data[col]=[]; _cloudIndex[col]=new Set(); continue; }
      const snap = await rootRef.collection(col).get();
      const arr = [];
      const ids = new Set();
      snap.forEach(doc=>{
        const v = doc.data() || {};
        // garante id
        v.id = doc.id; // nunca confiar no campo id gravado dentro do documento
        _normalizarDoc(col, v);
        arr.push(v);
        ids.add(String(v.id));
      });
      data[col] = arr;
      _cloudIndex[col] = ids;
    }catch(e){
      console.error('Erro ao carregar subcoleção', col, e);
      throw e;
    }
  }

  return { cfg, data };
}

async function saveCloudState(uidStr){
  if(!window.db || !uidStr) return;
  const rootRef = db.collection('perfis').doc(String(uidStr));

  // Configuração global e metadados do tenant são gravados apenas pelo administrador.
  const perfilAtual=getPerfilAtual();
  if(perfilAtual && isPerfilAdmin(perfilAtual.id)){
    await rootRef.set({cfg:state.cfg||{},updatedAt:new Date().toISOString(),lastLogin:(state.data&&state.data.lastLogin)?state.data.lastLogin:''},{merge:true});
  }

  // sincroniza cada subcoleção com batch + deletes
  // (as coleções em GRANULAR_COLS não passam mais por aqui — cada uma
  // delas já é salva/apagada documento-a-documento na hora certa, via
  // cloudSaveDoc/cloudDeleteDoc, exatamente no momento de cada ação)
  for (const col of CLOUD_COLS){
    try{
      if(!cloudColAllowed(col)) continue;
      if(GRANULAR_COLS.includes(col)) continue;
      const items = (state.data && state.data[col]) ? state.data[col] : [];
      const newIds = new Set();
      const ops = [];
      items.forEach(it=>{ const id=String(_ensureId(it)); newIds.add(id); ops.push(['set',rootRef.collection(col).doc(id),it]); });
      const oldIds = _cloudIndex[col] || new Set();
      oldIds.forEach(oldId=>{ if(!newIds.has(String(oldId))) ops.push(['delete',rootRef.collection(col).doc(String(oldId))]); });
      // Firestore aceita no máximo 500 writes por batch; 400 deixa margem segura.
      for(let i=0;i<ops.length;i+=400){
        const batch=db.batch();
        ops.slice(i,i+400).forEach(op=>{ if(op[0]==='set') batch.set(op[1],op[2],{merge:true}); else batch.delete(op[1]); });
        await batch.commit();
      }
      _cloudIndex[col] = newIds;
    }catch(e){
      console.error('Erro ao salvar subcoleção', col, e);
      throw e;
    }
  }
}

// Colunas que passaram a ser salvas documento-a-documento (ver
// cloudSaveDoc/cloudDeleteDoc abaixo), em vez de reescrever a coleção
// inteira a cada alteração. Isso evita que a sessão de uma pessoa
// "ressuscite" ou apague por engano um registro que outra pessoa
// criou/editou/excluiu enquanto as duas usavam o app ao mesmo tempo.
const GRANULAR_COLS = ['clientes','servicos','agenda','tx','fiados','an','audit'];

// Salva UM documento diretamente na coleção da nuvem (create ou
// update), sem tocar em mais nenhum outro documento da coleção.
// Chamado logo depois de cada criação/edição de item (cliente,
// agendamento, serviço, lançamento financeiro, fiado ou anamnese).
function cloudSaveDoc(col, item){
  try{
    if (!window.db || !item || item.id == null) return;
    const ownerId = getDataOwnerId();
    if (!ownerId || !cloudColAllowed(col)) return;
    db.collection('perfis').doc(String(ownerId)).collection(col).doc(String(item.id))
      .set(item, {merge:false})
      .then(()=>{ try{ setSyncStatus('Salvo'); }catch(_){} })
      .catch(e=>{
        console.error('cloudSaveDoc:'+col, e);
        try{
          setSyncStatus('Erro ao sincronizar', (e&&e.code)?e.code:'');
          if (/permission-denied/i.test(String((e&&e.code)||(e&&e.message)||''))) toast('Sem permissão para salvar no Firestore. Verifique as Rules.');
        }catch(_){}
      });
  }catch(e){ console.error('cloudSaveDoc', e); }
}

// Apaga UM documento diretamente na nuvem, sem depender de comparar
// listas de IDs (o que causava o risco de excluir/restaurar itens
// errados quando duas pessoas usavam o app ao mesmo tempo).
function cloudDeleteDoc(col, id){
  try{
    if (!window.db || id == null) return;
    const ownerId = getDataOwnerId();
    if (!ownerId || !cloudColAllowed(col)) return;
    db.collection('perfis').doc(String(ownerId)).collection(col).doc(String(id))
      .delete()
      .then(()=>{ try{ setSyncStatus('Salvo'); }catch(_){} })
      .catch(e=>{
        console.error('cloudDeleteDoc:'+col, e);
        try{ setSyncStatus('Erro ao sincronizar', (e&&e.code)?e.code:''); }catch(_){}
      });
  }catch(e){ console.error('cloudDeleteDoc', e); }
}

// Debounce para evitar escrita a cada clique
let _cloudSyncTimer = null;
function scheduleCloudSync(delayMs = 600){
  try{
    if (!auth || !auth.currentUser) return;
    const uidStr = getDataOwnerId();
    if (!uidStr) return;
    if (_cloudSyncTimer) clearTimeout(_cloudSyncTimer);
    setSyncStatus('Sincronizando...');
    _cloudSyncTimer = setTimeout(async ()=>{
      _cloudSyncTimer = null;
      try { await saveCloudState(uidStr); setSyncStatus('Salvo'); }
      catch(e){
        setSyncStatus('Erro ao sincronizar', (e&&e.code)?e.code:'');
        console.error(e);
        try{
          const msg = (e && (e.code||e.message)) ? String(e.code||e.message) : '';
          if (/permission-denied/i.test(msg)) toast('Sem permissão para salvar no Firestore. Verifique as Rules.');
        }catch(_){}
      }
    }, delayMs);
  }catch(e){ console.error(e); }
}

// Proxy reativo: qualquer mudança em state.data/state.cfg agenda um sync
function makeReactive(obj, onChange){
  if (!obj || typeof obj !== 'object') return obj;
  const mutators = new Set(['push','pop','shift','unshift','splice','sort','reverse','copyWithin','fill']);
  const cache = new WeakMap();

  const wrap = (target)=>{
    if (!target || typeof target !== 'object') return target;
    if (cache.has(target)) return cache.get(target);

    const p = new Proxy(target, {
      get(t, prop, rec){
        const v = Reflect.get(t, prop, rec);
        if (Array.isArray(t) && typeof v === 'function' && mutators.has(prop)){
          return function(...args){
            const r = v.apply(t, args);
            try{ onChange(); }catch(e){}
            return r;
          };
        }
        return wrap(v);
      },
      set(t, prop, value, rec){
        const r = Reflect.set(t, prop, value, rec);
        try{ onChange(); }catch(e){}
        return r;
      },
      deleteProperty(t, prop){
        const r = Reflect.deleteProperty(t, prop);
        try{ onChange(); }catch(e){}
        return r;
      }
    });
    cache.set(target, p);
    return p;
  };

  return wrap(obj);
}

function attachCloudAutosave(){
  // torna reativo apenas uma vez
  state.data = makeReactive(state.data, ()=>scheduleCloudSync());
  state.cfg  = makeReactive(state.cfg,  ()=>scheduleCloudSync());
}

