(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BNXDriverHistoryClient = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  var PROJECT_ORIGIN = 'https://ciqctdckqmopdeoigzfz.supabase.co';
  var RPC_PATH = '/rest/v1/rpc/central_driver_history_read_v1';
  var PAGE_SIZE = 100, MAX_PAGE_BYTES = 8 * 1024 * 1024;
  var MAX_TOTAL_BYTES = 40 * 1024 * 1024, MAX_RECORDS = 50000;
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  var ROOT_KEYS = ['version', 'kind', 'unitCode', 'unitName', 'generatedAt', 'startDate', 'endDate', 'includeAdministrative', 'snapshot', 'total', 'firstOccurredAt', 'lastOccurredAt', 'counts', 'entries', 'nextCursor'];
  var ENTRY_KEYS = ['id', 'tipo', 'ocorridoEm', 'registradoEm', 'dataServico', 'prefixo', 'descricaoViatura', 'autor', 'funcao', 'origem', 'condutor', 'litros', 'valorCentavos', 'km', 'justificativaKm', 'destinoFornecedor', 'resultado', 'observacoes', 'situacao', 'observacaoHistorico'];
  var INVALID = 'Não foi possível conferir todos os lançamentos. Nenhum PDF parcial foi criado.';
  var LARGE = 'O histórico é grande para gerar de uma só vez. Reduza o período e gere novamente. Nenhum PDF parcial foi criado.';
  var DENIED = 'Seu acesso não permite consultar este relatório. Consulte a administração da Central.';
  var AUTH = 'Não foi possível confirmar sua sessão. Entre novamente na Central antes de gerar o relatório.';
  var STALE = 'A sessão ou o acesso mudou durante a consulta. Abra o relatório novamente.';
  function failure(code, message) { return Object.assign(new Error(message || INVALID), { code: code }); }
  function need(value, code, message) { if (!value) throw failure(code || 'DRIVER_HISTORY_INVALID', message); }
  function exact(value, keys) { return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(function (key) { return Object.hasOwn(value, key); }); }
  function civil(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  // A Date only keeps milliseconds. Keep the original strings for RPC cursors,
  // and compare their UTC microsecond keys without discarding the final digits.
  function instantKey(value) {
    var match = typeof value === 'string' && /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(?:Z|\+00:00)$/.exec(value);
    need(match && civil(match[1]) && +match[2] <= 23 && +match[3] <= 59 && +match[4] <= 59 && Number.isFinite(Date.parse(value)));
    return match[1] + 'T' + match[2] + ':' + match[3] + ':' + match[4] + '.' + (match[5] || '').padEnd(6, '0') + 'Z';
  }
  function text(value, max, nullable, empty) {
    if (value === null && nullable) return;
    need(typeof value === 'string' && value.length <= max && (empty || value.trim().length > 0) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(value) && !/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(value));
  }
  function integer(value, maximum) { need(Number.isSafeInteger(value) && value >= 0 && value <= maximum); }
  function decimal(value) { if (value !== null) need(typeof value === 'string' && /^[0-9]{1,20}(?:\.[0-9]{1,6})?$/.test(value)); }
  function bytes(value) {
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(value).byteLength;
    var total = 0;
    for (var char of value) { var point = char.codePointAt(0); total += point < 128 ? 1 : point < 2048 ? 2 : point < 65536 ? 3 : 4; }
    return total;
  }
  function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
  function rowKey(row) { return instantKey(row.ocorridoEm) + '|' + row.id.toLowerCase(); }
  function metadata(page) {
    return JSON.stringify([page.version, page.kind, page.unitCode, page.unitName, page.generatedAt, page.startDate, page.endDate, page.includeAdministrative,
      page.snapshot.at, page.snapshot.maxSequence, page.total, page.firstOccurredAt, page.lastOccurredAt,
      page.counts.map(function (count) { return [count.tipo, count.total]; }).sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; })]);
  }
  function validateFilters(raw) {
    need(exact(raw, ['startDate', 'endDate', 'includeAdministrative']), 'DRIVER_HISTORY_FILTERS_INVALID', 'Confira o período do relatório.');
    need((raw.startDate === null || civil(raw.startDate)) && civil(raw.endDate) && (raw.startDate === null || raw.startDate <= raw.endDate) && typeof raw.includeAdministrative === 'boolean', 'DRIVER_HISTORY_FILTERS_INVALID', 'Confira o período do relatório.');
    return { startDate: raw.startDate, endDate: raw.endDate, includeAdministrative: raw.includeAdministrative };
  }
  function validatePage(page, filters, pageSize) {
    need(exact(page, ROOT_KEYS) && page.version === 1 && page.kind === 'CENTRAL_DRIVER_HISTORY_PAGE' && page.unitCode === '01gbm' && page.unitName === '1º GBM');
    instantKey(page.generatedAt);
    need(page.startDate === filters.startDate && page.endDate === filters.endDate && page.includeAdministrative === filters.includeAdministrative);
    need(exact(page.snapshot, ['at', 'maxSequence'])); instantKey(page.snapshot.at); integer(page.snapshot.maxSequence, Number.MAX_SAFE_INTEGER);
    integer(page.total, Number.MAX_SAFE_INTEGER);
    need(page.total <= MAX_RECORDS, 'DRIVER_HISTORY_LIMIT', LARGE);
    need(Array.isArray(page.counts) && page.counts.length <= 256 && Array.isArray(page.entries) && page.entries.length <= pageSize);
    var total = 0, kinds = new Set();
    page.counts.forEach(function (count) {
      need(exact(count, ['tipo', 'total']) && typeof count.tipo === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(count.tipo) && !kinds.has(count.tipo));
      integer(count.total, MAX_RECORDS); kinds.add(count.tipo); total += count.total;
      need(filters.includeAdministrative || count.tipo !== 'MOV_ADMINISTRATIVA');
    });
    need(total === page.total);
    if (page.total === 0) need(page.firstOccurredAt === null && page.lastOccurredAt === null && page.entries.length === 0 && page.nextCursor === null);
    else need(page.firstOccurredAt !== null && page.lastOccurredAt !== null && instantKey(page.firstOccurredAt) <= instantKey(page.lastOccurredAt) && instantKey(page.lastOccurredAt) <= instantKey(page.snapshot.at));
    var previous = null;
    page.entries.forEach(function (row) {
      need(exact(row, ENTRY_KEYS) && typeof row.id === 'string' && UUID.test(row.id) && typeof row.tipo === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(row.tipo) && kinds.has(row.tipo));
      var occurred = instantKey(row.ocorridoEm); instantKey(row.registradoEm); need(civil(row.dataServico));
      need(occurred <= instantKey(page.snapshot.at) && occurred >= instantKey(page.firstOccurredAt) && occurred <= instantKey(page.lastOccurredAt));
      // Date selection is civil Brasília time; dataServico remains the 08h cycle.
      var day = new Date(Date.parse(row.ocorridoEm) - 10800000).toISOString().slice(0, 10);
      need(day <= filters.endDate && (filters.startDate === null || day >= filters.startDate) && (filters.includeAdministrative || row.tipo !== 'MOV_ADMINISTRATIVA'));
      text(row.prefixo, 200, true, true); text(row.descricaoViatura, 1000, true, true); text(row.autor, 500, false, false);
      text(row.funcao, 200, true, true); text(row.origem, 500, true, true); text(row.condutor, 500, true, true);
      decimal(row.litros); decimal(row.km); if (row.valorCentavos !== null) integer(row.valorCentavos, Number.MAX_SAFE_INTEGER);
      text(row.justificativaKm, 2000, true, true); text(row.destinoFornecedor, 2000, true, true); text(row.resultado, 500, true, true);
      text(row.observacoes, 40000, true, true); text(row.situacao, 200, true, true); text(row.observacaoHistorico, 4000, true, true);
      var key = rowKey(row); need(previous === null || key < previous); previous = key;
    });
    if (page.nextCursor !== null) {
      need(exact(page.nextCursor, ['occurredAt', 'id']) && page.entries.length > 0 && typeof page.nextCursor.id === 'string' && UUID.test(page.nextCursor.id));
      instantKey(page.nextCursor.occurredAt);
      var last = page.entries[page.entries.length - 1];
      need(page.nextCursor.id === last.id && page.nextCursor.occurredAt === last.ocorridoEm);
    }
    return page;
  }
  function createDriverHistoryReportClient(options) {
    options = options || {};
    var url;
    try { url = new URL(options.supabaseUrl); } catch (_) { throw failure('DRIVER_HISTORY_CONFIG_INVALID', INVALID); }
    need(url.origin === PROJECT_ORIGIN && (url.pathname === '' || url.pathname === '/') && !url.search && !url.hash && !url.username && !url.password, 'DRIVER_HISTORY_CONFIG_INVALID');
    need(typeof options.publishableKey === 'string' && /^sb_publishable_[A-Za-z0-9_-]{16,256}$/.test(options.publishableKey), 'DRIVER_HISTORY_CONFIG_INVALID');
    var fetchImpl = options.fetchImpl || (typeof fetch === 'function' && fetch.bind(globalThis));
    var getAccessToken = options.getAccessToken, getGeneration = options.getGeneration, getActorId = options.getActorId, canRead = options.canRead;
    var timeoutMs = options.timeoutMs === undefined ? 30000 : options.timeoutMs;
    var setTimer = options.setTimer || setTimeout, clearTimer = options.clearTimer || clearTimeout;
    need([fetchImpl, getAccessToken, getGeneration, getActorId, canRead, setTimer, clearTimer].every(function (fn) { return typeof fn === 'function'; }) && Number.isSafeInteger(timeoutMs) && timeoutMs >= 100 && timeoutMs <= 60000, 'DRIVER_HISTORY_CONFIG_INVALID');
    var disposed = false, running = null;
    function fence(owner) {
      need(!disposed && running === owner && !owner.controller.signal.aborted, 'DRIVER_HISTORY_CANCELLED', 'Geração cancelada.');
      need(getGeneration() === owner.generation && getActorId() === owner.actor && canRead() === true, 'DRIVER_HISTORY_STALE', STALE);
    }
    async function readPage(body, owner) {
      fence(owner);
      var controller = new AbortController(), timedOut = false;
      var relay = function () { controller.abort(); };
      owner.controller.signal.addEventListener('abort', relay, { once: true });
      var timer = setTimer(function () { timedOut = true; controller.abort(); }, timeoutMs);
      var abortReject, abortPromise = new Promise(function (_, reject) { abortReject = function () { reject(failure(timedOut ? 'DRIVER_HISTORY_TIMEOUT' : 'DRIVER_HISTORY_CANCELLED', timedOut ? 'A consulta demorou mais que o esperado. Tente gerar o relatório novamente.' : 'Geração cancelada.')); }; controller.signal.addEventListener('abort', abortReject, { once: true }); });
      var task = async function () {
        var token = await getAccessToken(); fence(owner);
        need(!controller.signal.aborted, 'DRIVER_HISTORY_CANCELLED', 'Geração cancelada.');
        need(typeof token === 'string' && token.length <= 16384 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token), 'DRIVER_HISTORY_AUTH', AUTH);
        var response = await fetchImpl(PROJECT_ORIGIN + RPC_PATH, {
          method: 'POST', headers: { apikey: options.publishableKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(body), credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal
        });
        token = null; fence(owner);
        need(response && typeof response.text === 'function' && Number.isInteger(response.status), 'DRIVER_HISTORY_UNAVAILABLE', INVALID);
        if (response.status === 401) throw failure('DRIVER_HISTORY_AUTH', AUTH);
        if (response.status === 403) throw failure('DRIVER_HISTORY_DENIED', DENIED);
        var length = response.headers && typeof response.headers.get === 'function' ? response.headers.get('content-length') : null;
        if (length !== null && /^\d+$/.test(length)) need(Number(length) <= MAX_PAGE_BYTES, 'DRIVER_HISTORY_LIMIT', LARGE);
        var raw, size = 0;
        if (response.body && typeof response.body.getReader === 'function' && typeof TextDecoder === 'function') {
          var reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true }), pieces = [], complete = false, readerCancelled = false;
          var cancelReader = function () { if (!readerCancelled) { readerCancelled = true; try { Promise.resolve(reader.cancel()).catch(function () {}); } catch (_) {} } };
          controller.signal.addEventListener('abort', cancelReader, { once: true });
          if (controller.signal.aborted) cancelReader();
          try {
            for (;;) {
              var chunk = await reader.read(); fence(owner);
              need(!controller.signal.aborted, 'DRIVER_HISTORY_CANCELLED', 'Geração cancelada.');
              if (chunk.done) { complete = true; break; }
              need(chunk.value instanceof Uint8Array, 'DRIVER_HISTORY_INVALID');
              size += chunk.value.byteLength; need(size <= MAX_PAGE_BYTES, 'DRIVER_HISTORY_LIMIT', LARGE);
              pieces.push(decoder.decode(chunk.value, { stream: true }));
            }
            pieces.push(decoder.decode()); raw = pieces.join('');
          } finally {
            controller.signal.removeEventListener('abort', cancelReader);
            if (!complete) cancelReader();
            try { reader.releaseLock(); } catch (_) {}
          }
        } else {
          raw = await response.text(); fence(owner);
          need(typeof raw === 'string', 'DRIVER_HISTORY_INVALID');
          size = bytes(raw); need(size <= MAX_PAGE_BYTES, 'DRIVER_HISTORY_LIMIT', LARGE);
        }
        var value; try { value = JSON.parse(raw); } catch (_) { throw failure('DRIVER_HISTORY_INVALID', INVALID); }
        if (!response.ok) {
          if (value && value.code === '42501') throw failure('DRIVER_HISTORY_DENIED', DENIED);
          throw failure('DRIVER_HISTORY_UNAVAILABLE', 'Não foi possível consultar o histórico agora. Tente gerar o relatório novamente.');
        }
        return { value: value, bytes: size };
      };
      try { return await Promise.race([task(), abortPromise]); }
      catch (error) {
        if (error && /^DRIVER_HISTORY_/.test(error.code || '')) throw error;
        if (controller.signal.aborted) throw failure(timedOut ? 'DRIVER_HISTORY_TIMEOUT' : 'DRIVER_HISTORY_CANCELLED', timedOut ? 'A consulta demorou mais que o esperado. Tente gerar o relatório novamente.' : 'Geração cancelada.');
        throw failure('DRIVER_HISTORY_UNAVAILABLE', 'Não foi possível consultar o histórico agora. Tente gerar o relatório novamente.');
      } finally {
        clearTimer(timer); owner.controller.signal.removeEventListener('abort', relay); controller.signal.removeEventListener('abort', abortReject);
      }
    }
    async function readAll(rawFilters, readOptions) {
      readOptions = readOptions || {};
      need(!disposed, 'DRIVER_HISTORY_CANCELLED', 'Geração cancelada.');
      need(running === null, 'DRIVER_HISTORY_BUSY', 'Outra consulta deste relatório está em andamento.');
      var filters = validateFilters(rawFilters), actor = getActorId();
      need(canRead() === true && typeof actor === 'string' && UUID.test(actor), 'DRIVER_HISTORY_DENIED', DENIED);
      need(readOptions.signal === undefined || readOptions.signal && typeof readOptions.signal.addEventListener === 'function', 'DRIVER_HISTORY_CONFIG_INVALID');
      need(readOptions.onProgress === undefined || typeof readOptions.onProgress === 'function', 'DRIVER_HISTORY_CONFIG_INVALID');
      var owner = { generation: getGeneration(), actor: actor, controller: new AbortController() }, signal = readOptions.signal;
      var relay = function () { owner.controller.abort(); };
      running = owner;
      if (signal) { signal.addEventListener('abort', relay, { once: true }); if (signal.aborted) owner.controller.abort(); }
      var first = null, constant = null, cursor = null, rows = [], ids = new Set(), previous = null, totalBytes = 0, pages = 0;
      try {
        do {
          fence(owner);
          var body = { p_start_date: filters.startDate, p_end_date: filters.endDate, p_include_administrative: filters.includeAdministrative, p_page_size: PAGE_SIZE,
            p_snapshot: first ? first.snapshot : null, p_before_em: cursor ? cursor.occurredAt : null, p_before_id: cursor ? cursor.id : null };
          var result = await readPage(body, owner); fence(owner);
          totalBytes += result.bytes; need(totalBytes <= MAX_TOTAL_BYTES, 'DRIVER_HISTORY_LIMIT', LARGE);
          var page = validatePage(result.value, filters, PAGE_SIZE);
          if (!first) { first = page; constant = metadata(page); }
          else need(metadata(page) === constant);
          page.entries.forEach(function (row) {
            var key = rowKey(row); need(!ids.has(row.id.toLowerCase()) && (previous === null || key < previous));
            ids.add(row.id.toLowerCase()); rows.push(row); previous = key;
          });
          pages++;
          need(rows.length <= first.total && rows.length <= MAX_RECORDS && (page.nextCursor === null ? rows.length === first.total : page.entries.length > 0 && rows.length < first.total));
          if (page.nextCursor !== null && cursor) need(instantKey(page.nextCursor.occurredAt) + '|' + page.nextCursor.id.toLowerCase() < instantKey(cursor.occurredAt) + '|' + cursor.id.toLowerCase());
          cursor = page.nextCursor;
          if (readOptions.onProgress) readOptions.onProgress(Object.freeze({ loaded: rows.length, total: first.total, pages: pages }));
          fence(owner);
        } while (cursor !== null);
        var counts = new Map(); rows.forEach(function (row) { counts.set(row.tipo, (counts.get(row.tipo) || 0) + 1); });
        need(first.counts.every(function (count) { return count.total === (counts.get(count.tipo) || 0); }));
        if (rows.length) need(instantKey(rows[0].ocorridoEm) === instantKey(first.lastOccurredAt) && instantKey(rows[rows.length - 1].ocorridoEm) === instantKey(first.firstOccurredAt));
        fence(owner);
        return freeze(Object.assign({}, first, { entries: rows, nextCursor: null }));
      } finally {
        if (signal) signal.removeEventListener('abort', relay);
        if (running === owner) running = null;
      }
    }
    return Object.freeze({ readAll: readAll, dispose: function () { disposed = true; if (running) running.controller.abort(); } });
  }
  return Object.freeze({ createDriverHistoryReportClient: createDriverHistoryReportClient, validatePage: validatePage, validateFilters: validateFilters, PAGE_SIZE: PAGE_SIZE });
});

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BNXDriverHistoryReportV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const PDF_VENDOR = './vendor/pdf-lib-1.17.1.min.js?v=0f9a5cad07941f082658';
  const PDF_BUILDER = './driver-history-pdf.js?v=946d09d73ff20425c136';
  function today(now) { return new Date(now - 10800000).toISOString().slice(0, 10); }
  function civil(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const dt = new Date(value + 'T12:00:00Z');
    return Number.isFinite(dt.getTime()) && dt.toISOString().slice(0, 10) === value;
  }
  function mount(options) {
    const env = options.environment || window, doc = options.document || env.document;
    const trigger = doc.getElementById('vehicles-driver-report');
    if (!trigger) return { setReady() {}, dispose() {} };
    function rootClient() { return env.BNXDriverHistoryClient?.createDriverHistoryReportClient; }
    const createClient = rootClient();
    if (typeof createClient !== 'function') { trigger.disabled = true; return { setReady() {}, dispose() {} }; }
    const client = createClient({
      supabaseUrl: options.supabaseUrl, publishableKey: options.publishableKey,
      getAccessToken: options.getAccessToken, getGeneration: options.getGeneration,
      getActorId: options.getActorId, canRead: options.canRead,
      fetchImpl: env.fetch.bind(env), timeoutMs: 30000
    });
    let ready = false, actor = null, disposed = false, busy = false, operation = 0, controller = null, dialog = null;
    const elements = {}, loads = new Map();
    const setTimer = env.setTimeout.bind(env), clearTimer = env.clearTimeout.bind(env);
    function node(tag, text, id) {
      const value = doc.createElement(tag);
      if (text !== undefined) value.textContent = text;
      if (id) value.id = id;
      return value;
    }
    function message(text, error) {
      if (!elements.status) return;
      elements.status.textContent = text;
      elements.status.className = error ? 'decision-error' : 'driver-history-status';
      elements.status.setAttribute('role', error ? 'alert' : 'status');
    }
    function update() {
      trigger.disabled = !ready || disposed || busy;
      if (!dialog) return;
      for (const field of [elements.from, elements.to, elements.administrative]) field.disabled = busy;
      elements.generate.disabled = !ready || disposed || busy;
      elements.generate.textContent = busy ? 'Gerando PDF…' : 'Gerar e baixar PDF';
    }
    function stop() {
      operation++;
      if (controller) controller.abort();
      controller = null; busy = false;
    }
    function close() {
      stop();
      if (dialog) dialog.hidden = true;
      message('', false); update();
      trigger.focus?.();
    }
    function buildDialog() {
      if (dialog) return;
      const style = node('style');
      style.textContent = '.driver-history-card{max-width:630px;width:calc(100% - 28px)}.driver-history-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.driver-history-card .field{min-width:0}.driver-history-check{display:flex;gap:9px;align-items:flex-start;margin:18px 0 0;font-size:14px;line-height:1.5}.driver-history-check input{margin-top:4px}.driver-history-status{margin:15px 0 0;color:#315970;font-size:14px;line-height:1.5;overflow-wrap:anywhere}.driver-history-card .decision-body>p{font-size:14px;line-height:1.55;margin:0 0 18px;color:#4b6575}.driver-history-card[hidden],.driver-history-modal[hidden]{display:none!important}@media(max-width:500px){.driver-history-grid{grid-template-columns:1fr;gap:12px}}';
      (doc.head || doc.body).appendChild(style);
      dialog = node('div', undefined, 'vehicle-driver-report-dialog');
      dialog.className = 'decision-backdrop driver-history-modal';
      dialog.hidden = true; dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'vehicle-driver-report-title');
      const card = node('div'); card.className = 'decision-card driver-history-card';
      const head = node('div'); head.className = 'decision-head';
      head.appendChild(node('strong', 'Relatório do Encarregado de Motoristas', 'vehicle-driver-report-title'));
      head.appendChild(node('span', 'Histórico de lançamentos do Gestão de Serviço.'));
      const body = node('div'); body.className = 'decision-body';
      body.appendChild(node('p', 'Inclui abastecimentos, condições, manutenções, colisões e demais lançamentos, com data, viatura e responsável. Deixe a data inicial em branco para incluir todo o histórico.'));
      const grid = node('div'); grid.className = 'driver-history-grid';
      for (const [key, label, id] of [['from', 'De (opcional)', 'vehicle-driver-report-from'], ['to', 'Até', 'vehicle-driver-report-to']]) {
        const field = node('div'); field.className = 'field';
        const caption = node('label', label); caption.setAttribute('for', id);
        const input = node('input', undefined, id); input.type = 'date'; input.autocomplete = 'off';
        field.appendChild(caption); field.appendChild(input); grid.appendChild(field); elements[key] = input;
      }
      elements.to.value = today(Date.now());
      body.appendChild(grid);
      const check = node('label'); check.className = 'driver-history-check';
      const checkbox = node('input', undefined, 'vehicle-driver-report-administrative');
      checkbox.type = 'checkbox'; checkbox.checked = true; elements.administrative = checkbox;
      check.appendChild(checkbox);
      check.appendChild(node('span', 'Incluir movimentações administrativas, em seção separada.'));
      body.appendChild(check);
      elements.status = node('p', '', 'vehicle-driver-report-status');
      elements.status.setAttribute('aria-live', 'polite'); body.appendChild(elements.status);
      const footer = node('div'); footer.className = 'decision-footer';
      const cancel = node('button', 'Fechar'); cancel.type = 'button'; cancel.className = 'secondary';
      const generate = node('button', 'Gerar e baixar PDF', 'vehicle-driver-report-generate');
      generate.type = 'button'; generate.className = 'primary'; elements.generate = generate;
      footer.appendChild(cancel); footer.appendChild(generate);
      card.appendChild(head); card.appendChild(body); card.appendChild(footer); dialog.appendChild(card);
      doc.body.appendChild(dialog);
      cancel.addEventListener('click', close);
      generate.addEventListener('click', () => { void generatePdf(); });
      dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
      dialog.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); close(); } });
    }
    function scopeIsCurrent(expected) {
      return !disposed && ready && actor === expected.actor && options.getActorId() === expected.actor &&
        options.getGeneration() === expected.generation && operation === expected.operation &&
        options.canRead() === true && !expected.signal.aborted;
    }
    function loadScript(path) {
      if (loads.has(path)) return loads.get(path);
      const promise = new Promise((resolve, reject) => {
        const script = node('script'), url = new URL(path, env.location.href);
        if (url.origin !== env.location.origin) { reject(new Error('Não foi possível preparar o gerador de PDF.')); return; }
        const timer = setTimer(() => { script.remove(); reject(new Error('Não foi possível carregar o gerador de PDF. Tente novamente.')); }, 30000);
        script.async = true; script.src = url.href;
        script.addEventListener('load', () => { clearTimer(timer); resolve(); }, { once: true });
        script.addEventListener('error', () => { clearTimer(timer); script.remove(); reject(new Error('Não foi possível carregar o gerador de PDF. Tente novamente.')); }, { once: true });
        (doc.head || doc.body).appendChild(script);
      });
      loads.set(path, promise);
      promise.catch(() => { loads.delete(path); });
      return promise;
    }
    async function generatePdf() {
      if (!ready || disposed || busy || options.canRead() !== true) return;
      const filters = { startDate: elements.from.value || null, endDate: elements.to.value, includeAdministrative: elements.administrative.checked };
      if (filters.startDate !== null && !civil(filters.startDate) || !civil(filters.endDate)) { message('Confira as datas do relatório.', true); return; }
      if (filters.startDate && filters.startDate > filters.endDate) { message('A data inicial deve ser anterior ou igual à data final.', true); return; }
      if (filters.endDate > today(Date.now())) { message('A data final não pode estar no futuro.', true); return; }
      busy = true; operation++;
      controller = new env.AbortController();
      const expected = { actor, generation: options.getGeneration(), operation, signal: controller.signal };
      update(); message('Consultando os lançamentos do Encarregado…', false);
      try {
        const report = await client.readAll(filters, {
          signal: expected.signal,
          onProgress(value) { if (scopeIsCurrent(expected)) message('Consultando lançamentos: ' + value.loaded + (Number.isSafeInteger(value.total) ? ' de ' + value.total : '') + '…', false); }
        });
        if (!scopeIsCurrent(expected)) return;
        message('Preparando o arquivo PDF…', false);
        await loadScript(PDF_VENDOR);
        if (!scopeIsCurrent(expected)) return;
        await loadScript(PDF_BUILDER);
        if (!scopeIsCurrent(expected)) return;
        if (typeof env.BNXDriverHistoryPdf?.buildDriverHistoryPdf !== 'function') throw new Error('Não foi possível preparar o gerador de PDF.');
        const bytes = await env.BNXDriverHistoryPdf.buildDriverHistoryPdf(report, { PDFLib: env.PDFLib });
        if (!scopeIsCurrent(expected)) return;
        if (!(bytes instanceof Uint8Array) || bytes.byteLength < 100) throw new Error('O PDF não foi concluído. Nenhum arquivo parcial foi baixado.');
        const blob = new env.Blob([bytes], { type: 'application/pdf' }), url = env.URL.createObjectURL(blob);
        const link = node('a'); link.href = url;
        link.download = 'Encarregado de Motoristas - ' + (filters.startDate ? filters.startDate + ' a ' : 'Historico ate ') + filters.endDate + '.pdf';
        link.hidden = true; doc.body.appendChild(link); link.click(); link.remove();
        setTimer(() => env.URL.revokeObjectURL(url), 60000);
        message('PDF gerado com ' + report.entries.length + ' lançamento(s). O download foi iniciado.', false);
      } catch (error) {
        if (!scopeIsCurrent(expected)) return;
        message(error && error.message || 'Não foi possível gerar o PDF. Nenhum lançamento foi alterado.', true);
      } finally {
        if (operation === expected.operation) { controller = null; busy = false; update(); }
      }
    }
    function open() {
      if (!ready || disposed || options.canRead() !== true) return;
      buildDialog(); dialog.hidden = false; update(); elements.from.focus?.();
    }
    function onPageHide() { stop(); if (dialog) dialog.hidden = true; message('', false); update(); }
    env.addEventListener?.('pagehide', onPageHide);
    trigger.addEventListener('click', open);
    trigger.disabled = true;
    return Object.freeze({
      setReady(value) {
        const nextReady = value?.ready === true && typeof value.actorId === 'string' && value.actorId.length > 0;
        const changed = actor !== value?.actorId;
        if (!nextReady || changed) {
          stop();
          if (dialog) { dialog.hidden = true; message('', false); }
          if (changed && elements.from) { elements.from.value = ''; elements.to.value = today(Date.now()); elements.administrative.checked = true; }
        }
        ready = nextReady; actor = nextReady ? value.actorId : null; update();
      },
      dispose() {
        if (disposed) return; stop(); disposed = true; ready = false;
        trigger.removeEventListener('click', open); env.removeEventListener?.('pagehide', onPageHide); trigger.disabled = true;
        client.dispose(); dialog?.remove();
      }
    });
  }
  return Object.freeze({ mount, civil, today });
});
