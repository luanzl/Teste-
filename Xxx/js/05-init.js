/* Inicialização do app (init) — liga toda a interface
   Parte 6 de 14 do antigo app.v2.js (dividido na Etapa de modularização).
   Linhas originais: 1419-2604. Nenhuma linha de código foi alterada nesta divisão. */

/* ======= INICIAL ======= */
document.addEventListener('DOMContentLoaded', init);
function init(){
  setTimeout(()=>{ const q=$('#buscaAuditV4'); if(q) q.oninput=renderAuditV4; },0);
  // Acessibilidade: os botões de fechar modal (×/✕) só têm um símbolo
  // como conteúdo, o que não diz nada para quem usa leitor de tela.
  // Aplica "aria-label" a todos eles de uma vez (cobre também qualquer
  // modal novo que venha a usar essas mesmas classes no futuro).
  document.querySelectorAll('.auth-modal-x, .auth-modal-close').forEach(b=>{
    if (!b.hasAttribute('aria-label')) b.setAttribute('aria-label', 'Fechar');
  });
  // garante que modais (ex.: Novo Agendamento) e o conteúdo abaixo do
  // cabeçalho (ex.: "VISÃO GERAL" no dashboard) fiquem sempre visíveis
  // logo abaixo do cabeçalho fixo, mesmo depois que fontes/ícones/imagens
  // terminarem de carregar e mudarem a altura real do cabeçalho.
  initAppHeaderHeightSync();
  window.addEventListener('resize', syncAppHeaderHeight);
  window.addEventListener('orientationchange', syncAppHeaderHeight);

  // Cloud-first: tema inicial neutro (será ajustado depois de carregar cfg da nuvem).
  applyTheme('auto');

  // Cloud-only: não usamos perfis locais.
  try { state.perfis = []; } catch(e){}

  // Se já estiver logado (refresh / outro dispositivo), carrega direto.
  try{
    if (auth && typeof auth.onAuthStateChanged === 'function') {
      auth.onAuthStateChanged(function(user){
        if (user && user.email) {
          integrarUsuarioAoSistema(user.email);
        }
      });
    }
  }catch(e){ console.error(e); }
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


  // Modo de autenticação inicial
  try {
    setAuthMode('login');
  } catch(e) { /* pode não estar na tela de login */ }

  // Preenche e-mail salvo (lembrar de mim)
  try {
    const savedEmail = localStorage.getItem('studioLH__remember_email');
    if (savedEmail) {
      const emailInput = document.getElementById('emailLogin');
      const rememberEl = document.getElementById('rememberLogin');
      if (emailInput) emailInput.value = savedEmail;
      if (rememberEl) rememberEl.checked = true;
    }
  } catch(e) {}



  
  // Controle da tela "Usuários": alternar entre lista e formulário de cadastro
  try {
    const listView = $('#usuariosListView');
    const cadView = $('#usuariosCadastroView');

    if (listView && cadView) {
      // Estado inicial: mostra lista, esconde cadastro
      listView.classList.remove('hidden');
      cadView.classList.add('hidden');
    }

    const btnNovo = $('#btnNovoFuncionario');
    if (btnNovo && listView && cadView) {
      btnNovo.onclick = function(){
        listView.classList.add('hidden');
        cadView.classList.remove('hidden');
      };

    // Botão: mostrar/ocultar funcionários inativos (apenas visual)
    const btnToggleInativos = $('#btnToggleInativos');
    if (btnToggleInativos) {
      btnToggleInativos.textContent = state.mostrarInativos ? 'Ocultar inativos' : 'Mostrar inativos';
      btnToggleInativos.onclick = function(){
        state.mostrarInativos = !state.mostrarInativos;
        btnToggleInativos.textContent = state.mostrarInativos ? 'Ocultar inativos' : 'Mostrar inativos';
        renderFuncionarios();
      };
    }
    }

    const btnSalvar = $('#usAdd');
    if (btnSalvar) {
      btnSalvar.onclick = addFuncionarioUsuarios;
    }

    const btnCancelar = $('#btnCancelarCadastroFuncionario');
    if (btnCancelar && listView && cadView) {
      btnCancelar.onclick = function(){
        cadView.classList.add('hidden');
        listView.classList.remove('hidden');
      };
    }
  } catch(e){
    console.error(e);
  }



  const hoje = new Date();

  if ($('#agInicioData')) $('#agInicioData').valueAsDate = hoje;
  if ($('#agFimData'))    $('#agFimData').valueAsDate    = hoje;
  if ($('#agData'))       $('#agData').valueAsDate       = hoje;
  if ($('#txData'))       $('#txData').valueAsDate       = hoje;

  const syncDataInputs = () => {
    syncAgFormHiddenFields();
    renderMainCalendar();
  };

let agendaFilter = 'all'; // filtro rápido da agenda (today/tomorrow/week/all)


  if ($('#agInicioData')) $('#agInicioData').addEventListener('change', syncDataInputs);
  if ($('#agFimData'))    $('#agFimData').addEventListener('change', renderMainCalendar);

  if ($('#agDiaInteiro')) {
    const toggleDiaInteiro = () => {
      const full = $('#agDiaInteiro').checked;
      if ($('#agInicioHora')) $('#agInicioHora').disabled = full;
      if ($('#agFimHora'))    $('#agFimHora').disabled    = full;
      if (full) {
        if ($('#agInicioHora')) $('#agInicioHora').value = '';
        if ($('#agFimHora'))    $('#agFimHora').value    = '';
      }
      syncAgFormHiddenFields();
      renderMainCalendar();
    };
    $('#agDiaInteiro').addEventListener('change', toggleDiaInteiro);
    toggleDiaInteiro();
  }

  
  // eventos principais
  if ($('#btnEntrar')) $('#btnEntrar').onclick = entrarSistema;
  if ($('#btnCadastro')) $('#btnCadastro').onclick = onClickCriarConta;
  if ($('#btnResetSenha')) $('#btnResetSenha').onclick = onClickEsqueciSenha;
  if ($('#btnAlterarSenha')) $('#btnAlterarSenha').onclick = abrirModalAlterarSenha;
  if ($('#btnGoogleLogin')) $('#btnGoogleLogin').onclick = entrarComGoogle;
  if ($('#btnVoltarLogin')) $('#btnVoltarLogin').onclick = function(){ setAuthMode('login'); };
  if ($('#btnEnviarReset')) $('#btnEnviarReset').onclick = resetSenhaFirebase;
  if ($('#btnSair')) $('#btnSair').onclick = sairSistema;
  if ($('#sbBtnSair')) $('#sbBtnSair').onclick = sairSistema;

  const notificationsScreen = document.getElementById('notificationsScreen');
const btnToggleSaldo = document.getElementById('btnToggleSaldo');
const btnCloseNotifications = document.getElementById('btnCloseNotifications');

function openNotificationsScreen(){
  try{ requestNotificationPermission(); }catch(e){}
  if(!notificationsScreen) return;
  notificationsScreen.classList.remove('hidden');
  document.body.classList.add('notif-open');
  renderNotifications();
}

function closeNotificationsScreen(){
  if(!notificationsScreen) return;
  notificationsScreen.classList.add('hidden');
  document.body.classList.remove('notif-open');
}

if (btnToggleSaldo) btnToggleSaldo.addEventListener('click', openNotificationsScreen);
if (btnCloseNotifications) btnCloseNotifications.addEventListener('click', closeNotificationsScreen);

// Fecha no ESC (desktop)
document.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape' && notificationsScreen && !notificationsScreen.classList.contains('hidden')){
    closeNotificationsScreen();
  }
});
if ($('#altSenhaCancelar')) $('#altSenhaCancelar').onclick = fecharModalAlterarSenha;
  if ($('#altSenhaFechar')) $('#altSenhaFechar').onclick = fecharModalAlterarSenha;
  if ($('#altSenhaSalvar')) $('#altSenhaSalvar').onclick = salvarNovaSenha;

  if ($('#btnMeuUsuarioSalvar')) $('#btnMeuUsuarioSalvar').onclick = salvarMeuUsuario;

  const imgBtn = $('#btnMeuUsuarioImagem');
  const imgInput = $('#meuUsuarioImagemInput');
  if (imgBtn && imgInput){
    imgBtn.onclick = ()=> imgInput.click();
    // A foto redonda também é um botão: tocar nela abre a galeria
    const avBtn = document.querySelector('#tab-meu-usuario .perfil-avatar');
    if (avBtn){
      avBtn.setAttribute('role','button'); avBtn.setAttribute('tabindex','0');
      avBtn.setAttribute('aria-label','Alterar foto de perfil');
      avBtn.onclick = ()=> imgInput.click();
      avBtn.onkeydown = (e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); imgInput.click(); } };
    }
    imgInput.addEventListener('change', handleMeuUsuarioImagemChange);
  }
  const capaBtn = $('#btnMeuUsuarioCapa');
  const capaInput = $('#meuUsuarioCapaInput');
  if (capaBtn && capaInput){
    capaBtn.onclick = ()=> capaInput.click();
    capaInput.addEventListener('change', handleMeuUsuarioCapaChange);
  }
  const capaRm = $('#btnMeuUsuarioCapaRemover');
  if (capaRm) capaRm.onclick = removerMeuUsuarioCapa;

  // $('#btnAddFuncionario').onclick = addFuncionario; // Removido a pedido do usuário
  // binding do botão de salvar funcionário é configurado de acordo com o modo (lista vs cadastro)

  $('#btnAgendar').onclick = salvarAgendamento;
  // Campo de imagem do agendamento removido

  $('#openReceita').onclick = ()=>openFormTx('receita');
  $('#openDespesa').onclick = ()=>openFormTx('despesa');
  $('#btnCloseTx').onclick = ()=>$('#formTransacao').classList.add('hidden');
  $('#btnAddTx').onclick = addTransacao;

  // Fiados
  if ($('#btnNovoFiado')) $('#btnNovoFiado').onclick = ()=>openFormFiado();
  if ($('#btnCancelarFiado')) $('#btnCancelarFiado').onclick = closeFormFiado;
  if ($('#btnSalvarFiado')) $('#btnSalvarFiado').onclick = salvarFiado;
  if ($('#buscaFiado')) $('#buscaFiado').oninput = renderFiados;

  $('#btnAddCliente').onclick = addCliente;

  const btnNovoCliente = $('#btnNovoCliente');
  if (btnNovoCliente) {
    btnNovoCliente.onclick = ()=>{
      // Abre a tela dedicada de cadastro de cliente
      $('#clNome').value=''; $('#clEmail').value=''; $('#clZap').value=''; $('#clNasc').value=''; $('#clEnd').value='';
      $('#btnAddCliente').textContent='Cadastrar Cliente';
      $('#btnAddCliente').onclick = addCliente;
      if (typeof abrirCadastroCliente === 'function') abrirCadastroCliente();
      $('#clNome').focus();
    };
  }

  // Aniversariantes (hoje)
  const btnAnivers = document.getElementById('btnAniversariantes');
  if (btnAnivers) btnAnivers.onclick = openModalAniversariantes;
  const anivFechar = document.getElementById('anivFechar');
  if (anivFechar) anivFechar.onclick = closeModalAniversariantes;
  const modalAniv = document.getElementById('modalAniversariantes');
  if (modalAniv){
    const backdrop = modalAniv.querySelector('.auth-modal-backdrop[data-close="1"]');
    if (backdrop) backdrop.onclick = closeModalAniversariantes;
  }

  const btnVoltarClientes = $('#btnVoltarClientes');
  if (btnVoltarClientes) {
    btnVoltarClientes.onclick = ()=>{
      // Volta para a lista de clientes e reseta o formulário
      $('#clNome').value=''; $('#clEmail').value=''; $('#clZap').value=''; $('#clNasc').value=''; $('#clEnd').value='';
      $('#btnAddCliente').textContent='Cadastrar Cliente';
      $('#btnAddCliente').onclick = addCliente;
      if (typeof voltarListaClientes === 'function') voltarListaClientes();
    };
  }
  // Botão "X" no topo do cadastro de cliente: mesma ação de "Voltar para lista"
  // (fecha o formulário e volta para a tela de onde ele foi aberto).
  const btnFecharCadastroCliente = $('#btnFecharCadastroCliente');
  if (btnFecharCadastroCliente && btnVoltarClientes) {
    btnFecharCadastroCliente.onclick = ()=> btnVoltarClientes.onclick();
  }

  $('#btnAddServico').onclick = addServico;

  const btnNovoServico = $('#btnNovoServico');
  if (btnNovoServico) {
    btnNovoServico.onclick = ()=>{
      $('#svNome').value=''; $('#svDescricao').value=''; $('#svPreco').value='0,00'; $('#svDuracao').value='';
      $('#btnAddServico').textContent='Cadastrar Serviço';
      $('#btnAddServico').onclick = addServico;
      if (typeof abrirCadastroServico === 'function') abrirCadastroServico();
      $('#svNome').focus();
    };
  }

  const btnVoltarServicos = $('#btnVoltarServicos');
  if (btnVoltarServicos) {
    btnVoltarServicos.onclick = ()=>{
      $('#svNome').value=''; $('#svDescricao').value=''; $('#svPreco').value='0,00'; $('#svDuracao').value='';
      $('#btnAddServico').textContent='Cadastrar Serviço';
      $('#btnAddServico').onclick = addServico;
      if (typeof voltarListaServicos === 'function') voltarListaServicos();
    };
  }
  // Botão "X" no topo do cadastro de serviço: mesma ação de "Voltar para lista".
  const btnFecharCadastroServico = $('#btnFecharCadastroServico');
  if (btnFecharCadastroServico && btnVoltarServicos) {
    btnFecharCadastroServico.onclick = ()=> btnVoltarServicos.onclick();
  }

  $('#agServicoSel').addEventListener('change', preencherValorServico);

  // Seletor com aparência de botão (Agenda)
  const btnAgClientePicker = document.getElementById('btnAgClientePicker');
  if (btnAgClientePicker) {
    btnAgClientePicker.onclick = openModalBuscaClienteAg;
  }
  const selAgCliente = document.getElementById('agCliente');
  if (selAgCliente) {
    selAgCliente.addEventListener('change', ()=>{ try { syncAgClientePicker(); } catch(e) {} });
    try { syncAgClientePicker(); } catch(e) {}
  }

  const btnAgServicoSelPicker = document.getElementById('btnAgServicoSelPicker');
  if (btnAgServicoSelPicker) {
    // Abre o modal de busca/seleção de serviços (Novo Agendamento)
    btnAgServicoSelPicker.onclick = openModalBuscaServicoAg;
  }
  const selAgServicoSel = document.getElementById('agServicoSel');
  if (selAgServicoSel) {
    selAgServicoSel.addEventListener('change', ()=>{ try { syncAgServicoSelPicker(); } catch(e) {} });
    try { syncAgServicoSelPicker(); } catch(e) {}
  }

  // Lupa de busca de cliente no Novo Agendamento
  const btnBuscaClienteAg = document.getElementById('btnBuscaClienteAg');
  if (btnBuscaClienteAg) {
    btnBuscaClienteAg.onclick = openModalBuscaClienteAg;
  }
  const modalBuscaClienteAg = document.getElementById('modalBuscaClienteAg');
  if (modalBuscaClienteAg) {
    const fechar = document.getElementById('agClienteBuscaFechar');
    if (fechar) fechar.onclick = closeModalBuscaClienteAg;
    const backdrop = modalBuscaClienteAg.querySelector('.auth-modal-backdrop[data-close="1"]');
    if (backdrop) backdrop.onclick = closeModalBuscaClienteAg;
    const inp = document.getElementById('agClienteBuscaInput');
    if (inp) {
      inp.addEventListener('input', ()=>renderBuscaClienteAgLista(inp.value));
      inp.addEventListener('keydown', (e)=>{ if(e.key==='Enter') e.preventDefault(); });
    }
    document.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape' && !modalBuscaClienteAg.classList.contains('hidden')) {
        closeModalBuscaClienteAg();
      }
    });
  }

  // Modal de busca de serviço no Novo Agendamento
  const modalBuscaServicoAg = document.getElementById('modalBuscaServicoAg');
  if (modalBuscaServicoAg) {
    const fechar = document.getElementById('agServicoBuscaFechar');
    if (fechar) fechar.onclick = closeModalBuscaServicoAg;
    const backdrop = modalBuscaServicoAg.querySelector('.auth-modal-backdrop[data-close="1"]');
    if (backdrop) backdrop.onclick = closeModalBuscaServicoAg;
    const inp = document.getElementById('agServicoBuscaInput');
    if (inp) {
      inp.addEventListener('input', ()=>renderBuscaServicoAgLista(inp.value));
      inp.addEventListener('keydown', (e)=>{ if(e.key==='Enter') e.preventDefault(); });
    }
    document.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape' && !modalBuscaServicoAg.classList.contains('hidden')) {
        closeModalBuscaServicoAg();
      }
    });
  }

  // ===== Modal: Novo Agendamento (form dentro da modal) =====
  const modalNovoAgendamento = document.getElementById('modalNovoAgendamento');
  const btnAbrirNovoAgendamento = document.getElementById('btnAbrirNovoAgendamento');
  const agModalFechar = document.getElementById('agModalFechar');
  const agModalVoltar = document.getElementById('agModalVoltar');

  function syncBodyModalOpen(){
    const anyOpen = document.querySelectorAll('.auth-modal:not(.hidden)').length > 0;
    document.body.classList.toggle('modal-open', anyOpen);
  }

  function openModalNovoAgendamento(){
    if (!modalNovoAgendamento) return;
    modalNovoAgendamento.classList.remove('hidden');
    modalNovoAgendamento.setAttribute('aria-hidden','false');
    syncBodyModalOpen();
    // foco amigável
    setTimeout(()=>{
      const f = document.getElementById('btnAgClientePicker') || document.getElementById('agServico');
      try { f && f.focus(); } catch(e) {}
    }, 0);
  }

  function closeModalNovoAgendamento(){
    if (!modalNovoAgendamento) return;
    modalNovoAgendamento.classList.add('hidden');
    modalNovoAgendamento.setAttribute('aria-hidden','true');
    syncBodyModalOpen();
    // Fechou sem salvar durante uma edição: desfaz o modo de edição
    if (agEditId) { try { resetAgendamentoEdicao(); } catch(e) {} }
  }

  if (btnAbrirNovoAgendamento) btnAbrirNovoAgendamento.onclick = openModalNovoAgendamento;
  if (agModalFechar) agModalFechar.onclick = closeModalNovoAgendamento;
  if (agModalVoltar) agModalVoltar.onclick = closeModalNovoAgendamento;
  if (modalNovoAgendamento) {
    const backdrop = modalNovoAgendamento.querySelector('.auth-modal-backdrop[data-close="1"]');
    if (backdrop) backdrop.onclick = closeModalNovoAgendamento;
    document.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape' && !modalNovoAgendamento.classList.contains('hidden')) {
        closeModalNovoAgendamento();
      }
    });
  }

  $('#btnSalvarAn').onclick = salvarAnamnese;
  $$('#tab-anamnese .btn.model').forEach(b=>b.onclick = ()=>gerarModelo(b.dataset.modelo));
  initAnamnese();

  $('#btnExportar').onclick = exportarDados;
  $('#fileImport').addEventListener('change', importarDados);
  $('#btnBackup').onclick = backupManual;
  $('#btnRecuperar').onclick = recuperarUltimo;
  $('#btnRelatorio').onclick = exportarRelatorio;
  if ($('#btnExportAgenda')) $('#btnExportAgenda').onclick = exportAgendaCSV;
  if ($('#btnRelatorioAgendaPdf')) $('#btnRelatorioAgendaPdf').onclick = gerarRelatorioAgendaPdf;
  if ($('#btnExportTx')) $('#btnExportTx').onclick = exportTxCSV;

  function updateAgendaQuickFilterUI(){
    $$('.ag-filtros-rapidos [data-ag-filter]').forEach(btn=>{
      const active = btn.dataset.agFilter === agendaFilter;
      btn.classList.toggle('ag-filter-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }
  $$('.ag-filtros-rapidos [data-ag-filter]').forEach(btn=>{
    btn.onclick = ()=>{
      agendaFilter = btn.dataset.agFilter;
      updateAgendaQuickFilterUI();
      renderAgenda();
    };
  });
  updateAgendaQuickFilterUI();

  // V5.1 - Melhoria 02: limpar todos os filtros da Agenda em uma única ação.
  // Mantido aqui, junto aos filtros rápidos, para não alterar a lógica de renderização/gravação.
  const btnLimparFiltrosAgenda = $('#btnLimparFiltrosAgenda');
  if (btnLimparFiltrosAgenda) {
    btnLimparFiltrosAgenda.onclick = ()=>{
      const busca = $('#buscaAgenda');
      const status = $('#agFiltroStatus');
      const responsavel = $('#agFiltroResponsavel');
      if (busca) busca.value = '';
      if (status) status.value = 'all';
      if (responsavel) responsavel.value = 'all';
      agendaFilter = 'all';
      updateAgendaQuickFilterUI();
      renderAgenda();
    };
  }

  ligarConfigAoVivo();

  $('#btnLimparCache').onclick = limparCache;
  $('#btnResetApp').oncli  // navegação
  $('#btnTestar').onclick = testarConexao;

  // buscas
  $('#buscaAgenda').oninput = renderAgenda;
  $('#buscaTx').oninput = renderTx;
  $('#buscaCliente').oninput = renderClientes;
  $('#buscaServico').oninput = renderServicos;
  $('#buscaAn').oninput = renderAn;
  // Tamanho do app, tema, cores etc. são aplicados e salvos na hora (ver ligarConfigAoVivo()).

  // Lógica do Menu Hamburger
  $('#btnMenu').onclick = toggleSidebar;
  document.body.insertAdjacentHTML('beforeend', '<div id="overlay" class="overlay"></div>');
  $('#overlay').onclick = toggleSidebar;

  function toggleSidebar(){
    $('#sidebar').classList.toggle('open');
    $('#overlay').classList.toggle('show');
  }

  // Navegação pelo novo menu lateral
  $$('#navMenu .menu-item').forEach(btn=>{
    btn.onclick = ()=>{
      $$('#navMenu .menu-item').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const id = btn.dataset.tab;
      $$('.tabpane').forEach(p=>{ p.classList.remove('show'); p.classList.remove('active'); });
      const pane = $(`#tab-${id}`);
      if(pane){ pane.classList.add('show'); pane.classList.add('active'); }

      // Sempre que voltar para a Agenda, sai do modo de edição
      if(id === 'agenda'){
        agEditId = null;
        const t = $('#agFormTitle');
        if(t) t.textContent = 'Novo Agendamento';
        const btnAg = $('#btnAgendar');
        if(btnAg) btnAg.textContent = 'Agendar Serviço';
        const tabAg = $('#tab-agenda');
        if(tabAg) tabAg.classList.remove('edit-mode');

        // Agenda normal sempre abre sem filtros ocultos: mostra anteriores, hoje e futuros.
        agendaFilter = 'all';
        const buscaAgenda = $('#buscaAgenda');
        const statusAgenda = $('#agFiltroStatus');
        const respAgenda = $('#agFiltroResponsavel');
        if(buscaAgenda) buscaAgenda.value = '';
        if(statusAgenda) statusAgenda.value = 'all';
        if(respAgenda) respAgenda.value = 'all';
        try{ updateAgendaFilterButtonsV51(); }catch(e){}
        try{ renderAgenda(); }catch(e){}
      }

      if(id === 'meu-usuario'){
        renderMeuUsuario();
      }

      toggleSidebar(); // Fecha o menu após a seleção
    };
  });

// Notificações: verificação leve (1x/min) sem loops pesados
try{
  if(!window.__notifTimer){
    window.__notifTimer = setInterval(()=>{ try{ renderNotifications(); }catch(e){} }, 60000);
  }
  // Primeira renderização
  renderNotifications();
}catch(e){}

}
// USUÁRIOS
function renderPerfis(){
  const sel = $('#selPerfil');
  if (!sel) return;
  sel.innerHTML = '<option value="">Escolha seu perfil</option>';
  state.perfis.forEach(p=>{
    const opt = document.createElement('option');
    opt.value = p.id; opt.textContent = p.nome;
    sel.appendChild(opt);
  });
}


async function integrarUsuarioAoSistema(userEmail) {
  // Cloud-only: cada login vê apenas seus dados (uid).
  const emailLower = (userEmail || '').toLowerCase();

  // lembrar e-mail (opcional)
  const rememberEl = document.getElementById('rememberLogin');
  if (rememberEl && rememberEl.checked) {
    try { localStorage.setItem('studioLH__remember_email', emailLower); } catch(e){}
  } else {
    try { localStorage.removeItem('studioLH__remember_email'); } catch(e){}
  }

  if (!auth || !auth.currentUser) {
    setAuthMessage('Usuário não autenticado.');
    return;
  }

  try{
    setAuthMessage('');
    const uidStr = String(auth.currentUser.uid);
    await loadPerfil(uidStr);
  }catch(e){
    console.error(e);
    setAuthMessage('Não foi possível carregar seus dados na nuvem. Verifique Firestore/Auth.');
  }
}


function entrarSistema(){
  if (!auth) {
    alert('Login indisponível: Firebase Auth não está configurado.');
    return;
  }
  const emailEl = document.getElementById('emailLogin');
  const passEl  = document.getElementById('senhaLogin');
  if (!emailEl || !passEl) {
    alert('Campos de login não encontrados.');
    return;
  }
  const email = emailEl.value.trim();
  const senha = passEl.value;
  if (!email || !senha) {
    setAuthMessage('Informe e-mail e senha.');
    return;
  }
  setAuthMessage('Entrando...');

  const btnEntrarEl = document.getElementById('btnEntrar');
  if (btnEntrarEl) btnEntrarEl.disabled = true;

  // Trava de segurança: se o Firebase não responder em 15s (sem internet,
  // domínio não autorizado, rede lenta, etc.), avisa o usuário em vez de
  // deixar "Entrando..." para sempre sem nenhuma reação.
  let settled = false;
  const timeoutId = setTimeout(()=>{
    if (settled) return;
    settled = true;
    if (btnEntrarEl) btnEntrarEl.disabled = false;
    setAuthMessage('Não foi possível conectar ao servidor. Verifique sua internet (ou se este endereço está autorizado no Firebase) e tente novamente.');
  }, 15000);

  auth.signInWithEmailAndPassword(email, senha)
    .then((cred)=>{
      if (settled) return; // já mostrou timeout, ignora resposta tardia
      settled = true;
      clearTimeout(timeoutId);
      if (btnEntrarEl) btnEntrarEl.disabled = false;
      const user = cred && cred.user ? cred.user : null;
      const userEmail = (user && user.email ? user.email : email).toLowerCase();

      passEl.value = '';

      integrarUsuarioAoSistema(userEmail);
    })
    .catch(e=>{
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      if (btnEntrarEl) btnEntrarEl.disabled = false;
      console.error(e);
      setAuthMessage(translateFirebaseError(e.code || ''));
    });
}

function onClickCriarConta(){
  if (!modoCriarConta) {
    // entra no modo de cadastro
    setAuthMode('signup');
    const confInput = document.getElementById('senhaLoginConf');
    if (confInput) confInput.focus();
    return;
  }

  // Já está em modoCriarConta: faz o cadastro de fato
  cadastrarUsuario();
}


async function cadastrarUsuario(){
  if (!auth) {
    alert('Cadastro indisponível: Firebase Auth não está configurado.');
    return;
  }

  const emailEl = document.getElementById('emailLogin');
  const passEl  = document.getElementById('senhaLogin');
  const confEl  = document.getElementById('senhaLoginConf');

  if (!emailEl || !passEl) {
    alert('Campos de cadastro não encontrados.');
    return;
  }

  const email = emailEl.value.trim();
  const senha = passEl.value;
  const senhaConf = confEl ? confEl.value : '';

  if (!email || !senha) {
    setAuthMessage('Informe e-mail e senha para cadastro.');
    return;
  }
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailValido) {
    setAuthMessage('Informe um e-mail válido.');
    return;
  }
  if (senha.length < 8) {
    setAuthMessage('A senha deve ter pelo menos 8 caracteres.');
    return;
  }
  if (!senhaConf) {
    setAuthMessage('Confirme a senha para cadastro.');
    return;
  }
  if (senha !== senhaConf) {
    setAuthMessage('As senhas não conferem.');
    return;
  }

  setAuthMessage('Criando conta...');
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, senha);
    const user = cred && cred.user ? cred.user : null;
    const emailLower = (user && user.email ? user.email : email).toLowerCase();

    // Cria um novo perfil administrador para este e-mail.
    // Usa o UID do Firebase Auth como id do perfil para facilitar backup/restore.
    const id = (user && user.uid) ? String(user.uid) : uid();
    state.perfis = state.perfis || [];
    const adminPerfil = {
      id,
      nome: '👑 Administrador',
      email: emailLower,
      emailLower,
      login: emailLower,
      isAdmin: true,
      ownerId: id,
      tipo: 'admin',
      situacao: 'ativo',
      ativo: true
    };
    state.perfis.push(adminPerfil);
    if (window.db) await db.collection(PERFIS_COLLECTION).doc(id).set(adminPerfil, {merge:true});

    // Limpa campos
    passEl.value = '';
    if (confEl) confEl.value = '';

    setAuthMessage('Conta criada com sucesso! Você já pode usar o sistema.');

    // Integra e entra com este perfil (também respeita "lembrar de mim")
    integrarUsuarioAoSistema(emailLower);
  } catch(e){
    console.error(e);
    setAuthMessage(translateFirebaseError(e.code || ''));
  }
}


async function entrarComGoogle(){
  if (!auth) {
    alert('Login indisponível: Firebase Auth não está configurado.');
    return;
  }

  const provider = new firebase.auth.GoogleAuthProvider();

  // Sugere ao Google mostrar a lista de contas já logadas no dispositivo/navegador
  provider.setCustomParameters({
    prompt: 'select_account'
  });

  setAuthMessage('Abrindo Google...');

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

  try {
    if (isMobile) {
      // Em muitos navegadores mobile / PWA o popup é bloqueado.
      // Nesses casos fazemos o fluxo via redirect.
      await auth.signInWithRedirect(provider);
      return; // o restante será tratado em auth.getRedirectResult no init()
    } else {
      const cred = await auth.signInWithPopup(provider);
      const user = cred && cred.user ? cred.user : null;
      if (!user || !user.email) {
        setAuthMessage('Não foi possível obter o e-mail da sua conta Google.');
        return;
      }
      const emailLower = user.email.toLowerCase();
      integrarUsuarioAoSistema(emailLower);
    }
  } catch(e){
    console.error(e);
    // Se o popup for bloqueado, tenta redirect como fallback
    if (e && e.code === 'auth/popup-blocked') {
      try {
        await auth.signInWithRedirect(provider);
        return;
      } catch(e2){
        console.error(e2);
        setAuthMessage(translateFirebaseError(e2.code || ''));
      }
    } else {
      setAuthMessage(translateFirebaseError(e.code || ''));
    }
  }
}
function onClickEsqueciSenha(){
  setAuthMode('forgot');
  const emailEl = document.getElementById('emailLogin');
  if (emailEl && !emailEl.value) {
    emailEl.focus();
  }
}

async function resetSenhaFirebase(){
  if (!auth) {
    alert('Recuperação de senha indisponível: Firebase Auth não está configurado.');
    return;
  }
  const emailEl = document.getElementById('emailLogin');
  if (!emailEl) {
    alert('Campo de e-mail não encontrado.');
    return;
  }
  const email = emailEl.value.trim();
  if (!email) {
    setAuthMessage('Informe o e-mail para recuperar a senha.');
    return;
  }
  setAuthMessage('Enviando e-mail de redefinição...');
  try {
    await auth.sendPasswordResetEmail(email);
    setAuthMessage('E-mail de redefinição enviado. Verifique sua caixa de entrada.');
  } catch(e){
    console.error(e);
    setAuthMessage(translateFirebaseError(e.code || ''));
  }
}

async function sairSistema(){
  try {
    stopPerfisListener();
    if (auth) await auth.signOut();
  } catch(e){
    console.error(e);
  }
  location.reload();
}



function onFuncionarioAdicionado(novoPerfil){
  try {
    // Atualiza os dados locais / listas
    if (typeof renderPerfis === 'function') renderPerfis();
    if (typeof renderFuncionarios === 'function') renderFuncionarios();
    if (typeof renderUsuarios === 'function') renderUsuarios();

    // Volta da tela de cadastro para a lista de funcionários
    const listView = document.getElementById('usuariosListView');
    const cadView = document.getElementById('usuariosCadastroView');
    if (listView && cadView) {
      cadView.classList.add('hidden');
      listView.classList.remove('hidden');
    }
  } catch(e){
    console.error(e);
    try { if (typeof renderPerfis === 'function') renderPerfis(); } catch(_) {}
  }
}
function addFuncionarioUsuarios(){
  if (!isPerfilAdmin(state.perfilId)) {
    alert('Apenas o administrador pode adicionar novos perfis/funcionários.');
    return;
  }

  const nomeEl = $('#usNome');
  const emailEl = $('#usEmail');
  const senhaEl = $('#usSenha');
  const senhaConfEl = $('#usSenhaConf');
  const cargoEl = $('#usCargo');
  const setorEl = $('#usSetor');
  const situacaoEl = $('#usSituacao');

  const nome = nomeEl ? nomeEl.value.trim() : '';
  const email = emailEl ? emailEl.value.trim() : '';
  const emailLower = email.toLowerCase();
  const senha = senhaEl ? senhaEl.value.trim() : '';
  const senhaConf = senhaConfEl ? senhaConfEl.value.trim() : '';

  const cargo = cargoEl ? cargoEl.value.trim() : '';
  const setor = setorEl ? setorEl.value.trim() : '';
  const situacao = situacaoEl && situacaoEl.value ? situacaoEl.value : 'ativo';

  if (!nome) {
    alert('O nome do funcionário é obrigatório.');
    return;
  }
  if (!email) {
    alert('O e-mail do funcionário é obrigatório.');
    return;
  }
  if (!senha) {
    alert('A senha do funcionário é obrigatória.');
    return;
  }
  if (senha.length < 8) {
    alert('A senha deve ter pelo menos 8 caracteres.');
    return;
  }
  if (senha !== senhaConf) {
    alert('A confirmação de senha não confere.');
    return;
  }

  if (!auth || typeof firebase === 'undefined') {
    alert('Não foi possível acessar o Firebase Auth. Verifique sua conexão.');
    return;
  }

  // Cria usuário no Firebase Auth usando um app secundário,
  // para não desconectar o administrador atual.
  let secondaryApp = null;
  (async () => {
    try {
      if (typeof firebaseConfig === 'undefined') {
        throw new Error('firebaseConfig não está disponível.');
      }

      secondaryApp = firebase.apps.find(a => a.name === 'secondary') || firebase.initializeApp(firebaseConfig, 'secondary');
      const secondaryAuth = secondaryApp.auth();

      const created = await secondaryAuth.createUserWithEmailAndPassword(email, senha);

      // IMPORTANTÍSSIMO: use o UID real do Firebase Auth como id do perfil.
      // Isso evita que o funcionário vire "admin" por falta de correspondência
      // entre login (uid) e perfil salvo.
      const createdUid = created && created.user && created.user.uid ? String(created.user.uid) : uid();
      const id = createdUid;
      const novoPerfil = {
        id,
        nome,
        email,
        emailLower,
        isAdmin: false,
        // liga este funcionário ao administrador (dono) que cadastrou
        ownerId: String(getDataOwnerId() || state.perfilId),
        cargo,
        setor,
        situacao,
        ativo: String(situacao) === 'ativo',
        permissions: {
          agenda: !!($('#usPermAgenda') && $('#usPermAgenda').checked),
          clientes: !!($('#usPermClientes') && $('#usPermClientes').checked),
          financeiro: !!($('#usPermFinanceiro') && $('#usPermFinanceiro').checked),
          anamnese: !!($('#usPermAnamnese') && $('#usPermAnamnese').checked)
        }
      };

            // Salva também no Firestore em perfis_usuarios/{uid} (fonte de verdade na nuvem)
      try {
        if (window.db) {
          const ref = db.collection(PERFIS_COLLECTION).doc(String(id));
          const payload = Object.assign({}, novoPerfil, {
            // compatibilidade multi-perfil / consultas
            masterPerfilId: String(getDataOwnerId() || state.perfilId),
            tipo: 'funcionario',
            ativo: String(situacao) === 'ativo',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          await ref.set(payload, { merge: true });
        }
      } catch (e) {
        console.error('Erro ao salvar funcionário em perfis_usuarios', e);
        const friendly = translateFirebaseError(e.code || '');
        alert(friendly || 'Usuário criado, mas não foi possível salvar o funcionário na nuvem (perfis_usuarios).');
      }

state.perfis.push(novoPerfil);
      savePerfis();
      ensurePerfilData(id);

      if (nomeEl) nomeEl.value = '';
      if (emailEl) emailEl.value = '';
      if (senhaEl) senhaEl.value = '';
      if (senhaConfEl) senhaConfEl.value = '';

      alert(`Funcionário ${nome} adicionado com sucesso!`);

      onFuncionarioAdicionado(novoPerfil);
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

    } catch (e) {
      console.error(e);
      const friendly = translateFirebaseError(e.code || '');
      alert(friendly || 'Erro ao criar usuário no Firebase Auth.');
    } finally {
      if (secondaryApp) {
        try { await secondaryApp.delete(); } catch (_) {}
      }
    }
  })();
}


function renderUsuarios(){
  const perfilAtual = getPerfilAtual();
  const isAdmin = perfilAtual && isPerfilAdmin(perfilAtual.id);

  if ($('#usrAtual')) {
    $('#usrAtual').textContent = perfilAtual ? perfilAtual.nome : '—';
  }
  if ($('#usrTot')) {
    $('#usrTot').textContent = (state.perfis || []).length;
  }
  if ($('#usrAtivos')) {
    const total = (state.perfis || []).filter(p => !isPerfilAdmin(p.id)).length;
    $('#usrAtivos').textContent = total;
  }
  if ($('#usrLogin')) {
    $('#usrLogin').textContent = state.data.lastLogin
      ? new Date(state.data.lastLogin).toLocaleString('pt-BR')
      : '—';
  }

  const box = $('#listaUsuarios');
  if (!box) return;
  box.innerHTML = '';

  if (!isAdmin){
    const aviso = document.createElement('p');
    aviso.className = 'muted';
    aviso.style.marginTop = '8px';
    aviso.textContent = 'Somente o administrador pode gerenciar outros perfis.';
    box.appendChild(aviso);
  }
}

function renderFuncionarios(){
  const box = $('#listaFuncionarios'); 
  if (!box) return;
  box.innerHTML='';

  const perfilAtual = getPerfilAtual();
  const isAdmin = perfilAtual && isPerfilAdmin(perfilAtual.id);

  if (!isAdmin){
    box.innerHTML = '<p class="muted">Apenas o administrador pode visualizar ou alterar funcionários.</p>';
    return;
  }

  // Filtra apenas os perfis que não são o Administrador
  const funcionariosBase = (state.perfis || []).filter(p => !isPerfilAdmin(p.id));

  // Por padrão, esconde inativos. Use o botão "Mostrar inativos" para exibir todos.
  const funcionarios = state.mostrarInativos
    ? funcionariosBase
    : funcionariosBase.filter(isFuncionarioAtivo);

  if(funcionarios.length === 0){
    box.innerHTML = '<p class="muted">Nenhum funcionário cadastrado.</p>';
    return;
  }

  funcionarios.forEach(p=>{
    const ativoBool = (p.ativo !== false) && (String(p.situacao || '').toLowerCase() !== 'inativo');
    const situacao = ativoBool ? 'ativo' : 'inativo';
    const situacaoLabel = situacao === 'ativo' ? 'Ativo' : 'Inativo';
    const badgeClass = situacao === 'ativo' ? 'badge-success' : 'badge-muted';
    const acaoLabel = situacao === 'ativo' ? 'Inativar' : 'Ativar';
    const novoAtivo = situacao !== 'ativo';
    const cargo = p.cargo || '';
    const setor = p.setor || '';
    const perms = getPerfilPermissions(p);
    const permsLabel = Object.entries({agenda:'Agenda',clientes:'Clientes',financeiro:'Financeiro',anamnese:'Anamnese'}).filter(([k])=>perms[k]!==false).map(([,v])=>v).join(', ') || 'Sem acesso';

    const permsLista = Object.entries({agenda:'Agenda',clientes:'Clientes',financeiro:'Financeiro',anamnese:'Anamnese'}).filter(([k])=>perms[k]!==false).map(([,v])=>v);
    const chips = permsLista.length
      ? permsLista.map(v=>`<span class="fn-chip">${escapeHtml(v)}</span>`).join('')
      : '<span class="fn-chip is-none">Sem acesso</span>';
    const nomeFn = p.nome || '-';
    const iniciais = (String(nomeFn).trim().split(/\s+/).slice(0,2).map(x=>x.charAt(0)).join('') || '?').toUpperCase();
    const cargoSetor = (cargo ? cargo : 'Cargo não informado') + (setor ? ' • ' + setor : '');

    const div = document.createElement('div');
    div.className = 'item func-card' + (ativoBool ? '' : ' is-inativo');
    div.innerHTML = `
      <div class="fn-top">
        <div class="fn-avatar" aria-hidden="true">${escapeHtml(iniciais)}</div>
        <div class="fn-info">
          <div class="fn-name-row">
            <strong class="fn-name">${escapeHtml(nomeFn)}</strong>
            <span class="badge ${badgeClass}">${situacaoLabel}</span>
          </div>
          <div class="fn-cargo">${escapeHtml(cargoSetor)}</div>
          <div class="fn-email">${escapeHtml(p.email || '-')}</div>
        </div>
      </div>
      <div class="fn-access"><span class="fn-access-label">Acessos</span>${chips}</div>
      <div class="fn-actions">
        <button type="button" class="fn-btn" data-fn-act="perm"><i class="fa-solid fa-key"></i><span>Permissões</span></button>
        <button type="button" class="fn-btn ${novoAtivo ? 'is-ok' : ''}" data-fn-act="toggle"><i class="fa-solid ${novoAtivo ? 'fa-user-check' : 'fa-user-slash'}"></i><span>${acaoLabel}</span></button>
        <button type="button" class="fn-btn is-danger" data-fn-act="remove"><i class="fa-solid fa-trash"></i><span>Remover</span></button>
      </div>
    `;
    // Foto do funcionário (a mesma que ele colocou em "Meu usuário"); sem foto, mostra as iniciais.
    // Montada pelo DOM (e não por texto HTML) porque o dado vem do próprio usuário.
    if (p.avatar && typeof p.avatar === 'string' && /^data:image\//.test(p.avatar)) {
      const av = div.querySelector('.fn-avatar');
      const img = document.createElement('img');
      img.alt = 'Foto de ' + nomeFn;
      img.src = p.avatar;
      img.onerror = ()=>{ av.textContent = iniciais; };
      av.replaceChildren(img);
    }
    // Ações ligadas por addEventListener (nada de id dentro de atributo onclick).
    const fid = String(p.id);
    div.querySelector('[data-fn-act="perm"]').addEventListener('click', ()=>editarPermissoesFuncionario(fid));
    div.querySelector('[data-fn-act="toggle"]').addEventListener('click', ()=>toggleFuncionarioAtivo(fid, novoAtivo));
    div.querySelector('[data-fn-act="remove"]').addEventListener('click', ()=>removerFuncionario(fid));
    box.appendChild(div);
  });
}

function editarPermissoesFuncionario(id){
  if(!isPerfilAdmin(state.perfilId)) return;
  const p=(state.perfis||[]).find(x=>String(x.id)===String(id)); if(!p) return;
  const cur=getPerfilPermissions(p);
  const overlay=document.createElement('div'); overlay.className='auth-modal'; overlay.id='modalPermissoesV4';
  overlay.innerHTML=`<div class="auth-modal-backdrop"></div><div class="auth-modal-dialog" role="dialog" aria-modal="true"><div class="auth-modal-header"><h2>Permissões — ${escapeHtml(p.nome||'Funcionário')}</h2><button class="auth-modal-x" type="button">✕</button></div><div class="auth-modal-body"><p class="muted">Escolha as áreas que este funcionário pode acessar.</p>${[['agenda','Agenda'],['clientes','Clientes'],['financeiro','Financeiro'],['anamnese','Anamnese']].map(([k,l])=>`<label class="check" style="display:block;margin:12px 0"><input type="checkbox" data-perm="${k}" ${cur[k]!==false?'checked':''}/> ${l}</label>`).join('')}<div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn success" id="savePermV4">Salvar permissões</button></div></div></div>`;
  document.body.appendChild(overlay); document.body.classList.add('modal-open');
  const close=()=>{overlay.remove(); document.body.classList.remove('modal-open');}; overlay.querySelector('.auth-modal-backdrop').onclick=close; overlay.querySelector('.auth-modal-x').onclick=close;
  overlay.querySelector('#savePermV4').onclick=async()=>{ const permissions={}; overlay.querySelectorAll('[data-perm]').forEach(el=>permissions[el.dataset.perm]=el.checked); try{ await db.collection(PERFIS_COLLECTION).doc(String(id)).set({permissions,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}); p.permissions=permissions; auditLog('update','funcionario',id,'Permissões de '+(p.nome||'funcionário')+' atualizadas',{permissions}); renderFuncionarios(); close(); toast('Permissões atualizadas.'); }catch(e){console.error(e); alert('Não foi possível salvar as permissões.');} };
}

async function toggleFuncionarioAtivo(id, ativo){
  try{
    if (!isPerfilAdmin(state.perfilId)) {
      alert('Apenas o administrador pode ativar/inativar funcionários.');
      return;
    }
    const uidStr = String(id);
    const novoAtivo = !!ativo;
    const novaSituacao = novoAtivo ? 'ativo' : 'inativo';

    // Atualiza Firestore (fonte de verdade)
    if (window.db) {
      await db.collection(PERFIS_COLLECTION).doc(uidStr).set({
        ativo: novoAtivo,
        situacao: novaSituacao,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    // Atualiza cache em memória (UI imediata)
    const p = (state.perfis || []).find(x => String(x.id) === uidStr);
    if (p){
      p.ativo = novoAtivo;
      p.situacao = novaSituacao;
    }

    // Se foi inativado, oferecer opção de limpar faturamento
    if (!novoAtivo) {
      try{
        if (confirm('Funcionário inativado. Deseja também APAGAR o faturamento (financeiro) deste funcionário?')) {
          await limparFaturamentoFuncionario(uidStr);
        }
      }catch(_){
      }
    }

    renderFuncionarios();
    renderUsuarios();
  }catch(e){
    console.error(e);
    alert('Não foi possível atualizar a situação no Firebase. Verifique as Regras do Firestore.');
  }
}

async function removerFuncionario(id){
  try{
    if (!isPerfilAdmin(state.perfilId)) return alert('Apenas o administrador pode remover funcionários.');
    if(!confirm('Deseja desativar este funcionário?\n\nA conta do Firebase Authentication continuará existindo, mas o acesso ao estabelecimento será bloqueado.')) return;
    const uidStr = String(id);
    if (uidStr === getCurrentActorId()) return alert('O administrador não pode desativar a própria conta por esta tela.');
    if (window.db) {
      await db.collection(PERFIS_COLLECTION).doc(uidStr).set({
        ativo:false, situacao:'inativo', disabledAt:new Date().toISOString()
      }, {merge:true});
    }
    const p = (state.perfis||[]).find(x=>String(x.id)===uidStr);
    if (p){ p.ativo=false; p.situacao='inativo'; }
    renderPerfis(); renderFuncionarios(); renderUsuarios();
    toast('Funcionário desativado. O acesso ao estabelecimento foi bloqueado.');
  }catch(e){
    console.error(e);
    alert('Não foi possível desativar no Firebase. Verifique as Regras do Firestore.');
  }
}
async function limparFaturamentoFuncionario(funcionarioUid){
  try{
    if (!isPerfilAdmin(state.perfilId)) {
      alert('Apenas o administrador pode limpar faturamento.');
      return;
    }
    const uidStr = String(funcionarioUid);
    if (!confirm('Isso vai APAGAR todo o faturamento (lançamentos financeiros) deste funcionário. Deseja continuar?')) return;

    if (!window.db) {
      alert('Firestore não inicializado.');
      return;
    }

    const rootRef = db.collection('perfis').doc(String(getDataOwnerId())).collection('tx');
    // Deleta em lotes (batch) para evitar limite de 500
    while (true){
      const snap = await rootRef.where('createdByUid','==',uidStr).limit(450).get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach(d=>batch.delete(d.ref));
      await batch.commit();
      // continua até esvaziar
    }

    // atualiza visão do dono se estiver aberta
    try{ renderVisaoDono(); }catch(_){}
  }catch(e){
    console.error(e);
    const msg = (e && (e.code||e.message)) ? String(e.code||e.message) : '';
    if (/permission-denied/i.test(msg)) {
      alert('Sem permissão para limpar faturamento. Ajuste as Rules para permitir o administrador apagar em perfis/{uid}/tx.');
    } else {
      alert('Não foi possível limpar o faturamento.');
    }
  }
}


