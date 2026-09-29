const title = document.querySelector('#title');
const status = document.querySelector('#status');
const content = document.querySelector('#content');
const openOriginal = document.querySelector('#openOriginal');
const errorText = error => String(error?.message || error).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
openOriginal.addEventListener('click', async () => {
  try { await window.psyPreview.openOriginal(); }
  catch (error) { status.hidden = false; status.textContent = errorText(error); }
});
window.psyPreview.getData().then(async data => {
  window.psyI18n.setLanguage(data.language);
  document.title = `${data.title} — Preview`;
  title.textContent = data.title;
  openOriginal.hidden = data.kind === 'missing';
  status.hidden = true;
  let element;
  if (data.kind === 'text') {
    element = document.createElement('pre');
    element.setAttribute('translate', 'no');
    element.textContent = data.content;
    status.textContent = 'Text preview shows up to the first 24,000 characters.';
    status.hidden = false;
  } else if (['image', 'audio', 'video'].includes(data.kind)) {
    element = document.createElement(data.kind === 'image' ? 'img' : data.kind);
    if (data.kind === 'image') element.alt = data.title;
    else element.controls = true;
    element.src = data.fileUrl;
    element.addEventListener('error', () => { status.hidden = false; status.textContent = 'This media could not be displayed. Try Open with Windows.'; });
  } else if (data.kind === 'pdf') {
    try { await window.startPdfReader(data); return; }
    catch { status.hidden = false; status.textContent = 'PDF preview unavailable. Try Open with Windows.'; return; }
  } else if (data.kind === 'url' && data.url) {
    openOriginal.textContent = 'Open in browser';
    status.hidden = false;
    status.textContent = 'Websites open in your browser to keep web content separate from your library.';
    element = document.createElement('p');
    element.setAttribute('translate', 'no');
    element.textContent = data.url;
  } else {
    status.hidden = false;
    status.textContent = data.kind === 'missing' ? 'The file is missing or this entry has no attached file to preview.' : `This format cannot be previewed here. ${data.helper?.reason || 'Try opening it with Windows.'}`;
  }
  if (element) content.append(element);
}).catch(error => { status.hidden = false; status.textContent = errorText(error); });
window.psyPreview.onLanguageChange(language => window.psyI18n.setLanguage(language));
