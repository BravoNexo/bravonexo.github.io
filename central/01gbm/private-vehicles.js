(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BNXPrivateVehiclesV1=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const AREA='guarda.cadastros',UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RPC=Object.freeze({forecast:'central_private_vehicles_forecast_v1',list:'central_private_vehicles_list_v3',roster:'central_private_vehicles_roster_v2',military:'central_private_vehicle_military_search_v2',save:'central_private_vehicle_save_v2',receipt:'central_private_vehicle_receipt_v2',preview:'central_private_vehicles_preview_v2',import:'central_private_vehicles_import_v2'});
function error(message,code='INVALID_DATA',uncertain=false){return Object.assign(new Error(message),{code,uncertain});}
function fail(){throw error('Não foi possível conferir os dados dos veículos.');}
function exact(o,keys){if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).length!==keys.length||keys.some(k=>!Object.prototype.hasOwnProperty.call(o,k)))fail();}
function str(v,max,empty=false){if(typeof v!=='string'||[...v].length>max||!empty&&!v.trim()||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v))fail();return v;}
function nullable(v,max){return v===null?null:str(v,max,true);}
function integer(v,min=0){if(!Number.isSafeInteger(v)||v<min)fail();return v;}
function id(v){if(typeof v!=='string'||!UUID.test(v))fail();return v;}
function plate(v){str(v,20);const p=v.trim().toUpperCase().replace(/[ -]/g,'');if(!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(p))throw error('Informe uma placa válida, como ABC1234 ou ABC1D23.','INVALID_PLATE');return p;}
function rg(v){str(v,40);const r=v.trim().replace(/[.\s-]/g,'');if(!/^(?:\d{1,2}\/)?\d{4,9}$/.test(r))throw error('Confira o RG informado.','INVALID_RG');return r;}
function vehicleType(v){if(v!==null&&!['carro','moto'].includes(v))fail();return v;}
function inputType(v){const value=String(v||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();if(!value||value==='nao informado')return null;if(!['carro','moto'].includes(value))throw error('Informe Carro ou Moto na coluna Tipo.','INVALID_TYPE');return value;}
function wing(v){if(v!==null&&(!Number.isSafeInteger(v)||v<1||v>4))fail();return v;}
function typeLabel(v){return v==='carro'?'Carro':v==='moto'?'Moto':'Não informado';}
function wingLabel(v){return v===null?'Sem ala no Mapa':'Ala '+v;}
function totals(o){exact(o,['total','carro','moto','naoInformado','alas']);for(const k of ['total','carro','moto','naoInformado'])integer(o[k]);if(o.total!==o.carro+o.moto+o.naoInformado||!Array.isArray(o.alas)||o.alas.length!==5)fail();o.alas.forEach((r,i)=>{exact(r,['ala','total','carro','moto','naoInformado']);if(r.ala!==[1,2,3,4,null][i])fail();for(const k of ['total','carro','moto','naoInformado'])integer(r[k]);if(r.total!==r.carro+r.moto+r.naoInformado)fail();});for(const k of ['total','carro','moto','naoInformado'])if(o[k]!==o.alas.reduce((sum,r)=>sum+r[k],0))fail();return o;}
function military(o,withWing=false){exact(o,['id','nome','tipo','documento','ativo','revisao','dentro','situacao','ultimoMovimentoEm',...(withWing?['ala']:[])]);id(o.id);str(o.nome,200);if(o.tipo!=='militar'||typeof o.ativo!=='boolean'||typeof o.dentro!=='boolean'||!['conferida','pendente'].includes(o.situacao))fail();nullable(o.documento,100);integer(o.revisao);if(o.ultimoMovimentoEm!==null&&!Number.isFinite(Date.parse(o.ultimoMovimentoEm)))fail();if(withWing)wing(o.ala);return o;}
function vehicle(o){exact(o,['id','placa','modelo','cor','ativo','revisao','militar','entidadeId','tipo','ala']);id(o.id);id(o.entidadeId);if(plate(o.placa)!==o.placa||typeof o.ativo!=='boolean')fail();nullable(o.modelo,100);nullable(o.cor,60);vehicleType(o.tipo);wing(o.ala);integer(o.revisao,1);if(o.militar!==null)military(o.militar);return o;}
function list(o){exact(o,['version','kind','area','canEdit','items','nextCursor','resumo']);if(o.version!==1||o.kind!=='CENTRAL_PRIVATE_VEHICLES_LIST'||o.area!==AREA||typeof o.canEdit!=='boolean'||!Array.isArray(o.items)||o.items.length>50)fail();o.items.forEach(vehicle);if(new Set(o.items.map(v=>v.id)).size!==o.items.length||new Set(o.items.map(v=>v.placa)).size!==o.items.length)fail();if(o.nextCursor!==null){exact(o.nextCursor,['placa','id']);plate(o.nextCursor.placa);id(o.nextCursor.id);}totals(o.resumo);return o;}
function militaryResult(o){exact(o,['version','kind','items','truncated']);if(o.version!==1||o.kind!=='CENTRAL_PRIVATE_VEHICLES_MILITARY'||!Array.isArray(o.items)||o.items.length>50||typeof o.truncated!=='boolean')fail();o.items.forEach(p=>military(p,true));if(new Set(o.items.map(x=>x.id)).size!==o.items.length)fail();return o;}
function receipt(o){exact(o,['version','kind','requestId','operation','status','registeredAt','items','count','problems']);if(o.version!==1||o.kind!=='CENTRAL_PRIVATE_VEHICLES_RECEIPT'||!['save','import'].includes(o.operation)||!['saved','conflict'].includes(o.status)||!Number.isFinite(Date.parse(o.registeredAt))||!Array.isArray(o.items)||o.items.length>100||!Array.isArray(o.problems)||o.problems.length>100)fail();id(o.requestId);integer(o.count);o.items.forEach(vehicle);if(o.status==='saved'&&o.count!==o.items.length||o.status==='conflict'&&o.count!==0)fail();for(const p of o.problems){exact(p,['index','status','message']);integer(p.index,1);str(p.status,40);str(p.message,500,true);}return o;}
function preview(o){exact(o,['version','kind','canImport','rows']);if(o.version!==1||o.kind!=='CENTRAL_PRIVATE_VEHICLES_PREVIEW'||typeof o.canImport!=='boolean'||!Array.isArray(o.rows)||o.rows.length>100)fail();for(const row of o.rows){exact(row,['index','rg','placa','modelo','cor','tipo','ala','status','message','militares','entidadeId']);integer(row.index,1);str(row.rg,40,true);str(row.placa,20,true);nullable(row.modelo,100);nullable(row.cor,60);vehicleType(row.tipo);wing(row.ala);if(!['ready','existing','ambiguous','not_found','invalid','duplicate','conflict'].includes(row.status)||!Array.isArray(row.militares)||row.militares.length>50)fail();str(row.message,500,true);row.militares.forEach(p=>military(p,true));if(row.entidadeId!==null)id(row.entidadeId);if(row.status==='ready'&&(!row.entidadeId||!row.militares.some(p=>p.id===row.entidadeId)))fail();}return o;}
function parseClipboard(input){str(input,100000,true);const lines=input.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n');const rows=[],problems=[];let start=0,processed=0;while(start<lines.length&&!lines[start].trim())start++;if(start<lines.length){const h=lines[start].split('\t').map(x=>x.trim().toLowerCase());if(/^(?:rg|registro geral)$/.test(h[0])&&/placa/.test(h[1]||''))start++;}for(let i=start;i<lines.length;i++){if(!lines[i].trim())continue;if(++processed>100){problems.push({line:i+1,message:'Cole no máximo 100 veículos por vez.'});break;}const cells=lines[i].split('\t');if(cells.length<2||cells.length>5){problems.push({line:i+1,message:'Use RG, Placa, Modelo, Cor e Tipo (opcional), separados por tabulação.'});continue;}try{const row={rg:rg(cells[0]),placa:plate(cells[1]),modelo:cells[2]?.trim()||null,cor:cells[3]?.trim()||null,tipo:inputType(cells[4]),entidadeId:null};nullable(row.modelo,100);nullable(row.cor,60);rows.push(row);}catch(e){problems.push({line:i+1,message:e.message});}}const plates=new Map();rows.forEach((row,index)=>{if(plates.has(row.placa))problems.push({line:index+1,message:'Placa repetida nesta colagem: '+row.placa+'.'});else plates.set(row.placa,index);});if(!rows.length&&!problems.length)problems.push({line:0,message:'Cole pelo menos uma linha com RG e placa.'});return {rows,problems};}
function readyRows(report){preview(report);const bad=report.rows.filter(x=>!['ready','existing'].includes(x.status));if(bad.length)throw error('Corrija os registros destacados antes de importar.','PREVIEW_ERRORS');const rows=report.rows.filter(x=>x.status==='ready').map(x=>({rg:x.rg,placa:plate(x.placa),modelo:x.modelo,cor:x.cor,tipo:x.tipo,entidadeId:id(x.entidadeId)}));if(!rows.length)throw error('Nenhum veículo novo para importar.','NOTHING_TO_IMPORT');return rows;}
function listFilterArgs(raw={}){if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!['p_busca','p_ativo','p_apos_placa','p_apos_id','p_ala','p_tipo'].includes(k)))throw error('Confira os filtros dos veículos.','INVALID_FILTER');const f={p_busca:raw.p_busca??null,p_ativo:raw.p_ativo??null,p_apos_placa:raw.p_apos_placa??null,p_apos_id:raw.p_apos_id??null,p_ala:raw.p_ala??null,p_tipo:raw.p_tipo??null};if(f.p_busca!==null)str(f.p_busca,100,true);if(f.p_ativo!==null&&typeof f.p_ativo!=='boolean'||f.p_ala!==null&&(!Number.isSafeInteger(f.p_ala)||f.p_ala<0||f.p_ala>4)||f.p_tipo!==null&&!['carro','moto','nao_informado'].includes(f.p_tipo))throw error('Confira os filtros de ala, tipo e situação.','INVALID_FILTER');if((f.p_apos_placa===null)!==(f.p_apos_id===null))fail();if(f.p_apos_placa!==null){if(plate(f.p_apos_placa)!==f.p_apos_placa)fail();id(f.p_apos_id);}return f;}
function forecastWing(value){if(value!==null&&(!Number.isSafeInteger(value)||value<0||value>4))throw error('Confira a ala selecionada para a previsão.','INVALID_FILTER');return value;}
function forecastMetrics(value){exact(value,['militares','somenteCarro','somenteMoto','ambos','tipoPendente','identidadePendente','veiculosAtivos','maxCarros','minCarros']);for(const key of ['militares','somenteCarro','somenteMoto','ambos','tipoPendente','identidadePendente','veiculosAtivos'])integer(value[key]);for(const pair of [value.maxCarros,value.minCarros]){exact(pair,['carros','motos']);integer(pair.carros);integer(pair.motos);}if(value.militares!==value.somenteCarro+value.somenteMoto+value.ambos+value.tipoPendente||value.veiculosAtivos<value.militares+value.identidadePendente||value.maxCarros.carros!==value.somenteCarro+value.ambos||value.maxCarros.motos!==value.somenteMoto||value.minCarros.carros!==value.somenteCarro||value.minCarros.motos!==value.somenteMoto+value.ambos)fail();return value;}
function forecastDto(value){exact(value,['version','kind','area','alaFiltro','total','alas']);if(value.version!==1||value.kind!=='CENTRAL_PRIVATE_VEHICLES_FORECAST'||value.area!==AREA||!Array.isArray(value.alas)||value.alas.length!==5)fail();forecastWing(value.alaFiltro);forecastMetrics(value.total);value.alas.forEach((row,index)=>{exact(row,['ala','militares','somenteCarro','somenteMoto','ambos','tipoPendente','identidadePendente','veiculosAtivos','maxCarros','minCarros']);if(row.ala!==[1,2,3,4,null][index])fail();const {ala,...metrics}=row;forecastMetrics(metrics);if(value.alaFiltro!==null&&ala!==(value.alaFiltro===0?null:value.alaFiltro)&&metrics.veiculosAtivos!==0)fail();});for(const key of ['militares','somenteCarro','somenteMoto','ambos','tipoPendente','identidadePendente','veiculosAtivos'])if(value.total[key]!==value.alas.reduce((sum,row)=>sum+row[key],0))fail();for(const pair of ['maxCarros','minCarros'])for(const key of ['carros','motos'])if(value.total[pair][key]!==value.alas.reduce((sum,row)=>sum+row[pair][key],0))fail();return value;}
function rosterDto(value) {
  exact(value, ['version', 'kind', 'area', 'items']);
  if (value.version !== 2 || value.kind !== 'CENTRAL_PRIVATE_VEHICLES_ROSTER' || value.area !== AREA ||
      !Array.isArray(value.items) || value.items.length > 2000) fail();
  const ids = new Set();
  for (const item of value.items) {
    exact(item, ['rg', 'nome', 'nomeGuerra', 'antiguidade', 'obm', 'carros', 'motos', 'semTipo']);
    str(item.rg, 40);
    str(item.nome, 200);
    str(item.nomeGuerra, 200);
    integer(item.antiguidade, 1);
    if (item.obm !== null) str(item.obm, 160);
    for (const key of ['carros', 'motos', 'semTipo']) integer(item[key]);
    if (ids.has(item.rg)) fail();
    ids.add(item.rg);
  }
  return value;
}
function createClient(options){const url=new URL(options.supabaseUrl);if(url.protocol!=='https:'||!/^\w{20}\.supabase\.co$/.test(url.hostname)||url.pathname!=='/'||url.search||url.hash||url.username||url.password)fail();str(options.publishableKey,2000);if(options.timeoutMs!==undefined&&(!Number.isFinite(options.timeoutMs)||options.timeoutMs<1||options.timeoutMs>60000))fail();const fetchImpl=options.fetchImpl||globalThis.fetch;if(typeof fetchImpl!=='function'||['getAccessToken','getGeneration','getActorId','canView','canEdit'].some(k=>typeof options[k]!=='function'))fail();let disposed=false;const controls=new Set();
async function request(name,params={},write=false,signal){if(disposed||!Object.prototype.hasOwnProperty.call(RPC,name))fail();const who=options.getActorId(),generation=options.getGeneration();id(who);const permitted=()=>!disposed&&options.getActorId()===who&&options.getGeneration()===generation&&options.canView()===true&&(name!=='roster'||options.canViewRoster?.()===true)&&(!write||options.canEdit()===true);if(!permitted())throw error('Seu acesso a esta área não está liberado.','ACCESS_DENIED');let sent=false,reader=null,rejectInterrupted;const interrupted=new Promise((resolve,reject)=>{rejectInterrupted=reject;});const control=new AbortController();controls.add(control);const interruptedByAbort=()=>rejectInterrupted(error('A operação foi interrompida. Seus dados foram preservados.','SESSION_CHANGED',write&&sent));control.signal.addEventListener('abort',interruptedByAbort,{once:true});const abort=()=>control.abort();if(signal?.aborted)control.abort();else signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,options.timeoutMs||30000),wait=promise=>Promise.race([promise,interrupted]);
const check=()=>{if(control.signal.aborted||!permitted())throw error('A consulta foi interrompida. Seus dados foram preservados.','SESSION_CHANGED',write&&sent);};
try{const token=await wait(options.getAccessToken());check();if(typeof token!=='string'||token.length<16||token.length>16384||!/^[A-Za-z0-9_.-]+$/.test(token))throw error('Entre novamente para conferir sua sessão.','AUTH_REQUIRED');const isPost=['save','preview','import'].includes(name),target=new URL('/rest/v1/rpc/'+RPC[name],url);if(!isPost)for(const[k,v]of Object.entries(params))if(v!==null&&v!==undefined&&v!=='')target.searchParams.set(k,String(v));const headers={apikey:options.publishableKey,Authorization:'Bearer '+token,Accept:'application/json','Accept-Profile':'public'};if(isPost){headers['Content-Type']='application/json';headers['Content-Profile']='public';}check();sent=true;const response=await wait(fetchImpl(target.href,{method:isPost?'POST':'GET',headers,...(isPost?{body:JSON.stringify(params)}:{}),signal:control.signal,credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer'}));check();if(!response.ok){response.body?.cancel?.().catch(()=>{});throw error([401,403].includes(response.status)?'Não foi possível autorizar esta operação. Confira seu acesso à área.':'Não foi possível concluir a operação. Seus dados foram mantidos.','HTTP_'+response.status,write&&![400,401,403,409,422].includes(response.status));}if(!/^application\/json(?:;|$)/i.test(response.headers.get('Content-Type')||'')||!response.body)fail();reader=response.body.getReader();const decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0,text='';while(true){const part=await wait(reader.read());check();if(part.done)break;bytes+=part.value.byteLength;if(bytes>2000000)throw error('A resposta excedeu o limite. Restrinja a busca.','RESPONSE_LIMIT',write&&sent);text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();check();const raw=JSON.parse(text),validate=name==='list'?list:name==='military'?militaryResult:name==='preview'?preview:name==='forecast'?forecastDto:name==='roster'?rosterDto:receipt;const result=name==='receipt'&&raw===null?null:validate(raw);check();return result;
}catch(e){if(e?.code){if(write&&sent&&!/^HTTP_(400|401|403|409|422)$/.test(e.code))e.uncertain=true;throw e;}throw error(write&&sent?'Ainda não foi possível confirmar o envio. Use Consultar resultado; nenhum envio será repetido automaticamente.':'Não foi possível consultar agora. Seus filtros e ajustes foram mantidos.','REQUEST_FAILED',write&&sent);}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);controls.delete(control);control.signal.removeEventListener('abort',interruptedByAbort);try{Promise.resolve(reader?.cancel()).catch(()=>{});reader?.releaseLock();}catch{}}}
return Object.freeze({roster:signal=>request('roster',{},false,signal),forecast:(ala=null,signal)=>request('forecast',{p_ala:forecastWing(ala)},false,signal),list:(filters,signal)=>request('list',listFilterArgs(filters),false,signal),military:(term,signal)=>request('military',{p_busca:term},false,signal),save:(requestId,payload,signal)=>request('save',{p_request:id(requestId),p_payload:payload},true,signal),preview:(rows,signal)=>request('preview',{p_rows:rows},false,signal),import:(requestId,rows,signal)=>request('import',{p_request:id(requestId),p_rows:rows},true,signal),receipt:(requestId,signal)=>request('receipt',{p_request:id(requestId)},false,signal),dispose(){disposed=true;controls.forEach(x=>x.abort());controls.clear();}});}
// The Central page and delegated dialog use the same vehicle registry.
function mount(options){
const env=options.environment||window,doc=options.document||env.document,host=doc.getElementById(options.hostId||'guard-private-vehicles'),trigger=doc.getElementById('guard-private-vehicles-open');if(!host)return Object.freeze({setReady(){},setVisible(){},load(){},dispose(){}});
const embedded = host.tagName !== 'DIALOG';
const client = createClient({...options, fetchImpl: options.fetchImpl || env.fetch.bind(env)});
if (!embedded && host.parentNode !== doc.body) doc.body.appendChild(host);
const rosterEnabled = embedded && typeof options.canViewRoster === 'function';
let roster = null;
let ready=false,visible=false,actor=null,disposed=false,busy=false,activeAction=null,epoch=0,control=null,rows=[],cursor=null,loadedFilterKey='',editRecord=null,militarySelected=null,pending=null,bulkPreview=null,bulkSelections=new Map(),forecastEpoch=0,forecastControl=null,forecastFlight=null,forecastRequestedKey='',forecastRequestActor=null,forecastRequestGeneration=null,forecastLoadedKey='',forecastLoading=false,forecastData=null,forecastDataActor=null,forecastDataGeneration=null;const elements={},listeners=[];
const node=(tag,text,idValue)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;if(idValue)n.id=idValue;return n;},on=(el,event,fn)=>{el.addEventListener(event,fn);listeners.push(()=>el.removeEventListener(event,fn));},button=(text,fn,css='secondary')=>{const n=node('button',text);n.type='button';n.className=css;on(n,'click',fn);return n;},status=(text,bad=false)=>{elements.status.textContent=text;elements.status.className=bad?'decision-error':'cpv-status';};
function allowed(edit=false){return ready&&!disposed&&options.canView()===true&&(!edit||options.canEdit()===true);}
function stop(){epoch++;control?.abort();control=null;busy=false;activeAction=null;}
function update(){const view=allowed(),edit=allowed(true);if(trigger)trigger.disabled=!view;for(const input of [elements.search,elements.active,elements.wingFilter,elements.typeFilter,elements.refresh])input.disabled=busy&&activeAction!=='list'||!view;elements.new.disabled=elements.paste.disabled=busy||!edit||!!pending;elements.more.disabled=busy||!view||!cursor;elements.check.hidden=!pending;elements.check.disabled=busy||!view;for(const input of [elements.plate,elements.rg,elements.militarySearch,elements.model,elements.color,elements.type,elements.recordActive])input.disabled=busy||!edit||!!pending;elements.save.disabled=busy||!edit||!!pending||(!militarySelected&&(!editRecord||elements.recordActive.checked));elements.bulkText.disabled=busy||!edit||!!pending;elements.preview.disabled=busy||!edit||!!pending;elements.import.disabled=busy||!edit||!!pending||!bulkPreview||bulkPreview.rows.some(r=>!['ready','existing'].includes(r.status))||!bulkPreview.rows.some(r=>r.status==='ready');updateForecast();roster?.update();}
async function run(action,task){if(busy||!allowed())return false;const operation=++epoch,who=actor,generation=options.getGeneration();control=new AbortController();const signal=control.signal;busy=true;activeAction=action;update();const alive=()=>!disposed&&operation===epoch&&who===actor&&generation===options.getGeneration()&&allowed();let ownAttempt=null;try{const guard=()=>{if(!alive())throw error('A sessão mudou. Seus dados foram preservados.','SESSION_CHANGED',!!ownAttempt);};const work=task(signal,guard);ownAttempt=['save','import'].includes(action)?pending:null;const result=await work;if(!alive())return false;return result;}catch(e){if(ownAttempt&&pending===ownAttempt&&who===actor&&e.uncertain===false){pending=null;update();}if(alive()){status(e.message||'Não foi possível concluir. Seus dados foram mantidos.',true);if(['save','import'].includes(action)){const message=pending?'O envio ainda não foi confirmado. Use Consultar resultado; não salve novamente.':e.message||'Nenhuma alteração foi confirmada. Revise os dados.';elements.editStatus.textContent=message;elements.bulkStatus.textContent=message;}}return false;}finally{if(operation===epoch){busy=false;activeAction=null;control=null;update();}}}
function setVisible(show) {
  if (disposed) {
    host.hidden = true;
    return false;
  }
  const nextVisible = show === true && allowed();
  if (embedded && nextVisible === visible) {
    host.hidden = !nextVisible;
    update();
    return visible;
  }
  visible = nextVisible;
  if (visible) {
    host.hidden = false;
    if (!embedded && !host.open) {
      try { host.showModal(); } catch {
        visible = false;
        host.hidden = true;
        status('Não foi possível abrir este painel.', true);
        return false;
      }
    }
    if (roster?.selected()) void roster.load();
    else {
      void loadForecast(true);
      if (!rows.length && !busy) void load();
    }
  } else {
    stopForecast(true);
    roster?.pause();
    const settlingWrite = ['save', 'import', 'receipt'].includes(activeAction);
    if (!embedded || !settlingWrite) stop();
    if (!embedded && host.open) host.close();
    host.hidden = true;
  }
  update();
  return visible;
}
function renderRows(){elements.table.replaceChildren();for(const item of rows){const tr=node('tr');for(const text of [item.placa,item.militar?item.militar.nome+(item.militar.documento?' · RG '+item.militar.documento:''):'Militar indisponível no cadastro',wingLabel(item.ala),typeLabel(item.tipo),item.modelo||'—',item.cor||'—',item.ativo?'Ativo':'Inativo'])tr.appendChild(node('td',text));const action=node('td');action.appendChild(button(allowed(true)?'Editar':'Consultar',()=>openEdit(item)));tr.appendChild(action);elements.table.appendChild(tr);}elements.empty.hidden=rows.length>0;elements.summary.textContent=rows.length+' veículo(s) carregado(s)'+(cursor?' · há mais registros':'');}
function renderTotals(value){elements.totals.hidden=!value;elements.totalRows.replaceChildren();if(!value)return;elements.totalText.textContent=value.total+' veículos cadastrados ativos · '+value.carro+' carros · '+value.moto+' motos · '+value.naoInformado+' com tipo não informado';for(const item of value.alas){const tr=node('tr');for(const text of [wingLabel(item.ala),item.total,item.carro,item.moto,item.naoInformado])tr.appendChild(node('td',String(text)));elements.totalRows.appendChild(tr);}}
function forecastAla(){const value=elements.wingFilter.value;if(!['','0','1','2','3','4'].includes(value))throw error('Confira a ala selecionada para a previsão.','INVALID_FILTER');return value===''?null:Number(value);}
function forecastKeyFor(ala){return ala===null?'all':String(ala);}
function forecastMessage(text){elements.forecastStatus.textContent=text||'';elements.forecastStatus.hidden=!text;}
function updateForecast(){if(elements.forecastRefresh)elements.forecastRefresh.disabled=!visible||!allowed()||forecastLoading;}
function stopForecast(clear=false){forecastEpoch++;forecastControl?.abort();forecastControl=null;forecastFlight=null;forecastRequestedKey='';forecastRequestActor=null;forecastRequestGeneration=null;forecastLoading=false;if(clear){forecastData=null;forecastLoadedKey='';forecastDataActor=null;forecastDataGeneration=null;if(elements.forecastResult)elements.forecastResult.hidden=true;if(elements.forecastRows)elements.forecastRows.replaceChildren();for(const field of ['forecastSummary','forecastAlternatives','forecastPending'])if(elements[field])elements[field].textContent='';if(elements.forecastStatus)forecastMessage('');}updateForecast();}
function scenarioText(value){return value.carros+' '+(value.carros===1?'carro':'carros')+'\n+ '+value.motos+' '+(value.motos===1?'moto':'motos');}
function renderForecast(value){elements.forecastRows.replaceChildren();const total=value.total;elements.forecastSummary.textContent=total.militares+' '+(total.militares===1?'militar':'militares')+' com veículo cadastrado · '+total.veiculosAtivos+' '+(total.veiculosAtivos===1?'placa ativa':'placas ativas');elements.forecastAlternatives.textContent='Máximo de carros: '+scenarioText(total.maxCarros).replace('\n',' ')+'. Mínimo de carros: '+scenarioText(total.minCarros).replace('\n',' ')+'.';const pending=[];if(total.tipoPendente)pending.push(total.tipoPendente+' '+(total.tipoPendente===1?'militar':'militares')+' sem tipo definido');if(total.identidadePendente)pending.push(total.identidadePendente+' '+(total.identidadePendente===1?'cadastro':'cadastros')+' com vínculo a conferir');elements.forecastPending.textContent=pending.join(' · ');elements.forecastPending.hidden=!pending.length;elements.forecastPendingNote.hidden=!pending.length;const selected=value.alaFiltro===null?value.alas:value.alas.filter(row=>row.ala===(value.alaFiltro===0?null:value.alaFiltro));for(const row of selected){const tr=node('tr');tr.appendChild(node('td',wingLabel(row.ala)));tr.appendChild(node('td',String(row.militares)));for(const pair of [row.maxCarros,row.minCarros]){const td=node('td',scenarioText(pair));td.className='cpv-forecast-pair';tr.appendChild(td);}const details=[];if(row.tipoPendente)details.push(row.tipoPendente+' sem tipo');if(row.identidadePendente)details.push(row.identidadePendente+' '+(row.identidadePendente===1?'vínculo pendente':'vínculos pendentes'));const pendingCell=node('td',details.join('\n')||'—');pendingCell.className='cpv-forecast-pending';tr.appendChild(pendingCell);elements.forecastRows.appendChild(tr);}elements.forecastResult.hidden=false;forecastMessage('');}
function loadForecast(force=false){if(!visible||!allowed())return Promise.resolve(false);let ala;try{ala=forecastAla();}catch(e){stopForecast(true);forecastMessage(e.message);return Promise.resolve(false);}const key=forecastKeyFor(ala),who=actor,generation=options.getGeneration();if(!force&&forecastFlight&&forecastRequestedKey===key&&forecastRequestActor===who&&forecastRequestGeneration===generation)return forecastFlight;if(!force&&forecastData&&forecastLoadedKey===key&&forecastDataActor===who&&forecastDataGeneration===generation)return Promise.resolve(true);stopForecast(true);const operation=forecastEpoch,ownControl=new AbortController();forecastControl=ownControl;forecastRequestedKey=key;forecastRequestActor=who;forecastRequestGeneration=generation;forecastLoading=true;elements.forecastResult.hidden=true;forecastMessage('Consultando a previsão por ala…');updateForecast();const current=()=>{try{return !disposed&&visible&&allowed()&&actor===who&&options.getGeneration()===generation&&operation===forecastEpoch&&forecastKeyFor(forecastAla())===key;}catch{return false;}};const task=(async()=>{try{const value=await client.forecast(ala,ownControl.signal);if(!current())return false;if(value.alaFiltro!==ala)fail();forecastData=value;forecastLoadedKey=key;forecastDataActor=who;forecastDataGeneration=generation;renderForecast(value);return true;}catch(e){if(current()){elements.forecastResult.hidden=true;forecastMessage(e.message||'Não foi possível consultar a previsão. Use Atualizar previsão.');}return false;}finally{if(operation===forecastEpoch){forecastControl=null;forecastFlight=null;forecastRequestedKey='';forecastRequestActor=null;forecastRequestGeneration=null;forecastLoading=false;if(!current()&&visible&&allowed())forecastMessage('A ala ou a sessão mudou. Use Atualizar previsão.');updateForecast();}}})();forecastFlight=task;return task;}
function readFilters(){if(!['','true','false'].includes(elements.active.value)||!['','0','1','2','3','4'].includes(elements.wingFilter.value)||!['','carro','moto','nao_informado'].includes(elements.typeFilter.value))throw error('Confira os filtros de ala, tipo e situação.','INVALID_FILTER');const query=elements.search.value.trim();let search=query||null;try{search=plate(query);}catch{}return listFilterArgs({p_busca:search,p_ativo:elements.active.value===''?null:elements.active.value==='true',p_ala:elements.wingFilter.value===''?null:Number(elements.wingFilter.value),p_tipo:elements.typeFilter.value||null});}
function resetList(){if(!allowed()||busy&&activeAction!=='list')return false;if(busy)stop();rows=[];cursor=null;loadedFilterKey='';renderTotals(null);renderRows();status('Filtros alterados. Use Atualizar ou pressione Enter para consultar.');update();return true;}
async function load(more=false){if(!allowed() || embedded && !visible)return false;let filters;try{filters=readFilters();}catch(e){status(e.message,true);return false;}if(busy){if(activeAction!=='list')return false;stop();}const key=JSON.stringify(filters),append=more===true&&cursor!==null&&loadedFilterKey===key,selectedCursor=append?{...cursor}:null;if(!append){rows=[];cursor=null;loadedFilterKey='';renderTotals(null);renderRows();}void loadForecast();return run('list',async(signal,guard)=>{status('Consultando veículos…');const result=await client.list({...filters,p_apos_placa:selectedCursor?.placa||null,p_apos_id:selectedCursor?.id||null},signal);guard();let current;try{current=JSON.stringify(readFilters());}catch{}if(current!==key){status('Filtros alterados. Use Atualizar para consultar a lista.');return false;}const next=append?[...rows,...result.items]:result.items;if(new Set(next.map(r=>r.id)).size!==next.length||new Set(next.map(r=>r.placa)).size!==next.length)fail();rows=next;cursor=result.nextCursor;loadedFilterKey=key;renderTotals(result.resumo);renderRows();status(rows.length?'Cadastros consultados.':'Nenhum veículo encontrado.');return true;});}
function openEdit(item=null){if(!allowed()||busy||pending)return;editRecord=item;militarySelected=item?.militar||null;elements.plate.value=item?.placa||'';elements.rg.value=item?.militar?.documento||'';elements.model.value=item?.modelo||'';elements.color.value=item?.cor||'';elements.type.value=item?.tipo||'';elements.wing.textContent=item?wingLabel(item.ala):'Escolha um militar para consultar sua ala no Mapa.';elements.recordActive.checked=item?item.ativo:true;elements.militaryResults.replaceChildren();elements.militaryName.textContent=militarySelected?.nome||'Busque e selecione o militar responsável.';elements.editStatus.textContent='';elements.edit.hidden=false;elements.bulk.hidden=true;update();elements.plate.focus?.();}
async function findMilitary(){if(!allowed(true)||busy||pending)return;const term=elements.rg.value.trim();if(term.length<3){elements.editStatus.textContent='Informe o RG ou pelo menos três letras do nome.';return;}militarySelected=null;return run('military',async(signal,guard)=>{const result=await client.military(term,signal);guard();elements.militaryResults.replaceChildren();for(const person of result.items){const choice=button(person.nome+(person.documento?' · RG '+person.documento:''),()=>{if(!allowed(true)||busy||pending||elements.rg.value.trim()!==term)return;militarySelected=person;elements.militaryName.textContent=person.nome+(person.documento?' · RG '+person.documento:'');elements.wing.textContent=wingLabel(person.ala);elements.militaryResults.replaceChildren();update();});elements.militaryResults.appendChild(choice);}elements.editStatus.textContent=result.items.length?(result.truncated?'Há mais resultados. Refine a busca pelo RG.':'Selecione o militar correspondente.'):'Nenhum militar apto encontrado.';status('Busca de militar concluída.');return true;});}
function verifyReceipt(result,attempt){if(result.requestId!==attempt.id||result.operation!==attempt.operation)fail();if(result.status!=='saved')return;if(attempt.operation==='save'){const v=result.items[0],data=attempt.payload;if(result.count!==1||!v||data.id!==null&&v.id!==data.id||v.placa!==data.placa||v.modelo!==data.modelo||v.cor!==data.cor||v.tipo!==data.tipo||v.ativo!==data.ativo||v.revisao!==data.revisao+1||v.entidadeId!==data.entidadeId)fail();}else{if(result.count!==attempt.rows.length)fail();for(const row of attempt.rows)if(!result.items.some(v=>v.placa===row.placa&&v.entidadeId===row.entidadeId&&v.tipo===row.tipo))fail();}}
async function finish(result,attempt){verifyReceipt(result,attempt);pending=null;if(result.status==='conflict'){elements.editStatus.textContent='O cadastro mudou ou há conflito de placa. Confira os dados atuais antes de salvar novamente.';status('Nenhuma alteração desta tentativa foi aplicada. Confira os dados.',true);if(result.problems.length)elements.bulkStatus.textContent=result.problems.map(p=>'Linha '+p.index+': '+p.message).join('\n');return false;}if(attempt.operation==='save'){elements.edit.hidden=true;editRecord=null;militarySelected=null;}else{elements.bulk.hidden=true;elements.bulkText.value='';bulkPreview=null;elements.bulkRows.replaceChildren();}status(attempt.operation==='save'?'Veículo salvo com confirmação.':result.count+' veículo(s) importado(s) com confirmação.');rows=[];cursor=null;renderRows();void loadForecast(true);return true;}
async function saveRecord(){if(!allowed(true)||busy||pending||!militarySelected&&(!editRecord||elements.recordActive.checked))return;let payload;try{payload={id:editRecord?.id||null,placa:plate(elements.plate.value),entidadeId:militarySelected?.id||editRecord.entidadeId,modelo:elements.model.value.trim()||null,cor:elements.color.value.trim()||null,tipo:inputType(elements.type.value),ativo:elements.recordActive.checked,revisao:editRecord?.revisao||0};nullable(payload.modelo,100);nullable(payload.cor,60);}catch(e){elements.editStatus.textContent=e.message;return;}const attempt={id:env.crypto.randomUUID(),apiVersion:2,operation:'save',payload};const success=await run('save',async(signal,guard)=>{pending=attempt;update();elements.editStatus.textContent='Salvando uma única vez…';const result=await client.save(attempt.id,payload,signal);guard();return finish(result,attempt);});if(success)void load();}
async function checkPending(){if(!pending||busy||!allowed())return;const attempt=pending,success=await run('receipt',async(signal,guard)=>{status('Consultando o resultado sem reenviar…');const result=await client.receipt(attempt.id,signal);guard();if(result===null){status('O servidor ainda não confirmou esta tentativa. Seus dados continuam preservados.',true);return false;}return finish(result,attempt);});if(success)void load();}
function openBulk(){if(!allowed(true)||busy||pending)return;elements.edit.hidden=true;elements.bulk.hidden=false;elements.bulkStatus.textContent='Cole RG, Placa, Modelo, Cor e Tipo. As três últimas colunas são opcionais; Tipo aceita Carro ou Moto.';update();elements.bulkText.focus?.();}
function renderPreview(report){elements.bulkRows.replaceChildren();const labels={ready:'Novo',existing:'Já cadastrado · não duplicar',ambiguous:'Escolher militar',not_found:'Militar não encontrado',invalid:'Dados inválidos',duplicate:'Placa repetida',conflict:'Conflito de vínculo'};for(const row of report.rows){const tr=node('tr');for(const text of[row.index,row.rg,row.placa,row.modelo||'—',row.cor||'—',typeLabel(row.tipo),wingLabel(row.ala)])tr.appendChild(node('td',String(text)));const owner=node('td');if(row.status==='ambiguous'){const select=node('select');select.appendChild(node('option','Selecione o militar'));for(const person of row.militares){const option=node('option',person.nome+(person.documento?' · RG '+person.documento:''));option.value=person.id;select.appendChild(option);}on(select,'change',()=>{row.entidadeId=select.value||null;bulkSelections.set(row.rg+'|'+row.placa,row.entidadeId);bulkPreview=null;elements.bulkStatus.textContent='Clique em Conferir colagem novamente para validar a escolha.';update();});owner.appendChild(select);}else owner.textContent=row.militares.find(p=>p.id===row.entidadeId)?.nome||'—';tr.appendChild(owner);const state=node('td',labels[row.status]+(row.message?' · '+row.message:''));if(!['ready','existing'].includes(row.status))state.className='decision-error';tr.appendChild(state);elements.bulkRows.appendChild(tr);}const n=report.rows.filter(r=>r.status==='ready').length,existing=report.rows.filter(r=>r.status==='existing').length,bad=report.rows.length-n-existing;elements.bulkStatus.textContent=n+' novo(s), '+existing+' já cadastrado(s), '+bad+' pendência(s). Nenhum cadastro foi enviado.';}
async function previewBulk(){if(!allowed(true)||busy||pending)return;const parsed=parseClipboard(elements.bulkText.value);if(parsed.problems.length){bulkPreview=null;elements.bulkStatus.textContent=parsed.problems.map(p=>(p.line?'Linha '+p.line+': ':'')+p.message).join('\n');update();return;}return run('preview',async(signal,guard)=>{const report=await client.preview(parsed.rows.map(r=>({...r,entidadeId:bulkSelections.get(r.rg+'|'+r.placa)||null})),signal);guard();if(report.rows.length!==parsed.rows.length)fail();bulkPreview=report;renderPreview(report);status('Colagem conferida. Nenhum cadastro foi enviado.');return true;});}
async function importBulk(){if(!allowed(true)||busy||pending||!bulkPreview)return;let data;try{data=readyRows(bulkPreview);}catch(e){elements.bulkStatus.textContent=e.message;return;}const preparedPreview=bulkPreview,preparedActor=actor,preparedGeneration=options.getGeneration(),skipped=bulkPreview.rows.filter(r=>r.status==='existing').length;if(!await Promise.resolve((options.confirm||env.confirm?.bind(env)||(()=>false))('Cadastrar '+data.length+' veículo(s) particular(es)?'+(skipped?' '+skipped+' já cadastrado(s) serão preservados, sem duplicação.':''))))return;if(!allowed(true)||embedded&&!visible||busy||pending||bulkPreview!==preparedPreview||actor!==preparedActor||options.getGeneration()!==preparedGeneration)return;const attempt={id:env.crypto.randomUUID(),apiVersion:2,operation:'import',rows:data};const success=await run('import',async(signal,guard)=>{pending=attempt;update();elements.bulkStatus.textContent='Enviando um único lote…';const result=await client.import(attempt.id,data,signal);guard();return finish(result,attempt);});if(success)void load();}
function field(parent,label,tag='input'){const wrap=node('label');wrap.className='cpv-field';wrap.appendChild(node('span',label));const input=node(tag);wrap.appendChild(input);parent.appendChild(wrap);return input;}
function buildRoster(registry) {
  const modes = node('div');
  modes.className = 'cpv-view-modes';
  modes.setAttribute('role', 'group');
  modes.setAttribute('aria-label', 'Visualização de veículos particulares');
  const listMode = button('Cadastro de veículos', () => choose(false));
  const rosterMode = button('Militares por OBM', () => choose(true));
  listMode.setAttribute('aria-controls', registry.id);
  rosterMode.setAttribute('aria-controls', 'cpv-roster');
  modes.appendChild(listMode);
  modes.appendChild(rosterMode);
  host.appendChild(modes);
  host.appendChild(registry);

  const panel = node('div', undefined, 'cpv-roster');
  panel.className = 'cpv-roster';
  panel.setAttribute('aria-labelledby', 'cpv-roster-title');
  const head = node('div');
  head.className = 'cpv-forecast-head';
  const heading = node('h2', 'Militares por OBM', 'cpv-roster-title');
  head.appendChild(heading);
  const refresh = button('Atualizar relação', () => loadRoster(true));
  head.appendChild(refresh);
  panel.appendChild(head);
  panel.appendChild(node('p', 'Relação por OBM de vínculo, com um registro por militar. Os totais consideram veículos particulares ativos e distinguem os veículos com tipo não informado.'));
  const filters = node('div');
  filters.className = 'cpv-roster-filters';
  const obmFilter = node('fieldset');
  const carFilter = node('fieldset');
  obmFilter.appendChild(node('legend', 'OBM'));
  carFilter.appendChild(node('legend', 'Carro cadastrado'));
  const obmChoices = node('div');
  obmChoices.className = 'cpv-roster-choices';
  obmFilter.appendChild(obmChoices);
  const carChoices = node('div');
  carChoices.className = 'cpv-roster-choices';
  carFilter.appendChild(carChoices);
  const motoFilter = node('fieldset');
  motoFilter.appendChild(node('legend', 'Moto'));
  filters.appendChild(obmFilter);
  filters.appendChild(carFilter);
  filters.appendChild(motoFilter);
  const order = node('div');
  order.className = 'cpv-roster-sort';
  function selectOrder(parent, id, label, entries) {
    const field = node('label');
    const select = node('select', undefined, id);
    field.appendChild(node('span', label));
    for (const [value, description] of entries) {
      const option = node('option', description);
      option.value = value;
      select.appendChild(option);
    }
    field.appendChild(select);
    parent.appendChild(field);
    return select;
  }
  const sortBy = selectOrder(order, 'cpv-roster-sort', 'Organizar por:', [
    ['antiguidade', 'Antiguidade'], ['nome', 'Nome'], ['rg', 'RG'], ['carros', 'Carro'], ['motos', 'Moto']
  ]);
  const sortDirection = selectOrder(order, 'cpv-roster-direction', 'Ordem', [['asc', 'A a Z'], ['desc', 'Z a A']]);
  filters.appendChild(order);
  panel.appendChild(filters);
  const notice = node('p');
  notice.className = 'cpv-status';
  notice.setAttribute('role', 'status');
  panel.appendChild(notice);
  const wrap = node('div');
  wrap.className = 'cpv-scroll';
  panel.appendChild(wrap);
  host.appendChild(panel);

  const collator = new Intl.Collator('pt-BR', {sensitivity: 'base', numeric: true});
  const selectedObms = new Map();
  let active = false, groups = null, flight = null, dataGeneration = null;
  const access = () => allowed() && options.canViewRoster() === true;
  const obmLabel = obm => obm ?? 'Sem OBM informada';
  function checkbox(parent, label, checked, change) {
    const choice = node('label');
    choice.className = 'cpv-roster-check';
    const input = node('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => { change?.(input.checked); render(); });
    choice.appendChild(input);
    choice.appendChild(node('span', label));
    parent.appendChild(choice);
    return input;
  }
  const withCar = checkbox(carChoices, 'Com carro cadastrado', true);
  const withoutCar = checkbox(carChoices, 'Sem carro cadastrado', true);
  const withMoto = checkbox(motoFilter, 'Com moto cadastrada', false);
  function updateOrderLabels() {
    const [ascending, descending] = sortDirection.children;
    const [first, last] = sortBy.value === 'antiguidade' ? [' · mais antigos primeiro', ' · mais modernos primeiro'] :
      sortBy.value === 'nome' ? ['', ''] : [' · menor para maior', ' · maior para menor'];
    ascending.textContent = 'A a Z' + first;
    descending.textContent = 'Z a A' + last;
  }
  function setDefaultOrder() {
    sortBy.value = 'antiguidade';
    sortDirection.value = 'asc';
    updateOrderLabels();
  }
  setDefaultOrder();
  sortBy.addEventListener('change', () => { updateOrderLabels(); render(); });
  sortDirection.addEventListener('change', render);

  const compareRg = (left, right) => collator.compare(left.rg.replace(/[.\s-]/g, ''), right.rg.replace(/[.\s-]/g, '')) ||
    collator.compare(left.rg, right.rg) || (left.rg < right.rg ? -1 : left.rg > right.rg ? 1 : 0);
  const compareName = (left, right) => collator.compare(left.nomeGuerra, right.nomeGuerra);
  function compareMembers(left, right) {
    const key = sortBy.value;
    const direction = sortDirection.value === 'desc' ? -1 : 1;
    let result;
    if (key === 'rg') result = compareRg(left, right);
    else if (key === 'antiguidade' || key === 'carros' || key === 'motos') result = left[key] - right[key];
    else result = compareName(left, right);
    return direction * result || compareName(left, right) || compareRg(left, right);
  }
  function render() {
    if (!groups || !active || !access()) return;
    const table = node('table');
    table.className = 'cpv-roster-table';
    table.setAttribute('aria-labelledby', heading.id);
    const thead = node('thead'), row = node('tr');
    for (const label of ['Militar', 'RG', 'Carros', 'Motos', 'Tipo não informado']) {
      const th = node('th', label);
      th.setAttribute('scope', 'col');
      row.appendChild(th);
    }
    thead.appendChild(row);
    table.appendChild(thead);
    let withCount = 0, withoutCount = 0;
    for (const [obm, members] of groups) {
      if (selectedObms.get(obm) === false) continue;
      const matching = members.filter(member =>
        (member.carros > 0 ? withCar.checked : withoutCar.checked) && (!withMoto.checked || member.motos > 0)
      ).sort(compareMembers);
      if (!matching.length) continue;
      const tbody = node('tbody'), groupRow = node('tr');
      groupRow.className = 'cpv-roster-group';
      const group = node('th', obmLabel(obm) + ' · ' + matching.length + (matching.length === 1 ? ' militar' : ' militares'));
      group.setAttribute('scope', 'rowgroup');
      group.colSpan = 5;
      groupRow.appendChild(group);
      tbody.appendChild(groupRow);
      for (const member of matching) {
        if (member.carros > 0) withCount++;
        else withoutCount++;
        const tr = node('tr');
        for (const value of [member.nome, member.rg, member.carros, member.motos, member.semTipo]) tr.appendChild(node('td', String(value)));
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
    }
    const total = withCount + withoutCount;
    wrap.replaceChildren(...(total ? [table] : []));
    notice.textContent = total ? total + (total === 1 ? ' militar' : ' militares') + ' na relação · ' + withCount + ' com carro · ' + withoutCount + ' sem carro cadastrado.' :
      groups.length ? 'Nenhum militar corresponde aos filtros selecionados.' : 'Nenhum militar encontrado no Efetivo.';
  }
  function setData(items) {
    const byObm = new Map();
    for (const item of items) {
      if (!byObm.has(item.obm)) byObm.set(item.obm, []);
      byObm.get(item.obm).push(item);
    }
    groups = [...byObm].sort(([left], [right]) => left === null ? 1 : right === null ? -1 : collator.compare(left, right));
    obmChoices.replaceChildren();
    for (const [obm] of groups) {
      checkbox(obmChoices, obmLabel(obm), selectedObms.get(obm) !== false, checked => selectedObms.set(obm, checked));
    }
    filters.hidden = !groups.length;
    render();
  }
  function pause() {
    flight?.control.abort();
    flight = null;
    groups = null;
    dataGeneration = null;
    filters.hidden = true;
    obmChoices.replaceChildren();
    wrap.replaceChildren();
    notice.textContent = '';
    panel.setAttribute('aria-busy', 'false');
  }
  function updateRoster() {
    const allowedHere = access();
    if (!allowedHere && active) reset();
    modes.hidden = !allowedHere;
    rosterMode.disabled = !allowedHere || !!pending || (busy && activeAction !== 'list');
    listMode.setAttribute('aria-pressed', String(!active));
    rosterMode.setAttribute('aria-pressed', String(active));
    panel.hidden = !active;
    registry.hidden = active;
    refresh.disabled = !visible || !allowedHere || !!flight;
  }
  function reset() {
    active = false;
    selectedObms.clear();
    withCar.checked = withoutCar.checked = true;
    withMoto.checked = false;
    setDefaultOrder();
    pause();
  }
  async function loadRoster(force = false) {
    if (!active || !visible || !access()) return;
    const generation = options.getGeneration(), who = actor;
    if (!force && (flight?.generation === generation || groups && dataGeneration === generation)) return;
    pause();
    const attempt = {control: new AbortController(), generation};
    flight = attempt;
    const current = () => flight === attempt && active && visible && actor === who && options.getGeneration() === generation && access();
    notice.textContent = 'Consultando militares por OBM…';
    panel.setAttribute('aria-busy', 'true');
    updateRoster();
    try {
      const result = await client.roster(attempt.control.signal);
      if (!current()) return;
      dataGeneration = generation;
      setData(result.items);
    } catch {
      if (current()) notice.textContent = 'Não foi possível consultar os militares por OBM. Use Atualizar relação para tentar novamente.';
    } finally {
      if (flight === attempt) {
        flight = null;
        panel.setAttribute('aria-busy', 'false');
        updateRoster();
      }
    }
  }
  function choose(showRoster) {
    if (!visible || showRoster === active || (showRoster && (!access() || rosterMode.disabled))) return;
    active = showRoster;
    if (active) {
      if (activeAction === 'list') {
        stop();
        status(rows.length ? 'Cadastros consultados.' : '');
      }
      stopForecast(true);
      void loadRoster();
    } else {
      pause();
      void loadForecast(true);
      if (!rows.length && !busy) void load();
    }
    update();
  }
  return {selected: () => active, load: loadRoster, pause, reset, update: updateRoster};
}
function build() {
  const scope = embedded ? '.cpv-page' : '.cpv-dialog';
  host.classList.add(scope.slice(1));
  host.setAttribute('aria-labelledby', 'cpv-title');
  const style = node('style');
  const shellStyle = embedded ? ".cpv-page{min-width:0;color:#17374e}\n.cpv-page .cpv-title{margin:0}\n.cpv-page .cpv-description{margin:6px 0 0;color:#526b7d}\n.cpv-page .cpv-field{min-width:min(150px,100%)}\n" : ".cpv-dialog{max-width:1150px;width:calc(100% - 36px);max-height:90vh;border:0;border-radius:14px;padding:22px;color:#17374e}.cpv-dialog::backdrop{background:rgba(15,23,42,.55)}";
  style.textContent = shellStyle + `
${scope}[hidden],${scope} [hidden]{display:none!important}
.cpv-top{display:flex;justify-content:space-between;gap:15px;align-items:center}
.cpv-ribbon,.cpv-fields{display:flex;flex-wrap:wrap;align-items:end;gap:12px;margin:16px 0}
.cpv-field{display:grid;gap:5px;min-width:150px;flex:1;font-size:13px}${scope} input,${scope} select,${scope} textarea{border:1px solid #afc2ce;border-radius:7px;padding:9px;color:#17374e;background:white;box-sizing:border-box;width:100%}${scope} table{border-collapse:collapse;width:100%;font-size:13px}${scope} td,${scope} th{padding:10px;text-align:left;border-bottom:1px solid #dbe4ea;vertical-align:top}
.cpv-scroll{overflow:auto}${scope} section{border-top:1px solid #d9e4eb;margin-top:20px;padding-top:15px}
.cpv-status{font-size:13px;white-space:pre-line}${scope} button{margin:2px}${scope} textarea{min-height:145px;font-family:monospace}
.cpv-military{display:grid;gap:5px;max-height:240px;overflow:auto}
.cpv-summary{font-size:12px;color:#526b7d}
.cpv-totals{padding:12px;border:1px solid #d9e4eb;border-radius:10px;background:#f4f8fb}
.cpv-totals h3{margin:0 0 8px;font-size:16px}
.cpv-totals p{font-size:12px;line-height:1.5}
.cpv-totals table{min-width:0;table-layout:fixed;font-size:12px}
.cpv-totals th,.cpv-totals td{padding:7px 5px;overflow-wrap:anywhere}
.cpv-totals th:first-child{width:29%}
.cpv-wing{font-size:13px;color:#526b7d}
.cpv-totals>summary{cursor:pointer;font-size:15px;font-weight:700}
.cpv-forecast{padding:12px;border:1px solid #c5d9e5;border-radius:10px;background:#f1f7fb}
.cpv-forecast-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.cpv-forecast h3{margin:0;font-size:16px}
.cpv-forecast p{margin:8px 0;font-size:12px;line-height:1.45}
.cpv-forecast table{min-width:0;table-layout:fixed;font-size:12px}
.cpv-forecast th,.cpv-forecast td{padding:7px 4px;overflow-wrap:anywhere}
.cpv-forecast th:nth-child(1){width:14%}
.cpv-forecast th:nth-child(2){width:13%}
.cpv-forecast th:nth-child(3),.cpv-forecast th:nth-child(4){width:24%}
.cpv-forecast th:nth-child(5){width:25%}
.cpv-forecast-pair,.cpv-forecast-pending{white-space:pre-line}
.cpv-forecast-summary{font-weight:700}
.cpv-view-modes{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}
.cpv-view-modes button[aria-pressed=true]{background:#e6f0f5;border-color:#9dbacb;color:#173f5f;font-weight:700}
.cpv-roster{min-width:0}
.cpv-roster h2{margin:0;font-size:18px}
.cpv-roster>p{font-size:13px}
.cpv-roster-filters{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0}
.cpv-roster-filters fieldset{min-width:0;margin:0;border:1px solid #c5d9e5;border-radius:8px;padding:8px 12px}
.cpv-roster-filters legend{font-size:13px;font-weight:700}
.cpv-roster-choices{display:flex;flex-wrap:wrap;gap:6px 15px}
.cpv-roster-check{display:inline-flex;align-items:center;gap:6px;max-width:100%;min-height:26px;font-size:13px}
.cpv-roster-check input{width:auto;margin:0}
.cpv-roster-check span{min-width:0;overflow-wrap:anywhere}
.cpv-roster-sort{display:flex;flex-wrap:wrap;align-items:end;gap:8px 12px;max-width:100%}
.cpv-roster-sort label{display:grid;gap:4px;font-size:13px;font-weight:700;max-width:100%}
.cpv-roster-sort select{min-width:116px;font-weight:400}
.cpv-roster .cpv-roster-table{min-width:430px;background:#fff}
.cpv-roster-table tbody tr{cursor:default}
.cpv-roster-table .cpv-roster-group th{background:#e7f0f5;color:#173f5f}
.cpv-roster .cpv-roster-table td,.cpv-roster .cpv-roster-table th{padding:6px 8px;overflow-wrap:anywhere}
.cpv-roster-table td:nth-child(n+3),.cpv-roster-table th:nth-child(n+3){text-align:center}
`;
  (doc.head || doc.body).appendChild(style);
  elements.style = style;
  const top = node('div');
  top.className = 'cpv-top';
  const title = node(embedded ? 'h1' : 'h2', embedded ? 'Veículos Particulares' : 'Veículos particulares', 'cpv-title');
  title.className = 'cpv-title';
  top.appendChild(title);
  if (!embedded) top.appendChild(button('Fechar', () => setVisible(false)));
  host.appendChild(top);
  const registry = rosterEnabled ? node('div', undefined, 'cpv-registration') : host;
  if (rosterEnabled) roster = buildRoster(registry);
  const description = node('p', 'Cadastro vinculado aos militares para identificação pela placa no Controle de Acesso. Os veículos não integram a frota do quartel.');
  description.className = 'cpv-description';
  registry.appendChild(description);
const ribbon=node('div');ribbon.className='cpv-ribbon';elements.search=field(ribbon,'Localizar por placa, RG ou militar');elements.search.maxLength=100;elements.search.placeholder='Digite para localizar';elements.active=field(ribbon,'Situação','select');for(const[v,text]of[['true','Ativos'],['','Todos'],['false','Inativos']]){const op=node('option',text);op.value=v;elements.active.appendChild(op);}elements.wingFilter=field(ribbon,'Ala no Mapa','select');for(const [value,label] of [['','Todas'],['1','Ala 1'],['2','Ala 2'],['3','Ala 3'],['4','Ala 4'],['0','Sem ala no Mapa']]){const option=node('option',label);option.value=value;elements.wingFilter.appendChild(option);}elements.wingFilter.value='';elements.typeFilter=field(ribbon,'Tipo do veículo','select');for(const [value,label] of [['','Todos'],['carro','Carro'],['moto','Moto'],['nao_informado','Não informado']]){const option=node('option',label);option.value=value;elements.typeFilter.appendChild(option);}elements.typeFilter.value='';elements.refresh=button('Atualizar',()=>{void loadForecast(true);return load();});elements.new=button('Novo veículo',()=>openEdit(), 'primary');elements.paste=button('Colar da planilha',openBulk);ribbon.appendChild(elements.refresh);ribbon.appendChild(elements.new);ribbon.appendChild(elements.paste);registry.appendChild(ribbon);elements.status=node('p','','cpv-status');elements.status.setAttribute('role','status');elements.status.setAttribute('aria-live','polite');registry.appendChild(elements.status);elements.check=button('Consultar resultado do envio',checkPending);elements.check.hidden=true;registry.appendChild(elements.check);elements.forecast=node('section');elements.forecast.className='cpv-forecast';const forecastHead=node('div');forecastHead.className='cpv-forecast-head';forecastHead.appendChild(node('h3','Previsão por ala'));elements.forecastRefresh=button('Atualizar previsão',()=>loadForecast(true));forecastHead.appendChild(elements.forecastRefresh);elements.forecast.appendChild(forecastHead);elements.forecast.appendChild(node('p','1 veículo por militar. Considera todos os tipos ativos da ala selecionada.'));elements.forecast.appendChild(node('p','Os cenários consideram as mesmas pessoas. Estimativa por ala, sem consultar a escala ou a presença do dia.'));elements.forecastStatus=node('p');elements.forecastStatus.className='cpv-status';elements.forecastStatus.setAttribute('role','status');elements.forecastStatus.setAttribute('aria-live','polite');elements.forecast.appendChild(elements.forecastStatus);elements.forecastResult=node('div');elements.forecastResult.hidden=true;elements.forecastSummary=node('p');elements.forecastSummary.className='cpv-forecast-summary';elements.forecastAlternatives=node('p');elements.forecastPending=node('p');elements.forecastResult.appendChild(elements.forecastSummary);elements.forecastResult.appendChild(elements.forecastAlternatives);const forecastTable=node('table'),forecastThead=node('thead'),forecastHeader=node('tr');for(const text of ['Ala','Militares','Máximo de carros','Mínimo de carros','A confirmar'])forecastHeader.appendChild(node('th',text));forecastThead.appendChild(forecastHeader);forecastTable.appendChild(forecastThead);elements.forecastRows=node('tbody');forecastTable.appendChild(elements.forecastRows);elements.forecastResult.appendChild(forecastTable);elements.forecastResult.appendChild(elements.forecastPending);elements.forecastPendingNote=node('p','Militares sem tipo e vínculos pendentes ficam fora dos cenários.');elements.forecastResult.appendChild(elements.forecastPendingNote);elements.forecast.appendChild(elements.forecastResult);registry.appendChild(elements.forecast);elements.totals=node('details');elements.totals.className='cpv-totals';elements.totals.hidden=true;elements.totals.appendChild(node('summary','Placas cadastradas'));elements.totalText=node('p');elements.totals.appendChild(elements.totalText);elements.totals.appendChild(node('p','Quantitativo dos veículos ativos conforme os filtros de ala e tipo. A busca, a situação da lista e a página carregada não alteram este quadro. Não representa os veículos que estão dentro do quartel. A ala vem do Mapa das Alas.'));const totalScroll=node('div');totalScroll.className='cpv-scroll';const totalTable=node('table'),totalHead=node('thead'),totalHeader=node('tr');for(const title of ['Ala no Mapa','Total','Carros','Motos','Sem tipo'])totalHeader.appendChild(node('th',title));totalHead.appendChild(totalHeader);totalTable.appendChild(totalHead);elements.totalRows=node('tbody');totalTable.appendChild(elements.totalRows);totalScroll.appendChild(totalTable);elements.totals.appendChild(totalScroll);registry.appendChild(elements.totals);const scroll=node('div');scroll.className='cpv-scroll';const table=node('table'),thead=node('thead'),headrow=node('tr');for(const text of['Placa','Militar','Ala no Mapa','Tipo','Modelo','Cor','Situação','Ação'])headrow.appendChild(node('th',text));thead.appendChild(headrow);table.appendChild(thead);elements.table=node('tbody');table.appendChild(elements.table);scroll.appendChild(table);registry.appendChild(scroll);elements.empty=node('p','Nenhum veículo encontrado.');registry.appendChild(elements.empty);elements.summary=node('p');elements.summary.className='cpv-summary';registry.appendChild(elements.summary);elements.more=button('Carregar mais',()=>load(true));registry.appendChild(elements.more);
elements.edit=node('section');elements.edit.hidden=true;elements.edit.appendChild(node('h3','Cadastro do veículo'));const fields=node('div');fields.className='cpv-fields';elements.plate=field(fields,'Placa');elements.plate.maxLength=20;elements.plate.setAttribute('autocapitalize','characters');elements.rg=field(fields,'RG ou nome do militar');elements.rg.maxLength=100;elements.militarySearch=button('Buscar militar',findMilitary);fields.appendChild(elements.militarySearch);elements.model=field(fields,'Modelo (opcional)');elements.model.maxLength=100;elements.color=field(fields,'Cor (opcional)');elements.color.maxLength=60;elements.type=field(fields,'Tipo','select');for(const [value,label] of [['','Não informado'],['carro','Carro'],['moto','Moto']]){const option=node('option',label);option.value=value;elements.type.appendChild(option);}elements.type.value='';const activeLabel=node('label');elements.recordActive=node('input');elements.recordActive.type='checkbox';activeLabel.appendChild(elements.recordActive);activeLabel.appendChild(node('span','Cadastro ativo'));fields.appendChild(activeLabel);elements.edit.appendChild(fields);elements.militaryName=node('p');elements.edit.appendChild(elements.militaryName);elements.wing=node('p');elements.wing.className='cpv-wing';elements.edit.appendChild(elements.wing);elements.militaryResults=node('div');elements.militaryResults.className='cpv-military';elements.edit.appendChild(elements.militaryResults);elements.editStatus=node('p');elements.editStatus.className='cpv-status';elements.editStatus.setAttribute('role','status');elements.edit.appendChild(elements.editStatus);elements.save=button('Salvar veículo',saveRecord,'primary');elements.edit.appendChild(elements.save);elements.edit.appendChild(button('Fechar cadastro',()=>{elements.edit.hidden=true;}));registry.appendChild(elements.edit);
elements.bulk=node('section');elements.bulk.hidden=true;elements.bulk.appendChild(node('h3','Cadastrar a partir da planilha'));elements.bulk.appendChild(node('p','Copie até 100 linhas nas colunas RG, Placa, Modelo, Cor e Tipo. Modelo, cor e tipo são opcionais. A primeira linha de títulos é opcional. Confira antes de cadastrar.'));elements.bulkText=node('textarea');elements.bulkText.setAttribute('aria-label','Colagem da planilha');elements.bulkText.placeholder='RG\tPlaca\tModelo\tCor\tTipo\n49058\tABC1D23\tModelo\tBranco\tCarro';elements.bulk.appendChild(elements.bulkText);elements.preview=button('Conferir colagem',previewBulk);elements.bulk.appendChild(elements.preview);elements.import=button('Cadastrar veículos conferidos',importBulk,'primary');elements.bulk.appendChild(elements.import);elements.bulk.appendChild(button('Fechar colagem',()=>{elements.bulk.hidden=true;}));elements.bulkStatus=node('p');elements.bulkStatus.className='cpv-status';elements.bulkStatus.setAttribute('role','status');elements.bulk.appendChild(elements.bulkStatus);const bulkScroll=node('div');bulkScroll.className='cpv-scroll';const bulkTable=node('table'),bulkHead=node('thead'),bhr=node('tr');for(const text of['Linha','RG','Placa','Modelo','Cor','Tipo','Ala no Mapa','Militar','Conferência'])bhr.appendChild(node('th',text));bulkHead.appendChild(bhr);bulkTable.appendChild(bulkHead);elements.bulkRows=node('tbody');bulkTable.appendChild(elements.bulkRows);bulkScroll.appendChild(bulkTable);elements.bulk.appendChild(bulkScroll);registry.appendChild(elements.bulk);
for(const[key,el]of Object.entries(elements))if(el&&typeof el.setAttribute==='function'&&!['style'].includes(key))el.id='cpv-'+key;on(elements.search,'keydown',e=>{if(e.key==='Enter'){e.preventDefault();void load();}});on(elements.search,'input',resetList);on(elements.active,'change',()=>{if(resetList())void load();});on(elements.wingFilter,'change',()=>{if(resetList())void load();});on(elements.typeFilter,'change',()=>{if(resetList())void load();});on(elements.plate,'input',()=>{elements.plate.value=elements.plate.value.toUpperCase();});on(elements.rg,'input',()=>{militarySelected=null;elements.militaryResults.replaceChildren();elements.militaryName.textContent='Busque e selecione o militar responsável.';elements.wing.textContent='Escolha um militar para consultar sua ala no Mapa.';update();});on(elements.rg,'keydown',e=>{if(e.key==='Enter'){e.preventDefault();void findMilitary();}});on(elements.recordActive,'change',update);on(elements.bulkText,'input',()=>{bulkPreview=null;bulkSelections.clear();elements.bulkRows.replaceChildren();elements.bulkStatus.textContent='Colagem alterada. Confira os dados antes de cadastrar.';update();});if (!embedded) on(host, 'cancel', event => { event.preventDefault(); setVisible(false); });
  if (options.bindTrigger === true && trigger) on(trigger, 'click', () => setVisible(true));
  on(env, 'pagehide', () => {
    setVisible(false);
    if (embedded && busy) stop();
  });
}
function setReady(next){if(disposed)return;const nextActor=next.actorId||null;if(actor&&actor!==nextActor){stopForecast(true);stop();roster?.reset();rows=[];cursor=null;loadedFilterKey='';pending=null;editRecord=null;militarySelected=null;bulkPreview=null;bulkSelections.clear();for(const input of [elements.search,elements.wingFilter,elements.typeFilter,elements.plate,elements.rg,elements.model,elements.color,elements.type,elements.bulkText])input.value='';elements.edit.hidden=elements.bulk.hidden=true;elements.bulkRows.replaceChildren();elements.militaryResults.replaceChildren();elements.wing.textContent='';renderTotals(null);renderRows();status('');}actor=nextActor;ready=next.ready===true&&!!actor;if(!allowed()){stopForecast(true);stop();if(visible)setVisible(false);}else if(visible){const previouslyRoster=roster?.selected();roster?.update();if(roster?.selected())void roster.load();else{void loadForecast();if(previouslyRoster&&!rows.length&&!busy)void load();}}update();}
build();host.hidden=true;update();return Object.freeze({setReady,setVisible,load,loadForecast,dispose(){if(disposed)return;setVisible(false);disposed=true;stop();client.dispose();listeners.forEach(fn=>fn());elements.style.remove?.();host.replaceChildren();}});
}
return Object.freeze({mount,createClient,parseClipboard,readyRows,plate,rg,validateList:list,validateReceipt:receipt,validatePreview:preview,validateMilitary:militaryResult,validateForecast:forecastDto});
});
