/* Central de notificações
   Parte 8 de 14 do antigo app.v2.js (dividido na Etapa de modularização).
   Linhas originais: 2874-3731. Nenhuma linha de código foi alterada nesta divisão. */

/* ======= NOTIFICAÇÕES (Centro Inteligente) ======= */
const NOTIF_STORE_KEY = 'notifs.v1';

function loadNotifStore(){
  try{
    const raw = localStorage.getItem(NOTIF_STORE_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return {
      read: Array.isArray(obj.read) ? obj.read : [],
      dismissed: Array.isArray(obj.dismissed) ? obj.dismissed : [],
      pushed: Array.isArray(obj.pushed) ? obj.pushed : [],
      weeklyShown: Array.isArray(obj.weeklyShown) ? obj.weeklyShown : []
    };
  }catch(e){
    return { read:[], dismissed:[], pushed:[], weeklyShown:[] };
  }
}
function saveNotifStore(store){
  try{ localStorage.setItem(NOTIF_STORE_KEY, JSON.stringify(store||{})); }catch(e){}
}
function notifIdSafe(s){
  return String(s||'')
    .trim()
    .toLowerCase()
    .replace(/\s+/g,'-')
    .replace(/[^a-z0-9\-_.]/g,'')
    .slice(0, 80);
}

function parseAgendaDateTime(a){
  try{
    const d = String(a.data||'').slice(0,10);
    const h = String(a.hora||'').slice(0,5);
    if(!d || d.length<10 || !h || h.length<4) return null;
    const dt = new Date(`${d}T${h}:00`);
    if(isNaN(dt.getTime())) return null;
    return dt;
  }catch(e){ return null; }
}

function isoWeekKey(dt){
  // ISO week key: YYYY-Www
  const d = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  const yyyy = d.getUTCFullYear();
  return `${yyyy}-W${String(weekNo).padStart(2,'0')}`;
}

function isIOSDevice(){ return /iphone|ipad|ipod/i.test(navigator.userAgent || ''); }
function isStandaloneApp(){
  return (window.navigator.standalone === true) ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
}
// Situação das notificações do celular: granted | denied | default | unsupported | needs-install
function notifStatus(){
  if(!('Notification' in window)) return (isIOSDevice() && !isStandaloneApp()) ? 'needs-install' : 'unsupported';
  return Notification.permission;
}
// Precisa ser chamado dentro de um toque do usuário (regra do iOS/Android).
function requestNotificationPermission(){
  try{
    if(!('Notification' in window)) return Promise.resolve('unsupported');
    if(Notification.permission === 'default'){
      return Promise.resolve(Notification.requestPermission()).catch(()=>Notification.permission);
    }
    return Promise.resolve(Notification.permission);
  }catch(e){ return Promise.resolve('unsupported'); }
}

// Mostra a notificação pelo Service Worker (único jeito que funciona no iPhone/Android
// e que permite tocar nela para abrir o app). Tem som e vibração padrão do sistema.
async function showSystemNotification(title, body, data){
  const opts = {
    body: body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [200, 100, 200],
    silent: false,
    data: data || {}
  };
  if(data && data.nid){ opts.tag = data.nid; opts.renotify = true; }
  try{
    if('serviceWorker' in navigator){
      const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.ready);
      if(reg && reg.showNotification){ await reg.showNotification(title || 'Notificação', opts); return true; }
    }
  }catch(e){}
  try{
    const n = new Notification(title || 'Notificação', { body: opts.body, icon: opts.icon, data: opts.data });
    n.onclick = ()=>{ try{ window.focus(); }catch(e){} handleNotifClickData(opts.data); n.close(); };
    return true;
  }catch(e){ return false; }
}

function pushBrowserNotification(title, body, data){
  try{
    if(!('Notification' in window)) return false;
    if(Notification.permission !== 'granted') return false;
    showSystemNotification(title, body, data);
    return true;
  }catch(e){ return false; }
}

/**
 * Percorre state.data.agenda e gera notificações de agendamento.
 * Regra: alerta visual (e push, se permitido) a partir do momento em que faltar 12h.
 */
function checkBookingNotifications(now = new Date()){
  const store = loadNotifStore();
  const out = [];
  const agenda = (state && state.data && Array.isArray(state.data.agenda)) ? state.data.agenda : [];

  for(const a of agenda){
    const dt = parseAgendaDateTime(a);
    if(!dt) continue;

    const eventMs = dt.getTime();
    const triggerMs = eventMs - (12 * 60 * 60 * 1000);
    const nowMs = now.getTime();

    // Janela: do trigger até o horário do agendamento (com leve tolerância)
    if(nowMs < triggerMs) continue;
    if(nowMs > eventMs + (2 * 60 * 60 * 1000)) continue; // evita passado antigo

    const id = `booking-${notifIdSafe(a.id || `${a.data}-${a.hora}-${a.clienteNome||a.cliente||''}`)}`;
    if(store.dismissed.includes(id)) continue;

    const dataBr = a.dataBr || (a.data ? a.data.split('-').reverse().join('/') : '');
    const title = 'Agendamento em ~12h';
    const desc = `${a.clienteNome||'Cliente'}${a.servico?` • ${a.servico}`:''} — ${dataBr} ${a.hora||''}`.trim();

    out.push({
      id,
      kind: 'booking',
      title,
      message: desc,
      target: { type:'agenda', id:a.id },
      ts: triggerMs,
      unread: !store.read.includes(id)
    });

    // Push: dispara uma vez, assim que o app puder verificar dentro da janela
    // (de 12h antes até o horário do agendamento). Antes só valia nos 5 min iniciais,
    // então se o app estivesse fechado nesse momento o aviso nunca saía.
    if(!store.pushed.includes(id) && nowMs >= triggerMs && nowMs <= eventMs){
      if(pushBrowserNotification(title, desc, { nid:id, target:{ type:'agenda', id:a.id } })){
        store.pushed.push(id);
        saveNotifStore(store);
      }
    }
  }

  return out;
}

function getAniversariantesSemana(ref = new Date()){
  const clientes = (state && state.data && Array.isArray(state.data.clientes)) ? state.data.clientes : [];
  // Semana (Mon..Sun) da data ref, no fuso local
  const day = ref.getDay(); // 0..6 (Dom..Sab)
  const diffToMon = (day === 0) ? -6 : (1 - day);
  const monday = new Date(ref);
  monday.setHours(0,0,0,0);
  monday.setDate(monday.getDate() + diffToMon);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23,59,59,999);

  const mmddInRange = (mmdd)=>{
    try{
      const [mm,dd] = mmdd.split('-').map(x=>parseInt(x,10));
      if(!mm || !dd) return null;
      // usa ano atual para comparar janela
      const year = ref.getFullYear();
      const dt = new Date(year, mm-1, dd, 12, 0, 0, 0);
      // Se a janela atravessar ano (ex.: última semana de Dez), também testa ano+1/ano-1
      const candidates = [dt, new Date(year+1, mm-1, dd, 12,0,0,0), new Date(year-1, mm-1, dd, 12,0,0,0)];
      return candidates.some(c=> c.getTime() >= monday.getTime() && c.getTime() <= sunday.getTime());
    }catch(e){ return false; }
  };

  return clientes
    .filter(c=>{
      const nasc = (c && c.nasc) ? String(c.nasc) : '';
      if(nasc.length >= 10 && nasc.includes('-')){
        const mmdd = nasc.slice(5,10);
        return mmddInRange(mmdd);
      }
      return false;
    })
    .slice()
    .sort((a,b)=>(a.nome||'').localeCompare(b.nome||''));
}

function checkBirthdayNotifications(now = new Date()){
  const store = loadNotifStore();
  const out = [];

  // Diária: hoje
  const hoje = getAniversariantesHoje();
  for(const c of hoje){
    const id = `bday-${notifIdSafe(c.id || `${c.nome||'cliente'}-${String(c.nasc||'').slice(5,10)}`)}`;
    if(store.dismissed.includes(id)) continue;
    const title = 'Aniversário hoje 🎉';
    const msg = `Hoje é aniversário de ${c.nome||'um cliente'}! Envie um parabéns.`;
    out.push({ id, kind:'birthday', title, message: msg, ts: now.getTime(), unread: !store.read.includes(id), target:{ type:'clientes', busca: c.nome||'' } });
    const pid = id + '-' + now.toISOString().slice(0,10);
    if(!store.pushed.includes(pid) && pushBrowserNotification(title, msg, { nid:id, target:{ type:'clientes', busca: c.nome||'' } })){
      store.pushed.push(pid); saveNotifStore(store);
    }
  }

  // Semanal: segunda-feira 08h (mostra uma vez por semana)
  const isMonday = now.getDay() === 1;
  const after8 = (now.getHours() > 8) || (now.getHours() === 8 && now.getMinutes() >= 0);
  if(isMonday && after8){
    const weekKey = isoWeekKey(now);
    const weekId = `bweek-${weekKey}`;
    if(!store.weeklyShown.includes(weekId) && !store.dismissed.includes(weekId)){
      const list = getAniversariantesSemana(now);
      const nomes = list.map(x=>x.nome).filter(Boolean);
      const title = 'Aniversariantes da Semana';
      const msg = nomes.length ? `Aniversariantes da Semana: ${nomes.join(', ')}` : 'Aniversariantes da Semana: nenhum';
      out.push({ id: weekId, kind:'birthday-week', title, message: msg, ts: now.getTime(), unread: !store.read.includes(weekId), target:{ type:'clientes', busca:'' } });
      pushBrowserNotification(title, msg, { nid:weekId, target:{ type:'clientes', busca:'' } });

      // marca como "gerada" para não recriar várias vezes durante a renderização
      store.weeklyShown.push(weekId);
      saveNotifStore(store);
    }
  }

  return out;
}

function computeNotifications(){
  const now = new Date();
  const list = []
    .concat(checkBookingNotifications(now))
    .concat(checkBirthdayNotifications(now));

  // Ordena: mais recente primeiro (por ts)
  list.sort((a,b)=>(b.ts||0)-(a.ts||0));

  // remove duplicadas por id
  const seen = new Set();
  return list.filter(n=>{
    if(!n || !n.id) return false;
    if(seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });
}

function renderNotifications(){
  const panel = document.getElementById('notificationsScreen');
  const box = document.getElementById('notificationsList');
  const empty = document.getElementById('notificationsEmpty');
  const dot = document.getElementById('notifDot');
  const btnClear = document.getElementById('btnClearNotifications');
  if(!box) return;

  const store = loadNotifStore();
  const notifs = computeNotifications().filter(n=> !store.dismissed.includes(n.id));

  const unreadCount = notifs.filter(n=>n.unread).length;
  if(dot){
    dot.classList.toggle('hidden', unreadCount === 0);
  }

  box.innerHTML = '';

  if(empty){
    empty.classList.toggle('hidden', notifs.length !== 0);
  }

  const iconFor = (kind)=>{
    if(kind === 'booking') return 'fa-regular fa-clock';
    if(kind === 'birthday' || kind === 'birthday-week') return 'fa-solid fa-gift';
    return 'fa-regular fa-bell';
  };

  try{ renderNotifPermBanner(box); }catch(e){}
  notifs.forEach(n=>{
    const row = document.createElement('div');
    row.className = 'notif-item' + (n.unread ? '' : ' read') + (n.target ? ' is-clickable' : '');
    const meta = n.kind === 'booking' ? 'Lembrete de agendamento' : (n.kind === 'birthday-week' ? 'Resumo semanal' : 'Aniversário');
    row.innerHTML = `
      <div class="notif-left">
        <div class="notif-icon notif-icon--${escapeHtml(n.kind||'')}"><i class="${iconFor(n.kind)}"></i></div>
        <div class="notif-msg">
          <strong>${escapeHtml(n.title||'Notificação')}</strong>
          <div>${escapeHtml(n.message||'')}</div>
          <div class="notif-meta">${escapeHtml(meta)}</div>
        </div>
      </div>
      <div class="notif-actions">
        ${n.unread ? `<button class="btn ghost sm" type="button" data-act="read" data-id="${escapeHtml(n.id)}"><i class="fa-solid fa-check"></i></button>` : ''}
        <button class="btn ghost sm" type="button" data-act="dismiss" data-id="${escapeHtml(n.id)}"><i class="fa-solid fa-xmark"></i></button>
      </div>
    `;
    if(n.target){
      row.setAttribute('role','button'); row.tabIndex = 0;
      row.addEventListener('click', ev=>{ if(ev.target.closest('.notif-actions')) return; openNotifTarget(n); });
      row.addEventListener('keydown', ev=>{ if((ev.key==='Enter'||ev.key===' ') && !ev.target.closest('.notif-actions')){ ev.preventDefault(); openNotifTarget(n); } });
    }
    box.appendChild(row);
  });

  // binds
  box.querySelectorAll('[data-act="read"]').forEach(b=>{
    b.onclick = ()=>{
      const id = b.dataset.id;
      const s = loadNotifStore();
      if(id && !s.read.includes(id)) s.read.push(id);
      saveNotifStore(s);
      renderNotifications();
    };
  });
  box.querySelectorAll('[data-act="dismiss"]').forEach(b=>{
    b.onclick = ()=>{
      const id = b.dataset.id;
      const s = loadNotifStore();
      if(id && !s.dismissed.includes(id)) s.dismissed.push(id);
      saveNotifStore(s);
      renderNotifications();
    };
  });

  if(btnClear && !btnClear._bound){
    btnClear._bound = true;
    btnClear.onclick = ()=>{
      const s = loadNotifStore();
      // Dismiss todas marcadas como lidas (somente as que existem agora)
      notifs.filter(n=>!n.unread).forEach(n=>{
        if(!s.dismissed.includes(n.id)) s.dismissed.push(n.id);
      });
      saveNotifStore(s);
      renderNotifications();
    };
  }
}


function normalizePhoneBR(phoneRaw){
  const digits = String(phoneRaw||'').replace(/\D/g,'');
  if (!digits) return '';
  // Se já veio com código do país (ex: 55 + ...), mantém
  if (digits.length > 11) return digits;
  if (digits.length === 10 || digits.length === 11) return '55' + digits;
  return digits; // fallback
}

function sendWppBirthday(cliente){
  if(!cliente) return;
  if(!cliente.zap) return alert('Número de WhatsApp do cliente não cadastrado.');
  const fullPhone = normalizePhoneBR(cliente.zap);
  if(!fullPhone) return alert('Número de WhatsApp inválido.');
  const msg = `Olá ${cliente.nome||''}! Feliz aniversário! 🎉🎂`;
  const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function renderAniversariantesHoje(){
  const box = document.getElementById('listaAniversariantesHoje');
  if(!box) return;
  const arr = getAniversariantesHoje();
  box.innerHTML = '';
  if(!arr.length){
    box.innerHTML = '<p class="muted">Nenhum aniversariante hoje.</p>';
    return;
  }
  arr.forEach(c=>{
    const div = document.createElement('div');
    div.className = 'aniv-row';
    div.innerHTML = `
      <div class="aniv-left">
        <button class="btn success sm" data-id="${escapeHtml(c.id)}" title="Enviar WhatsApp"><i class="fa-brands fa-whatsapp"></i></button>
      </div>
      <div class="aniv-right">
        <strong>${escapeHtml(c.nome||'—')}</strong>
        <div class="muted">${escapeHtml(c.zap||'—')}${escapeHtml(c.email ? ' • ' + c.email : '')}</div>
      </div>
    `;
    box.appendChild(div);
  });
  box.querySelectorAll('button[data-id]').forEach(b=>{
    b.onclick = ()=>{
      const c = state.data.clientes.find(x=>x.id===b.dataset.id);
      sendWppBirthday(c);
    };
  });
}

function openModalAniversariantes(){
  const modal = document.getElementById('modalAniversariantes');
  if(!modal) return;
  renderAniversariantesHoje();
  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closeModalAniversariantes(){
  const modal = document.getElementById('modalAniversariantes');
  if(!modal) return;
  modal.classList.add('hidden');
  const anyOpen = document.querySelectorAll('.auth-modal:not(.hidden)').length > 0;
  document.body.classList.toggle('modal-open', anyOpen);
}

// Navega para a aba "Financeiro" e (opcionalmente) pré-preenche o formulário
function goToFinanceiro(){
  $$('.tabpane').forEach(p=>{ p.classList.remove('show'); p.classList.remove('active'); });
  $('#tab-financeiro').classList.add('show');
  // Ativar o item do menu lateral "Financeiro"
  $$('#navMenu .menu-item').forEach(b=>b.classList.remove('active'));
  const it = $$('#navMenu .menu-item[data-tab="financeiro"]')[0];
  if (it) it.classList.add('active');
}

// Abre o financeiro e deixa o formulário pronto para o usuário confirmar/editar
function txFromAgendamento(id){
  const a = state.data.agenda.find(x=>x.id===id);
  if(!a) return;
  goToFinanceiro();
  openFormTx('receita');
  $('#txDesc').value = `Serviço: ${escapeHtml(a.servico||'')} • Cliente: ${escapeHtml(a.clienteNome||'')}`;
  $('#txValor').value = (a.valor||0).toFixed(2).replace('.',',');
  $('#txData').value = a.data;
  $('#txCat').value = 'Serviços';
}

// Lança automaticamente a transação (1 clique)
function lancarTxFromAgendamento(id){
  const a = state.data.agenda.find(x=>x.id===id);
  if(!a) return;
  // Evita duplicidade: se já foi lançado, apenas avisa.
  if (a.lancadoFinanceiro || a.txId) {
    toast('');
    return;
  }

  // Cria a transação diretamente (sem abrir tela intermediária)
  const txId = uid();
  const dataISO = a.data || todayISO();
  const obj = {
    id: txId,
    tipo: 'receita',
    desc: `Serviço: ${escapeHtml(a.servico||'')} • Cliente: ${escapeHtml(a.clienteNome||'')}`,
    valor: Number(a.valor||0),
    data: dataISO,
    dataBr: formatDateBR(dataISO),
    cat: 'Serviços',
    // vínculo (útil para rastrear)
    origem: 'agenda',
    origemId: a.id
  };
  state.data.tx.push(obj);

  // marca no agendamento
  a.lancadoFinanceiro = true;
  a.txId = txId;
  a.lancadoFinanceiroEm = new Date().toISOString();

  savePerfil();
  cloudSaveDoc('tx', obj);
  cloudSaveDoc('agenda', a);

  // Atualiza totais/listas em tempo real (sem recarregar)
  try { renderTx(); } catch(e) {}
  try { refreshKpis(); } catch(e) {}
  try { renderAgenda(); } catch(e) {}
  try { renderAgendaResumo(); } catch(e) {}

  // toast removido (pedido do usuário)
}

// V5.1 - Melhoria 10: ações rápidas de status diretamente no card da Agenda.
function atualizarStatusAgendamentoRapido(id, novoStatus){
  const a = state.data.agenda.find(x=>x.id===id);
  if(!a) return alert('Agendamento não encontrado.');
  const anterior = String(a.status || 'agendado');
  if(anterior === novoStatus) return;
  const rotulo = novoStatus === 'concluido' ? 'Concluído' : (novoStatus === 'cancelado' ? 'Cancelado' : 'Agendado');
  if(!confirm(`Alterar o status deste agendamento para ${rotulo}?`)) return;
  a.status = novoStatus;
  a.updatedByUid = getCurrentActorId();
  a.updatedByName = getCurrentActorName();
  a.updatedAt = new Date().toISOString();
  auditLog('update','agenda',a.id,`Status do agendamento de ${a.clienteNome||'cliente'} alterado de ${anterior} para ${novoStatus}`);
  savePerfil();
  cloudSaveDoc('agenda', a);
  renderAgenda();
  try { renderAgendaResumo(); } catch(e) {}
  try { renderMainCalendar(); } catch(e) {}
  try { refreshKpis(); } catch(e) {}
}

function renderAgenda(){
  const buscaEl = $('#buscaAgenda');
  const q = (buscaEl && buscaEl.value ? buscaEl.value : '').toLowerCase();
  const box = $('#listaAgenda');
  if (!box || !state || !state.data || !Array.isArray(state.data.agenda)) return;

  box.innerHTML = '';

  (state.data.agenda || [])
    .slice()
    // V5.1 - Melhoria 09: ordenação cronológica usa o horário atual do agendamento.
    // Registros novos usam inicioHora; registros antigos continuam compatíveis com hora.
    .sort((a,b)=> {
      const dataA = String(a.inicioData || a.data || '');
      const dataB = String(b.inicioData || b.data || '');
      const porData = dataA.localeCompare(dataB);
      if (porData) return porData;
      const horaA = a.diaInteiro ? '00:00' : String(a.inicioHora || a.hora || '23:59');
      const horaB = b.diaInteiro ? '00:00' : String(b.inicioHora || b.hora || '23:59');
      return horaA.localeCompare(horaB);
    })
    .filter(a=>{
      const texto = ((a.servico||'') + (a.obs||'') + (a.clienteNome||'')).toLowerCase();
      const dataBr = (a.dataBr || (a.data ? a.data.split('-').reverse().join('/') : '')).toLowerCase();
      return !q || texto.includes(q) || dataBr.includes(q);
    })
    .filter(a=>{
      const st = ($('#agFiltroStatus') && $('#agFiltroStatus').value) || 'all';
      const resp = ($('#agFiltroResponsavel') && $('#agFiltroResponsavel').value) || 'all';
      if(st !== 'all' && (a.status||'agendado') !== st) return false;
      if(resp !== 'all' && (a.responsavelUid||a.createdByUid||'') !== resp) return false;
      return true;
    })
    .filter(a=>{
      // filtros rápidos: today / tomorrow / week / all
      if (typeof agendaFilter === 'undefined' || agendaFilter === 'all') return true;

      const dataISO = a.inicioData || a.data;
      if (!dataISO || typeof dataISO !== 'string') return true;

      const partes = dataISO.split('-');
      if (partes.length !== 3) return true;
      const [yy, mm, dd] = partes.map(Number);
      if (!yy || !mm || !dd) return true;

      const dt = new Date(yy, mm - 1, dd);
      const hoje = new Date();
      const hojeISO = todayISO();

      if (agendaFilter === 'today') {
        return dataISO === hojeISO;
      }

      if (agendaFilter === 'tomorrow') {
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        const amanhaISO = `${amanha.getFullYear()}-${String(amanha.getMonth()+1).padStart(2,'0')}-${String(amanha.getDate()).padStart(2,'0')}`;
        return dataISO === amanhaISO;
      }

      if (agendaFilter === 'week') {
        const inicioSemana = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
        const fimSemana = new Date(inicioSemana);
        fimSemana.setDate(fimSemana.getDate() + 7);
        return dt >= inicioSemana && dt < fimSemana;
      }

      return true;
    })
    .forEach(a=>{
      const div = document.createElement('div');
      div.className = 'item agenda-card';
      div.dataset.status = a.status || 'agendado';
      div.dataset.id = a.id;

      const jaLancadoFinanceiro = !!(a.lancadoFinanceiro || a.txId);

      const horarioLabel = a.diaInteiro
        ? 'Dia inteiro'
        : (a.inicioHora || a.hora)
          ? `${a.inicioHora || a.hora}${a.fimHora ? ' - ' + a.fimHora : ''}`
          : '';

      const dataBase = a.dataBr || (a.data ? a.data.split('-').reverse().join('/') : '');
      let diaSemana = '';
      if (a.data) {
        const partesDt = a.data.split('-');
        if (partesDt.length === 3) {
          const [yy, mm, dd] = partesDt.map(Number);
          if (yy && mm && dd) {
            const dt = new Date(yy, mm - 1, dd);
            diaSemana = dt.toLocaleDateString('pt-BR', { weekday: 'short' });
          }
        }
      }
      const dataLabel = diaSemana ? `${dataBase} (${diaSemana})` : dataBase;
      // V5.1 - Melhorias 06/07: identificação visual de hoje e amanhã.
      // É apenas apresentação: não altera filtros, status ou dados salvos.
      const hojeISOV51 = todayISO();
      const amanhaV51 = new Date();
      amanhaV51.setDate(amanhaV51.getDate() + 1);
      const amanhaISOV51 = `${amanhaV51.getFullYear()}-${String(amanhaV51.getMonth()+1).padStart(2,'0')}-${String(amanhaV51.getDate()).padStart(2,'0')}`;
      const dataAgendaV51 = String(a.data || '').trim().slice(0, 10);
      const statusAgendaV51 = String(a.status || 'agendado').trim().toLowerCase();
      const isHojeV51 = dataAgendaV51 === hojeISOV51;
      const isAmanhaV51 = dataAgendaV51 === amanhaISOV51;
      // V5.1 - Melhoria 08 (corrigida): normaliza data/status antes da comparação.
      // Assim registros antigos ou sincronizados com pequenas variações de formato também são reconhecidos.
      const isAtrasadoV51 = /^\d{4}-\d{2}-\d{2}$/.test(dataAgendaV51)
        && dataAgendaV51 < hojeISOV51
        && statusAgendaV51 === 'agendado';
      const hojeBadgeV51 = isHojeV51
        ? '<span class="ag-hoje-badge-v51">HOJE</span>'
        : (isAmanhaV51
          ? '<span class="ag-amanha-badge-v51">AMANHÃ</span>'
          : (isAtrasadoV51 ? '<span class="ag-atrasado-badge-v51">ATRASADO</span>' : ''));
      const statusLabel = safeAgStatus(a.status).toUpperCase();

      // Modelo 1: card compacto + botão de três pontos que abre a lista de ações dentro do card.
      // Os botões continuam com os mesmos data-act/data-id, então os handlers abaixo não mudam.
      const responsavelLabel = escapeHtml(a.responsavelNome||a.createdByName||'—');
      div.innerHTML = `
        <div class="ag-head">
          <div class="ag-head-main">
            <div class="ag-text ag-cliente">${escapeHtml(a.clienteNome||'')}</div>
            <div class="ag-sub">${escapeHtml(a.servico||'')} · ${responsavelLabel}</div>
          </div>
          <button type="button" class="ag-more" aria-expanded="false" aria-label="Abrir ações do agendamento" title="Ações">
            <i class="fa-solid fa-ellipsis-vertical"></i>
          </button>
        </div>
        <div class="ag-meta">
          <div class="ag-text ag-datahora">${escapeHtml(dataLabel)}${escapeHtml(horarioLabel ? ' • ' + horarioLabel : '')} ${hojeBadgeV51}</div>
          <div class="ag-text ag-valor">${money(a.valor, state.cfg.moeda)}</div>
        </div>
        <div class="ag-tags">
          <div class="ag-status-tag ag-status-${safeAgStatus(a.status)}">${statusLabel}</div>
          <div class="ag-fin-resumo-v51 ${jaLancadoFinanceiro ? 'is-ok' : 'is-pendente'}">
            <i class="fa-solid ${jaLancadoFinanceiro ? 'fa-circle-check' : 'fa-clock'}"></i>
            ${jaLancadoFinanceiro ? 'Financeiro lançado' : 'Pendente de lançamento'}
          </div>
        </div>
        <div class="ag-menu" hidden>
          <button type="button" class="ag-mi ag-btn" data-id="${escapeHtml(a.id)}" data-act="wpp" title="Abrir WhatsApp do cliente com a mensagem do agendamento">
            <i class="fa-brands fa-whatsapp"></i><span>WhatsApp</span>
          </button>
          ${statusAgendaV51 !== 'concluido' ? `<button type="button" class="ag-mi ag-btn" data-id="${escapeHtml(a.id)}" data-act="quick_done" title="Marcar como concluído"><i class="fa-solid fa-check"></i><span>Concluir</span></button>` : ''}
          <button type="button" class="ag-mi ag-btn" data-id="${escapeHtml(a.id)}" data-act="tx">
            <i class="fa-solid fa-coins"></i><span>Financeiro</span>
          </button>
          <button type="button" class="ag-mi ag-btn ${jaLancadoFinanceiro ? 'is-launched' : ''}" data-id="${escapeHtml(a.id)}" data-act="tx_lancar" title="${jaLancadoFinanceiro ? 'Já lançado' : 'Lançar'}">
            <i class="fa-solid ${jaLancadoFinanceiro ? 'fa-circle-check' : 'fa-cash-register'}"></i><span>${jaLancadoFinanceiro ? 'Lançado' : 'Lançar'}</span>
          </button>
          <button type="button" class="ag-mi ag-btn" data-id="${escapeHtml(a.id)}" data-act="edit">
            <i class="fa-solid fa-pen"></i><span>Editar</span>
          </button>
          ${statusAgendaV51 !== 'cancelado' ? `<button type="button" class="ag-mi ag-btn is-danger" data-id="${escapeHtml(a.id)}" data-act="quick_cancel" title="Marcar como cancelado"><i class="fa-solid fa-ban"></i><span>Cancelar</span></button>` : ''}
          <button type="button" class="ag-mi ag-btn is-danger" data-id="${escapeHtml(a.id)}" data-act="del">
            <i class="fa-solid fa-trash"></i><span>Excluir</span>
          </button>
        </div>
        `;

      box.appendChild(div);
    });

  // V5.1 - Melhoria 03: informa quantos agendamentos ficaram visíveis após os filtros.
  // Usa apenas os cards já renderizados para não duplicar nem alterar a lógica dos filtros.
  const agendaContagemV51 = $('#agendaContagemV51');
  if (agendaContagemV51) {
    const totalVisivel = box.children.length;
    agendaContagemV51.textContent = totalVisivel === 1
      ? '1 agendamento encontrado'
      : `${totalVisivel} agendamentos encontrados`;

    // V5.1 - Melhoria 05: resumo textual dos filtros ativos.
    // Apenas lê os controles existentes; não altera a lógica de filtragem nem os dados.
    const filtrosAtivosEl = $('#agendaFiltrosAtivosV51');
    if (filtrosAtivosEl) {
      const partesFiltro = [];
      const periodoLabels = { today: 'Hoje', tomorrow: 'Amanhã', week: 'Esta semana' };
      if (typeof agendaFilter !== 'undefined' && agendaFilter !== 'all' && periodoLabels[agendaFilter]) {
        partesFiltro.push(periodoLabels[agendaFilter]);
      }
      const statusEl = $('#agFiltroStatus');
      if (statusEl && statusEl.value !== 'all') {
        partesFiltro.push(`Status: ${statusEl.options[statusEl.selectedIndex]?.text || statusEl.value}`);
      }
      const respEl = $('#agFiltroResponsavel');
      if (respEl && respEl.value !== 'all') {
        partesFiltro.push(`Profissional: ${respEl.options[respEl.selectedIndex]?.text || 'Selecionado'}`);
      }
      if (q) partesFiltro.push(`Busca: ${buscaEl.value.trim()}`);
      filtrosAtivosEl.textContent = partesFiltro.length
        ? `Filtros ativos: ${partesFiltro.join(' • ')}`
        : 'Sem filtros adicionais';
    }

    // V5.1 - Melhoria 04: estado vazio da Agenda.
    // É inserido somente depois da contagem, portanto não interfere nos filtros nem nos dados.
    if (totalVisivel === 0) {
      const vazio = document.createElement('div');
      vazio.className = 'agenda-empty-v51';
      vazio.innerHTML = `
        <i class="fa-regular fa-calendar-xmark" aria-hidden="true"></i>
        <strong>Nenhum agendamento encontrado com esses filtros.</strong>
        <span>Tente alterar os filtros ou limpar a busca atual.</span>
        <button class="btn ghost xs" type="button" id="btnAgendaEmptyLimparV51">Limpar filtros</button>
      `;
      box.appendChild(vazio);
      const btnVazio = $('#btnAgendaEmptyLimparV51');
      if (btnVazio) btnVazio.onclick = () => {
        const btnLimpar = $('#btnLimparFiltrosAgenda');
        if (btnLimpar) btnLimpar.click();
      };
    }
  }

  // Modelo 1: abre/fecha o menu de ações dentro do card (um aberto por vez).
  box.onclick = (ev)=>{
    const more = ev.target.closest('.ag-more');
    if (more){
      const card = more.closest('.agenda-card');
      const menu = card && card.querySelector('.ag-menu');
      if (!menu) return;
      const abrir = menu.hidden;
      box.querySelectorAll('.ag-menu').forEach(m=>{
        m.hidden = true;
        const b = m.closest('.agenda-card').querySelector('.ag-more');
        if (b){ b.setAttribute('aria-expanded','false'); b.classList.remove('is-open'); }
      });
      menu.hidden = !abrir;
      more.setAttribute('aria-expanded', abrir ? 'true' : 'false');
      more.classList.toggle('is-open', abrir);
      return;
    }
    const item = ev.target.closest('.ag-mi');
    if (item){
      const menu = item.closest('.ag-menu');
      if (menu){
        menu.hidden = true;
        const b = menu.closest('.agenda-card').querySelector('.ag-more');
        if (b){ b.setAttribute('aria-expanded','false'); b.classList.remove('is-open'); }
      }
    }
  };

  $$('#listaAgenda [data-act="del"]').forEach(btn=>{
    btn.onclick = (ev)=>{
      const id = ev.currentTarget.dataset.id;
      if (confirm('Excluir este agendamento?')){
        delAgendamento(id);
        refreshKpis();
      }
    };
  });
  $$('#listaAgenda [data-act="wpp"]').forEach(btn=>{
    btn.onclick = (ev)=>{
      const id = ev.currentTarget.dataset.id;
      sendWppReminder(id);
    };
  });
  $$('#listaAgenda [data-act="tx"]').forEach(btn=>{
    btn.onclick = (ev)=>{
      const id = ev.currentTarget.dataset.id;
      txFromAgendamento(id);
    };
  });
  $$('#listaAgenda [data-act="tx_lancar"]').forEach(btn=>{
    btn.onclick = (ev)=>{
      const id = ev.currentTarget.dataset.id;
      lancarTxFromAgendamento(id);
    };
  });
  $$('#listaAgenda [data-act="quick_done"]').forEach(btn=>{
    btn.onclick = (ev)=> atualizarStatusAgendamentoRapido(ev.currentTarget.dataset.id, 'concluido');
  });
  $$('#listaAgenda [data-act="quick_cancel"]').forEach(btn=>{
    btn.onclick = (ev)=> atualizarStatusAgendamentoRapido(ev.currentTarget.dataset.id, 'cancelado');
  });
  $$('#listaAgenda [data-act="edit"]').forEach(btn=>{
    btn.onclick = (ev)=>{
      const id = ev.currentTarget.dataset.id;
      editAgendamento(id);
    };
  });
}



function gerarRelatorioAgendaPdf(){
  if (!state || !state.data || !Array.isArray(state.data.agenda)) {
    alert('Nenhum dado de agenda disponível.');
    return;
  }

  const win = window.open('', '_blank');
  if (!win) {
    alert('Não foi possível abrir o relatório. Verifique bloqueio de pop-ups.');
    return;
  }

  const hoje = new Date();
  const dataGeracao = hoje.toLocaleDateString('pt-BR');
  const horaGeracao = hoje.toLocaleTimeString('pt-BR').slice(0,5);

  const itens = (state.data.agenda || [])
    .slice()
    .sort((a,b)=> String(a.data||'').localeCompare(String(b.data||'')) || String(a.hora||'').localeCompare(String(b.hora||'')));

  // Esta janela é do MESMO domínio do app (herda a sessão de quem está logado).
  // Por isso todo dado que veio da nuvem passa por escapeHtml, o relatório não
  // carrega nenhum script e tem a própria CSP (default-src 'none').
  const linhas = itens.map(a=>{
    const data = a.dataBr || (a.data ? String(a.data).split('-').reverse().join('/') : '');
    const hora = a.diaInteiro ? 'Dia inteiro' : (a.inicioHora || a.hora || '');
    const status = safeAgStatus(a.status).toUpperCase();
    const valor = money(a.valor || 0, state.cfg.moeda || 'BRL');
    return `
      <tr>
        <td>${escapeHtml(data)}</td>
        <td>${escapeHtml(hora)}</td>
        <td>${escapeHtml(a.clienteNome || '')}</td>
        <td>${escapeHtml(a.servico || '')}</td>
        <td>${escapeHtml(status)}</td>
        <td style="text-align:right;">${escapeHtml(valor)}</td>
      </tr>`;
  }).join('');

  const html = `
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
      <title>Relatório de Agenda</title>
      <style>
        body {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          padding: 24px;
        }
        h1 { font-size: 20px; margin-bottom: 4px; }
        h2 { font-size: 13px; font-weight: 500; color: #555; margin-top: 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; }
        th { background:#f5f5f5; text-align: left; }
        tfoot td { font-weight: 600; }
      </style>
    </head>
    <body>
      <h1>Relatório de Agenda</h1>
      <h2>Gerado em ${dataGeracao} às ${horaGeracao}</h2>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Hora</th>
            <th>Cliente</th>
            <th>Serviço</th>
            <th>Status</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          ${linhas || '<tr><td colspan="6">Nenhum agendamento encontrado.</td></tr>'}
        </tbody>
      </table>
    </body>
    </html>
  `;

  win.document.write(html);
  win.document.close();
  // A impressão é disparada a partir do app (o relatório não tem script próprio).
  setTimeout(function(){ try{ win.focus(); win.print(); }catch(e){} }, 400);
}

function renderAgendaResumo(){
  // Mantém o Dashboard (Receita Hoje, Pendentes, Próximos Agendamentos
  // etc.) sempre sincronizado na hora que um agendamento é criado,
  // editado ou excluído — mesmo que a aba Dashboard não esteja aberta
  // no momento.
  try { renderDashboardV5(); } catch(e) { /* noop */ }
  const box = $('#agendaResumo');
  if(!box) return;
  const hoje = new Date();
  const mes = hoje.getMonth();
  const ano = hoje.getFullYear();
  let totalMes = 0;
  let conclMes = 0;
  (state.data.agenda||[]).forEach(a=>{
    if(!a.data) return;
    const [yy, mm, dd] = a.data.split('-').map(Number);
    if(!yy || !mm || !dd) return;
    const d = new Date(yy, mm - 1, dd);
    if(d.getMonth()===mes && d.getFullYear()===ano){
      const v = Number(a.valor||0);
      totalMes += v;
      if((a.status||'agendado')==='concluido') conclMes += v;
    }
  });
  box.innerHTML = `
    <div class="kpi">
      <span class="kpi-label">Previsto no mês</span>
      <span class="kpi-value">${money(totalMes, state.cfg.moeda)}</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">Concluído no mês</span>
      <span class="kpi-value">${money(conclMes, state.cfg.moeda)}</span>
    </div>
  `;
}


/* ===== Notificações clicáveis + permissão do celular ===== */
function fecharTelaNotificacoes(){
  const sc = document.getElementById('notificationsScreen');
  if(sc) sc.classList.add('hidden');
  document.body.classList.remove('notif-open');
}

// Leva até o agendamento (rola até o card e destaca) ou até o cliente.
function openNotifTarget(n){
  const t = n && n.target; if(!t) return;
  try{
    const st = loadNotifStore();
    if(n.id && !st.read.includes(n.id)){ st.read.push(n.id); saveNotifStore(st); }
  }catch(e){}
  fecharTelaNotificacoes();
  if(t.type === 'agenda'){
    try{ v51DashboardAction('agenda'); }catch(e){}
    let tentativas = 0;
    const achar = ()=>{
      const box = document.getElementById('listaAgenda');
      let el = null;
      if(box) el = Array.from(box.querySelectorAll('.agenda-card')).find(c=> c.dataset.id === String(t.id));
      if(el){
        el.scrollIntoView({ behavior:'smooth', block:'center' });
        el.classList.add('ag-highlight');
        setTimeout(()=>el.classList.remove('ag-highlight'), 3000);
      } else if(++tentativas < 6){ setTimeout(achar, 150); }
    };
    setTimeout(achar, 80);
  } else if(t.type === 'clientes'){
    try{ v51OpenTab('clientes'); }catch(e){}
    const b = document.getElementById('buscaCliente');
    if(b){ b.value = t.busca || ''; }
    try{ renderClientes(); }catch(e){}
    try{ window.scrollTo(0,0); }catch(e){}
  }
  try{ if(window.dpTabBarSync) window.dpTabBarSync(); }catch(e){}
  try{ renderNotifications(); }catch(e){}
}

// Toque numa notificação do sistema (vem do Service Worker ou da URL ao abrir o app)
function handleNotifClickData(data){
  if(!data || !data.target) return;
  let tent = 0;
  const go = ()=>{
    const pronto = state && state.data && Array.isArray(state.data.agenda) && document.getElementById('listaAgenda');
    if(!pronto && ++tent < 40){ setTimeout(go, 500); return; }
    openNotifTarget({ id: data.nid, target: data.target });
  };
  go();
}

function renderNotifPermBanner(box){
  if(!box || !box.parentNode) return;
  let el = document.getElementById('notifPermBanner');
  if(!el){
    el = document.createElement('div');
    el.id = 'notifPermBanner';
    box.parentNode.insertBefore(el, box);
    el.addEventListener('click', async ev=>{
      const b = ev.target.closest('button[data-perm]'); if(!b) return;
      if(b.dataset.perm === 'fechar'){
        try{ localStorage.setItem('notifPermDismiss', notifStatus()); }catch(e){}
        renderNotifPermBanner(box); return;
      }
      if(b.dataset.perm === 'ativar'){
        const r = await requestNotificationPermission();
        if(r === 'granted'){
          showSystemNotification('Notificações ativadas ✅', 'Você vai receber os lembretes dos agendamentos aqui.', { nid:'teste-notif' });
        }
      } else if(b.dataset.perm === 'testar'){
        showSystemNotification('Teste de notificação', 'Se você viu e ouviu isso, está tudo certo.', { nid:'teste-notif' });
      }
      renderNotifPermBanner(box);
    });
  }
  const st = notifStatus();
  // Se o usuário fechou o aviso neste mesmo estado, não mostra de novo.
  // Se o estado mudar (ex.: bloqueado -> permitido), o aviso volta a ser avaliado.
  let fechado = '';
  try{ fechado = localStorage.getItem('notifPermDismiss') || ''; }catch(e){}
  if(st === 'default'){ try{ localStorage.removeItem('notifPermDismiss'); }catch(e){} fechado = ''; }
  const X = '<button type="button" class="np-x" data-perm="fechar" aria-label="Fechar aviso"><i class="fa-solid fa-xmark"></i></button>';
  let html = '';
  if(fechado === st && st !== 'default'){
    html = '';
  } else if(st === 'granted'){
    html = '<div class="np-row is-ok"><i class="fa-solid fa-bell"></i><span>Notificações do celular ativadas</span><button type="button" class="btn ghost sm" data-perm="testar">Testar</button>'+X+'</div>';
  } else if(st === 'default'){
    html = '<div class="np-row"><i class="fa-regular fa-bell"></i><span>Ative para receber os lembretes com som no celular</span><button type="button" class="btn sm violet" data-perm="ativar">Ativar</button></div>';
  } else if(st === 'denied'){
    html = '<div class="np-row is-warn"><i class="fa-solid fa-bell-slash"></i><span>Notificações bloqueadas. ' + (isIOSDevice() ? 'Vá em Ajustes do iPhone > Notificações > 2letters e permita.' : 'Permita nas configurações do site/app do navegador.') + '</span>'+X+'</div>';
  } else if(st === 'needs-install'){
    html = '<div class="np-row is-warn"><i class="fa-solid fa-mobile-screen"></i><span>No iPhone, as notificações só funcionam com o app instalado: toque em Compartilhar > Adicionar à Tela de Início e abra por lá.</span>'+X+'</div>';
  } else {
    html = '<div class="np-row is-warn"><i class="fa-solid fa-circle-info"></i><span>Este navegador não suporta notificações do celular.</span>'+X+'</div>';
  }
  if(el._html !== html){ el.innerHTML = html; el._html = html; }
}

// Abre o alvo quando o app é aberto/trazido à frente por um toque na notificação
try{
  if('serviceWorker' in navigator){
    navigator.serviceWorker.addEventListener('message', ev=>{
      const d = ev && ev.data;
      if(d && d.type === 'notif-click') handleNotifClickData(d.data);
    });
  }
  const qs = new URLSearchParams(location.search);
  if(qs.get('ntype')){
    const alvo = { type: qs.get('ntype'), id: qs.get('nid') || '', busca: qs.get('nbusca') || '' };
    try{ history.replaceState(null, '', location.pathname); }catch(e){}
    handleNotifClickData({ nid:'', target: alvo });
  }
  // Ao voltar para o app, verifica na hora (pode ter entrado na janela de 12h)
  document.addEventListener('visibilitychange', ()=>{
    if(!document.hidden){ try{ renderNotifications(); }catch(e){} }
  });
  // Voltou dos Ajustes do iPhone depois de permitir: reavalia o aviso na hora
  window.addEventListener('focus', ()=>{ try{ renderNotifications(); }catch(e){} });
}catch(e){}
