const api = window.psyLibrary;
api.securityStatus().then(status => window.psyI18n.setLanguage(status.language));
document.getElementById('unlockForm').addEventListener('submit', async event => {
  event.preventDefault();
  const input = document.getElementById('unlockPassword');
  const button = event.currentTarget.querySelector('button'); button.disabled = true;
  const password = input.value; input.value = '';
  try { await api.unlock(password); }
  catch (error) { document.getElementById('unlockError').textContent = String(error.message).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ''); }
  finally { button.disabled = false; input.focus(); }
});
