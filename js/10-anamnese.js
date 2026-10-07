/* Anamnese
   Parte 11 de 14 do antigo app.v2.js (dividido na Etapa de modularização).
   Linhas originais: 4834-5250. Nenhuma linha de código foi alterada nesta divisão. */

/* ======= ANAMNESE ======= */
// Estrutura das perguntas: {p: 'Pergunta', t: 'texto'|'assinalar'|'selecionar', opt?: ['A','B']}
const MODELOS_PADRAO = {
  basico: {
    perguntas: [
      {p:'Alergia a medicamentos?', t:'texto'},
      {p:'Doenças pré-existentes?', t:'texto'},
      {p:'Uso de anticoagulantes?', t:'texto'},
      {p:'Cicatrização lenta?', t:'texto'},
      {p:'Já fez tatuagem antes?', t:'texto'}
    ],
    termos: 'Declaro que as informações prestadas são verdadeiras e autorizo a realização do procedimento.'
  },
  detalhado: {
    perguntas: [
      {p:'Altura', t:'texto'},
      {p:'Peso', t:'texto'},
      {p:'IMC (aprox.)', t:'texto'},
      {p:'Pressão recente', t:'texto'},
      {p:'Cirurgias', t:'texto'},
      {p:'Cicatriz/Queloide', t:'texto'},
      {p:'Tendência a sangramento', t:'texto'},
      {p:'Avaliação da pele', t:'texto'},
      {p:'Consentimento informado', t:'assinalar'}
    ],
    termos: 'Li e concordo com os termos, riscos e orientações informadas pelo profissional.'
  },
  // Modelo completo (tattoo / piercing / micropigmentação)
  completo: {
    perguntas: [
      {p:'Procedimento que irá realizar', t:'selecionar', opt:['Tatuagem','Piercing','Micropigmentação','Outro']},
      {p:'Nome completo', t:'texto'},
      {p:'Data de nascimento', t:'texto'},
      {p:'Telefone/WhatsApp para contato', t:'texto'},
      {p:'Peso (kg)', t:'texto'},
      {p:'Altura (cm)', t:'texto'},
      {p:'Está gestante ou amamentando?', t:'selecionar', opt:['Não','Sim','Não sei/Prefiro não informar']},
      {p:'Possui marcapasso?', t:'selecionar', opt:['Não','Sim','Não sei']},
      {p:'É portador(a) de HIV?', t:'selecionar', opt:['Não','Sim','Não sei/Prefiro não informar']},
      {p:'Hepatite (A/B/C) diagnosticada?', t:'selecionar', opt:['Não','Sim','Não sei']},
      {p:'Possui/teve DST/IST diagnosticada?', t:'selecionar', opt:['Não','Sim','Não sei/Prefiro não informar']},
      {p:'Diabetes?', t:'selecionar', opt:['Não','Sim','Não sei']},
      {p:'Hipertensão/Pressão alta?', t:'selecionar', opt:['Não','Sim','Não sei']},
      {p:'Doenças cardíacas?', t:'selecionar', opt:['Não','Sim','Não sei']},
      {p:'Epilepsia/convulsões?', t:'selecionar', opt:['Não','Sim','Não sei']},
      {p:'Alergia a medicamentos/anestésicos/latex?', t:'texto'},
      {p:'Uso de medicamentos contínuos?', t:'texto'},
      {p:'Uso de anticoagulantes (ex: AAS, Marevan, Xarelto)?', t:'selecionar', opt:['Não','Sim','Não sei']},
      {p:'Tendência a sangramento fácil?', t:'selecionar', opt:['Não','Sim','Não sei']},
      {p:'Problemas de cicatrização / queloide?', t:'selecionar', opt:['Não','Sim','Não sei']},
      {p:'Realizou procedimento semelhante antes? (tattoo/piercing/micro)', t:'selecionar', opt:['Não','Sim']},
      {p:'Observações / diagnósticos relevantes', t:'texto'},
      {p:'Declaro que as informações acima são verdadeiras', t:'assinalar'}
    ],
    termos: 'Declaro que as informações prestadas são verdadeiras. Estou ciente dos riscos do procedimento (tatuagem/piercing/micropigmentação), bem como dos cuidados pré e pós-procedimento, e autorizo a realização do procedimento.'
  }
};

let assinaturaPad = null;

function ensureAnCfg(){
  state.cfg.anTermos = state.cfg.anTermos || {};
  state.cfg.anEditavel = state.cfg.anEditavel || {
    perguntas: [
      {p:'Pergunta 1', t:'texto'},
      {p:'Pergunta 2', t:'assinalar'},
      {p:'Pergunta 3', t:'selecionar', opt:['Opção A','Opção B']}
    ],
    termos: 'Digite aqui os termos do modelo editável.'
  };
}

function initSignaturePad(){
  const canvas = document.getElementById('anCanvas');
  const btnLimpar = document.getElementById('btnLimparAss');
  if(!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  function resize(){
    // Mantém o tamanho visual via CSS (100% x 180px) e ajusta o buffer interno
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    // fundo transparente; não desenha background
  }
  resize();
  window.addEventListener('resize', resize);

  let drawing = false;
  let hasInk = false;
  let last = {x:0,y:0};

  function getPos(e){
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {x: clientX - rect.left, y: clientY - rect.top};
  }
  function start(e){
    drawing = true;
    last = getPos(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    e.preventDefault();
  }
  function move(e){
    if(!drawing) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    last = pos;
    hasInk = true;
    e.preventDefault();
  }
  function end(){
    drawing = false;
  }
  canvas.addEventListener('pointerdown', start);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  if(btnLimpar){
    btnLimpar.onclick = ()=>{
      ctx.clearRect(0,0,canvas.width,canvas.height);
      hasInk = false;
    };
  }

  assinaturaPad = {
    clear: ()=>{ctx.clearRect(0,0,canvas.width,canvas.height); hasInk=false;},
    hasInk: ()=>hasInk,
    toDataURL: ()=> hasInk ? canvas.toDataURL('image/png') : ''
  };
}

function renderCamposAn(perguntas){
  const box = document.getElementById('anCampos');
  if(!box) return;
  box.innerHTML = '';
  (perguntas||[]).forEach((q,idx)=>{
    const p = (q && q.p) ? String(q.p) : `Pergunta ${idx+1}`;
    const t = (q && q.t) ? String(q.t) : 'texto';
    const div = document.createElement('div');
    div.innerHTML = `<label class="label">${escapeHtml(p)}</label>`;

    if(t === 'assinalar'){
      const wrap = document.createElement('label');
      wrap.style.display='flex';
      wrap.style.alignItems='center';
      wrap.style.gap='10px';
      wrap.style.padding='10px 12px';
      wrap.style.border='1px solid rgba(255,255,255,.08)';
      wrap.style.borderRadius='14px';
      wrap.style.background='rgba(0,0,0,.18)';
      wrap.innerHTML = `<input type="checkbox" data-pergunta="${escapeHtml(p)}" data-tipo="assinalar" style="width:18px;height:18px" /> <span class="muted">Assinalar</span>`;
      div.appendChild(wrap);
    } else if(t === 'selecionar'){
      const sel = document.createElement('select');
      sel.className = 'input';
      sel.setAttribute('data-pergunta', p);
      sel.setAttribute('data-tipo', 'selecionar');
      const opts = Array.isArray(q.opt) ? q.opt : (typeof q.opt === 'string' ? q.opt.split(',').map(x=>x.trim()).filter(Boolean) : []);
      sel.innerHTML = `<option value="">Selecione...</option>` + opts.map(o=>`<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('');
      div.appendChild(sel);
    } else {
      const inp = document.createElement('input');
      inp.className='input';
      inp.setAttribute('data-pergunta', p);
      inp.setAttribute('data-tipo', 'texto');
      div.appendChild(inp);
    }
    box.appendChild(div);
  });
}

function buildEditor(){
  const ed = document.getElementById('anEditor');
  if(!ed) return;
  ed.innerHTML = '';

  const head = document.createElement('div');
  head.className = 'row';
  head.style.justifyContent='space-between';
  head.innerHTML = `
    <div>
      <strong>Editar modelo</strong><div class="muted sm">Defina perguntas e o tipo de resposta.</div>
    </div>
    <div class="row" style="gap:8px">
      <button class="btn ghost sm" id="btnAnAddQ" type="button"><i class="fa-solid fa-plus"></i> Adicionar pergunta</button>
      <button class="btn primary sm" id="btnAnAplicar" type="button"><i class="fa-solid fa-check"></i> Aplicar</button>
    </div>`;
  ed.appendChild(head);

  const list = document.createElement('div');
  list.id = 'anEditorList';
  ed.appendChild(list);

  function renderList(){
    ensureAnCfg();
    list.innerHTML = '';
    (state.cfg.anEditavel.perguntas||[]).forEach((q,idx)=>{
      const item = document.createElement('div');
      item.className = 'an-qitem';
      const t = q.t || 'texto';
      const opts = Array.isArray(q.opt) ? q.opt.join(', ') : (q.opt||'');
      item.innerHTML = `
        <div class="an-qmeta">
          <input class="input" data-ed="p" data-idx="${idx}" placeholder="Pergunta" value="${escapeHtml(q.p||'')}" />
          <div class="an-opt" style="display:${t==='selecionar'?'block':'none'}">
            <input class="input" data-ed="opt" data-idx="${idx}" placeholder="Opções (separadas por vírgula)" value="${escapeHtml(String(opts))}" />
          </div>
        </div>
        <div>
          <select class="input" data-ed="t" data-idx="${idx}">
            <option value="texto" ${t==='texto'?'selected':''}>Texto</option>
            <option value="assinalar" ${t==='assinalar'?'selected':''}>Assinalar</option>
            <option value="selecionar" ${t==='selecionar'?'selected':''}>Selecionar</option>
          </select>
          <div class="an-qact" style="margin-top:8px">
            <button class="btn danger sm" data-ed="del" data-idx="${idx}" type="button"><i class="fa-solid fa-trash"></i> Remover</button>
          </div>
        </div>`;
      list.appendChild(item);
    });

    // handlers
    list.querySelectorAll('[data-ed="t"]').forEach(sel=>{
      sel.onchange = ()=>{
        const idx = Number(sel.dataset.idx);
        ensureAnCfg();
        state.cfg.anEditavel.perguntas[idx].t = sel.value;
        renderList();
      };
    });
    list.querySelectorAll('[data-ed="p"]').forEach(inp=>{
      inp.oninput = ()=>{
        const idx = Number(inp.dataset.idx);
        ensureAnCfg();
        state.cfg.anEditavel.perguntas[idx].p = inp.value;
      };
    });
    list.querySelectorAll('[data-ed="opt"]').forEach(inp=>{
      inp.oninput = ()=>{
        const idx = Number(inp.dataset.idx);
        ensureAnCfg();
        state.cfg.anEditavel.perguntas[idx].opt = inp.value;
      };
    });
    list.querySelectorAll('[data-ed="del"]').forEach(btn=>{
      btn.onclick = ()=>{
        const idx = Number(btn.dataset.idx);
        ensureAnCfg();
        state.cfg.anEditavel.perguntas.splice(idx,1);
        renderList();
      };
    });
  }

  function addQ(){
    ensureAnCfg();
    state.cfg.anEditavel.perguntas.push({p:`Pergunta ${state.cfg.anEditavel.perguntas.length+1}`, t:'texto'});
    renderList();
  }

  function aplicar(){
    ensureAnCfg();
    // normaliza
    state.cfg.anEditavel.perguntas = (state.cfg.anEditavel.perguntas||[]).map(q=>{
      const t = q.t || 'texto';
      const nq = {p:(q.p||'').trim(), t};
      if(t==='selecionar'){
        const raw = Array.isArray(q.opt) ? q.opt.join(',') : (q.opt||'');
        nq.opt = raw.split(',').map(x=>x.trim()).filter(Boolean);
      }
      return nq;
    }).filter(q=>q.p);
    // aplica no formulário
    renderCamposAn(state.cfg.anEditavel.perguntas);
  }

  const btnAdd = ed.querySelector('#btnAnAddQ');
  const btnAplicar = ed.querySelector('#btnAnAplicar');
  if(btnAdd) btnAdd.onclick = addQ;
  if(btnAplicar) btnAplicar.onclick = aplicar;

  renderList();
}

function getModeloConfig(key){
  ensureAnCfg();
  // O "modelo editável" foi removido. Mantemos compatibilidade caso exista algum dado antigo.
  if(key === 'editavel') key = 'completo';
  return MODELOS_PADRAO[key] || MODELOS_PADRAO.basico;
}

function gerarModelo(key){
  ensureAnCfg();
  // Normaliza chave (compatibilidade com versões antigas)
  const modeloKey = (key === 'editavel') ? 'completo' : key;
  const conf = getModeloConfig(modeloKey);

  const ed = document.getElementById('anEditor');
  if(ed){
    // "Modelo Editável" removido: editor sempre oculto.
    ed.classList.add('hidden');
    ed.innerHTML = '';
  }

  renderCamposAn(conf.perguntas || []);

  const termosEl = document.getElementById('anTermos');
  if(termosEl){
    const t = (state.cfg.anTermos && state.cfg.anTermos[modeloKey] != null) ? state.cfg.anTermos[modeloKey] : (conf.termos || '');
    termosEl.value = t;
    termosEl.oninput = ()=>{
      ensureAnCfg();
      state.cfg.anTermos[modeloKey] = termosEl.value;
    };
  }

  const box = document.getElementById('anCampos');
  if(box) box.dataset.modelo = modeloKey;

  // reinicia assinatura ao trocar modelo
  if(assinaturaPad) assinaturaPad.clear();
}

function salvarAnamnese(){
  const idc = document.getElementById('anCliente').value;
  const cliente = state.data.clientes.find(c=>c.id===idc);
  if(!cliente) return alert('Selecione um cliente.');

  const modelo = (document.getElementById('anCampos')?.dataset.modelo) || 'basico';

  // coleta respostas
  const respostas = [];
  const campos = document.querySelectorAll('#anCampos [data-pergunta]');
  campos.forEach(el=>{
    const p = el.dataset.pergunta;
    const t = el.dataset.tipo || (el.type==='checkbox'?'assinalar':(el.tagName==='SELECT'?'selecionar':'texto'));
    let v = '';
    if(el.type === 'checkbox') v = el.checked ? 'Sim' : 'Não';
    else v = (el.value||'').trim();
    respostas.push({p,t,v});
  });

  const termos = (document.getElementById('anTermos')?.value || '').trim();
  const assinatura = assinaturaPad ? assinaturaPad.toDataURL() : '';

  const obj = {
    id: uid(),
    clienteId: idc,
    clienteNome: cliente.nome,
    modelo,
    respostas,
    termos,
    assinatura,
    data: new Date().toISOString(),
    dataBr: formatDateBR(new Date())
  };

  state.data.an.push(obj); savePerfil();
  cloudSaveDoc('an', obj);

  document.getElementById('anCampos').innerHTML='';
  if(assinaturaPad) assinaturaPad.clear();
  renderAn();
}

function renderAn(){
  const q = (document.getElementById('buscaAn').value||'').toLowerCase();
  const box = document.getElementById('listaAn'); box.innerHTML='';

  state.data.an
    .slice().sort((a,b)=>String(b.data||'').localeCompare(String(a.data||'')))
    .filter(a=>!q || (a.clienteNome||'').toLowerCase().includes(q))
    .forEach(a=>{
      const div = document.createElement('div');
      div.className='item';

      const termosTxt = a.termos ? `

TERMO:
${a.termos}` : '';
      const respostasTxt = (Array.isArray(a.respostas)?a.respostas:[]).map(r=>(r&&typeof r==='object')?`• ${r.p}: ${r.v}`:`• ${r}`).join('\n');

      div.innerHTML = `
        <strong>${escapeHtml(a.dataBr||'')} • ${escapeHtml(a.clienteNome||'')} — ${escapeHtml((a.modelo||'').toUpperCase())}</strong>
        <pre class="muted" style="white-space:pre-wrap">${escapeHtml(respostasTxt)}${escapeHtml(termosTxt)}</pre>
        ${(a.assinatura && /^data:image\//i.test(String(a.assinatura))) ? `<div style="margin:10px 0"><div class="muted sm" style="margin-bottom:6px">Assinatura:</div><img alt="Assinatura" src="${escapeHtml(a.assinatura)}" style="max-width:100%;border:1px solid rgba(255,255,255,.10);border-radius:12px" /></div>` : ''}
        <div class="row" style="gap:8px">
          <button class="btn ghost sm" data-id="${escapeHtml(a.id)}" data-act="export"><i class="fa-solid fa-file-arrow-down"></i> Exportar</button>
          <button class="btn danger sm" data-id="${escapeHtml(a.id)}" data-act="del"><i class="fa-solid fa-trash"></i> Excluir</button>
        </div>`;
      box.appendChild(div);
    });

  document.querySelectorAll('#listaAn [data-act="del"]').forEach(b=>b.onclick=()=>{state.data.an=state.data.an.filter(x=>x.id!==b.dataset.id); savePerfil(); cloudDeleteDoc('an', b.dataset.id); renderAn();});
  document.querySelectorAll('#listaAn [data-act="export"]').forEach(b=>b.onclick=()=>exportSingle('anamnese', state.data.an.find(x=>x.id===b.dataset.id)));
}

function initAnamnese(){
  ensureAnCfg();
  initSignaturePad();
  // modelo padrão ao entrar
  if(document.getElementById('anCampos') && !document.getElementById('anCampos').dataset.modelo){
    gerarModelo('basico');
  }
}

