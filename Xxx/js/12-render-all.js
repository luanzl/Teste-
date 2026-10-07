/* Render geral de todas as telas
   Parte 13 de 14 do antigo app.v2.js (dividido na Etapa de modularização).
   Linhas originais: 5520-6143. Nenhuma linha de código foi alterada nesta divisão. */

/* ======= RENDER ALL ======= */


function renderMainCalendar(){
  const resumoCard   = document.getElementById('agendaResumoDiaCard');
  const resumoTitulo = document.getElementById('agendaResumoDiaTitulo');
  const resumoLista  = document.getElementById('agendaResumoDiaLista');

  let currentResumoDateISO = null;
  let lastScrollLeft = 0;

  const formatDateBrLong = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const buildResumoDia = (diaIso) => {
    if (!resumoCard || !resumoLista || !resumoTitulo) return;

    currentResumoDateISO = diaIso;

    const ags = (state.data.agenda || [])
      .filter(a => a && a.data === diaIso)
      .slice()
      .sort((a, b) => {
        const hA = (a.inicioHora || a.hora || '').padStart(5, '0');
        const hB = (b.inicioHora || b.hora || '').padStart(5, '0');
        return hA.localeCompare(hB);
      });

    resumoTitulo.textContent = formatDateBrLong(diaIso);

    if (ags.length === 0) {
      resumoLista.innerHTML = `
        <div class="agenda-resumo-card status-empty" style="flex:0 0 100%; text-align:center; min-height:80px; display:grid; place-items:center; opacity:0.8; padding:20px; border: 1px dashed var(--muted);">
          Não há agendamento para este dia.
        </div>
      `;
    } else {
      resumoLista.innerHTML = '';
      ags.forEach(a => {
        const nome = a.clienteNome || 'Sem nome';
        const dataBr = a.dataBr || (a.data || '').split('-').reverse().join('/');
        const diaInteiro = !!a.diaInteiro;
        const inicioHora = a.inicioHora || a.hora || '';
        const fimHora = a.fimHora || '';
        const descricao = a.obs && a.obs.trim() ? a.obs.trim() : (a.servico || '');
        const status = a.status || 'agendado';

        let linhaHorario = '';
        if (diaInteiro) linhaHorario = 'Dia inteiro';
        else if (inicioHora && fimHora) linhaHorario = inicioHora + ' - ' + fimHora;
        else if (inicioHora) linhaHorario = inicioHora;

        let detalheHoras = '';
        if (!diaInteiro && inicioHora) {
          detalheHoras = 'Início: ' + inicioHora + (fimHora ? ' • Fim: ' + fimHora : '');
        }

        const card = document.createElement('div');
        card.className = 'agenda-resumo-card status-' + status;
        card.innerHTML = `
          <div class="agenda-resumo-cliente">${escapeHtml(nome)}</div>
          <div class="agenda-resumo-dia-linha">${escapeHtml(dataBr)}</div>
          <div class="agenda-resumo-hora">${escapeHtml(linhaHorario)}</div>
          <div class="agenda-resumo-detalhe-horas">${escapeHtml(detalheHoras)}</div>
          <div class="agenda-resumo-descricao">${escapeHtml(descricao || '')}</div>
        `;
        resumoLista.appendChild(card);
      });
    }

    // Reseta scroll e listeners
    resumoLista.scrollLeft = 0;
    lastScrollLeft = 0;

    // Removido: antes o onscroll mudava de dia quando chegava no fim/início do carrossel.
    // Agora a rolagem horizontal só navega entre os agendamentos do próprio dia.
    resumoLista.onscroll = null;

  };

  const changeDayFromScroll = (offset) => {
    if (!currentResumoDateISO) return;
    const base = _parseISODateOnlyLocal(currentResumoDateISO);
    const next = new Date(base);
    next.setDate(base.getDate() + offset);
    const nextISO = _formatISODateOnlyLocal(next);

    const mainContainer = document.getElementById('mainCalendarContainer');
    if (!mainContainer) return;

    const tryClickDay = () => {
      const dayEl = mainContainer.querySelector('.calendar-day[data-date="' + nextISO + '"]') ||
                    mainContainer.querySelector('.calendar-week-strip-day[data-date="' + nextISO + '"]');
      if (dayEl) {
        dayEl.click(); // dispara onDateSelect + highlight
        return true;
      }
      return false;
    };

    if (tryClickDay()) {
      return;
    }

    // Se não encontrou, provavelmente está em outro mês -> navega
    const nextBtn = mainContainer.querySelector('.calendar-nav-btn[data-action="next"]');
    const prevBtn = mainContainer.querySelector('.calendar-nav-btn[data-action="prev"]');
    const useNext = next > base;

    const btn = useNext ? nextBtn : prevBtn;
    if (btn) {
      btn.click();
      setTimeout(tryClickDay, 40);
    }
  };

  const onDateSelect = (dateISO) => {
    // Linhas comentadas para evitar o scroll indesejado:
    // if ($('#agInicioData')) $('#agInicioData').value = dateISO; 
    // if ($('#agFimData') && !$('#agFimData').value) $('#agFimData').value = dateISO; 
    // if ($('#agData')) $('#agData').value = dateISO; 
    
    // Mantém apenas a função de carregar o resumo dos agendamentos do dia:
    buildResumoDia(dateISO);

    // Mantém apenas ajuste de rolagem horizontal do resumo (não mexe na rolagem vertical da página):
    const resumoScroll = document.getElementById('agendaResumoScroll');
    if (resumoScroll) {
      setTimeout(() => {
        resumoScroll.scrollLeft = 0;
      }, 0);
    }
}
;

  const baseDateStr =
    ($('#agInicioData') && $('#agInicioData').value) ||
    ($('#agData') && $('#agData').value) ||
    todayISO();

  window.renderCalendar('mainCalendarContainer', baseDateStr, onDateSelect, state.data.agenda);

  // monta resumo inicial
  onDateSelect(baseDateStr);
}



function initVisaoDonoControles(){
  const sel = document.getElementById('visaoDonoFiltroFuncionario');
  const inpMes = document.getElementById('visaoDonoFiltroMes');
  const btnLimpar = document.getElementById('visaoDonoBtnLimparFiltros');
  const btnRanking = document.getElementById('visaoDonoBtnRanking');
  if (!sel || !inpMes || !btnLimpar || !btnRanking) return;

  if (sel.dataset.bound === '1') return; // evita duplicar listeners
  sel.dataset.bound = '1';

  sel.addEventListener('change', ()=>{
    state.visaoDono = state.visaoDono || {};
    state.visaoDono.funcionarioId = sel.value;
    renderVisaoDono();
  });

  inpMes.addEventListener('change', ()=>{
    state.visaoDono = state.visaoDono || {};
    state.visaoDono.mes = inpMes.value || '';
    renderVisaoDono();
  });

  btnLimpar.addEventListener('click', ()=>{
    state.visaoDono = state.visaoDono || {};
    state.visaoDono.funcionarioId = '__all__';
    state.visaoDono.mes = '';
    sel.value = '__all__';
    inpMes.value = '';
    renderVisaoDono();
  });

  btnRanking.addEventListener('click', ()=>{
    state.visaoDono = state.visaoDono || {};
    const atual = !(state.visaoDono.ranking === false);
    state.visaoDono.ranking = !atual;
    btnRanking.textContent = state.visaoDono.ranking ? 'Ranking: ON' : 'Ranking: OFF';
    renderVisaoDono();
  });
}


function renderVisaoDono(){
  const containerResumo = document.getElementById('visaoDonoResumo');
  const containerLista = document.getElementById('visaoDonoLista');
  if (!containerResumo || !containerLista) return;

  const perfilAtual = getPerfilAtual();
  if (!perfilAtual || !isPerfilAdmin(perfilAtual.id)) {
    containerResumo.innerHTML = '';
    containerLista.innerHTML = '<p class="muted">Apenas o administrador tem acesso a esta visão.</p>';
    return;
  }

  initVisaoDonoControles();

  // mantém controles sincronizados com o estado
  try{
    const btnRanking = document.getElementById('visaoDonoBtnRanking');
    const sel = document.getElementById('visaoDonoFiltroFuncionario');
    const inpMes = document.getElementById('visaoDonoFiltroMes');
    const rOn = !(state.visaoDono && state.visaoDono.ranking === false);
    if (btnRanking) btnRanking.textContent = rOn ? 'Ranking: ON' : 'Ranking: OFF';
    if (sel) sel.value = (state.visaoDono && state.visaoDono.funcionarioId) ? String(state.visaoDono.funcionarioId) : '__all__';
    if (inpMes) inpMes.value = (state.visaoDono && state.visaoDono.mes) ? String(state.visaoDono.mes) : '';
  }catch(_){}

  // UI de carregamento (evita tela vazia em conexões lentas) — os "..."
  // agora são pontinhos animados, para ficar claro que está carregando.
  const dotsLoading = '<span class="loading-dots" aria-label="Carregando"><span></span><span></span><span></span></span>';
  containerResumo.innerHTML = `
    <div class="kpi green"><span class="kpi-label">Receitas totais</span><span class="kpi-value">${dotsLoading}</span></div>
    <div class="kpi red"><span class="kpi-label">Despesas totais</span><span class="kpi-value">${dotsLoading}</span></div>
    <div class="kpi blue"><span class="kpi-label">Saldo geral</span><span class="kpi-value">${dotsLoading}</span></div>
  `;
  containerLista.innerHTML = '<p class="muted">Carregando faturamento dos funcionários...</p>';

  // Carrega do Firestore (cloud-first)
  renderVisaoDonoAsync().catch(e=>{
    console.error('Erro na Visão do Dono', e);
    const msg = (e && (e.code || e.message)) ? String(e.code || e.message) : 'Erro desconhecido';
    if (/permission-denied/i.test(msg)) {
      containerLista.innerHTML = '<p class="muted">Sem permissão para ler os dados financeiros dos funcionários. Ajuste as Rules para permitir leitura do admin em perfis/{uid}/tx.</p>';
    } else {
      containerLista.innerHTML = '<p class="muted">Não foi possível carregar a visão do dono.</p>';
    }
  });
}

async function renderVisaoDonoAsync(){
  const containerResumo = document.getElementById('visaoDonoResumo');
  const containerLista = document.getElementById('visaoDonoLista');
  if (!containerResumo || !containerLista) return;

  const perfilAtual = getPerfilAtual();
  if (!perfilAtual || !isPerfilAdmin(perfilAtual.id)) return;

  if (!window.db || !auth || !auth.currentUser) {
    containerLista.innerHTML = '<p class="muted">Firestore não inicializado.</p>';
    return;
  }

  const adminUid = String(auth.currentUser.uid);

  const filtroFuncionario = (state.visaoDono && state.visaoDono.funcionarioId) ? String(state.visaoDono.funcionarioId) : '__all__';
  const filtroMes = (state.visaoDono && state.visaoDono.mes) ? String(state.visaoDono.mes) : '';
  const usarRanking = !(state.visaoDono && state.visaoDono.ranking === false);

  // Lista de funcionários registrados (perfis_usuarios), incluindo o próprio admin
  const perfis = Array.isArray(state.perfis) ? state.perfis : [];
  const funcionarios = perfis
    .filter(p => p && p.id && (String(p.ownerId||'') === adminUid))
    .map(p => ({ id: String(p.id), nome: p.nome || p.email || String(p.id) }));

  // Garante o próprio admin na lista
  if (!funcionarios.find(f => f.id === adminUid)) {
    funcionarios.unshift({ id: adminUid, nome: 'Você (Administrador)' });
  } else {
    // Renomeia o admin para ficar claro
    funcionarios.forEach(f=>{ if (f.id === adminUid) f.nome = f.nome || 'Você (Administrador)'; });
  }

  // Atualiza dropdown de funcionários
  try{
    const sel = document.getElementById('visaoDonoFiltroFuncionario');
    if (sel){
      const current = filtroFuncionario || '__all__';
      const opts = [];
      opts.push({id:'__all__', nome:'Todos os funcionários'});
      funcionarios.forEach(f=>opts.push({id:String(f.id), nome:f.nome}));
      sel.innerHTML = opts.map(o=>`<option value="${escapeHtml(o.id)}">${escapeHtml(o.nome)}</option>`).join('');
      sel.value = opts.find(o=>o.id===current) ? current : '__all__';
    }
    const inpMes = document.getElementById('visaoDonoFiltroMes');
    if (inpMes){
      inpMes.value = filtroMes || '';
    }
    const btnRanking = document.getElementById('visaoDonoBtnRanking');
    if (btnRanking){
      btnRanking.textContent = usarRanking ? 'Ranking: ON' : 'Ranking: OFF';
    }
  }catch(e){}

  // Carrega tx de cada funcionário e soma
  const rows = [];
  let totalGeralReceitas = 0;
  let totalGeralDespesas = 0;

  const sharedTxSnap = await db.collection('perfis').doc(adminUid).collection('tx').get();
  const sharedTx = [];
  sharedTxSnap.forEach(doc=>{ const t=doc.data()||{}; t.id=doc.id; sharedTx.push(t); });
  for (const f of funcionarios) {
    let rec = 0, desp = 0;
    sharedTx.forEach(t=>{
      const actor = String(t.createdByUid || adminUid); // legado sem autoria pertence ao admin
      if (actor !== String(f.id)) return;
      const dataIso = String(t.data || t.dataISO || t.data_iso || t.dataStr || '');
      if (filtroMes && (!dataIso || !dataIso.startsWith(filtroMes))) return;
      const v = Number(t.valor || 0) || 0;
      if (t.tipo === 'receita') rec += v;
      else if (t.tipo === 'despesa') desp += v;
    });
    const saldo = rec - desp;
    totalGeralReceitas += rec; totalGeralDespesas += desp;
    rows.push({id:f.id,nome:f.nome,faturamento:rec,receitas:rec,despesas:desp,saldo});
  }

  // Aplica filtro por funcionário (se houver)
  const rowsFiltradas = (filtroFuncionario && filtroFuncionario !== '__all__')
    ? rows.filter(r => String(r.id) === String(filtroFuncionario))
    : rows;

  const totalRecFiltrado = rowsFiltradas.reduce((s,r)=>s+(Number(r.receitas||0)||0),0);
  const totalDespFiltrado = rowsFiltradas.reduce((s,r)=>s+(Number(r.despesas||0)||0),0);

  // KPIs
  containerResumo.innerHTML = `
    <div class="kpi green">
      <span class="kpi-label">Receitas totais</span>
      <span class="kpi-value">${money(totalRecFiltrado, state.cfg.moeda)}</span>
    </div>
    <div class="kpi red">
      <span class="kpi-label">Despesas totais</span>
      <span class="kpi-value">${money(totalDespFiltrado, state.cfg.moeda)}</span>
    </div>
    <div class="kpi blue">
      <span class="kpi-label">Saldo geral</span>
      <span class="kpi-value">${money(totalRecFiltrado-totalDespFiltrado, state.cfg.moeda)}</span>
    </div>
  `;

  if (!rows.length){
    containerLista.innerHTML = '<p class="muted">Nenhum funcionário encontrado.</p>';
    return;
  }

  // Ordenação
  if (usarRanking){
    rows.sort((a,b)=>b.faturamento - a.faturamento);
  } else {
    rows.sort((a,b)=>String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  }

  containerLista.innerHTML = '';
  const lista = rowsFiltradas;
  if (!lista.length){
    containerLista.innerHTML = '<p class="muted">Nenhum dado financeiro encontrado para os filtros selecionados.</p>';
    return;
  }
  lista.forEach((r, idx)=>{
    const div = document.createElement('div');
    div.className = 'item';
    const iniciais = (String(r.nome||'').trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('') || '?').toUpperCase();
    div.innerHTML = `
      <div class="dp-tx-row">
        <div class="dp-avatar dp-avatar-${idx % 6}">${escapeHtml(iniciais)}</div>
        <div class="dp-item-main">
          <strong>${escapeHtml(r.nome)}</strong>
          <span>Despesas: ${money(r.despesas, state.cfg.moeda)} • Saldo: ${money(r.saldo, state.cfg.moeda)}</span>
        </div>
        <div class="dp-tx-value in">${money(r.faturamento, state.cfg.moeda)}</div>
      </div>
    `;
    containerLista.appendChild(div);
  });
}

function renderAuditV4(){
  const box=$('#listaAuditV4'); if(!box) return; box.innerHTML='';
  if(!isPerfilAdmin(state.perfilId)){ box.innerHTML='<p class="muted">Disponível apenas para o administrador.</p>'; return; }
  const q=(($('#buscaAuditV4')&&$('#buscaAuditV4').value)||'').toLowerCase();
  (state.data.audit||[]).slice().sort((a,b)=>(b.at||'').localeCompare(a.at||'')).filter(x=>!q||((x.actorName||'')+(x.summary||'')+(x.entity||'')).toLowerCase().includes(q)).slice(0,200).forEach(x=>{ const d=document.createElement('div'); d.className='item'; const when=x.at?new Date(x.at).toLocaleString('pt-BR'):'—'; d.innerHTML=`<strong>${escapeHtml(x.actorName||'Usuário')} • ${escapeHtml(x.entity||'')}</strong><div>${escapeHtml(x.summary||'')}</div><div class="muted" style="font-size:11px">${escapeHtml(when)} • ${escapeHtml(x.action||'')}</div>`; box.appendChild(d); });
  if(!box.children.length) box.innerHTML='<p class="muted">Nenhum registro de auditoria encontrado.</p>';
}
function populateResponsaveisV4(){
  const sel=$('#agResponsavel'); if(!sel) return; const old=sel.value; sel.innerHTML=''; (state.perfis||[]).filter(p=>isPerfilAdmin(p.id)||isFuncionarioAtivo(p)).forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.nome||p.email||'Usuário';sel.appendChild(o);}); sel.value=old||getCurrentActorId();
}

function populateAgendaFiltersV5(){
  const sel=$('#agFiltroResponsavel'); if(!sel) return;
  const old=sel.value||'all'; sel.innerHTML='<option value="all">Todos os profissionais</option>';
  (state.perfis||[]).filter(p=>isPerfilAdmin(p.id)||isFuncionarioAtivo(p)).forEach(p=>{
    const o=document.createElement('option'); o.value=p.id; o.textContent=p.nome||p.email||'Usuário'; sel.appendChild(o);
  });
  sel.value=[...sel.options].some(o=>o.value===old)?old:'all';
}
// V5.1 - Melhorias 14/15: resumo financeiro no card e KPIs do Dashboard como atalhos.
function v51OpenTab(tab){
  // Navegação direta dos atalhos do Dashboard. Não dispara o clique do menu
  // lateral, pois esse clique também controla a abertura/fechamento do hambúrguer.
  const menu=document.querySelector('#navMenu .menu-item[data-tab="'+tab+'"]');
  if(!menu || menu.classList.contains('hidden')) return false;

  $$('#navMenu .menu-item').forEach(b=>b.classList.remove('active'));
  menu.classList.add('active');
  $$('.tabpane').forEach(p=>{ p.classList.remove('show'); p.classList.remove('active'); });
  const pane=$('#tab-'+tab);
  if(pane){ pane.classList.add('show'); pane.classList.add('active'); }

  // Atalhos nunca podem abrir o menu hambúrguer.
  const sidebar=$('#sidebar'), overlay=$('#overlay');
  if(sidebar) sidebar.classList.remove('open');
  if(overlay) overlay.classList.remove('show');

  // Mantém os mesmos efeitos necessários da navegação normal.
  if(tab==='agenda'){
    agEditId=null;
    const t=$('#agFormTitle'); if(t) t.textContent='Novo Agendamento';
    const btnAg=$('#btnAgendar'); if(btnAg) btnAg.textContent='Agendar Serviço';
    const tabAg=$('#tab-agenda'); if(tabAg) tabAg.classList.remove('edit-mode');
  }
  if(tab==='meu-usuario') renderMeuUsuario();
  return !!pane;
}
function v51DashboardAction(action){
  if(action==='clientes'){ v51OpenTab('clientes'); return; }
  if(action==='financeiro'){ v51OpenTab('financeiro'); return; }
  if(!v51OpenTab('agenda')) return;
  // Atalhos do Dashboard apenas levam à Agenda. Filtros só são aplicados
  // quando o usuário abre a busca e escolhe explicitamente um filtro.
  const status=$('#agFiltroStatus'), resp=$('#agFiltroResponsavel'), busca=$('#buscaAgenda');
  agendaFilter='all';
  if(status) status.value='all';
  if(resp) resp.value='all';
  if(busca) busca.value='';
  try{ updateAgendaFilterButtonsV51(); }catch(e){}
  renderAgenda();
}
// ===== Atalhos extras do Dashboard (Ações Rápidas) =====
const DP_EXTRA_SHORTCUTS = [
  { id:'agenda',      label:'Agenda',          icon:'fa-solid fa-calendar-days', tab:'agenda' },
  { id:'financeiro',  label:'Financeiro',      icon:'fa-solid fa-coins',         tab:'financeiro' },
  { id:'visao-dono',  label:'Visão do Dono',   icon:'fa-solid fa-chart-line',    tab:'visao-dono' },
  { id:'clientes-x',  label:'Clientes',        icon:'fa-solid fa-users',        tab:'clientes' },
  { id:'servicos-x',  label:'Serviços',        icon:'fa-solid fa-bell-concierge', tab:'servicos' },
  { id:'config',      label:'Configurações',   icon:'fa-solid fa-gear',          tab:'config' },
  { id:'meu-usuario', label:'Meu usuário',     icon:'fa-solid fa-user',          tab:'meu-usuario' }
];
function dpGetAtalhosSalvos(){
  try{ return JSON.parse(localStorage.getItem('dpAtalhosExtras')||'[]'); }catch(e){ return []; }
}
function dpSalvarAtalhos(ids){
  try{ localStorage.setItem('dpAtalhosExtras', JSON.stringify(ids)); }catch(e){}
}
function renderDpAtalhosExtras(){
  // Os atalhos extras aparecem na folha do botão "+" da barra inferior.
  const grid = document.getElementById('dpSheetExtras');
  if(!grid) return;
  grid.innerHTML = '';
  const salvos = dpGetAtalhosSalvos();
  salvos.forEach(id=>{
    const item = DP_EXTRA_SHORTCUTS.find(s=>s.id===id); if(!item) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dps-btn compact dp-quick-extra';
    btn.dataset.dpNav = item.tab;
    btn.dataset.needs = item.tab;
    btn.innerHTML = `<i class="${item.icon}"></i><span>${escapeHtml(item.label)}</span>`;
    grid.appendChild(btn);
  });
  if(typeof window.dpTabBarSync === 'function') window.dpTabBarSync();
}
function renderListaAtalhosDisponiveis(){
  const box = document.getElementById('listaAtalhosDisponiveis'); if(!box) return;
  const salvos = dpGetAtalhosSalvos();
  box.innerHTML = DP_EXTRA_SHORTCUTS.map(item=>{
    const ativo = salvos.includes(item.id);
    return `<button type="button" class="menu-item cfg-menu-btn dp-atalho-toggle" data-id="${escapeHtml(item.id)}">
      <span class="cfg-left"><i class="${item.icon}"></i><span>${escapeHtml(item.label)}</span></span>
      <i class="fa-solid ${ativo ? 'fa-check' : 'fa-plus'}" style="${ativo ? 'color:#67e7a1' : ''}"></i>
    </button>`;
  }).join('');
  box.querySelectorAll('.dp-atalho-toggle').forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.dataset.id;
      let salvos = dpGetAtalhosSalvos();
      if(salvos.includes(id)) salvos = salvos.filter(x=>x!==id);
      else salvos.push(id);
      dpSalvarAtalhos(salvos);
      renderListaAtalhosDisponiveis();
      renderDpAtalhosExtras();
    };
  });
}
function bindDpQuickAdd(){
  if(window.__dpQuickAddBound) return; window.__dpQuickAddBound=true;
  renderDpAtalhosExtras();
}

// Executa uma ação rápida (usada pelo botão "+" da barra inferior e pelos links do Dashboard).
function dpRunQuickAction(action){
  if(action==='agenda'){ v51OpenTab('agenda'); return; }
  if(action==='novo-ag'){ v51OpenTab('agenda'); setTimeout(()=>{ const b=$('#btnAbrirNovoAgendamento'); if(b) b.click(); },0); return; }
  if(action==='novo-cliente'){ v51OpenTab('clientes'); setTimeout(()=>{ const b=$('#btnNovoCliente'); if(b) b.click(); },0); return; }
  if(action==='novo-servico'){ v51OpenTab('servicos'); setTimeout(()=>{ const b=$('#btnNovoServico'); if(b) b.click(); },0); return; }
  if(action==='relatorios'){ if(!v51OpenTab('visao-dono')) v51OpenTab('financeiro'); }
}

function bindDashboardActionsV51(){
  if(window.__v51DashboardBound) return; window.__v51DashboardBound=true;
  const dash=$('#tab-dashboard'); if(!dash) return;
  bindDpQuickAdd();
  dash.addEventListener('click',e=>{
    const nav=e.target.closest('[data-dp-nav]'); if(nav){ v51OpenTab(nav.dataset.dpNav); return; }
    const card=e.target.closest('[data-v51-action]'); if(card){ v51DashboardAction(card.dataset.v51Action); return; }
    const q=e.target.closest('[data-dp-action]'); if(!q) return;
    dpRunQuickAction(q.dataset.dpAction);
  });
  dash.addEventListener('keydown',e=>{ if((e.key==='Enter'||e.key===' ') && e.target.matches('[data-v51-action]')){ e.preventDefault(); v51DashboardAction(e.target.dataset.v51Action); } });
}
// ===== Dashboard · Modelo 8 (receita em destaque) =====
// Monta as linhas do gráfico (viewBox 200×80) a partir de uma série de valores.
function dpSparkPaths(serie){
  const W=200, H=80, PX=3, TOP=8, BOT=3, base=H-BOT;
  const n=serie.length, max=Math.max(0,...serie);
  const px=i=>PX+(W-2*PX)*i/(n-1);
  const py=v=>max>0 ? base-(base-TOP)*(v/max) : base;
  const pts=serie.map((v,i)=>[+px(i).toFixed(1), +py(v).toFixed(1)]);
  const line='M'+pts.map(p=>p.join(' ')).join(' L');
  const area=line+' L'+pts[n-1][0]+' '+base+' L'+pts[0][0]+' '+base+' Z';
  return {line, area, empty:max<=0};
}
function renderDashboardM8({hoje, agenda, tx, recHoje, pendHoje, addLocal}){
  const moeda=state.cfg.moeda;

  // Receita dos últimos 7 dias (o último ponto é hoje)
  const dias=[]; for(let i=6;i>=0;i--) dias.push(addLocal(hoje,-i));
  const porDia=new Map(dias.map(d=>[d,0]));
  tx.forEach(t=>{ if(t.tipo==='receita' && porDia.has(t.data)) porDia.set(t.data, porDia.get(t.data)+Number(t.valor||0)); });
  const serie=dias.map(d=>porDia.get(d));
  const ontem=serie[5];

  // Valor grande: fonte menor quando o número é comprido, para não espremer o gráfico
  const valEl=$('#stReceitaHoje');
  if(valEl){ const len=valEl.textContent.length; valEl.classList.toggle('is-long', len>=11); valEl.classList.toggle('is-xlong', len>=13); }

  // Variação vs ontem
  const badge=$('#dpReceitaTrend');
  if(badge){
    let dir='flat', txt;
    if(recHoje<=0 && ontem<=0){ txt='sem receita ainda'; }
    else if(ontem<=0){ dir='up'; txt='sem receita ontem'; }
    else{
      const pct=Math.round((recHoje-ontem)/ontem*100);
      dir=pct>0?'up':pct<0?'down':'flat';
      txt=pct===0?'igual a ontem':Math.abs(pct).toLocaleString('pt-BR')+'% vs ontem';
    }
    const icon=dir==='up'?'fa-caret-up':dir==='down'?'fa-caret-down':'fa-minus';
    badge.className='m8-badge is-'+dir;
    badge.innerHTML='<i class="fa-solid '+icon+'"></i><span>'+txt+'</span>';
  }

  // Legenda: total de fiados ainda em aberto
  const fiados=Array.isArray(state.data.fiados)?state.data.fiados:[];
  const aReceber=fiados.reduce((s,f)=>s+(Array.isArray(f.parcelas)?f.parcelas:[]).filter(p=>!p.pago).reduce((n,p)=>n+Number(p.valor||0),0),0);
  const legend=$('#dpSparkLegend');
  if(legend) legend.textContent='últimos 7 dias · '+money(aReceber,moeda)+' a receber';

  // Gráfico: só recomeça a se desenhar quando os dados mudam
  // (ao abrir a tela Início o CSS já reinicia a animação sozinho)
  const svg=$('#dpSpark'), line=$('#dpSparkLine'), area=$('#dpSparkArea');
  if(svg && line && area){
    const p=dpSparkPaths(serie);
    line.setAttribute('d',p.line); area.setAttribute('d',p.area);
    svg.classList.toggle('is-empty',p.empty);
    const sig=serie.join(',');
    if(svg.dataset.sig!==sig){
      svg.dataset.sig=sig;
      svg.classList.remove('is-drawing'); void svg.getBoundingClientRect(); svg.classList.add('is-drawing');
    }
  }

  // Hoje: quantos já foram concluídos
  const hojeAll=agenda.filter(a=>a.data===hoje);
  const hojeConcl=hojeAll.filter(a=>(a.status||'')==='concluido').length;
  const hi=$('#dpHojeInfo');
  if(hi){
    const t=hojeAll.length;
    hi.textContent=!t?'Nenhum hoje':hojeConcl===t?(t===1?'Concluído':'Todos concluídos'):hojeConcl+' de '+t+' concluídos';
    hi.classList.toggle('is-muted',!t);
  }

  // Clientes: cadastrados neste mês (só clientes com data de cadastro entram na conta)
  const ymLocal=iso=>{ const d=new Date(iso); return isNaN(d)?'':d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); };
  const ymHoje=hoje.slice(0,7);
  const novosMes=(state.data.clientes||[]).filter(c=>c.criadoEm && ymLocal(c.criadoEm)===ymHoje).length;
  const ci=$('#dpClientesInfo');
  if(ci){ ci.textContent=novosMes>0?'+'+novosMes+' este mês':'Sem novos este mês'; ci.classList.toggle('is-muted',novosMes<=0); }

  // Pendentes
  const pt=$('#dpPendText');
  if(pt) pt.textContent=pendHoje>0?'Em aberto':'Tudo em dia';
}
function renderDashboardV5(){
  const hoje=todayISO(); const agora=new Date(); const ym=hoje.slice(0,7);
  const addLocal=(iso,days)=>{ const [y,m,d]=iso.split('-').map(Number); const x=new Date(y,m-1,d); x.setDate(x.getDate()+days); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
  const limite=addLocal(hoje,7);
  const agenda=Array.isArray(state.data.agenda)?state.data.agenda:[];
  const tx=Array.isArray(state.data.tx)?state.data.tx:[];
  const recHoje=tx.filter(t=>t.tipo==='receita' && t.data===hoje).reduce((n,t)=>n+Number(t.valor||0),0);
  const prox7=agenda.filter(a=>(a.data||'')>=hoje && (a.data||'')<=limite && (a.status||'agendado')!=='cancelado');
  const pendHoje=agenda.filter(a=>a.data===hoje && (a.status||'agendado')==='agendado').length;
  const conclMes=agenda.filter(a=>String(a.data||'').startsWith(ym) && (a.status||'')==='concluido').length;
  const dpNome=$('#dpNomeUsuario'); if(dpNome){ const nome=String(getCurrentActorName()||'Usuário').trim().split(/\s+/)[0]||'Usuário'; dpNome.textContent=nome; }
  const dpData=$('#dpDataHoje'); if(dpData){ const [yy,mm,dd]=hoje.split('-').map(Number); dpData.textContent=new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long'}).format(new Date(yy,mm-1,dd)); }
  if($('#stReceitaHoje')) $('#stReceitaHoje').textContent=money(recHoje,state.cfg.moeda);
  if($('#stProx7')) $('#stProx7').textContent=String(prox7.length);
  if($('#stPendHoje')) $('#stPendHoje').textContent=String(pendHoje);
  if($('#stConclMes')) $('#stConclMes').textContent=String(conclMes);
  renderDashboardM8({hoje, agenda, tx, recHoje, pendHoje, addLocal});

  const box=$('#dashProximosV5');
  if(box){ box.innerHTML=''; const upcoming=agenda.filter(a=>{ if((a.status||'agendado')==='cancelado'||!a.data) return false; const key=`${a.data}T${a.inicioHora||a.hora||'23:59'}`; return a.data>hoje || (a.data===hoje && key>=`${hoje}T${String(agora.getHours()).padStart(2,'0')}:${String(agora.getMinutes()).padStart(2,'0')}`); }).sort((a,b)=>`${a.data}${a.inicioHora||a.hora||''}`.localeCompare(`${b.data}${b.inicioHora||b.hora||''}`)).slice(0,6);
    if(!upcoming.length) box.innerHTML='<p class="muted">Nenhum atendimento próximo.</p>';
    upcoming.forEach(a=>{ const d=document.createElement('div'); d.className='item'; const st=(a.status||'agendado'); const stLabel=st==='concluido'?'Concluído':st==='cancelado'?'Cancelado':st==='agendado'?'Agendado':'Pendente'; d.innerHTML=`<div class="dp-appointment-row"><div class="dp-ap-time">${escapeHtml(a.inicioHora||a.hora||'—')}</div><div class="dp-ap-main"><strong>${escapeHtml(a.clienteNome||'Cliente')}</strong><span>${escapeHtml(a.servico||'Serviço')} • ${escapeHtml(a.responsavelNome||a.createdByName||'—')}</span></div><span class="dp-ap-status ${escapeHtml(st)}">${stLabel}</span></div>`; box.appendChild(d); });
  }
  const prof=$('#dashProfissionaisV5');
  if(prof){ prof.innerHTML=''; const map=new Map(); agenda.filter(a=>String(a.data||'').startsWith(ym) && (a.status||'agendado')!=='cancelado').forEach(a=>{ const key=a.responsavelUid||a.createdByUid||'sem'; const cur=map.get(key)||{nome:a.responsavelNome||a.createdByName||'Sem responsável',qtd:0,concl:0,valor:0}; cur.qtd++; if((a.status||'')==='concluido'){cur.concl++;cur.valor+=Number(a.valor||0);} map.set(key,cur); }); const rows=[...map.values()].sort((a,b)=>b.concl-a.concl||b.valor-a.valor).slice(0,8); if(!rows.length) prof.innerHTML='<p class="muted">Sem dados neste mês.</p>'; rows.forEach(r=>{ const d=document.createElement('div'); d.className='item'; d.innerHTML=`<div class="v5-dash-line"><div class="v5-dash-main"><strong>${escapeHtml(r.nome)}</strong><div class="muted v5-dash-meta">${r.concl} concluído(s) de ${r.qtd} atendimento(s)</div></div><span class="v5-dash-value">${money(r.valor,state.cfg.moeda)}</span></div>`; prof.appendChild(d); }); }
}

function refreshAll(){
  // Cada tela é desenhada isoladamente: um documento malformado (gravado por um
  // usuário mal-intencionado) não pode interromper as outras telas do administrador.
  const run = (fn, ...args) => { try { fn(...args); } catch (e) { console.error('refreshAll:', fn && fn.name, e); } };
  try { bindDashboardActionsV51(); } catch (e) { console.error('refreshAll bind', e); }
  if(!window.__v5FiltersBound){ window.__v5FiltersBound=true; ['agFiltroStatus','agFiltroResponsavel'].forEach(id=>{const el=$('#'+id); if(el) el.addEventListener('change',renderAgenda);}); }
  run(renderMainCalendar);
  run(renderClientes);
  run(renderSelClientes, '#agCliente');
  run(renderSelClientes, '#anCliente');
  run(renderServicos);
  run(renderSelServicos, '#agServicoSel');
  run(renderAgenda);
  run(renderAgendaResumo);
  run(renderTx);
  run(renderFiados);
  run(renderUsuarios);
  run(renderFuncionarios);
  run(renderVisaoDono);
  run(renderAuditV4);
  run(populateResponsaveisV4);
  run(populateAgendaFiltersV5);
  run(refreshKpis);
  run(refreshSystemStats);
  run(renderDashboardV5);
}
/* ======= Cor de destaque livre ======= */
const _ACENTOS_LEGADOS = {blue:'#3b82f6', green:'#22c55e', purple:'#8b5cf6', red:'#ef4444'};
function normalizarAcento(v){
  v = String(v || '').trim().toLowerCase();
  if (_ACENTOS_LEGADOS[v]) return _ACENTOS_LEGADOS[v];
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  return null; // 'auto' / inválido = padrão do tema
}
function paletaAcento(hex){
  const n = parseInt(hex.slice(1), 16);
  const r = (n>>16)&255, g = (n>>8)&255, b = n&255;
  const h2 = x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2,'0');
  const mix = k => '#' + h2(r*k) + h2(g*k) + h2(b*k); // k<1 escurece
  return { claro: hex, escuro: mix(0.78) };
}

function applyTheme(pref){
  const root = document.documentElement;
  let tema = pref || (state && state.cfg && state.cfg.tema) || 'auto';

  if(tema === 'auto'){
    let prefersDark = true;
    if(window.matchMedia){
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      prefersDark = mq.matches;
      if(!applyTheme._bound){
        const handler = () => {
          if((state.cfg.tema||'auto') === 'auto') applyTheme();
        };
        if(mq.addEventListener) mq.addEventListener('change', handler);
        else if(mq.addListener) mq.addListener(handler);
        applyTheme._bound = true;
      }
    }
    tema = prefersDark ? 'dark' : 'light';
  }

  root.setAttribute('data-theme', tema);
  root.style.setProperty('color-scheme', tema==='light' ? 'light dark' : 'dark');

  // Cor de destaque: 'auto' = padrão do tema (Light = azul, Dark = vermelho, Verde = verde)
  // Aceita cor livre (#rrggbb) e os nomes antigos (blue/green/purple/red).
  const acento = (state && state.cfg && state.cfg.acento) || 'auto';
  const hexAcento = normalizarAcento(acento);
  let corBarra = '';
  if (hexAcento){
    const { claro, escuro } = paletaAcento(hexAcento);
    root.setAttribute('data-accent', 'custom');
    root.style.setProperty('--primary-light', claro);
    root.style.setProperty('--primary', escuro);
    corBarra = escuro;
  } else {
    root.removeAttribute('data-accent');
    root.style.removeProperty('--primary-light');
    root.style.removeProperty('--primary');
  }
  // Cor da barra de status do celular acompanha o cabeçalho (todos os temas).
  // O iOS/Safari guarda em cache a cor antiga quando só o "content" muda, então a tag
  // é recriada. Também relemos a cor depois que o CSS do novo tema foi aplicado.
  const atualizarBarra = ()=>{
    try {
      const cor = corBarra || getComputedStyle(root).getPropertyValue('--primary').trim();
      if (!cor) return;
      document.querySelectorAll('meta[name="theme-color"]').forEach(m=>m.remove());
      const tc = document.createElement('meta');
      tc.setAttribute('name','theme-color');
      tc.setAttribute('content', cor);
      document.head.appendChild(tc);
    } catch(e) { /* noop */ }
  };
  atualizarBarra();
  if (window.requestAnimationFrame) requestAnimationFrame(()=>requestAnimationFrame(atualizarBarra));
  setTimeout(atualizarBarra, 250);

  // Ajuste do 'vermelho' do app (ex: cancelados) para verde quando o tema verde estiver ativo
  try {
    if (state && state.cfg && state.cfg.cores) {
      const ca = String(state.cfg.cores.ca || '').toLowerCase();
      const isDefaultRed = (ca === '#ef4444' || ca === '#b91c1c' || ca === '#991b1b' || ca === '#ff0000');
      const isDefaultGreen = (ca === '#5dd62c');

      if (tema === 'green' && (isDefaultRed || !ca)) {
        state.cfg.cores.ca = '#5DD62C';
      }
      if (tema !== 'green' && isDefaultGreen) {
        state.cfg.cores.ca = '#EF4444';
      }

      document.documentElement.style.setProperty('--cor-ca', state.cfg.cores.ca);
      const corCaEl = document.getElementById('corCa');
      if (corCaEl) corCaEl.value = state.cfg.cores.ca;
    }
  } catch(e) { /* noop */ }
}



