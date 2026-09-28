'use strict';

// Confirmación de acciones destructivas con <dialog> propio.
// (El CSP con script-src 'self' bloquea los handlers inline tipo onsubmit,
// por eso la confirmación vive aquí y no en el HTML.)
(function () {
  const dialog = document.getElementById('confirm-dialog');
  if (!dialog) return;

  let pendingForm = null;

  document.querySelectorAll('form[data-confirm]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      if (form.dataset.confirmed === 'true') return;
      e.preventDefault();
      pendingForm = form;
      dialog.querySelector('p').textContent = form.dataset.confirm;
      dialog.showModal();
    });
  });

  dialog.querySelector('[data-action="cancel"]').addEventListener('click', () => {
    pendingForm = null;
    dialog.close();
  });

  dialog.querySelector('[data-action="accept"]').addEventListener('click', () => {
    if (pendingForm) {
      pendingForm.dataset.confirmed = 'true';
      pendingForm.requestSubmit();
    }
    dialog.close();
  });
})();
