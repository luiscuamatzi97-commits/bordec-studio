/* Safety net: if the page code never starts (old phone, in-app browser, a file that did not download),
   swap the endless loader for a clear message and a retry button. Plain ES5 on purpose. */
(function () {
  var shown = false;
  function show(reason) {
    if (shown || window.__bordecBoot) return;
    shown = true;
    var box = document.querySelector('.loader');
    if (!box) return;
    box.removeAttribute('aria-hidden');
    box.className += ' loader-fail';
    box.innerHTML =
      '<div class="loader-msg" role="alert">' +
        '<span class="loader-mark">Bordec Studio</span>' +
        '<p>' + (reason === 'slow'
          ? 'La página está tardando más de lo normal. Puede ser la conexión.'
          : 'No pudimos abrir la página en este navegador.') + '</p>' +
        '<button type="button" class="loader-btn">Reintentar</button>' +
        '<p class="loader-hint">Si la abriste desde WhatsApp, Instagram o Facebook, toca los tres puntos y elige «Abrir en el navegador».</p>' +
      '</div>';
    box.querySelector('.loader-btn').onclick = function () { location.reload(); };
  }
  // a page script that failed to download
  window.addEventListener('error', function (e) {
    var t = e && e.target;
    if (t && t.tagName === 'SCRIPT') setTimeout(function () { show('error'); }, 300);
  }, true);
  // the page code could not run in this browser
  window.addEventListener('error', function () { setTimeout(function () { if (!window.__bordecBoot) show('error'); }, 1500); });
  setTimeout(function () { show('slow'); }, 15000);
})();
