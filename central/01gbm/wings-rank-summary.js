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
    const match=/^(?:CEDIDOS\s*[•-]\s*)?ALA\s*([1-4])(?:\s|[•-]|$)/.exec(text(value));
    return match?Number(match[1]):0;
  }
  function rankOf(value){
    const rank=text(value);
    if(/^SUB\s*TEN(?:ENTE)?(?:\s+BM)?$/.test(rank))return 'subten';
    if(/^(?:(?:[123]|PRIMEIRO|SEGUNDO|TERCEIRO)\s*)?(?:SGT|SARGENTO)(?:\s+BM)?$/.test(rank))return 'sgt';
    if(/^(?:CB|CABO)(?:\s+BM)?$/.test(rank))return 'cb';
    if(/^(?:SD|SOLDADO)(?:\s+BM)?$/.test(rank))return 'sd';
    return '';
  }
  function build(payload){
    payload=payload&&typeof payload==='object'?payload:{};
    const result=[1,2,3,4].map(number=>({number,subten:0,sgt:0,cb:0,sd:0,total:0}));
    const roster=new Map(),people=new Map(),cededCells=new Set();
    const declared=payload.militaryByRg;
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
    function include(person,number,priority){
      if(!person||typeof person!=='object')return;
      const rg=rgOf(person.rg);if(!rg)return;
      const previous=people.get(rg),candidate={number:wingOf(number),priority,category:category(person,rg)};
      if(!previous||priority>previous.priority)people.set(rg,candidate);
      else if(priority===previous.priority&&!previous.category&&candidate.category)previous.category=candidate.category;
    }
    // Origin is a fallback: the current draft can place the same person in a
    // different Ala or in the Expediente without rewriting person.originWing.
    list(payload.unassigned).forEach(person=>include(person,person&&person.originWing,10));
    list(payload.wings).forEach(wing=>list(wing&&wing.available).forEach(person=>include(person,wingOf(person&&person.originWing)||wing&&wing.number,10)));
    list(payload.office).forEach(sector=>list(sector&&sector.people).forEach(person=>include(person,0,20)));
    list(payload.ceded).forEach(column=>list(column&&column.slots).forEach(slot=>{
      if(!slot)return;
      const row=Number(slot.sourceRow),col=Number(slot.sourceColumn);
      if(Number.isInteger(row)&&row>0&&Number.isInteger(col)&&col>0)cededCells.add(row+':'+col);
      include(slot.person,column.number,40);
    }));
    list(payload.movements).forEach(item=>{
      if(!item||item.informational===true||item.restriction24hOnly===true)return;
      // The dedicated ceded board is mutable in a local draft. Its original
      // movement mirror may still name the previous occupant or an empty slot.
      if(text(item.group).startsWith('CEDIDOS')&&cededCells.has(Number(item.sourceRow)+':'+Number(item.sourceColumn)))return;
      include(item.person,wingOf(item.location),30);
    });
    list(payload.wings).forEach(wing=>list(wing&&wing.assignments).forEach(item=>include(item&&item.person,wing&&wing.number,50)));
    people.forEach(person=>{
      if(!person.number||!person.category)return;
      const row=result[person.number-1];row[person.category]++;row.total++;
    });
    return result;
  }
  return Object.freeze({build});
});
