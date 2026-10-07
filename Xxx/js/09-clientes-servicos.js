/* Clientes + Serviços
   Parte 10 de 14 do antigo app.v2.js (dividido na Etapa de modularização).
   Linhas originais: 4428-4833. Nenhuma linha de código foi alterada nesta divisão. */

/* ======= CLIENTES ======= */
function addCliente(){
  const nome = $('#clNome').value.trim();
  if (!nome) {
    alert('Informe o nome.');
    return;
  }
  const obj = {
    id: uid(),
    nome,
    email: $('#clEmail').value.trim(),
    zap: $('#clZap').value.trim(),
    nasc: ($('#clNasc') ? $('#clNasc').value : ''),
    end: $('#clEnd').value.trim(),
    criadoEm: new Date().toISOString() // usado no "+N este mês" do Dashboard
  };
  state.data.clientes.push(obj);
  savePerfil();
  cloudSaveDoc('clientes', obj);
  $('#clNome').value=''; $('#clEmail').value=''; $('#clZap').value=''; if ($('#clNasc')) $('#clNasc').value=''; $('#clEnd').value='';
  if (typeof voltarListaClientes === 'function') voltarListaClientes();
  renderClientes();
}


function delCliente(id){
  if(!confirm('Excluir cliente?')) return;
  // Captura os vínculos ANTES de filtrar, para poder apagar cada um
  // deles individualmente na nuvem também (agendamentos e fichas de
  // anamnese deste cliente).
  const agendaRemovida = state.data.agenda.filter(a=>a.clienteId===id);
  const anRemovida = state.data.an.filter(a=>a.clienteId===id);
  state.data.clientes = state.data.clientes.filter(c=>c.id!==id);
  state.data.agenda = state.data.agenda.filter(a=>a.clienteId!==id);
  state.data.an = state.data.an.filter(a=>a.clienteId!==id);
  savePerfil(); refreshAll();
  cloudDeleteDoc('clientes', id);
  agendaRemovida.forEach(a=>cloudDeleteDoc('agenda', a.id));
  anRemovida.forEach(a=>cloudDeleteDoc('an', a.id));
}
function editCliente(id){
  const c = state.data.clientes.find(x=>x.id===id); if(!c) return;

  if (typeof abrirCadastroCliente === 'function') abrirCadastroCliente();

  $('#clNome').value=c.nome; $('#clEmail').value=c.email; $('#clZap').value=c.zap;
  if ($('#clNasc')) $('#clNasc').value = (c.nasc || '');
  $('#clEnd').value=c.end;
  $('#btnAddCliente').textContent='Salvar Alterações';

  const originalOnClick = $('#btnAddCliente').onclick;

  $('#btnAddCliente').onclick = ()=>{
    c.nome=$('#clNome').value.trim(); c.email=$('#clEmail').value.trim();
    c.zap=$('#clZap').value.trim(); c.end=$('#clEnd').value.trim();
    if ($('#clNasc')) c.nasc = $('#clNasc').value;
    savePerfil(); renderClientes(); 
    cloudSaveDoc('clientes', c);
    if (typeof voltarListaClientes === 'function') voltarListaClientes();

    $('#btnAddCliente').textContent='Cadastrar Cliente';
    $('#btnAddCliente').onclick = originalOnClick;

    $('#clNome').value=''; $('#clEmail').value=''; $('#clZap').value=''; if ($('#clNasc')) $('#clNasc').value=''; $('#clEnd').value='';
  };
}

function verCliente(id){
  const c = state.data.clientes.find(x=>x.id===id); if(!c) return;
  const nome = c.nome || '';
  const iniciais = (nome.trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('') || '?').toUpperCase();
  const idx = state.data.clientes.findIndex(x=>x.id===id);
  $('#verClienteAvatar').textContent = iniciais;
  $('#verClienteAvatar').className = 'dp-avatar dp-vc-avatar dp-avatar-' + (Math.max(idx,0) % 6);
  $('#verClienteNome').textContent = nome || '—';
  $('#verClienteSub').textContent = c.zap || c.email || '';
  $('#verClienteZap').textContent = c.zap || '—';
  $('#verClienteEmail').textContent = c.email || '—';
  $('#verClienteNasc').textContent = c.nasc ? formatDateBR(c.nasc) : '—';
  $('#verClienteEnd').textContent = c.end || '—';
  $('#verClienteEditar').onclick = ()=>{ closeCfgModal('modalVerCliente'); editCliente(id); };
  openCfgModal('modalVerCliente');
}

function renderClientes(){
  const q = ($('#buscaCliente').value||'').toLowerCase();
  const box = $('#listaClientes'); box.innerHTML='';
  state.data.clientes
    .filter(c=>!q || c.nome.toLowerCase().includes(q))
    .forEach((c, idx)=>{
      const div = document.createElement('div');
      div.className='item';
      const nome = c.nome || '';
      const iniciais = (nome.trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('') || '?').toUpperCase();
      const sub = c.zap || c.email || '—';
      div.innerHTML = `
        <div class="dp-avatar dp-avatar-${idx % 6}" data-id="${escapeHtml(c.id)}" data-act="ver">${escapeHtml(iniciais)}</div>
        <div class="dp-item-main" data-id="${escapeHtml(c.id)}" data-act="ver">
          <strong>${escapeHtml(nome)}</strong>
          <span>${escapeHtml(sub)}</span>
        </div>
        <div class="dp-item-actions">
          <button class="btn ghost sm" data-id="${escapeHtml(c.id)}" data-act="edit" aria-label="Editar cliente"><i class="fa-solid fa-pen"></i></button>
          <button class="btn danger sm" data-id="${escapeHtml(c.id)}" data-act="del" aria-label="Excluir cliente"><i class="fa-solid fa-trash"></i></button>
        </div>`;
      box.appendChild(div);
    });
  $$('#listaClientes [data-act="del"]').forEach(b=>b.onclick=()=>delCliente(b.dataset.id));
  $$('#listaClientes [data-act="edit"]').forEach(b=>b.onclick=()=>editCliente(b.dataset.id));
  $$('#listaClientes [data-act="ver"]').forEach(b=>b.onclick=()=>verCliente(b.dataset.id));
  renderSelClientes('#agCliente'); renderSelClientes('#anCliente');
}
function renderSelClientes(selector){
  const sel = $(selector); sel.innerHTML = '<option value="">Selecione um cliente</option>';
  state.data.clientes.forEach(c=>{ const o=document.createElement('option'); o.value=c.id; o.textContent=c.nome; sel.appendChild(o); });

  // Atualiza o botão/seletor visual do Novo Agendamento
  if (selector === '#agCliente') {
    try { syncAgClientePicker(); } catch(e) {}
  }
}

// Mantém o texto do botão “Cliente” em sincronia com o select escondido
function syncAgClientePicker(){
  const sel = document.getElementById('agCliente');
  const txt = document.getElementById('agClientePickerText');
  if(!sel || !txt) return;
  const opt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
  const label = (opt && opt.value) ? (opt.textContent || 'Selecione um cliente') : 'Selecione um cliente';
  txt.textContent = label;
}

// ===== Busca de Cliente no Novo Agendamento (lupa no seletor) =====
function openModalBuscaClienteAg(){
  const modal = document.getElementById('modalBuscaClienteAg');
  if(!modal) return;
  modal.classList.remove('hidden');
  const inp = document.getElementById('agClienteBuscaInput');
  if(inp){
    inp.value = '';
    renderBuscaClienteAgLista('');
    setTimeout(()=>{ try { inp.focus(); } catch(e){} }, 50);
  } else {
    renderBuscaClienteAgLista('');
  }
}

function closeModalBuscaClienteAg(){
  const modal = document.getElementById('modalBuscaClienteAg');
  if(!modal) return;
  modal.classList.add('hidden');
}

function renderBuscaClienteAgLista(query){
  const box = document.getElementById('agClienteBuscaLista');
  if(!box) return;
  const q = (query||'').trim().toLowerCase();

  const clientes = (state.data && state.data.clientes) ? state.data.clientes : [];
  const filtered = !q ? clientes : clientes.filter(c=>{
    const nome = (c.nome||'').toLowerCase();
    const zap  = (c.zap||'').toLowerCase();
    const email= (c.email||'').toLowerCase();
    return nome.includes(q) || zap.includes(q) || email.includes(q);
  });

  box.innerHTML = '';
  if(filtered.length === 0){
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'Nenhum cliente encontrado.';
    box.appendChild(empty);
    return;
  }

  filtered.forEach(c=>{
    const div = document.createElement('div');
    div.className = 'client-search-item';
    div.innerHTML = `
      <strong>${escapeHtml(c.nome||'Sem nome')}</strong>
      <div class="muted">${escapeHtml(c.email||'—')} • ${escapeHtml(c.zap||'—')}</div>
    `;
    div.onclick = ()=>{
      const sel = document.getElementById('agCliente');
      if(sel){
        sel.value = c.id;
        try { sel.dispatchEvent(new Event('change', { bubbles: true })); } catch(e){}
      }
      closeModalBuscaClienteAg();
    };
    box.appendChild(div);
  });
}

// ===== Busca de Serviço no Novo Agendamento =====
function openModalBuscaServicoAg(){
  const modal = document.getElementById('modalBuscaServicoAg');
  if(!modal) return;
  modal.classList.remove('hidden');
  const inp = document.getElementById('agServicoBuscaInput');
  if(inp){
    inp.value = '';
    renderBuscaServicoAgLista('');
    setTimeout(()=>{ try { inp.focus(); } catch(e){} }, 50);
  } else {
    renderBuscaServicoAgLista('');
  }
}

function closeModalBuscaServicoAg(){
  const modal = document.getElementById('modalBuscaServicoAg');
  if(!modal) return;
  modal.classList.add('hidden');
}

function renderBuscaServicoAgLista(query){
  const box = document.getElementById('agServicoBuscaLista');
  if(!box) return;
  const q = (query||'').trim().toLowerCase();

  const servicos = (state.data && state.data.servicos) ? state.data.servicos : [];
  const filtered = !q ? servicos : servicos.filter(s=>{
    const nome = (s.nome||'').toLowerCase();
    const desc = (s.descricao||'').toLowerCase();
    return nome.includes(q) || desc.includes(q);
  });

  box.innerHTML = '';
  if(filtered.length === 0){
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'Nenhum serviço encontrado.';
    box.appendChild(empty);
    return;
  }

  filtered.forEach(s=>{
    const div = document.createElement('div');
    div.className = 'client-search-item';
    div.innerHTML = `
      <strong>${escapeHtml(s.nome||'Sem nome')}</strong>
      <div class="muted">${escapeHtml(s.descricao||'—')}${(typeof s.preco === 'number') ? ` • ${money(s.preco, state.cfg.moeda)}` : ''}</div>
    `;
    div.onclick = ()=>{
      const sel = document.getElementById('agServicoSel');
      if(sel){
        sel.value = s.id;
        try { sel.dispatchEvent(new Event('change', { bubbles: true })); } catch(e){}
      }
      closeModalBuscaServicoAg();
    };
    box.appendChild(div);
  });
}

/* ======= SERVIÇOS ======= */
function addServico(){

  const nome = $('#svNome').value.trim();
  if(!nome) return alert('Informe o nome do serviço.');
  const obj = { 
    id: uid(), 
    nome, 
    descricao: $('#svDescricao').value.trim(), 
    preco: parseMoney($('#svPreco').value),
    duracaoMin: parseInt($('#svDuracao').value||'0',10)||0
  };
  state.data.servicos.push(obj);
  savePerfil();
  cloudSaveDoc('servicos', obj);
  $('#svNome').value=''; $('#svDescricao').value=''; $('#svPreco').value='0,00'; $('#svDuracao').value='';
  renderServicos();
  if (typeof voltarListaServicos === 'function') voltarListaServicos();
}
function delServico(id){
  if(!confirm('Excluir serviço?')) return;
  state.data.servicos = state.data.servicos.filter(s=>s.id!==id);
  savePerfil(); renderServicos();
  cloudDeleteDoc('servicos', id);
}



function abrirCadastroCliente(){
  const cadastroTab = document.getElementById('tab-clientes-cadastro');
  const listaTab = document.getElementById('tab-clientes');
  if (listaTab) listaTab.classList.remove('show');
  if (cadastroTab) cadastroTab.classList.add('show');
}

function voltarListaClientes(){
  const cadastroTab = document.getElementById('tab-clientes-cadastro');
  const listaTab = document.getElementById('tab-clientes');
  if (cadastroTab) cadastroTab.classList.remove('show');
  if (listaTab) listaTab.classList.add('show');
}

function abrirCadastroServico(){
  const cadastroTab = document.getElementById('tab-servicos-cadastro');
  const listaTab = document.getElementById('tab-servicos');
  if (listaTab) listaTab.classList.remove('show');
  if (cadastroTab) cadastroTab.classList.add('show');
}

function voltarListaServicos(){
  const cadastroTab = document.getElementById('tab-servicos-cadastro');
  const listaTab = document.getElementById('tab-servicos');
  if (cadastroTab) cadastroTab.classList.remove('show');
  if (listaTab) listaTab.classList.add('show');
}

function editServico(id){
  const s = state.data.servicos.find(x=>x.id===id); if(!s) return;

  if (typeof abrirCadastroServico === 'function') abrirCadastroServico();

  $('#svNome').value=s.nome; $('#svDescricao').value=s.descricao; $('#svPreco').value=s.preco.toFixed(2).replace('.',',');
  $('#svDuracao').value = s.duracaoMin || '';
  $('#btnAddServico').textContent='Salvar Alterações';

  // Salva a função original para restaurar depois
  const originalOnClick = $('#btnAddServico').onclick;

  $('#btnAddServico').onclick = ()=>{
    s.nome=$('#svNome').value.trim(); s.descricao=$('#svDescricao').value.trim();
    s.preco=parseMoney($('#svPreco').value);
    s.duracaoMin = parseInt($('#svDuracao').value||'0',10)||0;
    savePerfil(); renderServicos(); 
    cloudSaveDoc('servicos', s);
    if (typeof voltarListaServicos === 'function') voltarListaServicos();

    // Restaura o botão para a função de cadastro
    $('#btnAddServico').textContent='Cadastrar Serviço';
    $('#btnAddServico').onclick = originalOnClick; // Restaura a função original (addServico)

    // Limpa o formulário
    $('#svNome').value=''; $('#svDescricao').value=''; $('#svPreco').value='0,00'; $('#svDuracao').value='';
  };
}
function renderServicos(){
  const q = ($('#buscaServico').value||'').toLowerCase();
  const box = $('#listaServicos'); box.innerHTML='';
  state.data.servicos
    .filter(s=>!q || (s.nome+s.descricao).toLowerCase().includes(q))
    .forEach(s=>{
      const div = document.createElement('div');
      div.className='item';
      div.innerHTML = `
        <div class="dp-service-icon"><i class="fa-solid fa-bell-concierge"></i></div>
        <div class="dp-item-main">
          <strong>${escapeHtml(s.nome||'')}</strong>
          <span>${Number(s.duracaoMin) || 0} min</span>
        </div>
        <div class="dp-item-price">${money(s.preco, state.cfg.moeda)}</div>
        <div class="dp-item-actions">
          <button class="btn ghost sm" data-id="${escapeHtml(s.id)}" data-act="edit" aria-label="Editar serviço"><i class="fa-solid fa-pen"></i></button>
          <button class="btn danger sm" data-id="${escapeHtml(s.id)}" data-act="del" aria-label="Excluir serviço"><i class="fa-solid fa-trash"></i></button>
        </div>`;
      box.appendChild(div);
    });
  $$('#listaServicos [data-act="del"]').forEach(b=>b.onclick=()=>delServico(b.dataset.id));
  $$('#listaServicos [data-act="edit"]').forEach(b=>b.onclick=()=>editServico(b.dataset.id));
  renderSelServicos('#agServicoSel');
}
function renderSelServicos(selector){
  const sel = $(selector); sel.innerHTML = '<option value="">Selecione um serviço</option>';
  state.data.servicos.forEach(s=>{ const o=document.createElement('option'); o.value=s.id; o.textContent=s.nome; sel.appendChild(o); });

  // Atualiza o botão/seletor visual do Novo Agendamento
  if (selector === '#agServicoSel') {
    try { syncAgServicoSelPicker(); } catch(e) {}
  }
}

// Mantém o texto do botão “Serviço Cadastrado” em sincronia com o select escondido
function syncAgServicoSelPicker(){
  const sel = document.getElementById('agServicoSel');
  const txt = document.getElementById('agServicoSelPickerText');
  if(!sel || !txt) return;
  const opt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
  const label = (opt && opt.value) ? (opt.textContent || 'Selecione um serviço') : 'Selecione um serviço';
  txt.textContent = label;
}
function preencherValorServico(){
  // Atualiza label do botão visual
  try { syncAgServicoSelPicker(); } catch(e) {}
  const sid = $('#agServicoSel').value;
  if(!sid) return;
  const servico = state.data.servicos.find(s=>s.id===sid);
  if(servico){
    $('#agServico').value = servico.nome;
    $('#agValor').value = servico.preco.toFixed(2).replace('.',',');
    // Se houver duração padrão, preenche hora final automaticamente
    if (servico.duracaoMin && $('#agInicioHora') && $('#agFimHora')) {
      const h = $('#agInicioHora').value;
      if (h) {
        const [hh,mm] = h.split(':').map(Number);
        const total = hh*60 + (mm||0) + Number(servico.duracaoMin||0);
        const hh2 = Math.floor((total % (24*60)) / 60);
        const mm2 = total % 60;
        const pad = (n)=>String(n).padStart(2,'0');
        $('#agFimHora').value = pad(hh2)+':'+pad(mm2);
      }
    }
  }
}

