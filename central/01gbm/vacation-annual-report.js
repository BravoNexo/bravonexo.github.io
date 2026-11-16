(function (window) {
  'use strict';

  const visiblePeriods = 17;
  const escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => escapes[character]);
  }

  function countLabel(count, singular, plural) {
    return escapeHtml(count) + ' ' + (Number(count) === 1 ? singular : plural);
  }

  function annualTotals(model) {
    const totals = [
      [model.totalMilitary, 'Militares no ano'],
      [model.totalPeriods, 'Períodos no ano']
    ];
    return '<dl class="annual-totals">' + totals.filter(([value]) => value != null).map(([value, label]) =>
      '<div><dt>' + label + '</dt><dd>' + escapeHtml(value) + '</dd></div>'
    ).join('') + '</dl>';
  }

  function periodRow(row) {
    const military = escapeHtml(row.military);
    const reference = row.otherReference
      ? '<span class="period-reference">Ref. ' + escapeHtml(row.referenceYear) + '</span>' : '';
    const partial = row.partial
      ? '<span class="period-partial" title="Este período entra no total de outro mês">Parcial</span>' : '';
    return '<li class="period' + (row.otherReference ? ' other-reference' : '') + '">' +
      '<span class="period-name" title="' + military + '">' + military + '</span>' + reference +
      '<span class="period-days">' + partial + escapeHtml(row.range) + '</span></li>';
  }

  function monthCard(month) {
    const label = escapeHtml(String(month.label).replace(/\/\d{4}$/, ''));
    const remaining = month.rows.length - visiblePeriods;
    const periods = month.rows.slice(0, visiblePeriods).map(periodRow).join('');
    const overflow = remaining > 0
      ? '<li class="period-more" title="Períodos adicionais deste mês">+' + countLabel(remaining, 'período', 'períodos') + '</li>' : '';
    const body = month.rows.length
      ? '<ul class="month-periods">' + periods + overflow + '</ul>'
      : '<p class="empty-month">Sem férias programadas</p>';
    return '<section class="month"><header class="month-header"><h2>' + label + '</h2>' +
      '<p class="month-count">' + countLabel(month.count, 'militar', 'militares') + '</p></header>' + body + '</section>';
  }

  const styles = `
    @page { size: A4 landscape; margin: 6mm; }
    :root { --navy: #18394e; --navy-panel: #294d63; --gold: #bc9b58; --gold-light: #e4d6b7; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #183645; background: #edf2f5; font-family: Arial, Helvetica, sans-serif; }
    .print-tools { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 11px 20px; background: #f9fbfc; border-bottom: 1px solid #d6e1e7; }
    .print-tools button { padding: 9px 13px; border: 1px solid #bfd2dc; border-radius: 6px; color: #24495a; background: #fff; font: 700 13px Arial, sans-serif; cursor: pointer; }
    .print-tools button:first-child { border-color: var(--navy); background: var(--navy); color: #fff; }
    .print-tools button:focus-visible { outline: 2px solid #246f90; outline-offset: 2px; }
    .print-tools p { margin: 0 4px; color: #526873; font-size: 12px; }
    .report-preview { overflow: auto; padding: 16px; }
    .annual-sheet { display: grid; grid-template-rows: 13mm minmax(0, 1fr) 5mm; gap: 2mm; width: 285mm; height: 196mm; margin: 0 auto; padding: 0; background: #fff; box-shadow: 0 8px 28px #17364622; }
    .annual-header { display: flex; align-items: center; justify-content: space-between; gap: 5mm; padding: 0 2.6mm; border-bottom: .65mm solid var(--gold); border-radius: 1.3mm 1.3mm 0 0; background: var(--navy); }
    .annual-header h1 { display: flex; align-items: baseline; gap: 2.1mm; margin: 0; color: #fff; font-size: 16pt; line-height: 1; white-space: nowrap; }
    .annual-header h1 span { font-weight: 750; color: var(--gold-light); }
    .annual-header p { margin: 1.15mm 0 0; color: #e3edf4; font-size: 8pt; white-space: nowrap; }
    .annual-totals { display: flex; gap: 2mm; margin: 0; text-align: center; }
    .annual-totals div { display: flex; flex-direction: column-reverse; justify-content: center; min-width: 24mm; height: 9mm; padding: .5mm .8mm; border: .22mm solid #628195; border-radius: 1mm; background: var(--navy-panel); }
    .annual-totals dt { color: #e3edf4; font-size: 6.65pt; white-space: nowrap; }
    .annual-totals dd { margin: 0; color: #fff7e6; font-size: 11pt; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.05; }
    .months { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-template-rows: repeat(3, minmax(0, 1fr)); gap: 1.6mm; min-height: 0; }
    .month { min-width: 0; min-height: 0; border: .23mm solid #bdcedb; border-radius: 1.3mm; }
    .month-header { display: flex; align-items: center; justify-content: space-between; gap: .8mm; min-height: 6.1mm; padding: .65mm 1.6mm; border-bottom: .22mm solid #bdcedb; border-radius: 1.05mm 1.05mm 0 0; background: #dce9f0; }
    .month-header h2 { margin: 0; color: var(--navy); font-size: 8.6pt; line-height: 1.1; }
    .month-count { flex: 0 0 auto; margin: 0; padding: .38mm 1mm; border-radius: .75mm; background: var(--navy-panel); color: #fff; font-size: 6.3pt; font-weight: 700; white-space: nowrap; }
    .month-periods { margin: 0; padding: .55mm 1.3mm .5mm; list-style: none; }
    .period { display: flex; align-items: center; gap: .9mm; height: 2.64mm; padding: 0 .55mm; box-shadow: inset 0 -.13mm #e8eff2; color: #1d3b49; font-size: 6.85pt; line-height: 1; white-space: nowrap; }
    .period:nth-child(even):not(.other-reference) { background: #f2f6f9; }
    .period-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
    .period-reference { flex: 0 0 auto; color: #704e21; font-size: 6.2pt; }
    .period-days { flex: 0 0 auto; min-width: 8mm; margin-left: auto; text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
    .period-partial { margin-right: 1.4mm; color: #536c7a; font-size: 6.2pt; font-weight: 400; }
    .other-reference { box-shadow: inset .48mm 0 #b18139, inset 0 -.13mm #e8eff2; background: #fbf2e3; }
    .period-more, .empty-month { margin: 0; padding: 0 .55mm; color: #4a6771; font-size: 6.6pt; line-height: 2.64mm; }
    .period-more { font-weight: 700; }
    .empty-month { margin: 1.1mm 1.3mm; }
    .annual-footer { display: flex; justify-content: space-between; align-items: center; gap: 3mm; padding: 0 1mm; border-top: .22mm solid #bdcedb; color: #425d68; font-size: 6.75pt; }
    .annual-footer p { display: flex; align-items: center; gap: 1mm; margin: 0; white-space: nowrap; }
    .legend-sample { display: inline-block; width: 2.5mm; height: 2.5mm; margin-left: 2.2mm; border-left: .55mm solid #b18139; background: #fbf2e3; }
    @media print {
      body { background: #fff; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .print-tools { display: none; }
      .report-preview { overflow: visible; padding: 0; }
      .annual-sheet { width: 100%; margin: 0; box-shadow: none; break-inside: avoid; }
    }
  `;

  function render(model) {
    const year = escapeHtml(model.year);
    const periodScope = model.includeOtherReferences
      ? 'Inclui férias de outros anos de referência' : 'Somente férias da referência ' + year;
    const legend = model.includeOtherReferences
      ? '<span class="legend-sample" aria-hidden="true"></span> Referência diferente do ano de gozo' : '';
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Planejamento anual de férias – ' + year + ' – 1º GBM</title><style>' + styles + '</style></head><body>' +
      '<nav class="print-tools" aria-label="Impressão do planejamento"><button id="annual-print" type="button">Imprimir / Salvar PDF</button>' +
      '<button id="annual-close" type="button">Fechar</button><p>A4 • Paisagem</p></nav>' +
      '<div class="report-preview"><main class="annual-sheet" aria-labelledby="annual-title">' +
      '<header class="annual-header"><div><h1 id="annual-title">Planejamento anual de férias <span>' + year + '</span></h1>' +
      '<p>1º GBM • Ano de gozo • ' + periodScope + '</p></div>' + annualTotals(model) + '</header>' +
      '<div class="months" aria-label="Meses do ano">' + model.months.map(monthCard).join('') + '</div>' +
      '<footer class="annual-footer"><p>Dias de férias no mês. Cada período conta no mês com mais dias. “Parcial” indica contagem em outro mês.' + legend + '</p>' +
      (model.generatedAt ? '<p>Gerado em ' + escapeHtml(model.generatedAt) + '</p>' : '') + '</footer>' +
      '</main></div><script>document.getElementById("annual-print").addEventListener("click",function(){window.print()});' +
      'document.getElementById("annual-close").addEventListener("click",function(){window.close()});</script></body></html>';
  }

  window.BNXVacationAnnualReport = Object.freeze({ render });
})(window);
