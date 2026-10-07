/* Financeiro + Fiados
   Parte 9 de 14 do antigo app.v2.js (dividido na Etapa de modularização).
   Linhas originais: 3732-4427. Nenhuma linha de código foi alterada nesta divisão. */

/* ======= FINANCEIRO ======= */
function openFormTx(tipo){
  $('#formTransacao').classList.remove('hidden');
  $('#txTipo').value = tipo||'receita';
  $('#txData').valueAsDate = new Date();
}
function addTransacao(){
  const obj = {
    id: uid(), tipo: $('#txTipo').value, desc: $('#txDesc').value.trim(),
    valor: parseMoney($('#txValor').value),
    data: $('#txData').value || todayISO(),
    dataBr: formatDateBR($('#txData').value || Date.now()),
    cat: $('#txCat').value,
    createdByUid: getCurrentActorId(),
    ownerId: getDataOwnerId(), createdByName:getCurrentActorName(), createdAt:new Date().toISOString()
  };
  if(!obj.data) return alert('Informe a data.');
  state.data.tx.push(obj);
  auditLog('create','financeiro',obj.id,'Lançamento financeiro criado: '+(obj.desc||obj.cat||''));
  savePerfil();
  cloudSaveDoc('tx', obj);
  $('#formTransacao').classList.add('hidden');
  $('#txDesc').value=''; $('#txValor').value='0,00';
  renderTx();
}
function delTx(id){ const old=state.data.tx.find(t=>t.id===id); auditLog('delete','financeiro',id,'Lançamento excluído: '+((old&&old.desc)||'')); state.data.tx = state.data.tx.filter(t=>t.id!==id); savePerfil(); cloudDeleteDoc('tx', id); renderTx(); }
function editTx(id){
  const t = state.data.tx.find(x=>x.id===id); if(!t) return;
  openFormTx(t.tipo);
  $('#txDesc').value=t.desc; $('#txValor').value=t.valor.toFixed(2).replace('.',',');
  $('#txData').value=t.data; $('#txCat').value=t.cat;
  $('#btnAddTx').onclick = ()=>{
    t.tipo=$('#txTipo').value; t.desc=$('#txDesc').value.trim();
    t.valor=parseMoney($('#txValor').value); t.data=$('#txData').value; t.dataBr=formatDateBR(t.data);
    t.cat=$('#txCat').value; t.updatedByUid=getCurrentActorId(); t.updatedByName=getCurrentActorName(); t.updatedAt=new Date().toISOString(); auditLog('update','financeiro',t.id,'Lançamento financeiro atualizado: '+(t.desc||'')); savePerfil(); cloudSaveDoc('tx', t); $('#formTransacao').classList.add('hidden'); renderTx();
    $('#btnAddTx').onclick = addTransacao;
  };
}
function renderTx(){
  const q = ($('#buscaTx').value||'').toLowerCase();
  const box = $('#listaTx'); box.innerHTML='';
  state.data.tx
    .slice().sort((a,b)=>String(b.data||'').localeCompare(String(a.data||'')))
    .filter(t=>!q || (t.tipo+t.desc+t.cat).toLowerCase().includes(q))
    .forEach(t=>{
      const div = document.createElement('div');
      div.className='item';
      const isReceita = t.tipo === 'receita';
      div.innerHTML = `
        <div class="dp-tx-row">
          <div class="dp-tx-icon ${isReceita?'in':'out'}"><i class="fa-solid fa-${isReceita?'arrow-down':'arrow-up'}"></i></div>
          <div class="dp-item-main">
            <strong>${escapeHtml(t.desc || t.cat || t.tipo.toUpperCase())}</strong>
            <span>${escapeHtml(t.dataBr||'')} • ${escapeHtml(t.cat||'')}</span>
          </div>
          <div class="dp-tx-value ${isReceita?'in':'out'}">${isReceita?'+ ':'- '}${money(t.valor, state.cfg.moeda)}</div>
        </div>
        <div class="dp-tx-actions">
          <span class="muted">Criado por: ${escapeHtml(t.createdByName||'registro antigo')}</span>
          <div class="dp-item-actions">
            <button class="btn ghost sm" data-id="${escapeHtml(t.id)}" data-act="edit" aria-label="Editar lançamento"><i class="fa-solid fa-pen"></i></button>
            <button class="btn danger sm" data-id="${escapeHtml(t.id)}" data-act="del" aria-label="Excluir lançamento"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>`;
      box.appendChild(div);
    });
  $$('#listaTx [data-act="del"]').forEach(b=>b.onclick=()=>delTx(b.dataset.id));
  $$('#listaTx [data-act="edit"]').forEach(b=>b.onclick=()=>editTx(b.dataset.id));
  // Garante que os cards de Receitas/Despesas/Saldo (topo do Financeiro)
  // sempre reflitam a lista na hora, sem precisar fechar e reabrir o app.
  try { refreshKpis(); } catch(e) { /* noop */ }
}
function refreshKpis(){
  const totalR = state.data.tx.filter(t=>t.tipo==='receita').reduce((s,t)=>s+t.valor,0);
  const totalD = state.data.tx.filter(t=>t.tipo==='despesa').reduce((s,t)=>s+t.valor,0);
  const saldo = totalR-totalD;
  $('#kpiReceitas').textContent = money(totalR, state.cfg.moeda);
  $('#kpiDespesas').textContent = money(totalD, state.cfg.moeda);
  $('#kpiSaldo').textContent = money(saldo, state.cfg.moeda);
  const topo = $('#saldoTopo');
  if (topo) topo.textContent = money(saldo, state.cfg.moeda);
}

/* ======= FIADOS ======= */
let _fiadoEditId = null;

function ensureFiados(){
  if (!state || !state.data) return;
  if (!Array.isArray(state.data.fiados)) state.data.fiados = [];

  // Migração leve: fiados antigos (sem parcelas) viram 1 parcela
  try{
    (state.data.fiados||[]).forEach(f=>{
      if (!f) return;
      if (!Array.isArray(f.parcelas) || !f.parcelas.length){
        const pago = (f.status||'') === 'pago';
        f.parcelas = [{
          n: 1,
          valor: Number(f.valor||0),
          venc: f.venc || '',
          pago: !!pago,
          pagoData: f.pagoData || '',
          pagoDataBr: f.pagoDataBr || (f.pagoData ? formatDateBR(f.pagoData) : ''),
          txId: f.txId || null
        }];
      }
      // mantém status coerente
      const unpaid = (f.parcelas||[]).filter(p=>!p.pago).reduce((s,p)=>s+Number(p.valor||0),0);
      f.status = unpaid > 0 ? 'aberto' : 'pago';
    });
  }catch(e){ console.warn('Migração fiados/parcelas falhou', e); }
}

function _addDaysISO(iso, days){
  const d = iso ? _parseISODateOnlyLocal(iso) : new Date();
  d.setDate(d.getDate()+days);
  return _dateToISODateOnlyLocal(d);
}
function _addMonthsISO(iso, months){
  const d = iso ? _parseISODateOnlyLocal(iso) : new Date();
  const day = d.getDate();
  d.setMonth(d.getMonth()+months);
  // evita pular mês quando dia não existe
  if (d.getDate() !== day) d.setDate(0);
  return _dateToISODateOnlyLocal(d);
}
function _freqNext(baseISO, i, freq){
  if (freq === 'semanal') return _addDaysISO(baseISO, 7*i);
  if (freq === 'quinzenal') return _addDaysISO(baseISO, 14*i);
  return _addMonthsISO(baseISO, i);
}

function _rebuildParcelasPreview(opts){
  const box = $('#fiParcelasBox');
  if (!box) return;
  const qtd = Math.max(1, Math.min(60, parseInt(opts.qtd||1,10) || 1));
  const total = Number(opts.total||0);
  const firstISO = opts.firstISO || todayISO();
  const freq = opts.freq || 'mensal';

  // divisão do valor (ajusta última parcela para bater certinho)
  const base = qtd > 0 ? Math.floor((total/qtd)*100)/100 : total;
  const parcelas = [];
  let acc = 0;
  for (let i=0;i<qtd;i++){
    let v = base;
    if (i === qtd-1) v = Math.max(0, Math.round((total-acc)*100)/100);
    acc = Math.round((acc+v)*100)/100;
    parcelas.push({
      n: i+1,
      valor: v,
      venc: _freqNext(firstISO, i, freq),
      pago: false,
      pagoData: '',
      pagoDataBr: '',
      txId: null
    });
  }

  // Render UI editável
  box.innerHTML = `
    <div class="muted" style="margin-bottom:8px;">Controle de parcelas (vencimento e data de pagamento).</div>
    <div id="fiParcelasList" class="list" style="gap:10px;"></div>
  `;
  const list = $('#fiParcelasList');
  parcelas.forEach(p=>{
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <strong>Parcela ${escapeHtml(p.n)}/${qtd} — ${money(p.valor, state.cfg.moeda)}</strong>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px;align-items:center;">
        <div style="flex:1;min-width:160px;">
          <label class="label" style="margin:0 0 6px;opacity:.9;">Vencimento</label>
          <div class="dt-pill flex"><i class="fa-regular fa-calendar"></i><input class="input dt-input" type="date" data-parc="venc" data-n="${escapeHtml(p.n)}" value="${escapeHtml(p.venc||'')}"/></div>
        </div>
        <label class="row" style="gap:8px;align-items:center;flex:0 0 auto;margin-top:18px;">
          <input type="checkbox" data-parc="pago" data-n="${escapeHtml(p.n)}" />
          <span>Pago</span>
        </label>
        <div style="flex:1;min-width:160px;" data-parcwrap="${escapeHtml(p.n)}" class="hidden">
          <label class="label" style="margin:0 0 6px;opacity:.9;">Data do pagamento</label>
          <div class="dt-pill flex"><i class="fa-regular fa-calendar"></i><input class="input dt-input" type="date" data-parc="pagoData" data-n="${escapeHtml(p.n)}" value=""/></div>
        </div>
      </div>
    `;
    list.appendChild(div);
  });

  // interações
  $$('#fiParcelasBox [data-parc="pago"]').forEach(chk=>{
    chk.onchange = ()=>{
      const n = chk.dataset.n;
      const wrap = $(`#fiParcelasBox [data-parcwrap="${n}"]`);
      if (!wrap) return;
      if (chk.checked){
        wrap.classList.remove('hidden');
        const inp = wrap.querySelector('[data-parc="pagoData"]');
        if (inp && !inp.value) inp.value = todayISO();
      } else {
        wrap.classList.add('hidden');
      }
    };
  });
}

function _renderParcelasFromFiado(f){
  const box = $('#fiParcelasBox');
  if (!box) return;
  const parcelas = Array.isArray(f.parcelas) ? f.parcelas : [];
  const qtd = parcelas.length || 1;
  box.innerHTML = `
    <div class="muted" style="margin-bottom:8px;">Controle de parcelas (vencimento e data de pagamento).</div>
    <div id="fiParcelasList" class="list" style="gap:10px;"></div>
  `;
  const list = $('#fiParcelasList');

  parcelas.forEach(p=>{
    const div = document.createElement('div');
    div.className = 'item';
    const pagoLbl = p.pago ? ` • Pago: ${(p.pagoDataBr || (p.pagoData ? formatDateBR(p.pagoData) : ''))}` : '';
    div.innerHTML = `
      <strong>Parcela ${escapeHtml(p.n||1)}/${qtd} — ${money(Number(p.valor||0), state.cfg.moeda)}${escapeHtml(pagoLbl)}</strong>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px;align-items:center;">
        <div style="flex:1;min-width:160px;">
          <label class="label" style="margin:0 0 6px;opacity:.9;">Vencimento</label>
          <div class="dt-pill flex"><i class="fa-regular fa-calendar"></i><input class="input dt-input" type="date" data-parc="venc" data-n="${escapeHtml(p.n)}" value="${escapeHtml(p.venc||'')}"/></div>
        </div>
        <label class="row" style="gap:8px;align-items:center;flex:0 0 auto;margin-top:18px;">
          <input type="checkbox" data-parc="pago" data-n="${escapeHtml(p.n)}" ${p.pago ? 'checked' : ''} />
          <span>Pago</span>
        </label>
        <div style="flex:1;min-width:160px;" data-parcwrap="${escapeHtml(p.n)}" class="${p.pago ? '' : 'hidden'}">
          <label class="label" style="margin:0 0 6px;opacity:.9;">Data do pagamento</label>
          <div class="dt-pill flex"><i class="fa-regular fa-calendar"></i><input class="input dt-input" type="date" data-parc="pagoData" data-n="${escapeHtml(p.n)}" value="${escapeHtml(p.pagoData||'')}"/></div>
        </div>
      </div>
      ${p.txId ? `<div class="muted" style="margin-top:6px;">Lançado no Financeiro ✅</div>` : ''}
    `;
    list.appendChild(div);
  });

  // interações
  $$('#fiParcelasBox [data-parc="pago"]').forEach(chk=>{
    chk.onchange = ()=>{
      const n = chk.dataset.n;
      const wrap = $(`#fiParcelasBox [data-parcwrap="${n}"]`);
      if (!wrap) return;
      if (chk.checked){
        wrap.classList.remove('hidden');
        const inp = wrap.querySelector('[data-parc="pagoData"]');
        if (inp && !inp.value) inp.value = todayISO();
      } else {
        wrap.classList.add('hidden');
      }
    };
  });
}

function openFormFiado(editId=null){
  ensureFiados();
  _fiadoEditId = editId;
  const form = $('#formFiado');
  if (!form) return;

  // popula clientes
  const sel = $('#fiCliente');
  if (sel){
    sel.innerHTML = '';
    (state.data.clientes||[]).slice().sort((a,b)=>(a.nome||'').localeCompare(b.nome||'')).forEach(c=>{
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.nome;
      sel.appendChild(o);
    });
  }

  // defaults
  $('#fiadoFormTitle').textContent = editId ? 'Editar Fiado' : 'Novo Fiado';
  $('#fiDesc').value = '';
  $('#fiValor').value = '0,00';
  if ($('#fiParcQtd')) $('#fiParcQtd').value = '1';
  if ($('#fiParcPrimeira')) $('#fiParcPrimeira').value = todayISO();
  if ($('#fiParcFreq')) $('#fiParcFreq').value = 'mensal';
  $('#fiData').value = todayISO();
  $('#fiVenc').value = '';

  if (editId){
    const f = state.data.fiados.find(x=>x.id===editId);
    if (f){
      if (sel) sel.value = f.clienteId || (sel.options[0]?.value || '');
      $('#fiDesc').value = f.desc || '';
      $('#fiValor').value = Number(f.valor||0).toFixed(2).replace('.',',');
      // parcelas
      const parcelas = Array.isArray(f.parcelas) ? f.parcelas : [];
      const qtd = parcelas.length || 1;
      if ($('#fiParcQtd')) $('#fiParcQtd').value = String(qtd);
      if ($('#fiParcPrimeira')) $('#fiParcPrimeira').value = (parcelas[0]?.venc) || (f.venc || f.data || todayISO());
      if ($('#fiParcFreq')) $('#fiParcFreq').value = (f.parcFreq || 'mensal');

      $('#fiData').value = f.data || todayISO();
      $('#fiVenc').value = f.venc || '';

      // Se já tem parcelas pagas, não deixa recriar/redistribuir
      const hasPaid = (parcelas||[]).some(p=>p && p.pago);
      if ($('#fiValor')) $('#fiValor').disabled = !!hasPaid;
      if ($('#fiParcQtd')) $('#fiParcQtd').disabled = !!hasPaid;
      if ($('#fiParcPrimeira')) $('#fiParcPrimeira').disabled = !!hasPaid;
      if ($('#fiParcFreq')) $('#fiParcFreq').disabled = !!hasPaid;

      _renderParcelasFromFiado(f);
    }
  } else {
    // Novo: monta preview automático
    if ($('#fiValor')) $('#fiValor').disabled = false;
    if ($('#fiParcQtd')) $('#fiParcQtd').disabled = false;
    if ($('#fiParcPrimeira')) $('#fiParcPrimeira').disabled = false;
    if ($('#fiParcFreq')) $('#fiParcFreq').disabled = false;
    _rebuildParcelasPreview({
      qtd: $('#fiParcQtd')?.value,
      total: parseMoney($('#fiValor')?.value || '0'),
      firstISO: $('#fiParcPrimeira')?.value || todayISO(),
      freq: $('#fiParcFreq')?.value || 'mensal'
    });
  }

  // listeners (apenas quando pode recalcular)
  const canRecalc = !editId;
  if (canRecalc){
    const rebuild = ()=>{
      _rebuildParcelasPreview({
        qtd: $('#fiParcQtd')?.value,
        total: parseMoney($('#fiValor')?.value || '0'),
        firstISO: $('#fiParcPrimeira')?.value || todayISO(),
        freq: $('#fiParcFreq')?.value || 'mensal'
      });
    };
    if ($('#fiValor')) $('#fiValor').oninput = rebuild;
    if ($('#fiParcQtd')) $('#fiParcQtd').oninput = rebuild;
    if ($('#fiParcPrimeira')) $('#fiParcPrimeira').onchange = rebuild;
    if ($('#fiParcFreq')) $('#fiParcFreq').onchange = rebuild;
  }

  form.classList.remove('hidden');
}

function closeFormFiado(){
  _fiadoEditId = null;
  const form = $('#formFiado');
  if (form) form.classList.add('hidden');
}

function salvarFiado(){
  ensureFiados();
  const clienteId = $('#fiCliente').value;
  const cliente = (state.data.clientes||[]).find(c=>c.id===clienteId);
  if (!clienteId || !cliente) return alert('Selecione um cliente.');

  const data = $('#fiData').value || todayISO();
  const valor = parseMoney($('#fiValor').value);
  if (!valor || valor <= 0) return alert('Informe um valor válido.');

  const payload = {
    id: _fiadoEditId || uid(),
    clienteId,
    clienteNome: cliente.nome,
    desc: ($('#fiDesc').value||'').trim(),
    valor,
    data,
    dataBr: formatDateBR(data),
    venc: $('#fiVenc').value || '',
    status: 'aberto',
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  };

  // Parcelas (lê do formulário)
  const qtd = Math.max(1, Math.min(60, parseInt($('#fiParcQtd')?.value || '1',10) || 1));
  payload.parcFreq = $('#fiParcFreq')?.value || 'mensal';
  payload.parcelas = [];

  // Se o box foi montado como preview, os inputs estão dentro de #fiParcelasBox
  // Para editar, também.
  for (let i=1;i<=qtd;i++){
    const venc = $(`#fiParcelasBox [data-parc="venc"][data-n="${i}"]`)?.value || '';
    const pago = !!($(`#fiParcelasBox [data-parc="pago"][data-n="${i}"]`)?.checked);
    const pagoData = $(`#fiParcelasBox [data-parc="pagoData"][data-n="${i}"]`)?.value || '';
    payload.parcelas.push({
      n: i,
      valor: 0, // será preenchido abaixo
      venc,
      pago,
      pagoData: pago ? (pagoData || todayISO()) : '',
      pagoDataBr: pago ? formatDateBR((pagoData||todayISO())) : '',
      txId: null
    });
  }

  // Define valor por parcela: tenta manter o que já existia ao editar
  // Se editar e já tinha parcelas, mantém os valores originais (para não bagunçar histórico)
  if (_fiadoEditId){
    const old = state.data.fiados.find(x=>x.id===_fiadoEditId);
    if (old && Array.isArray(old.parcelas) && old.parcelas.length === payload.parcelas.length){
      payload.parcelas.forEach((p,idx)=>{
        p.valor = Number(old.parcelas[idx]?.valor||0);
        p.txId = old.parcelas[idx]?.txId || null;
      });
    }
  }

  // Se não conseguiu manter valores (novo fiado ou tamanho diferente), distribui o total
  if (payload.parcelas.some(p=>!p.valor)){
    const base = qtd > 0 ? Math.floor((valor/qtd)*100)/100 : valor;
    let acc = 0;
    payload.parcelas.forEach((p,idx)=>{
      let v = base;
      if (idx === qtd-1) v = Math.max(0, Math.round((valor-acc)*100)/100);
      acc = Math.round((acc+v)*100)/100;
      p.valor = v;
    });
  }

  // Atualiza status conforme parcelas
  const unpaidSum = payload.parcelas.filter(p=>!p.pago).reduce((s,p)=>s+Number(p.valor||0),0);
  payload.status = unpaidSum > 0 ? 'aberto' : 'pago';

  // Ao marcar parcela como PAGA, lança automaticamente no Financeiro (1 receita por parcela).
  // Ao desmarcar (voltar para em aberto), remove o lançamento correspondente.
  // Também funciona no cadastro de um novo fiado (se alguma parcela já for marcada como paga).
  try{
    if (!Array.isArray(state.data.tx)) state.data.tx = [];

    const old = _fiadoEditId ? state.data.fiados.find(x=>x.id===_fiadoEditId) : null;
    const oldParcelas = (old && Array.isArray(old.parcelas)) ? old.parcelas : [];

    payload.parcelas.forEach((p,idx)=>{
      const oldP = oldParcelas[idx] || {};

      const eraPago = !!oldP.pago;
      const virouPago = !!p.pago && !eraPago;
      const virouAberto = !p.pago && eraPago;

      // garante datas BR
      if (p.pago){
        const dISO = p.pagoData || todayISO();
        p.pagoData = dISO;
        p.pagoDataBr = formatDateBR(dISO);
      } else {
        p.pagoData = '';
        p.pagoDataBr = '';
      }

      // remove receita se voltou para aberto
      const existingTxId = oldP.txId || p.txId || null;
      if (virouAberto && existingTxId){
        state.data.tx = (state.data.tx||[]).filter(t=>t && t.id !== existingTxId);
        p.txId = null;
        cloudDeleteDoc('tx', existingTxId);
        return;
      }

      // cria receita se virou pago e ainda não existe
      if (virouPago && !existingTxId){
        const txId = uid();
        const dataISO = p.pagoData || todayISO();
        const tx = {
          id: txId,
          tipo: 'receita',
          desc: `Fiado recebido • ${cliente.nome} • Parcela ${escapeHtml(p.n)}/${qtd}${payload.desc ? ' • ' + payload.desc : ''}`,
          valor: Number(p.valor||0),
          data: dataISO,
          dataBr: formatDateBR(dataISO),
          cat: 'Fiados',
          origem: 'fiado_parcela',
          origemId: payload.id,
          origemParcela: p.n
        };
        state.data.tx.push(tx);
        p.txId = txId;
        cloudSaveDoc('tx', tx);
        return;
      }

      // se continua pago e já existe, mantém e atualiza o lançamento para ficar consistente
      if (p.pago && existingTxId){
        p.txId = existingTxId;
        const t = (state.data.tx||[]).find(x=>x && x.id===existingTxId);
        if (t){
          t.tipo = 'receita';
          t.cat = 'Fiados';
          t.origem = 'fiado_parcela';
          t.origemId = payload.id;
          t.origemParcela = p.n;
          t.valor = Number(p.valor||0);
          t.data = p.pagoData || t.data || todayISO();
          t.dataBr = formatDateBR(t.data);
          t.desc = `Fiado recebido • ${cliente.nome} • Parcela ${escapeHtml(p.n)}/${qtd}${payload.desc ? ' • ' + payload.desc : ''}`;
          cloudSaveDoc('tx', t);
        }
      } else {
        // mantém txId antigo (se houver)
        p.txId = existingTxId;
      }
    });
  } catch(e){
    console.warn('Falha ao sincronizar parcelas do fiado com Financeiro', e);
  }

  if (_fiadoEditId){
    const f = state.data.fiados.find(x=>x.id===_fiadoEditId);
    if (!f) return alert('Fiado não encontrado.');
    if (f.status === 'pago') return alert('Este fiado já está pago e não pode ser editado.');
    Object.assign(f, payload);
    cloudSaveDoc('fiados', f);
  } else {
    state.data.fiados.push(payload);
    cloudSaveDoc('fiados', payload);
  }

  savePerfil();
  closeFormFiado();
  renderFiados();
  refreshSystemStats();
}

function delFiado(id){
  ensureFiados();
  const f = state.data.fiados.find(x=>x.id===id);
  if (!f) return;
  const parcelas = Array.isArray(f.parcelas) ? f.parcelas : [];
  const temLancamentos = parcelas.some(p=>p && p.txId) || (state.data.tx||[]).some(t=>t && t.origem==='fiado_parcela' && t.origemId===f.id);
  const msg = (f.status === 'pago')
    ? `Excluir este fiado PAGO?${temLancamentos ? '\n\nObs.: as receitas lançadas deste fiado também serão removidas.' : ''}`
    : `Excluir este fiado?${temLancamentos ? '\n\nObs.: as receitas lançadas deste fiado também serão removidas.' : ''}`;
  if(!confirm(msg)) return;

  // Remove lançamentos vinculados (por segurança, usa txId das parcelas e também origemId)
  let txIdsRemovidos = [];
  try{
    const txIds = new Set((parcelas||[]).map(p=>p && p.txId).filter(Boolean));
    const txsRemovidos = (state.data.tx||[]).filter(t=>t && (txIds.has(t.id) || (t.origem === 'fiado_parcela' && t.origemId === f.id)));
    txIdsRemovidos = txsRemovidos.map(t=>t.id);
    state.data.tx = (state.data.tx||[]).filter(t=>{
      if (!t) return false;
      if (txIds.has(t.id)) return false;
      if (t.origem === 'fiado_parcela' && t.origemId === f.id) return false;
      return true;
    });
  }catch(e){
    console.warn('Falha ao remover lançamentos do fiado', e);
  }

  state.data.fiados = state.data.fiados.filter(x=>x.id!==id);
  savePerfil();
  cloudDeleteDoc('fiados', id);
  txIdsRemovidos.forEach(tid=>cloudDeleteDoc('tx', tid));
  renderFiados();
  renderTx();
  refreshKpis();
  refreshSystemStats();
}

function receberFiado(id){
  ensureFiados();
  const f = state.data.fiados.find(x=>x.id===id);
  if (!f) return;
  if ((f.status||'aberto') === 'pago') return;

  // recebe por parcela (se existir)
  const parcelas = Array.isArray(f.parcelas) ? f.parcelas : [];
  if (!parcelas.length){
    // fallback: cria 1 parcela
    f.parcelas = [{ n:1, valor:Number(f.valor||0), venc:f.venc||'', pago:false, pagoData:'', pagoDataBr:'', txId:null }];
  }

  const ab = (f.parcelas||[]).filter(p=>!p.pago);
  if (!ab.length){
    f.status = 'pago';
    savePerfil();
    cloudSaveDoc('fiados', f);
    renderFiados();
    refreshSystemStats();
    return;
  }

  let alvo = ab[0];
  if (ab.length > 1){
    const msg = `Qual parcela deseja receber?\n\nEm aberto: ${ab.map(p=>p.n).join(', ')}\n\nDigite o número da parcela:`;
    const resp = prompt(msg, String(ab[0].n||1));
    const n = parseInt((resp||'').trim(),10);
    const found = ab.find(p=>Number(p.n)===Number(n));
    if (!found) return;
    alvo = found;
  }

  if(!confirm(`Receber Parcela ${alvo.n}/${(f.parcelas||[]).length} e lançar como RECEITA no Financeiro?`)) return;

  const dataISO = todayISO();
  alvo.pago = true;
  alvo.pagoData = dataISO;
  alvo.pagoDataBr = formatDateBR(dataISO);

  // cria receita (se ainda não existe)
  if (!alvo.txId){
    const txId = uid();
    const tx = {
      id: txId,
      tipo: 'receita',
      desc: `Fiado recebido • ${f.clienteNome} • Parcela ${alvo.n}/${(f.parcelas||[]).length}${f.desc ? ' • ' + f.desc : ''}`,
      valor: Number(alvo.valor||0),
      data: dataISO,
      dataBr: formatDateBR(dataISO),
      cat: 'Fiados',
      origem: 'fiado_parcela',
      origemId: f.id,
      origemParcela: alvo.n
    };
    state.data.tx.push(tx);
    alvo.txId = txId;
    cloudSaveDoc('tx', tx);
  }

  const unpaid = (f.parcelas||[]).filter(p=>!p.pago).reduce((s,p)=>s+Number(p.valor||0),0);
  f.status = unpaid > 0 ? 'aberto' : 'pago';
  if (f.status === 'pago'){
    f.pagoEm = new Date().toISOString();
    f.pagoData = dataISO;
    f.pagoDataBr = formatDateBR(dataISO);
  }
  f.atualizadoEm = new Date().toISOString();

  savePerfil();
  cloudSaveDoc('fiados', f);
  renderFiados();
  renderTx();
  refreshKpis();
  refreshSystemStats();
}

function renderFiados(){
  ensureFiados();
  const q = ($('#buscaFiado')?.value || '').toLowerCase();
  const box = $('#listaFiados');
  if (!box) return;
  box.innerHTML = '';

  const arr = (state.data.fiados||[])
    .slice()
    .sort((a,b)=>{
      // abertos primeiro, depois por data desc
      const sa = (a.status||'aberto');
      const sb = (b.status||'aberto');
      if (sa !== sb) return sa === 'aberto' ? -1 : 1;
      return String(b.data||'').localeCompare(String(a.data||''));
    })
    .filter(f=>{
      const blob = `${f.clienteNome||''} ${f.desc||''} ${f.status||''}`.toLowerCase();
      return !q || blob.includes(q);
    });

  if (!arr.length){
    box.innerHTML = '<p class="muted">Nenhum fiado encontrado.</p>';
    return;
  }

  arr.forEach(f=>{
    const div = document.createElement('div');
    div.className = 'item';

    const status = safeFiStatus(f.status);
    const parcelas = Array.isArray(f.parcelas) ? f.parcelas : [];
    const qtdP = parcelas.length || 1;
    const pagos = parcelas.filter(p=>p && p.pago).length;
    const aberto = parcelas.filter(p=>p && !p.pago).reduce((s,p)=>s+Number(p.valor||0),0);
    const proxVenc = parcelas.filter(p=>p && !p.pago && p.venc).map(p=>p.venc).sort()[0] || (f.venc||'');
    const vencLabel = proxVenc ? ` • Próx. venc: ${formatDateBR(proxVenc)}` : '';
    const pagoLabel = status==='pago' ? ` • Pago: ${(f.pagoDataBr || (f.pagoData ? formatDateBR(f.pagoData) : ''))}` : '';

    div.innerHTML = `
      <strong>${escapeHtml(status.toUpperCase())} • ${escapeHtml(f.dataBr || (f.data ? formatDateBR(f.data) : ''))} — ${money(f.valor, state.cfg.moeda)}</strong>
      <div class="muted">Cliente: ${escapeHtml(f.clienteNome || '')}${escapeHtml(vencLabel)}${escapeHtml(pagoLabel)}</div>
      <div class="muted">Parcelas: ${pagos}/${qtdP} • Em aberto: ${money(aberto, state.cfg.moeda)}</div>
      ${f.desc ? `<div class="muted">${escapeHtml(f.desc)}</div>` : ''}
      <div class="row" style="margin-top:6px;gap:8px;flex-wrap:wrap">
        ${status==='aberto' ? `<button class="btn success sm" data-id="${escapeHtml(f.id)}" data-act="pay"><i class="fa-solid fa-circle-check"></i> Receber</button>` : ''}
        ${status==='aberto' ? `<button class="btn ghost sm" data-id="${escapeHtml(f.id)}" data-act="edit"><i class="fa-solid fa-pen"></i> Editar</button>` : ''}
        <button class="btn danger sm" data-id="${escapeHtml(f.id)}" data-act="del"><i class="fa-solid fa-trash"></i> Excluir</button>
      </div>
    `;
    box.appendChild(div);
  });

  $$('#listaFiados [data-act="pay"]').forEach(b=>b.onclick=()=>receberFiado(b.dataset.id));
  $$('#listaFiados [data-act="edit"]').forEach(b=>b.onclick=()=>openFormFiado(b.dataset.id));
  $$('#listaFiados [data-act="del"]').forEach(b=>b.onclick=()=>delFiado(b.dataset.id));
}

