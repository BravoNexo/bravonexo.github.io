/* BravoNexo driver-history PDF builder. PDFLib 1.17.1 supplied locally by the caller.
 * No fetch, authentication, DOM, uploads or application-state mutations.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BNXDriverHistoryPdf = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const VERSION = '1.0.0';
  const LABELS = Object.freeze({
    ABASTECIMENTO: 'Abastecimento', ALTERACAO: 'Alteração registrada',
    ALTERACAO_CADASTRO: 'Alteração de cadastro', CONDICAO: 'Condição operacional',
    MANUTENCAO: 'Manutenção', OBSERVACAO_GERAL: 'Observação geral',
    SISGEO: 'SISGEO', SUBSTITUICAO: 'Substituição', COLISAO: 'Colisão',
    MOV_ADMINISTRATIVA: 'Movimentação administrativa'
  });
  const ROLES = Object.freeze({
    encarregado_motoristas: 'Encarregado de Motoristas', comandante_guarda: 'Comandante da Guarda',
    guarda: 'Guarda', toque_diurno: 'Toque de Fogo diurno', toque_noturno: 'Toque de Fogo noturno',
    BRAVONEXO: 'Administração'
  });
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
  const allowed = new Set(['id','tipo','ocorridoEm','registradoEm','dataServico','prefixo','descricaoViatura','autor','funcao','origem','condutor','litros','valorCentavos','km','justificativaKm','destinoFornecedor','resultado','observacoes','situacao','observacaoHistorico']);
  function need(value, message) { if (!value) throw new Error(message || 'O histórico não pôde ser conferido para gerar o PDF.'); }
  function text(value, nullable) {
    if (value === null || value === undefined) { need(nullable, 'Falta um campo obrigatório no histórico.'); return ''; }
    need(typeof value === 'string' && value.length <= 40000 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value));
    return value.replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
  }
  function civil(value) {
    need(typeof value === 'string' && DATE.test(value) && Number.isFinite(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10) === value);
    return value;
  }
  function instant(value) { need(typeof value === 'string' && INSTANT.test(value) && Number.isFinite(Date.parse(value))); return value; }
  function validate(report) {
    need(report && typeof report === 'object' && !Array.isArray(report));
    need(report.version === 1 && report.unitCode === '01gbm' && typeof report.unitName === 'string');
    need(report.kind === 'CENTRAL_DRIVER_HISTORY_PAGE' || report.kind === 'CENTRAL_DRIVER_HISTORY_REPORT');
    instant(report.generatedAt); civil(report.endDate); if (report.startDate !== null && report.startDate !== undefined) { civil(report.startDate); need(report.startDate <= report.endDate); }
    need(typeof report.includeAdministrative === 'boolean');
    need(Number.isSafeInteger(report.total) && report.total >= 0 && Array.isArray(report.entries) && report.entries.length === report.total,
      'O histórico ainda está incompleto. Aguarde a consulta de todas as páginas antes de gerar o PDF.');
    need(report.nextCursor === null || report.nextCursor === undefined, 'Há páginas do histórico que ainda precisam ser consultadas.');
    const seen = new Set(), counts = new Map();
    const entries = report.entries.map(raw => {
      need(raw && typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw).every(key => allowed.has(key)));
      const entry = {};
      entry.id = text(raw.id, false); need(entry.id && !seen.has(entry.id)); seen.add(entry.id);
      entry.tipo = text(raw.tipo, false); need(entry.tipo.trim());
      entry.ocorridoEm = instant(raw.ocorridoEm); entry.registradoEm = instant(raw.registradoEm);
      entry.dataServico = civil(raw.dataServico);
      for (const key of ['prefixo','descricaoViatura','autor','funcao','origem','condutor','justificativaKm','destinoFornecedor','resultado','observacoes','situacao','observacaoHistorico']) entry[key] = text(raw[key], true);
      for (const key of ['litros','km']) {
        const v = raw[key];
        need(v === null || v === undefined || typeof v === 'string' && /^\d{1,13}(?:\.\d{1,3})?$/.test(v) || typeof v === 'number' && Number.isFinite(v) && v >= 0);
        entry[key] = v === undefined ? null : v;
      }
      need(raw.valorCentavos === null || raw.valorCentavos === undefined || Number.isSafeInteger(raw.valorCentavos) && raw.valorCentavos >= 0);
      entry.valorCentavos = raw.valorCentavos === undefined ? null : raw.valorCentavos;
      counts.set(entry.tipo, (counts.get(entry.tipo)||0)+1);
      return entry;
    });
    need(report.includeAdministrative || !counts.has('MOV_ADMINISTRATIVA'));
    need(Array.isArray(report.counts));
    const advertised = new Map();
    for (const item of report.counts) {
      need(item && typeof item.tipo === 'string' && Number.isSafeInteger(item.total) && item.total > 0 && !advertised.has(item.tipo));
      advertised.set(item.tipo,item.total);
    }
    need(advertised.size === counts.size && [...counts].every(([tipo,total]) => advertised.get(tipo) === total), 'O total do histórico não confere com os registros recebidos.');
    entries.sort((a,b) => Date.parse(a.ocorridoEm)-Date.parse(b.ocorridoEm) || Date.parse(a.registradoEm)-Date.parse(b.registradoEm) || a.id.localeCompare(b.id));
    return { ...report, entries, counts: [...counts].map(([tipo,total]) => ({tipo,total})).sort((a,b)=>(LABELS[a.tipo]||a.tipo).localeCompare(LABELS[b.tipo]||b.tipo,'pt-BR')) };
  }
  const timestamp = value => new Intl.DateTimeFormat('pt-BR', {timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(value)).replace(',', '');
  const dateLabel = value => value.split('-').reverse().join('/');
  const decimal = (value, places) => Number(value).toLocaleString('pt-BR',{maximumFractionDigits:places});
  function fileName(report) { return 'Encarregado de Motoristas - ' + String(report.unitCode||'01gbm') + ' - até ' + civil(report.endDate) + '.pdf'; }
  async function buildDriverHistoryPdf(raw, options) {
    options = options || {};
    const report = validate(raw);
    const lib = options.PDFLib || (typeof globalThis === 'object' && globalThis.PDFLib);
    need(lib && lib.PDFDocument && lib.StandardFonts && lib.rgb, 'A biblioteca local de PDF ainda não foi carregada.');
    const { PDFDocument, StandardFonts, rgb } = lib;
    const pdf = await PDFDocument.create();
    const normal = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    pdf.setTitle('Histórico do Encarregado de Motoristas - ' + report.unitName);
    pdf.setAuthor('BravoNexo Central');
    pdf.setSubject('Lançamentos até ' + dateLabel(report.endDate));
    pdf.setCreator('BravoNexo Central - driver-history-pdf ' + VERSION);
    pdf.setProducer('BravoNexo Central / pdf-lib 1.17.1');
    pdf.setCreationDate(new Date(report.generatedAt)); pdf.setModificationDate(new Date(report.generatedAt));
    const W = 595.28, H = 841.89, LEFT = 38, RIGHT = 38, BOTTOM = 42, WIDTH = W-LEFT-RIGHT;
    const navy = rgb(.09,.22,.31), blue = rgb(.13,.35,.47), ink = rgb(.12,.17,.20), muted = rgb(.35,.41,.44), pale = rgb(.93,.96,.97), rule = rgb(.80,.85,.88);
    const unsupported = new Set(), glyphCache = new Map();
    function glyph(char, heavy) {
      const key = (heavy?'b':'n')+char;
      if (glyphCache.has(key)) return glyphCache.get(key);
      for (const font of [heavy?bold:normal]) {
        try { font.encodeText(char); const result={text:char,font}; glyphCache.set(key,result); return result; } catch (_) {}
      }
      const point=char.codePointAt(0), result={text:'[U+'+point.toString(16).toUpperCase().padStart(4,'0')+']',font:heavy?bold:normal};
      unsupported.add(result.text); glyphCache.set(key,result); return result;
    }
    function runs(value, heavy) {
      const out=[];
      for (const char of String(value)) {
        const g=glyph(char,heavy),last=out[out.length-1];
        if (last && last.font===g.font) last.text+=g.text; else out.push({text:g.text,font:g.font});
      }
      return out;
    }
    function measure(value,size,heavy) { return runs(value,heavy).reduce((sum,r)=>sum+r.font.widthOfTextAtSize(r.text,size),0); }
    function write(value,x,y,size,heavy,color) {
      for (const r of runs(value,heavy)) { page.drawText(r.text,{x,y,size,font:r.font,color:color||ink}); x+=r.font.widthOfTextAtSize(r.text,size); }
    }
    function wrap(value,size,width,heavy) {
      const out=[];
      for (const paragraph of String(value).split('\n')) {
        if (!paragraph) {out.push('');continue;}
        let line='';
        for (const token of paragraph.split(/(\s+)/).filter(Boolean)) {
          if (measure(line+token,size,heavy)<=width) {line+=token;continue;}
          if (line.trim()) {out.push(line.trimEnd());line='';}
          const word=token.trimStart(); if (!word) continue;
          if (measure(word,size,heavy)<=width) {line=word;continue;}
          for (const char of word) {
            if (line && measure(line+char,size,heavy)>width) {out.push(line);line='';}
            line+=char;
          }
        }
        out.push(line.trimEnd());
      }
      return out;
    }
    let page, y, sectionTitle='', pageNumber=0;
    function newPage() {
      page=pdf.addPage([W,H]); pageNumber++;
      page.drawRectangle({x:0,y:H-54,width:W,height:54,color:navy});
      write('ENCARREGADO DE MOTORISTAS',LEFT,H-24,12,true,rgb(1,1,1));
      write(report.unitName+' | Histórico até '+dateLabel(report.endDate),LEFT,H-41,8.5,false,rgb(.87,.94,.97));
      y=H-74;
      if (sectionTitle) sectionHeading(sectionTitle+' - continuação',true);
    }
    function room(height) {if(y-height<BOTTOM)newPage();}
    function paragraph(value,{size=9,heavy=false,color=ink,after=5,indent=0}={}) {
      const lines=wrap(value,size,WIDTH-indent,heavy),lh=size*1.3;
      for (const line of lines) {room(lh);write(line,LEFT+indent,y-size,size,heavy,color);y-=lh;}
      y-=after;
    }
    function sectionHeading(title,continued) {
      if(!continued && y-31<BOTTOM)newPage();
      page.drawRectangle({x:LEFT,y:y-24,width:WIDTH,height:24,color:blue});
      write(title,LEFT+8,y-16,10,true,rgb(1,1,1)); y-=33;
    }
    function startSection(title,count) {sectionTitle='';room(70);sectionTitle=title;sectionHeading(title+' ('+count+')',false);}
    newPage();
    paragraph('Relatório consolidado dos lançamentos registrados no sistema.',{size:10,heavy:true,after:4});
    const period=(report.startDate?'De '+dateLabel(report.startDate):'Todo o histórico disponível')+' até '+dateLabel(report.endDate)+'.';
    paragraph(period+' Emitido em '+timestamp(report.generatedAt)+' (Brasília).',{size:8.5,color:muted,after:7});
    const main=report.entries.filter(x=>x.tipo!=='MOV_ADMINISTRATIVA'),administrative=report.entries.filter(x=>x.tipo==='MOV_ADMINISTRATIVA');
    paragraph(report.total+' registros | '+main.length+' lançamentos do livro | '+administrative.length+' movimentações administrativas',{size:9.2,heavy:true,after:8});
    if(report.counts.length) {
      const col=WIDTH/2,rowH=20;
      report.counts.forEach((item,i)=>{
        if(i%2===0)room(rowH+2);
        const x=LEFT+(i%2)*col,baseY=y;
        page.drawRectangle({x,y:baseY-rowH,width:col-4,height:rowH-2,color:pale});
        write((LABELS[item.tipo]||item.tipo)+': '+item.total,x+7,baseY-13,8.5,false,ink);
        if(i%2===1||i===report.counts.length-1)y-=rowH;
      });y-=8;
    }
    paragraph('A data/hora representa a ocorrência. A data de registro e o serviço correspondente aparecem em cada lançamento. Movimentações administrativas do Controle de Acesso estão separadas ao final.',{size:8,color:muted,after:10});
    function record(entry,index) {
      const label=LABELS[entry.tipo]||entry.tipo.replaceAll('_',' ');
      const prefix=entry.prefixo||'Geral';
      const title=String(index).padStart(3,'0')+' | '+timestamp(entry.ocorridoEm)+' | '+label+' | '+prefix;
      const lines=[];
      function add(value,size,heavy,color,gap) {
        for(const line of wrap(value,size,WIDTH-14,heavy)) lines.push({text:line,size,heavy,color,lh:size*1.25});
        if(gap)lines.push({space:gap});
      }
      const author=(entry.autor||'Não identificado no registro')+(entry.funcao?' - '+(ROLES[entry.funcao]||entry.funcao.replaceAll('_',' ')):'');
      add('Responsável: '+author,7.8,false,muted,2);
      if(entry.descricaoViatura&&entry.descricaoViatura!==entry.prefixo)add('Viatura: '+entry.descricaoViatura,8.2,false,ink,2);
      const measures=[];
      if(entry.condutor)measures.push('Condutor: '+entry.condutor);
      if(entry.litros!==null)measures.push('Litros: '+decimal(entry.litros,3)+' L');
      if(entry.valorCentavos!==null)measures.push('Valor: '+(entry.valorCentavos/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}));
      if(entry.km!==null)measures.push('KM: '+decimal(entry.km,1));
      if(entry.resultado)measures.push('Resultado: '+(entry.tipo==='MOV_ADMINISTRATIVA'?({entrada:'Entrada',saida:'Saída'}[entry.resultado]||entry.resultado):entry.resultado));
      if(measures.length)add(measures.join(' | '),8.5,false,ink,2);
      if(entry.destinoFornecedor)add((entry.tipo==='COLISAO'?'Local da colisão':entry.tipo==='ABASTECIMENTO'?'Fornecedor':entry.tipo==='MOV_ADMINISTRATIVA'?'Destino':'Destino / fornecedor')+': '+entry.destinoFornecedor,8.5,false,ink,2);
      if(entry.observacoes)add('Observações: '+entry.observacoes,8.5,false,ink,2);
      if(entry.justificativaKm)add('Justificativa do KM: '+entry.justificativaKm,8.2,false,ink,2);
      if(entry.observacaoHistorico)add('Registro histórico: '+entry.observacaoHistorico,8.2,false,ink,2);
      const meta=['Registrado em '+timestamp(entry.registradoEm),'Serviço: '+dateLabel(entry.dataServico)];
      if(entry.origem)meta.push(entry.origem);
      if(entry.situacao && !/^ativo$/i.test(entry.situacao))meta.push('Situação: '+entry.situacao);
      add(meta.join(' | '),7,false,muted,0);
      const head=wrap(title,9,WIDTH-14,true),headH=head.length*11.5+8,total=headH+lines.reduce((n,l)=>n+(l.space||l.lh),0)+9;
      if(total<=H-132-BOTTOM && y-total<BOTTOM)newPage();
      function titleBar(continued) {
        const headLines=continued?wrap(title+' (continuação)',9,WIDTH-14,true):head;
        const height=headLines.length*11.5+8;
        if(y-height-12<BOTTOM)newPage();
        page.drawRectangle({x:LEFT,y:y-height,width:WIDTH,height,color:pale});
        for(const line of headLines){write(line,LEFT+7,y-12,9,true,navy);y-=11.5;}y-=8;
      }
      titleBar(false);
      for(const line of lines) {
        if(line.space){y-=line.space;continue;}
        if(y-line.lh<BOTTOM){newPage();titleBar(true);}
        write(line.text,LEFT+7,y-line.size,line.size,line.heavy,line.color);y-=line.lh;
      }
      y-=5;page.drawLine({start:{x:LEFT,y},end:{x:W-RIGHT,y},thickness:.45,color:rule});y-=7;
    }
    if(main.length){startSection('Livro do Encarregado de Motoristas',main.length);main.forEach((entry,i)=>record(entry,i+1));}
    else paragraph('Nenhum lançamento do livro foi encontrado no período selecionado.',{size:9,after:10});
    if(administrative.length){startSection('Movimentações administrativas - Controle de Acesso',administrative.length);administrative.forEach((entry,i)=>record(entry,i+1));}
    if(!report.entries.length)paragraph('Nenhum registro encontrado para os filtros selecionados.',{size:10,heavy:true});
    if(unsupported.size){sectionTitle='';paragraph('Representação de caracteres: símbolos não disponíveis nas fontes locais são preservados na forma de códigos Unicode, como '+[...unsupported].slice(0,8).join(', ')+'.',{size:7.5,color:muted,after:0});}
    const pages=pdf.getPages(),totalPages=pages.length;
    pages.forEach((p,i)=>{
      page=p;p.drawLine({start:{x:LEFT,y:29},end:{x:W-RIGHT,y:29},thickness:.5,color:rule});
      write('BravoNexo Central | Horários de Brasília',LEFT,17,7,false,muted);
      const pageLabel='Página '+(i+1)+' de '+totalPages;
      write(pageLabel,W-RIGHT-measure(pageLabel,7,false),17,7,false,muted);
    });
    return pdf.save();
  }
  return Object.freeze({VERSION,PDF_LIB_VERSION:'1.17.1',LABELS,validateDriverHistoryReport:validate,fileName,buildDriverHistoryPdf});
});
