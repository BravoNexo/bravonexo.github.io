(function (window) {
  'use strict';

  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const numberFormat = new Intl.NumberFormat('pt-BR');

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => entities[character]);
  }

  function number(value) {
    return Number.isSafeInteger(value) && value >= 0 ? numberFormat.format(value) : '—';
  }

  function wingLabel(wing) {
    if (wing == null || wing === '') return 'Sem ala';
    if (/^[1-4]$/.test(String(wing))) return 'Ala ' + wing;
    return wing;
  }

  function typeLabel(kind) {
    const type = String(kind ?? '').toLowerCase();
    if (type === 'carro') return 'Carro';
    if (type === 'moto') return 'Moto';
    return '—';
  }

  function statusLabel(status) {
    const value = String(status ?? '').trim().toLowerCase();
    if (status === true || value === 'ativo' || value === 'active') return 'Ativo';
    if (status === false || value === 'inativo' || value === 'inactive') return 'Inativo';
    return status;
  }

  function cells(columns, values, tag) {
    return columns.map((column, index) => {
      const kind = column[1];
      const value = values[index];
      const content = tag === 'td' && kind === 'number' ? number(value) : escapeHtml(value || '—');
      return '<' + tag + (tag === 'th' ? ' scope="col"' : '') + (kind ? ' class="' + kind + '"' : '') +
        '>' + content + '</' + tag + '>';
    }).join('');
  }

  function tableMarkup(id, columns, rows, empty, { totals, group } = {}) {
    const headings = columns.map(column => column[0]);
    const militaryTable = id === 'military-counts';
    const withoutVehicle = ' data-without-active-vehicle';
    const body = rows.length
      ? rows.map(row => '<tr' + (militaryTable && row[4] === 0 ? withoutVehicle : '') + '>' +
        cells(columns, row, 'td') + '</tr>').join('')
      : '<tr class="empty-row"><td colspan="' + columns.length + '">' + escapeHtml(empty) + '</td></tr>';
    const groupHeader = group ? '<tr class="military-group-heading"><th scope="colgroup" colspan="' +
      columns.length + '">' + escapeHtml(group) + '</th></tr>' : '';
    const tableFilter = militaryTable && rows.length && rows.every(row => row[4] === 0) ? withoutVehicle : '';
    return '<table class="' + id + '"' + tableFilter + ' aria-labelledby="' + id + '" aria-describedby="' + id + '-description"><thead>' +
      groupHeader + '<tr>' + cells(columns, headings, 'th') + '</tr></thead><tbody>' + body +
      (totals ? '<tr class="total-row">' + cells(columns, totals, 'td') + '</tr>' : '') + '</tbody></table>';
  }

  function reportSection(id, title, description, content) {
    return '<section class="report-section"><h2 id="' + id + '">' + title + '</h2>' +
      '<p class="section-description" id="' + id + '-description">' + description + '</p>' + content + '</section>';
  }

  function forecastScenario(cars, motorcycles) {
    return number(cars) + (cars === 1 ? ' carro' : ' carros') + ' + ' +
      number(motorcycles) + (motorcycles === 1 ? ' moto' : ' motos');
  }

  function vehicleForecast(forecast, unavailable) {
    if (unavailable === true) {
      return reportSection('vehicle-forecast', 'Previsão de veículos', 'Não foi possível consultar a previsão de veículos.', '');
    }
    if (!Array.isArray(forecast)) return '';
    const columns = [['Grupo', 'align-label'], ['Militares', 'number'], ['Máximo de carros', 'forecast-scenario'],
      ['Mínimo de carros', 'forecast-scenario']];
    const hasPending = forecast.some(group => group.pending > 0);
    if (hasPending) columns.push(['A conferir', 'number']);
    const rows = forecast.map(group => {
      const row = [group.label, group.people, forecastScenario(group.maxCars, group.maxMotorcycles),
        forecastScenario(group.minCars, group.minMotorcycles)];
      if (hasPending) row.push(group.pending ?? 0);
      return row;
    });
    return reportSection('vehicle-forecast', 'Previsão de veículos',
      'Até um veículo por militar por dia. Os cenários consideram os tipos cadastrados.',
      tableMarkup('vehicle-forecast', columns, rows, 'Nenhuma previsão disponível.'));
  }

  function militaryCounts(columns, military) {
    const id = 'military-counts';
    const empty = 'Nenhum militar encontrado.';
    const sorted = tableMarkup(id, columns, military, empty);
    if (!military.length) return sorted;
    const groups = [
      ['Com veículo ativo', military.filter(row => row[4] > 0)],
      ['Sem veículo ativo', military.filter(row => row[4] === 0)]
    ];
    const grouped = groups.filter(([, rows]) => rows.length > 0).map(([label, rows]) =>
      tableMarkup(id, columns, rows, empty, { group: label + ' · ' + number(rows.length) })
    ).join('');
    const noActive = groups[0][1].length === 0
      ? '<p class="military-filter-empty">Nenhum militar com veículo ativo.</p>' : '';
    return '<div id="military-order-result"><div id="military-order-vehicle">' + grouped + '</div>' +
      '<div id="military-order-seniority" hidden>' + sorted + '</div>' + noActive + '</div>';
  }

  const styles = `
    @page { size: A4 portrait; margin: 9mm; }
    :root { --navy: #18394e; --navy-panel: #294d63; --gold: #bc9b58; --gold-light: #e4d6b7; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #edf2f5; color: #233d4e; font-family: Arial, Helvetica, sans-serif; }
    .print-tools { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 11px 20px; background: #f9fbfc; border-bottom: 1px solid #d6e1e7; }
    .print-tools button, .print-tools select { padding: 9px 13px; border: 1px solid #bfd2dc; border-radius: 6px; background: #fff; color: #24495a; font: 700 13px Arial, sans-serif; cursor: pointer; }
    .print-tools button:first-child { border-color: var(--navy); background: var(--navy); color: #fff; }
    .print-tools :is(button, select):focus-visible { outline: 2px solid #246f90; outline-offset: 2px; }
    .print-tools p { margin: 0 4px; color: #526873; font-size: 12px; }
    .print-tools label { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 5px; color: #415e6f; font-size: 13px; }
    .report-preview { overflow: auto; padding: 16px; }
    .report { width: 192mm; margin: 0 auto; background: #fff; box-shadow: 0 8px 24px #17364622; }
    .report-head { padding: 4.4mm 5mm; border-bottom: .65mm solid var(--gold); border-radius: 1.4mm 1.4mm 0 0; background: var(--navy); color: #fff; }
    .report-head h1 { margin: 0 0 1.2mm; font-size: 18pt; line-height: 1.12; }
    .report-head p { margin: 0; color: var(--gold-light); font-size: 9pt; }
    .report-content { padding: 3.4mm 4mm 5mm; }
    .report-totals { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2mm; margin: 0 0 3.5mm; break-inside: avoid; }
    .report-totals div { display: flex; flex-direction: column-reverse; align-items: flex-start; gap: .6mm; padding: 1.65mm 2.2mm; border: .22mm solid #cddbe2; background: #f0f5f8; }
    .report-totals dt { color: #415e6f; font-size: 8pt; }
    .report-totals dd { margin: 0; color: var(--navy); font-size: 13pt; font-weight: 700; line-height: 1; }
    .report-section { margin: 0 0 4.5mm; }
    .report-section h2 { margin: 0; padding: 1.65mm 2mm; background: var(--navy-panel); color: #fff; font-size: 11pt; line-height: 1.18; break-after: avoid; page-break-after: avoid; }
    .section-description { margin: 0; padding: 1mm 1.5mm; color: #4b6573; background: #f4f7f8; font-size: 8pt; break-after: avoid; page-break-after: avoid; }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 8.45pt; line-height: 1.24; }
    thead { display: table-header-group; }
    th, td { padding: 1mm 1.4mm; border: .22mm solid #cddbe2; overflow-wrap: anywhere; vertical-align: top; }
    th { background: #e6eef3; color: #294755; font-weight: 700; }
    tbody tr:nth-child(even) { background: #f5f8fa; }
    tbody tr { break-inside: avoid; page-break-inside: avoid; }
    .number { text-align: right; font-variant-numeric: tabular-nums; }
    td.number { white-space: nowrap; }
    .identifier { white-space: nowrap; font-variant-numeric: tabular-nums; }
    .align-label { font-weight: 700; }
    .total-row td { border-top: .45mm solid #b8cbd4; background: #e8f0f4; font-weight: 700; }
    td.empty-row, .empty-row td { color: #526873; text-align: center; }
    .wing-summary th:first-child { width: 24%; }
    .vehicle-forecast th:first-child { width: 24%; }
    .forecast-scenario { text-align: right; font-variant-numeric: tabular-nums; }
    td.forecast-scenario { white-space: nowrap; }
    .military-counts th[scope="col"]:first-child { width: 38%; }
    .military-counts th[scope="col"]:nth-child(2) { width: 11%; }
    .military-counts + .military-counts { margin-top: 3mm; }
    .military-counts .military-group-heading th { background: #d3e5ef; color: var(--navy); }
    #military-order-result [hidden], #military-order-result[data-active-only] [data-without-active-vehicle] { display: none !important; }
    .military-filter-empty { display: none; margin: 0; padding: 2mm; color: #526873; font-size: 8.45pt; }
    #military-order-result[data-active-only] .military-filter-empty { display: block; }
    .vehicle-list th:first-child { width: 10%; }
    .vehicle-list th:nth-child(2) { width: 10%; }
    .vehicle-list th:nth-child(3) { width: 22%; }
    .vehicle-list th:nth-child(4), .vehicle-list th:nth-child(8) { width: 9%; }
    .vehicle-list th:nth-child(5) { width: 24%; }
    .vehicle-list th:nth-child(6), .vehicle-list th:nth-child(7) { width: 8%; }
    @media print {
      body { background: #fff; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .print-tools { display: none; }
      .report-preview { padding: 0; overflow: visible; }
      .report { width: 100%; margin: 0; box-shadow: none; }
      .report-head { break-inside: avoid; }
      .report-content { padding: 3.4mm 0 0; }
    }
  `;

  function render(model) {
    const groupColumns = [['Ala', 'align-label'], ['Com veículo', 'number'], ['Carros', 'number'], ['Motos', 'number'], ['Veículos', 'number']];
    const militaryColumns = [['Militar', 'align-label'], ['RG', 'identifier'], ['Carros', 'number'], ['Motos', 'number'], ['Veículos', 'number']];
    const vehicleColumns = [['Placa', 'identifier'], ['Tipo'], ['Modelo'], ['Cor'], ['Militar', 'align-label'], ['RG', 'identifier'], ['Ala'], ['Situação']];
    const grouped = (label, item) => [label, item.withVehicle, item.cars, item.motorcycles, item.vehicleCount];
    const groups = model.groups.map(group => grouped(group.label, group));
    const military = model.military.map(row => [row.label, row.rg, row.cars, row.motorcycles, row.vehicleCount]);
    const vehicles = model.vehicles.map(row => [row.plate, typeLabel(row.kind), row.model, row.color, row.military, row.rg,
      wingLabel(row.wing), statusLabel(row.status)]);
    const summary = reportSection('wing-summary', 'Resumo por ala', 'Contagem dos veículos ativos e dos militares vinculados a eles.',
      tableMarkup('wing-summary', groupColumns, groups, 'Nenhuma ala encontrada.', {
        totals: grouped('Total', {...model.totals, withVehicle: model.linkedOwners ?? model.totals.withVehicle})
      }));
    const counts = reportSection('military-counts', 'Veículos por militar', 'Quantidades de veículos ativos por militar.',
      militaryCounts(militaryColumns, military));
    const listing = reportSection('vehicle-list', 'Relação de veículos por antiguidade',
      'Inclui cadastros ativos e inativos. Vínculos sem antiguidade disponível aparecem ao final.',
      tableMarkup('vehicle-list', vehicleColumns, vehicles, 'Nenhum veículo particular cadastrado.'));
    const totals = '<dl class="report-totals">' + [
      ['Militares no efetivo', model.totals.militaryCount],
      ['Militares com veículo ativo', model.totals.withVehicle],
      ['Veículos ativos', model.totals.vehicleCount]
    ].map(([label, value]) => '<div><dt>' + label + '</dt><dd>' + number(value) + '</dd></div>').join('') + '</dl>';

    const militaryControls = military.length ? '<label>Organizar militares por' +
      '<select id="military-order"><option value="vehicle">Com veículo primeiro</option>' +
      '<option value="seniority">Antiguidade</option></select></label>' +
      '<label>Exibir militares<select id="military-filter"><option value="all">Todos</option>' +
      '<option value="active">Com veículo ativo</option></select></label>' : '';
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Veículos particulares – 1º GBM</title><style>' + styles + '</style></head><body>' +
      '<nav class="print-tools" aria-label="Impressão do relatório"><button id="vehicles-print" type="button">Imprimir / Salvar PDF</button>' +
      '<button id="vehicles-close" type="button">Fechar</button>' + militaryControls + '<p>A4 • Retrato</p></nav>' +
      '<div class="report-preview"><main class="report" aria-labelledby="report-title"><header class="report-head">' +
      '<h1 id="report-title">Veículos particulares</h1><p>1º GBM' +
      (model.generatedAt ? ' • Gerado em ' + escapeHtml(model.generatedAt) : '') + '</p></header>' +
      '<div class="report-content">' + totals + summary + vehicleForecast(model.forecast, model.forecastUnavailable) + counts + listing + '</div></main></div>' +
      '<script>document.getElementById("vehicles-print").addEventListener("click",function(){window.print()});' +
      'document.getElementById("vehicles-close").addEventListener("click",function(){window.close()});' +
      'const order=document.getElementById("military-order");const filter=document.getElementById("military-filter");' +
      'if(order&&filter){const result=document.getElementById("military-order-result");' +
      'const description=document.getElementById("military-counts-description");const initial=description.textContent;' +
      'function updateMilitaryOptions(){const byVehicle=order.value==="vehicle";const activeOnly=filter.value==="active";' +
      'document.getElementById("military-order-vehicle").hidden=!byVehicle;' +
      'document.getElementById("military-order-seniority").hidden=byVehicle;' +
      'result.toggleAttribute("data-active-only",activeOnly);' +
      'description.textContent=activeOnly?"Somente militares com veículo ativo.":initial;}' +
      'order.addEventListener("change",updateMilitaryOptions);filter.addEventListener("change",updateMilitaryOptions);' +
      'updateMilitaryOptions();}</script></body></html>';
  }

  window.BNXPrivateVehiclesReport = Object.freeze({ render });
})(window);
