const title = document.querySelector('#title');
const status = document.querySelector('#status');
const content = document.querySelector('#content');
const openOriginal = document.querySelector('#openOriginal');
openOriginal.addEventListener('click', async () => {
  try { await window.psyPreview.openOriginal(); }
  catch (error) { status.hidden = false; status.textContent = error.message; }
});
window.psyPreview.getData().then(data => {
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
  } else if (data.kind === 'pdf' || (data.kind === 'url' && data.url)) {
    element = document.createElement('iframe');
    element.title = data.title;
    if (data.kind === 'url') {
      element.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
      element.referrerPolicy = 'no-referrer';
      openOriginal.textContent = 'Open in browser';
      status.hidden = false;
      status.textContent = 'Some websites block embedded previews. If the page is blank or sign-in is required, choose Open in browser.';
    }
    element.src = data.kind === 'pdf' ? data.fileUrl + (data.page ? '#page=' + data.page : '') : data.url;
    if (data.kind === 'pdf' && data.page) {
      status.hidden = false;
      status.textContent = 'PDF page ' + data.page + '. Page numbers count from the start of the file.';
    }
  } else {
    status.hidden = false;
    status.textContent = data.kind === 'missing' ? 'The file is missing or this entry has no attached file to preview.' : `This format cannot be previewed here. ${data.helper?.reason || 'Try opening it with Windows.'}`;
  }
  if (element) content.append(element);
}).catch(error => { status.hidden = false; status.textContent = `Preview unavailable: ${error.message}`; });
window.psyPreview.onLanguageChange(language => window.psyI18n.setLanguage(language));
