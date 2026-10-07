/* Admin/Backup/Relatório + Config/Ações + Auto Backup
   Parte 12 de 14 do antigo app.v2.js (dividido na Etapa de modularização).
   Linhas originais: 5251-5519. Nenhuma linha de código foi alterada nesta divisão. */

/* ======= ADMIN / BACKUP / RELATÓRIO ======= */

function exportarDados(){
  const blob = new Blob([JSON.stringify({perfilId:state.perfilId, cfg:state.cfg, data:state.data},null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `studioLH_${state.perfilId}.json`; a.click();
}
function exportSingle(nome,obj){
  const blob = new Blob([JSON.stringify(obj,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${nome}_${obj.id}.json`; a.click();
}
/* ======= VALIDAÇÃO DE IMPORTAÇÃO / RESTAURAÇÃO =======
   Um arquivo de backup é entrada não confiável: só coleções conhecidas, itens que são
   objetos, ids seguros (o id vira atributo HTML e id de documento) e nada de chaves
   que poluam o protótipo. "audit" nunca vem de arquivo (é imutável). */
const IMPORT_COLS = ['clientes','servicos','agenda','tx','fiados','an'];
const ID_SEGURO = /^[A-Za-z0-9_-]{1,64}$/;
function _semChavesPerigosas(k, v){
  return (k === '__proto__' || k === 'constructor' || k === 'prototype') ? undefined : v;
}
function _limparDadosImportados(data){
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Formato inválido.');
  const out = {};
  IMPORT_COLS.forEach(col=>{
    const arr = Array.isArray(data[col]) ? data[col] : [];
    out[col] = arr
      .filter(it => it && typeof it === 'object' && !Array.isArray(it))
      .map(it=>{
        const c = JSON.parse(JSON.stringify(it), _semChavesPerigosas);
        c.id = ID_SEGURO.test(String(c.id == null ? '' : c.id)) ? String(c.id) : uid();
        return c;
      });
  });
  return out;
}
function _limparCfgImportada(cfg){
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return {};
  const c = JSON.parse(JSON.stringify(cfg), _semChavesPerigosas);
  if ('moeda' in c && !/^[A-Z]{3}$/.test(String(c.moeda))) delete c.moeda;
  if ('appZoom' in c) { const z = Number(c.appZoom); if (isFinite(z) && z >= 50 && z <= 150) c.appZoom = z; else delete c.appZoom; }
  if ('acento' in c && c.acento !== 'auto' && !/^#[0-9a-fA-F]{6}$/.test(String(c.acento))) c.acento = 'auto';
  if ('cores' in c) {
    const k = c.cores, ok = x => /^#[0-9a-fA-F]{6}$/.test(String(x));
    if (k && typeof k === 'object' && ok(k.ag) && ok(k.co) && ok(k.ca)) c.cores = {ag:k.ag, co:k.co, ca:k.ca}; else delete c.cores;
  }
  return c;
}
function importarDados(evt){
  const file = evt.target.files[0]; if(!file) return;
  if (!isPerfilAdmin(state.perfilId)) { alert('Apenas o administrador pode importar dados.'); evt.target.value = ''; return; }
  if (file.size > 20 * 1024 * 1024) { alert('Arquivo grande demais (máximo 20 MB).'); evt.target.value = ''; return; }
  const reader = new FileReader();
  reader.onload = e=>{
    try{
      const pack = JSON.parse(e.target.result, _semChavesPerigosas);
      if (!pack || typeof pack !== 'object' || !pack.data) throw new Error('Arquivo inválido.');
      if(!confirm('Isto substituirá os dados deste perfil. Continuar?')) return;
      _restoreBackupPayload({ data: pack.data, cfg: pack.cfg });
      savePerfil(); refreshAll(); alert('Importado com sucesso.');
    }catch(err){ alert('Arquivo inválido.'); }
  };
  reader.readAsText(file);
}

function downloadCSV(filename, rows){
  const csv = rows.map(r => r.map(v => {
    const s = String(v ?? '').replace(/"/g,'""');
    return `"${s}"`;
  }).join(';')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportAgendaCSV(){
  const rows = [['Data','Hora','Dia inteiro','Cliente','Serviço','Valor','Status','Obs']];
  (state.data.agenda||[]).forEach(a=>{
    rows.push([
      a.dataBr || (a.data ? formatDateBR(a.data) : ''),
      a.diaInteiro ? 'Dia inteiro' : (a.inicioHora || a.hora || ''),
      a.diaInteiro ? 'SIM' : 'NÃO',
      a.clienteNome || '',
      a.servico || '',
      money(a.valor||0, state.cfg.moeda),
      (a.status||'agendado').toUpperCase(),
      a.obs || ''
    ]);
  });
  downloadCSV('agenda.csv', rows);
}

function exportTxCSV(){
  const rows = [['Data','Tipo','Descrição','Categoria','Valor']];
  (state.data.tx||[]).forEach(t=>{
    rows.push([
      t.dataBr || (t.data ? formatDateBR(t.data) : ''),
      t.tipo || '',
      t.desc || '',
      t.cat || '',
      money(t.valor||0, state.cfg.moeda)
    ]);
  });
  downloadCSV('financeiro.csv', rows);
}
function _plainClone(value){
  // state.data/state.cfg usam Proxy reativo; structuredClone(Proxy) pode lançar DataCloneError.
  return JSON.parse(JSON.stringify(value == null ? null : value));
}
function _restoreBackupPayload(b){
  if(!b || !b.data) throw new Error('Backup inválido.');
  if(!isPerfilAdmin(state.perfilId)) throw new Error('Apenas o administrador pode restaurar dados.');
  // Mantém a lista de backups atual fora do snapshot para evitar backups recursivos e crescimento exponencial.
  const currentBackups = _plainClone(state.data?.backups || []);
  // Só coleções conhecidas, com ids seguros (ver _limparDadosImportados).
  const restoredData = _limparDadosImportados(b.data);
  restoredData.backups = currentBackups;
  restoredData.audit = _plainClone(state.data?.audit || []);       // auditoria nunca é restaurada
  restoredData.usuarios = _plainClone(state.data?.usuarios || []);
  restoredData.lastLogin = (state.data && state.data.lastLogin) || '';
  state.data = makeReactive(restoredData, ()=>scheduleCloudSync());
  state.cfg = makeReactive(Object.assign({}, state.cfg || {}, _limparCfgImportada(b.cfg)), ()=>scheduleCloudSync());
}
function backupManual(silent = false){
  // Quando chamado por onclick, o primeiro argumento pode ser um Event.
  if (typeof silent !== 'boolean') silent = false;
  try{
    const dataSnapshot = _plainClone(state.data) || {};
    // Um backup não deve conter outros backups dentro dele.
    dataSnapshot.backups = [];
    const payload = {date:new Date().toISOString(), data:dataSnapshot, cfg:_plainClone(state.cfg)};
    state.data.backups.unshift(payload);
    // manter últimos 10
    state.data.backups = state.data.backups.slice(0,10);
    savePerfil();
    if(!silent) alert('Backup criado.');
  }catch(e){
    console.error('Erro ao criar backup', e);
    if(!silent) alert('Não foi possível criar o backup.');
  }
}
function recuperarUltimo(){
  const b = state.data.backups?.[0];
  if(!b) return alert('Sem backups disponíveis.');
  if(!confirm('Restaurar o último backup? Isto substituirá os dados atuais.')) return;
  try{
    _restoreBackupPayload(b); savePerfil(); refreshAll(); alert('Restaurado com sucesso!');
  }catch(e){ console.error('Erro ao restaurar backup', e); alert('Não foi possível restaurar o backup.'); }
}
function refreshDbStatus(){
  $('#dbUltima').textContent = new Date().toLocaleString('pt-BR');
  const bytes = new Blob([JSON.stringify(state.data)]).size;
  $('#stTam').textContent = (bytes/1024).toFixed(2)+' KB';
  const regs = state.data.clientes.length + state.data.agenda.length + state.data.tx.length + state.data.an.length;
  $('#stRegs').textContent = regs;
  $('#stBkp').textContent = (state.data.backups||[]).length;
  // lista backups
  const list = $('#listaBackups'); list.innerHTML='';
  (state.data.backups||[]).forEach((b,idx)=>{
    const d = document.createElement('div'); d.className='item';
    d.innerHTML = `<strong>📅 ${new Date(b.date).toLocaleString('pt-BR')}</strong>
      <div class="row"><button class="btn ghost sm" data-i="${idx}" data-act="rest"><i class="fa-solid fa-rotate-left"></i> Restaurar</button></div>`;
    list.appendChild(d);
  });
  $$('#listaBackups [data-act="rest"]').forEach(btn=>btn.onclick=()=>{
    const i=+btn.dataset.i;
    const selected = state.data.backups?.[i];
    if(!selected) return alert('Backup não encontrado.');
    if(!confirm('Restaurar este backup? Isto substituirá os dados atuais.')) return;
    try{
      _restoreBackupPayload(selected); savePerfil(); refreshAll(); alert('Backup restaurado.');
    }catch(e){ console.error('Erro ao restaurar backup', e); alert('Não foi possível restaurar o backup.'); }
  });
}
function exportarRelatorio(){
  const totalR = state.data.tx.filter(t=>t.tipo==='receita').reduce((s,t)=>s+t.valor,0);
  const totalD = state.data.tx.filter(t=>t.tipo==='despesa').reduce((s,t)=>s+t.valor,0);
  const linhas = [
    `Estúdio: ${state.cfg.estudio}`,
    `Saldo Atual: ${money(totalR-totalD, state.cfg.moeda)}`,
    `Clientes: ${state.data.clientes.length}`,
    `Agendamentos: ${state.data.agenda.length}`,
    `Transações: ${state.data.tx.length}`
  ].join('\n');
  const blob = new Blob([linhas], {type:'text/plain;charset=utf-8'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='relatorio_2letters.txt'; a.click();
}
function refreshSystemStats(){
  $('#stClientes').textContent = state.data.clientes.length;
  const hoje = todayISO();
  $('#stHoje').textContent = state.data.agenda.filter(a=>a.data===hoje).length;
  const ym = todayISO().slice(0,7);
  const recMes = state.data.tx.filter(t=>t.tipo==='receita' && t.data.startsWith(ym)).reduce((s,t)=>s+t.valor,0);
  $('#stMes').textContent = money(recMes, state.cfg.moeda);
  $('#stTx').textContent = state.data.tx.length;

  // Fiados (Dashboard)
  try {
    if (!Array.isArray(state.data.fiados)) state.data.fiados = [];
    const fiados = state.data.fiados || [];
    // usa parcelas como fonte de verdade
    const abertos = fiados.filter(f=>{
      const parcelas = Array.isArray(f.parcelas) ? f.parcelas : [];
      const unpaid = parcelas.filter(p=>!p.pago).reduce((s,p)=>s+Number(p.valor||0),0);
      return unpaid > 0;
    });
    const abertoSum = abertos.reduce((s,f)=>{
      const parcelas = Array.isArray(f.parcelas) ? f.parcelas : [];
      const unpaid = parcelas.filter(p=>!p.pago).reduce((ss,p)=>ss+Number(p.valor||0),0);
      return s + unpaid;
    },0);

    const pagosMesParcelas = fiados.flatMap(f=>{
      const parcelas = Array.isArray(f.parcelas) ? f.parcelas : [];
      return parcelas.filter(p=>p.pago && String(p.pagoData||'').startsWith(ym)).map(p=>({f,p}));
    });
    const recebMes = pagosMesParcelas.reduce((s,x)=>s+Number(x.p.valor||0),0);

    if ($('#stFiadosAberto')) $('#stFiadosAberto').textContent = money(abertoSum, state.cfg.moeda);
    if ($('#stFiadosQtd')) $('#stFiadosQtd').textContent = String(abertos.length);
    if ($('#stFiadosRecebMes')) $('#stFiadosRecebMes').textContent = money(recebMes, state.cfg.moeda);
    if ($('#stFiadosPagosMes')) $('#stFiadosPagosMes').textContent = String(pagosMesParcelas.length);

    const list = $('#dashFiadosList');
    if (list){
      const top = abertos.slice().sort((a,b)=>{
        const va = a.venc || a.data || '';
        const vb = b.venc || b.data || '';
        return String(va).localeCompare(String(vb));
      }).slice(0,8);

      if (!top.length){
        list.innerHTML = '<p class="muted">Nenhum fiado em aberto.</p>';
      } else {
        list.innerHTML = '';
        top.forEach(f=>{
          const div = document.createElement('div');
          div.className = 'item';
          const parcelas = Array.isArray(f.parcelas) ? f.parcelas : [];
          const abertoFiado = parcelas.filter(p=>!p.pago).reduce((s,p)=>s+Number(p.valor||0),0);
          const proxVenc = parcelas.filter(p=>!p.pago && p.venc).map(p=>p.venc).sort()[0] || (f.venc||'');
          const vencLabel = proxVenc ? `Próx. venc: ${formatDateBR(proxVenc)}` : 'Sem vencimento';
          div.innerHTML = `
            <strong>${escapeHtml(f.clienteNome || 'Cliente')} — ${money(abertoFiado, state.cfg.moeda)}</strong>
            <div class="muted">${escapeHtml(vencLabel)}${escapeHtml(f.desc ? ' • ' + f.desc : '')}</div>
          `;
          list.appendChild(div);
        });
      }
    }
  } catch(e) {
    console.warn('Falha ao atualizar stats de fiados', e);
  }
}

/* ======= CONFIG / AÇÕES ======= */
/* Configurações: tudo é aplicado e salvo na hora (não existe mais botão "Salvar Configurações"). */
function salvarCfg(){
  const est = $('#cfgEstudio').value.trim();
  if (est) state.cfg.estudio = est; else if (!state.cfg.estudio) state.cfg.estudio = '2letters';
  state.cfg.moeda   = $('#cfgMoeda').value||'BRL';
  state.cfg.tema    = $('#cfgTema').value||'auto';
  // 'auto' = padrão do tema; senão guarda a cor escolhida (#rrggbb).
  // (mantém o valor atual se o usuário acabou de clicar em "Padrão do tema")
  const ac = $('#cfgAcento');
  if (ac && ac.dataset.auto === '0') state.cfg.acento = ac.value;
  else if (ac && ac.dataset.auto === '1') state.cfg.acento = 'auto';
  state.cfg.wpp24   = $('#cfgWpp24').checked;
  state.cfg.wpp2    = $('#cfgWpp2').checked;
  state.cfg.autoBackup = $('#cfgAutoBackup').checked;
  state.cfg.msgWpp  = $('#cfgMsgWpp').value.trim()||state.cfg.msgWpp;
  if ($('#cfgMsgWppConcluido')) state.cfg.msgWppConcluido = $('#cfgMsgWppConcluido').value.trim() || state.cfg.msgWppConcluido;
  if ($('#cfgMsgWppCancelado')) state.cfg.msgWppCancelado = $('#cfgMsgWppCancelado').value.trim() || state.cfg.msgWppCancelado;
  if ($('#cfgPixChave')) state.cfg.pixChave = $('#cfgPixChave').value.trim();
  state.cfg.appZoom = parseInt(($('#cfgZoom')||{}).value, 10) || 85;
  savePerfil();
}
function salvarCores(){
  state.cfg.cores = {ag:$('#corAg').value, co:$('#corCo').value, ca:$('#corCa').value};
  aplicarCoresAgenda();
  savePerfil();
}
function aplicarCoresAgenda(){
  const c = state.cfg.cores; if(!c) return;
  document.documentElement.style.setProperty('--cor-ag', c.ag);
  document.documentElement.style.setProperty('--cor-co', c.co);
  document.documentElement.style.setProperty('--cor-ca', c.ca);
}

/* Sincroniza o campo de cor de destaque com o que está salvo */
function sincronizarCampoAcento(){
  const ac = $('#cfgAcento'); if(!ac) return;
  const cur = (state.cfg && state.cfg.acento) || 'auto';
  const hex = (typeof normalizarAcento === 'function') ? normalizarAcento(cur) : null;
  if (hex){ ac.value = hex; ac.dataset.auto = '0'; }
  else { ac.dataset.auto = '1'; }
  const info = $('#cfgAcentoInfo');
  if (info) info.textContent = hex ? 'Cor personalizada ativa. Toque em "Padrão do tema" para voltar ao original.'
                                   : 'Usando o padrão do tema. Escolha qualquer cor para personalizar.';
}

/* Liga todos os campos de Configurações: aplica na hora e salva (com debounce) */
function ligarConfigAoVivo(){
  let t = null;
  const gravar = ()=>{ clearTimeout(t); t = null; try{ salvarCfg(); }catch(e){ console.error('cfg', e); } };
  const agendar = ()=>{ clearTimeout(t); t = setTimeout(gravar, 350); };
  const aplicarVisual = ()=>{
    // efeitos visuais imediatos, antes mesmo de gravar
    const tema = $('#cfgTema'); if (tema) state.cfg.tema = tema.value || 'auto';
    const ac = $('#cfgAcento');
    if (ac) state.cfg.acento = (ac.dataset.auto === '1') ? 'auto' : ac.value;
    applyTheme(state.cfg.tema);
    const z = $('#cfgZoom'); if (z) applyAppZoom(z.value);
    sincronizarCampoAcento();
  };

  ['#cfgEstudio','#cfgMoeda','#cfgWpp24','#cfgWpp2','#cfgAutoBackup','#cfgMsgWpp',
   '#cfgMsgWppConcluido','#cfgMsgWppCancelado','#cfgPixChave'].forEach(sel=>{
    const el = $(sel); if(!el) return;
    el.addEventListener('input', agendar);
    el.addEventListener('change', agendar);
  });
  ['#cfgTema','#cfgZoom'].forEach(sel=>{
    const el = $(sel); if(!el) return;
    const h = ()=>{ aplicarVisual(); agendar(); };
    el.addEventListener('input', h); el.addEventListener('change', h);
  });
  const ac = $('#cfgAcento');
  if (ac){
    const h = ()=>{ ac.dataset.auto = '0'; aplicarVisual(); agendar(); };
    ac.addEventListener('input', h); ac.addEventListener('change', h);
  }
  const btnPad = $('#btnAcentoPadrao');
  if (btnPad) btnPad.addEventListener('click', ()=>{
    if (ac) ac.dataset.auto = '1';
    aplicarVisual(); agendar();
  });

  // Cores dos agendamentos (Agendado / Concluído / Cancelado)
  let tc = null;
  ['#corAg','#corCo','#corCa'].forEach(sel=>{
    const el = $(sel); if(!el) return;
    const h = ()=>{
      state.cfg.cores = {ag:$('#corAg').value, co:$('#corCo').value, ca:$('#corCa').value};
      aplicarCoresAgenda();
      clearTimeout(tc); tc = setTimeout(()=>{ try{ salvarCores(); }catch(e){ console.error(e); } }, 350);
    };
    el.addEventListener('input', h); el.addEventListener('change', h);
  });

  // não perde alteração pendente se o app for fechado/minimizado
  const flush = ()=>{ if (t){ gravar(); } };
  document.addEventListener('visibilitychange', ()=>{ if (document.hidden) flush(); });
  window.addEventListener('pagehide', flush);
}
function limparCache(){
  if(!('caches' in window)) return alert('Cache não disponível neste navegador.');
  // Apaga o cache E desregistra o service worker; depois recarrega para baixar tudo de novo.
  const sw = ('serviceWorker' in navigator)
    ? navigator.serviceWorker.getRegistrations().then(rs=>Promise.all(rs.map(r=>r.unregister()))).catch(()=>{})
    : Promise.resolve();
  Promise.all([sw, caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k))))])
    .then(()=>{ alert('Cache limpo. O app vai recarregar.'); location.reload(); });
}
function resetApp(){
  if(!confirm('Resetar aplicativo (mantém perfis, zera dados deste perfil)?')) return;
  state.data = {clientes:[], servicos:[], agenda:[], tx:[], fiados:[], an:[], usuarios:[], backups:[], lastLogin:state.data.lastLogin};
  savePerfil(); refreshAll(); alert('Aplicativo resetado para este perfil.');
}
function testarConexao(){
  alert(navigator.onLine ? 'Conectado à internet.' : 'Sem conexão (offline).');
}

/* ======= AUTO BACKUP ======= */
function autoBackupIfNeeded(){
  if(!state.cfg.autoBackup) return;
  const last = state.data.backups?.[0]?.date;
  const d = new Date();
  const isNewDay = !last || (new Date(last)).toDateString() !== d.toDateString();
  if(isNewDay) backupManual(true);
}

