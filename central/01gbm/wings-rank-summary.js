(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.BNXWingsRankSummary=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const list=value=>Array.isArray(value)?value:[];
  const text=value=>String(value==null?'':value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[º°ª.]/g,'').replace(/\s+/g,' ').trim();
  const rgOf=value=>String(value==null?'':value).replace(/\D/g,'').replace(/^0+(?=\d)/,'');
  function wingOf(value){
    if(typeof value==='number'||typeof value==='string'&&/^[1-4]$/.test(value)){const number=Number(value);return Number.isInteger(number)&&number>=1&&number<=4?number:0;}
    return 0;
  }
  function rankOf(value){
    const rank=text(value);
    if(/^SUB\s*TEN(?:ENTE)?(?:\s+BM)?$/.test(rank))return 'subten';
    if(/^(?:(?:[123]|PRIMEIRO|SEGUNDO|TERCEIRO)\s*)?(?:SGT|SARGENTO)(?:\s+BM)?$/.test(rank))return 'sgt';
    if(/^(?:CB|CABO)(?:\s+BM)?$/.test(rank))return 'cb';
    if(/^(?:SD|SOLDADO)(?:\s+BM)?$/.test(rank))return 'sd';
    return '';
  }
  function context(payload){
    payload=payload&&typeof payload==='object'?payload:{};
    const roster=new Map(),declared=payload.militaryByRg;
    if(declared&&typeof declared==='object')Object.keys(declared).forEach(key=>{
      const person=declared[key],rg=rgOf(person&&person.rg||key);
      if(person&&typeof person==='object'&&rg)roster.set(rg,person);
    });
    function field(person,fallback,key){return person[key]!=null&&String(person[key]).trim()!==''?person[key]:fallback[key];}
    function category(person,rg){
      const fallback=roster.get(rg)||{},activity=text(field(person,fallback,'activity'));
      const former=person.isFormer===true||person.former===true||person.isFormer!==false&&person.former!==false&&(fallback.isFormer===true||fallback.former===true);
      const external=person.externalHealth===true||person.externalHealth!==false&&fallback.externalHealth===true;
      if(person.isVacant===true||former||external||['TRANSFERIDO','OFICIAL','CIVIL','COLABORADOR','VISITANTE'].includes(activity)||person.isOfficer===true)return '';
      return rankOf(text(person.rank)||text(person.rankShort)||text(fallback.rank)||text(fallback.rankShort));
    }
    return {payload,category};
  }
  function readyForWing(person){
    return person&&person.available===true&&person.available24h!==false&&person.currentLeaveAffectsScale!==true;
  }
  function readyForOffice(person){
    // Exact wingsAvailableForOffice contract from the Mapa UI: a DTS limited
    // to 24h duty may still permit work in the Expediente.
    return person&&person.availableForOffice===true&&person.currentLeaveAffectsOffice!==true;
  }
  function assigned(state,visit){
    const seen=new Set();
    list(state.payload.wings).forEach(wing=>{
      const number=wingOf(wing&&wing.number);if(!number)return;
      list(wing.assignments).forEach(item=>{
        const person=item&&item.person,rg=rgOf(person&&person.rg);
        if(!rg||seen.has(rg)||!readyForWing(person))return;
        const category=state.category(person,rg);if(!category)return;
        seen.add(rg);visit(number,category);
      });
    });
    return seen;
  }
  function empty(){return {subten:0,sgt:0,cb:0,sd:0,total:0};}
  function build(payload){
    const state=context(payload),result=[1,2,3,4].map(number=>Object.assign({number},empty()));
    // Effective Ala strength comes only from ready, occupied assignments.
    // Origin links, available pool, ceded and away boards do not enter.
    assigned(state,(number,category)=>{result[number-1][category]++;result[number-1].total++;});
    return result;
  }
  function buildOffice(payload){
    const state=context(payload),result=empty(),seen=assigned(state,()=>{});
    list(state.payload.office).forEach(sector=>list(sector&&sector.people).forEach(person=>{
      const rg=rgOf(person&&person.rg);if(!rg||seen.has(rg)||!readyForOffice(person))return;
      const category=state.category(person,rg);if(!category)return;
      seen.add(rg);result[category]++;result.total++;
    }));
    return result;
  }
  return Object.freeze({build,buildOffice});
});
