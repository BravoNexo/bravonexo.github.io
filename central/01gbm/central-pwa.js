(function (window, document, navigator) {
  'use strict';
  var url;
  try { url = new URL(window.location.href); } catch (_) { return; }
  if (url.origin !== 'https://bravonexo.github.io' || url.pathname !== '/central/01gbm/' ||
      window.isSecureContext !== true || url.searchParams.has('scaleWorkspaceDate')) return;

  var buttons = Array.from(document.querySelectorAll('[data-central-pwa-install]'));
  var messages = Array.from(document.querySelectorAll('[data-central-pwa-status]'));
  var help = document.getElementById('central-pwa-help');
  var helpText = document.getElementById('central-pwa-help-text');
  var helpClose = document.getElementById('central-pwa-help-close');
  if (!buttons.length || !help || !helpText || !helpClose) return;
  var media = null, installed = false, deferred = null, busy = false, active = true, sequence = 0;
  try { media = window.matchMedia('(display-mode: standalone)'); } catch (_) {}

  function isInstalled() { return Boolean(installed || media && media.matches === true || navigator.standalone === true); }
  function closeHelp() {
    try { if (help.open && typeof help.close === 'function') help.close(); } catch (_) {}
    help.removeAttribute('open'); help.hidden = true;
  }
  function message(text) {
    messages.forEach(function (node) { node.textContent = text || ''; node.hidden = !text || isInstalled(); });
  }
  function paint() {
    var hidden = isInstalled();
    buttons.forEach(function (button) { button.hidden = hidden; button.disabled = busy || !active; button.setAttribute('aria-busy', String(busy)); });
    if (hidden) { deferred = null; closeHelp(); message(''); }
  }
  function openHelp() {
    var ios = /iPad|iPhone|iPod/.test(navigator.userAgent || '') || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    helpText.textContent = ios
      ? 'No iPhone ou iPad, abra esta Central no Safari, toque em Compartilhar e escolha Adicionar à Tela de Início. Depois, confirme em Adicionar.'
      : 'Abra o menu do navegador e procure Instalar Central, Instalar aplicativo ou Adicionar à tela inicial. Se essa opção não aparecer, continue usando a Central normalmente pelo navegador.';
    help.hidden = false;
    try {
      if (typeof help.showModal === 'function') { if (!help.open) help.showModal(); }
      else help.setAttribute('open', '');
    } catch (_) { help.hidden = true; message('Use o menu do navegador para instalar a Central.'); }
  }
  async function install() {
    if (!active || busy || isInstalled()) return;
    var selected = deferred;
    if (!selected) { openHelp(); return; }
    deferred = null; busy = true; var own = ++sequence; message(''); paint();
    try {
      await selected.prompt();
      var choice = await selected.userChoice;
      if (!active || own !== sequence || isInstalled()) return;
      message(choice && choice.outcome === 'accepted'
        ? 'Conclua a instalação na janela do navegador.'
        : 'Você pode instalar a Central depois pelo menu do navegador.');
    } catch (_) {
      if (active && own === sequence && !isInstalled()) message('Use o menu do navegador para instalar a Central.');
    } finally {
      if (own === sequence) { busy = false; paint(); }
    }
  }
  buttons.forEach(function (button) { button.addEventListener('click', install); });
  helpClose.addEventListener('click', closeHelp);
  help.addEventListener('cancel', function (event) { event.preventDefault(); closeHelp(); });
  help.addEventListener('close', function () { help.hidden = true; });
  window.addEventListener('beforeinstallprompt', function (event) {
    if (!active || isInstalled() || !event || typeof event.prompt !== 'function' || !event.userChoice || typeof event.userChoice.then !== 'function') return;
    event.preventDefault(); deferred = event; paint();
  });
  window.addEventListener('appinstalled', function () { installed = true; sequence++; busy = false; deferred = null; message(''); paint(); });
  window.addEventListener('pagehide', function () { active = false; sequence++; busy = false; deferred = null; closeHelp(); paint(); });
  window.addEventListener('pageshow', function () { active = true; paint(); });
  if (media) {
    if (typeof media.addEventListener === 'function') media.addEventListener('change', paint);
    else if (typeof media.addListener === 'function') media.addListener(paint);
  }
  paint();
  if ('serviceWorker' in navigator) {
    Promise.resolve().then(function () {
      return navigator.serviceWorker.register('/central/01gbm/sw.js', { scope: '/central/01gbm/', updateViaCache: 'none' });
    }).catch(function () {});
  }
})(window, document, navigator);
