(() => {
  const api = window.psyLibrary;
  if (!api?.onFileOperation) return;
  let current;
  let dismissed;
  const panels = [];
  function createPanel(parent) {
    const panel = document.createElement('section');
    panel.className = 'file-activity';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Background activity');
    panel.innerHTML = '<strong>Background activity</strong><p class="file-activity-status" role="status" aria-live="polite"></p><progress aria-label="File operation progress"></progress><small class="file-activity-detail"></small><div class="button-row"><button type="button" class="button compact" data-file-cancel>Cancel</button><button type="button" class="button compact" data-file-dismiss>Dismiss</button></div>';
    panel.querySelector('[data-file-cancel]').addEventListener('click', async () => {
      if (!current) return;
      try { await api.cancelFileOperation(current.id); }
      catch (error) { panel.querySelector('.file-activity-detail').textContent = error.message; }
    });
    panel.querySelector('[data-file-dismiss]').addEventListener('click', () => {
      if (current?.state === 'running') return;
      dismissed = current?.id;
      render();
    });
    parent.append(panel);
    panels.push(panel);
  }
  createPanel(document.querySelector('.workspace') || document.body);
  for (const dialog of document.querySelectorAll('dialog')) createPanel(dialog.querySelector('.dialog-card') || dialog);
  const megabytes = value => (value / (1024 * 1024)).toFixed(1) + ' MB';
  function render() {
    for (const panel of panels) {
      panel.hidden = !current || dismissed === current.id;
      if (panel.hidden) continue;
      panel.dataset.state = current.state;
      panel.querySelector('.file-activity-status').textContent = `${current.label}: ${current.phase}`;
      const copying = current.state === 'running' && current.totalBytes !== undefined;
      const meter = panel.querySelector('progress');
      meter.hidden = current.state !== 'running';
      if (copying && current.totalBytes > 0) { meter.max = current.totalBytes; meter.value = current.copiedBytes || 0; }
      else meter.removeAttribute('value');
      panel.querySelector('.file-activity-detail').textContent = copying
        ? `File ${current.fileIndex || 0} of ${current.totalFiles || 0} · ${megabytes(current.copiedBytes || 0)} / ${megabytes(current.totalBytes)}${current.fileName ? ' · ' + current.fileName : ''}`
        : current.state === 'running' ? (current.cancellable ? 'You can continue browsing your library.' : 'Finishing safely. Please wait.') : '';
      panel.querySelector('[data-file-cancel]').hidden = current.state !== 'running';
      panel.querySelector('[data-file-cancel]').disabled = !current.cancellable;
      panel.querySelector('[data-file-dismiss]').hidden = current.state === 'running';
    }
  }
  function update(status) {
    if (!status || (current && status.sequence < current.sequence)) return;
    const changedToTerminal = status.state !== 'running' && (current?.state === 'running' || current?.id !== status.id);
    current = status;
    render();
    if (changedToTerminal && typeof refreshBackupStatus === 'function') refreshBackupStatus();
  }
  api.onFileOperation(update);
  api.fileOperationStatus().then(update).catch(() => {});
})();
