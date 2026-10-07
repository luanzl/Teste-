/* Agenda
   Parte 7 de 14 do antigo app.v2.js (dividido na Etapa de modularização).
   Linhas originais: 2605-2873. Nenhuma linha de código foi alterada nesta divisão. */

/* ======= AGENDA ======= */

function handleMeuUsuarioImagemChange(evt){
  const file = evt.target.files && evt.target.files[0];
  if(!file) return;
  if(file.type && !file.type.startsWith('image/')){
    setMeuUsuarioMessage('Selecione uma imagem válida.', true);
    return;
  }
  const reader = new FileReader();
  const aplicar = (dataUrl)=>{
    const perfil = getPerfilAtual();
    if(!perfil) return;
    perfil.avatar = dataUrl;
    savePerfis();
    atualizarAvatarPerfil(perfil);
    renderSidebarPerfil();
    setMeuUsuarioMessage('Imagem atualizada com sucesso.', false);
  };
  reader.onload = e=>{
    const original = e.target.result;
    // Reduz para 256x256 (recorte central, JPEG): foto leve, cabe no banco e carrega rápido na lista.
    const im = new Image();
    im.onload = ()=>{
      try{
        const L = 256, lado = Math.min(im.width, im.height);
        const c = document.createElement('canvas'); c.width = L; c.height = L;
        c.getContext('2d').drawImage(im, (im.width-lado)/2, (im.height-lado)/2, lado, lado, 0, 0, L, L);
        aplicar(c.toDataURL('image/jpeg', 0.85));
      }catch(err){ aplicar(original); }
    };
    im.onerror = ()=>aplicar(original);
    im.src = original;
  };
  reader.readAsDataURL(file);
}

// Foto de capa: reduz para no máx. 960x384 (proporção 5:2, recorte central, JPEG) para ficar leve e caber no banco.
function handleMeuUsuarioCapaChange(evt){
  const file = evt.target.files && evt.target.files[0];
  evt.target.value = '';
  if(!file) return;
  if(file.type && !file.type.startsWith('image/')){
    setMeuUsuarioMessage('Selecione uma imagem válida.', true);
    return;
  }
  const aplicar = (dataUrl)=>{
    const perfil = getPerfilAtual();
    if(!perfil) return;
    perfil.capa = dataUrl;
    savePerfis();
    atualizarCapaPerfil(perfil);
    setMeuUsuarioMessage('Capa atualizada com sucesso.', false);
  };
  const reader = new FileReader();
  reader.onload = e=>{
    const original = e.target.result;
    const im = new Image();
    im.onload = ()=>{
      try{
        const W = 960, H = 384, ratio = W/H;
        let sw = im.width, sh = im.height;
        if (sw/sh > ratio){ sw = sh*ratio; } else { sh = sw/ratio; }
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        c.getContext('2d').drawImage(im, (im.width-sw)/2, (im.height-sh)/2, sw, sh, 0, 0, W, H);
        aplicar(c.toDataURL('image/jpeg', 0.8));
      }catch(err){ aplicar(original); }
    };
    im.onerror = ()=>setMeuUsuarioMessage('Não foi possível ler essa imagem.', true);
    im.src = original;
  };
  reader.readAsDataURL(file);
}
function removerMeuUsuarioCapa(){
  const perfil = getPerfilAtual();
  if(!perfil) return;
  perfil.capa = '';
  savePerfis();
  atualizarCapaPerfil(perfil);
  setMeuUsuarioMessage('Capa removida.', false);
}

function salvarAgendamento(){
  const idc = $('#agCliente').value;
  const cliente = state.data.clientes.find(c=>c.id===idc);
  if(!cliente) return alert('Selecione um cliente.');
  const formInfo  = syncAgFormHiddenFields() || {};
  const inicioData = formInfo.inicioData || $('#agData').value || todayISO();
  const inicioHora = formInfo.inicioHora || $('#agHora').value;
  const fimData    = formInfo.fimData    || inicioData;
  const fimHora    = formInfo.fimHora    || '';
  const diaInteiro = !!formInfo.diaInteiro;

  const isEdit = !!agEditId;
  const existing = isEdit ? state.data.agenda.find(x=>x.id===agEditId) : null;
  const id = existing ? existing.id : uid();

  const obj = {
    id,
    clienteId: idc, clienteNome: cliente.nome,
    servico: $('#agServico').value.trim(),
    data: inicioData,
    dataBr: (inicioData || todayISO()).split('-').reverse().join('/'),
    hora: diaInteiro ? 'Dia inteiro' : (inicioHora || ''),
    diaInteiro,
    inicioData,
    inicioHora,
    fimData,
    fimHora,
    valor: parseMoney($('#agValor').value),
    status: $('#agStatus').value,
    obs: $('#agObs').value.trim(),
    responsavelUid: ($('#agResponsavel') && $('#agResponsavel').value) || getCurrentActorId(),
    responsavelNome: ($('#agResponsavel') && $('#agResponsavel').selectedOptions[0] ? $('#agResponsavel').selectedOptions[0].textContent : getCurrentActorName()),
    createdByUid: existing ? (existing.createdByUid||'') : getCurrentActorId(),
    createdByName: existing ? (existing.createdByName||'') : getCurrentActorName(),
    createdAt: existing ? (existing.createdAt||new Date().toISOString()) : new Date().toISOString(),
    updatedByUid: getCurrentActorId(), updatedByName:getCurrentActorName(), updatedAt:new Date().toISOString()
  };

  // Verifica conflitos de horário simples
  const parseMinutes = (h) => {
    if(!h) return null;
    const [hh,mm] = h.split(':').map(Number);
    return hh*60 + (mm||0);
  };

  const novoIni = parseMinutes(inicioHora);
  // V5.1 - Melhorias 10-12: conflito por profissional. Quando não existe hora final,
  // tratamos o horário inicial como um intervalo mínimo de 1 minuto para detectar duplicidade exata.
  const novoFim = fimHora ? parseMinutes(fimHora) : (novoIni == null ? null : novoIni + 1);
  const responsavelNovo = String(obj.responsavelUid || '');

  const conflitoEncontrado = state.data.agenda.find(x=>{
    const dataX = String(x.inicioData || x.data || '').slice(0,10);
    if(dataX !== String(obj.data || '').slice(0,10)) return false;
    if(x.id === obj.id) return false;
    if(String(x.status || 'agendado').trim().toLowerCase() === 'cancelado') return false;
    const responsavelX = String(x.responsavelUid || x.createdByUid || '');
    if(responsavelNovo && responsavelX && responsavelX !== responsavelNovo) return false;
    if(x.diaInteiro || obj.diaInteiro) return true;
    const xIni = parseMinutes(x.inicioHora || (x.hora === 'Dia inteiro' ? '' : x.hora));
    const xFimRaw = x.fimHora ? parseMinutes(x.fimHora) : null;
    const xFim = xFimRaw == null ? (xIni == null ? null : xIni + 1) : xFimRaw;
    if(xIni==null || novoIni==null || xFim==null || novoFim==null) return false;
    return Math.max(xIni, novoIni) < Math.min(xFim, novoFim);
  });

  if(conflitoEncontrado){
    const prof = obj.responsavelNome || 'profissional selecionado';
    const horaConflito = conflitoEncontrado.diaInteiro ? 'dia inteiro' : (conflitoEncontrado.inicioHora || conflitoEncontrado.hora || 'horário informado');
    const ok = confirm(`Conflito de horário: ${prof} já possui um agendamento às ${horaConflito} nessa data. Deseja salvar mesmo assim?`);
    if(!ok) return;
  }

  if(existing){
    Object.assign(existing, obj);
    auditLog('update','agenda',obj.id,'Agendamento de '+(obj.clienteNome||'cliente')+' atualizado');
  } else {
    state.data.agenda.push(obj);
    auditLog('create','agenda',obj.id,'Agendamento de '+(obj.clienteNome||'cliente')+' criado');
  }
  savePerfil();
  cloudSaveDoc('agenda', obj);

  // Limpa estado de edição e formulário
  agEditId = null;
  $('#btnAgendar').textContent = 'Agendar Serviço';
  const tAg = $('#agFormTitle');
  if(tAg) tAg.textContent = 'Novo Agendamento';
  const tabAg = $('#tab-agenda');
  if(tabAg) tabAg.classList.remove('edit-mode');
  $('#agServico').value='';
  $('#agObs').value='';
  // imagem do agendamento removida

  renderAgenda();
  // Atualiza KPIs (Previsto/Concluído) em tempo real
  try { renderAgendaResumo(); } catch(e) {}
  renderMainCalendar(); // Atualiza o calendário principal para mostrar o novo agendamento

  // Fecha a modal do formulário (se estiver aberta)
  const m = document.getElementById('modalNovoAgendamento');
  if (m && !m.classList.contains('hidden')) {
    m.classList.add('hidden');
    m.setAttribute('aria-hidden','true');
    const anyOpen = document.querySelectorAll('.auth-modal:not(.hidden)').length > 0;
    document.body.classList.toggle('modal-open', anyOpen);
  }
}
function delAgendamento(id){
  const old=state.data.agenda.find(a=>a.id===id);
  auditLog('delete','agenda',id,'Agendamento de '+((old&&old.clienteNome)||'cliente')+' excluído');
  state.data.agenda = state.data.agenda.filter(a=>a.id!==id);
  savePerfil();
  cloudDeleteDoc('agenda', id);
  renderAgenda();
  // Atualiza KPIs (Previsto/Concluído) em tempo real
  try { renderAgendaResumo(); } catch(e) {}
  renderMainCalendar(); // Atualiza o calendário principal para remover o agendamento
}

// Sai do modo de edição (usado ao fechar o modal sem salvar): volta título/botão
// ao estado "Novo Agendamento" e limpa o formulário, para que o próximo
// "Novo Agendamento" não abra com os dados do item que estava sendo editado
// (e não sobrescreva aquele agendamento sem querer).
function resetAgendamentoEdicao(){
  agEditId = null;
  const tAg = $('#agFormTitle'); if(tAg) tAg.textContent = 'Novo Agendamento';
  const btnAg = $('#btnAgendar'); if(btnAg) btnAg.textContent = 'Agendar Serviço';
  const tabAg = $('#tab-agenda'); if(tabAg) tabAg.classList.remove('edit-mode');
  const set = (id, v) => { const el = $('#'+id); if(el) el.value = v; };
  set('agCliente',''); set('agServico',''); set('agValor',''); set('agObs','');
  set('agStatus','agendado'); set('agInicioHora',''); set('agFimHora','');
  set('agInicioData', todayISO()); set('agFimData', todayISO());
  const di = $('#agDiaInteiro');
  if(di){ di.checked = false; try{ di.dispatchEvent(new Event('change')); }catch(_){} }
  try { syncAgClientePicker(); } catch(e) {}
  try { syncAgServicoSelPicker(); } catch(e) {}
}

function editAgendamento(id){
  const a = state.data.agenda.find(x=>x.id===id);
  if(!a) return;

  agEditId = id;
  try{ populateResponsaveisV4(); if($('#agResponsavel')) $('#agResponsavel').value=a.responsavelUid||a.createdByUid||getCurrentActorId(); }catch(e){}

  // Abre a aba de Agenda (modo edição isolado)
  $$('.tabpane').forEach(p=>{ p.classList.remove('show'); p.classList.remove('active'); });
  const tabAg = $('#tab-agenda');
  if(tabAg){
    tabAg.classList.add('show');
    tabAg.classList.remove('edit-mode');
  }
  $$('#navMenu .menu-item').forEach(b=>b.classList.remove('active'));
  const agendaBtn = $$('#navMenu .menu-item[data-tab="agenda"]')[0];
  if(agendaBtn) agendaBtn.classList.add('active');

  // Ajusta textos para modo de edição
  const tAg = $('#agFormTitle');
  if(tAg) tAg.textContent = 'Editar Agendamento';
  const btnAg = $('#btnAgendar');
  if(btnAg) btnAg.textContent = 'Salvar alterações';

  // Preenche os campos do formulário
  $('#agCliente').value   = a.clienteId || '';
  $('#agServico').value   = a.servico || '';
  $('#agValor').value     = (Number(a.valor||0)).toFixed(2).replace('.',',');
  $('#agStatus').value    = a.status || 'agendado';
  $('#agObs').value       = a.obs || '';

  // Dia inteiro / datas e horários
  if ($('#agDiaInteiro')) $('#agDiaInteiro').checked = !!a.diaInteiro;
  if ($('#agInicioData')) $('#agInicioData').value   = a.inicioData || a.data || todayISO();
  if ($('#agInicioHora')) $('#agInicioHora').value   = a.diaInteiro ? '' : (a.inicioHora || (a.hora === 'Dia inteiro' ? '' : a.hora) || '');
  if ($('#agFimData'))    $('#agFimData').value      = a.fimData || a.inicioData || a.data || '';
  if ($('#agFimHora'))    $('#agFimHora').value      = a.fimHora || '';

  // Atualiza os textos dos pickers (cliente/serviço) para refletir o item selecionado
  try { syncAgClientePicker(); } catch(e) {}
  try { syncAgServicoSelPicker(); } catch(e) {}

  // Abre a modal do formulário
  const m = document.getElementById('modalNovoAgendamento');
  if (m) {
    m.classList.remove('hidden');
    m.setAttribute('aria-hidden','false');
    const anyOpen = document.querySelectorAll('.auth-modal:not(.hidden)').length > 0;
    document.body.classList.toggle('modal-open', anyOpen);
    setTimeout(()=>{ try { $('#agServico').focus(); } catch(_) {} }, 0);
  }

  // imagem do agendamento removida

}

function sendWppReminder(id){
  const a = state.data.agenda.find(x=>x.id===id);
  if(!a) return alert('Agendamento não encontrado.');

  const cliente = state.data.clientes.find(c=>c.id===a.clienteId);
  if(!cliente || !cliente.zap) return alert('Número de WhatsApp do cliente não cadastrado.');

  // Formata a mensagem
  const status = (a.status||'agendado');
  let baseMsg = state.cfg.msgWpp || 'Olá! Lembrete do seu agendamento.';
  if(status==='concluido' && state.cfg.msgWppConcluido) baseMsg = state.cfg.msgWppConcluido;
  if(status==='cancelado' && state.cfg.msgWppCancelado) baseMsg = state.cfg.msgWppCancelado;

  // Monta o texto de horário considerando dia inteiro / início / fim
  let horaTexto = '';
  if (a.diaInteiro) {
    horaTexto = 'dia inteiro';
  } else {
    const inicio = a.inicioHora || a.hora || '';
    const fim    = a.fimHora || '';
    if (inicio && fim) horaTexto = `${inicio} às ${fim}`;
    else horaTexto = inicio || fim || '';
  }

  let msg = baseMsg;
  msg = msg.replace(/{{DATA}}/g, a.dataBr);
  msg = msg.replace(/{{HORA}}/g, horaTexto);
  msg = msg.replace(/{{CLIENTE}}/g, a.clienteNome);
  msg = msg.replace(/{{SERVICO}}/g, a.servico);
  msg = msg.replace(/{{VALOR}}/g, money(a.valor||0, state.cfg.moeda));
  msg = msg.replace(/{{ESTUDIO}}/g, state.cfg.estudio||'');
  msg = msg.replace(/{{PIX}}/g, state.cfg.pixChave||'');

  // Remove caracteres não numéricos do telefone e garante o código do país (55 para Brasil)
  const phone = cliente.zap.replace(/\D/g, '');
  // Garante o formato E.164 (Código do País + DDD + Número)
  // Assume 55 (Brasil) se o número tiver 10 ou 11 dígitos (DDD + Número)
  let fullPhone = phone;
  if (phone.length === 10 || phone.length === 11) {
    fullPhone = '55' + phone;
  }

  const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
  console.log('Tentando abrir o WhatsApp com a URL:', url);
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ======= ANIVERSARIANTES (HOJE) =======
function getAniversariantesHoje(){
  const hoje = new Date();
  const mm = String(hoje.getMonth()+1).padStart(2,'0');
  const dd = String(hoje.getDate()).padStart(2,'0');
  const key = `${mm}-${dd}`;

  const clientes = (state.data && Array.isArray(state.data.clientes)) ? state.data.clientes : [];
  return clientes
    .filter(c=>{
      const nasc = (c && c.nasc) ? String(c.nasc) : '';
      // aceita YYYY-MM-DD
      if (nasc.length >= 10 && nasc.includes('-')){
        const part = nasc.slice(5,10);
        return part === key;
      }
      return false;
    })
    .slice()
    .sort((a,b)=>(a.nome||'').localeCompare(b.nome||''));
}



