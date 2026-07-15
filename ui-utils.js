// ---------- ui-utils.js ----------
// Small reusable UI primitives shared by exercise-picker.js and workout-builder.js:
// toast notifications, a generic modal shell, debounce, and a couple of formatters.
// Injects its own DOM (toast stack + modal shell) so it needs no markup in index.html.
// Public API: window.UIUtils

(function () {
  const escapeHtml = window.FTCore.escapeHtml;

  // ---------- toasts ----------
  const toastStack = document.createElement('div');
  toastStack.id = 'toast-stack';
  toastStack.className = 'toast-stack';
  toastStack.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastStack);

  function toast(message, type = 'info', duration = 2600) {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    toastStack.appendChild(el);
    // rAF so the initial (offscreen) state paints before the "show" transition kicks in
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
    const remove = () => el.remove();
    setTimeout(() => {
      el.classList.remove('show');
      el.addEventListener('transitionend', remove, { once: true });
      setTimeout(remove, 400); // fallback in case transitionend never fires
    }, duration);
  }

  // ---------- generic modal shell ----------
  const modalOverlay = document.createElement('div');
  modalOverlay.id = 'generic-modal';
  modalOverlay.className = 'modal-overlay';
  modalOverlay.hidden = true;
  modalOverlay.innerHTML = `
    <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="generic-modal-title">
      <div class="modal-head">
        <h2 id="generic-modal-title"></h2>
        <button type="button" class="modal-close" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body" id="generic-modal-body"></div>
    </div>`;
  document.body.appendChild(modalOverlay);

  const modalPanel = modalOverlay.querySelector('.modal-panel');
  const modalTitleEl = modalOverlay.querySelector('#generic-modal-title');
  const modalBodyEl = modalOverlay.querySelector('#generic-modal-body');
  const modalCloseBtn = modalOverlay.querySelector('.modal-close');

  let activeOnClose = null;
  let lastFocusedBeforeModal = null;

  function focusables() {
    return Array.from(
      modalPanel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter((n) => !n.disabled && n.offsetParent !== null);
  }

  function onModalKeydown(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeModal();
      return;
    }
    if (e.key === 'Tab') {
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function openModal({ title = '', bodyHtml = '', onMount = null, onClose = null, extraClass = '' } = {}) {
    lastFocusedBeforeModal = document.activeElement;
    modalTitleEl.textContent = title;
    modalBodyEl.innerHTML = bodyHtml;
    modalPanel.className = `modal-panel${extraClass ? ' ' + extraClass : ''}`;
    modalOverlay.hidden = false;
    document.body.classList.add('modal-open');
    activeOnClose = onClose;
    document.addEventListener('keydown', onModalKeydown, true);
    if (onMount) onMount(modalBodyEl);
    const items = focusables();
    (items[0] || modalCloseBtn).focus();
  }

  function closeModal() {
    if (modalOverlay.hidden) return;
    modalOverlay.hidden = true;
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', onModalKeydown, true);
    modalBodyEl.innerHTML = '';
    const cb = activeOnClose;
    activeOnClose = null;
    if (cb) cb();
    if (lastFocusedBeforeModal && lastFocusedBeforeModal.focus) lastFocusedBeforeModal.focus();
  }

  modalCloseBtn.addEventListener('click', closeModal);
  modalOverlay.addEventListener('mousedown', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  // ---------- misc helpers ----------
  function debounce(fn, wait = 80) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function formatMMSS(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  }

  function highlightMatch(name, query) {
    if (!query) return escapeHtml(name);
    const idx = name.toLowerCase().indexOf(query.trim().toLowerCase());
    if (idx === -1) return escapeHtml(name);
    const before = name.slice(0, idx);
    const match = name.slice(idx, idx + query.trim().length);
    const after = name.slice(idx + query.trim().length);
    return `${escapeHtml(before)}<mark>${escapeHtml(match)}</mark>${escapeHtml(after)}`;
  }

  window.UIUtils = {
    toast,
    openModal,
    closeModal,
    debounce,
    clamp,
    formatMMSS,
    highlightMatch,
  };
})();
