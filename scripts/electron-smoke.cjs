const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const playwrightModule = process.env.PSYSHELF_PLAYWRIGHT_MODULE || 'playwright';
const { _electron: electron } = require(playwrightModule);

async function run() {
  const projectRoot = path.resolve(__dirname, '..');
  const artifactRoot = path.join(projectRoot, 'artifacts');
  const userData = path.join(artifactRoot, 'e2e-user-data');
  const screenshotPath = path.join(artifactRoot, 'psyshelf-home.png');
  const packagedExecutable = process.env.PSYSHELF_EXECUTABLE;
  const executablePath = packagedExecutable || path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
  fs.mkdirSync(artifactRoot, { recursive: true });
  fs.rmSync(userData, { recursive: true, force: true });

  const electronApp = await electron.launch({
    executablePath,
    args: packagedExecutable ? [] : [projectRoot],
    cwd: projectRoot,
    env: { ...process.env, PSYSHELF_TEST_DATA_DIR: userData }
  });

  try {
    const page = await electronApp.firstWindow();
    page.on('pageerror', error => console.error('Renderer error:', error));
    page.on('console', message => {
      if (message.type() === 'error') console.error('Renderer console:', message.text());
    });
    await page.waitForSelector('.resource-card');
    assert.equal(await page.locator('.resource-card').count(), 17, 'Google Sheet seed count');
    await page.locator('.resource-card').first().click();
    await page.waitForSelector('.detail-hero h2');
    assert.ok(await page.locator('#correctButton').isVisible(), 'Correction action is visible');
    assert.ok(await page.locator('#analyzeButton').isVisible(), 'Metadata agent action is visible');

    await page.locator('#addUrlButton').click();
    await page.locator('#urlForm [name="url"]').fill('https://example.com/psychology-resource');
    await page.locator('#urlForm [name="title"]').fill('Smoke test resource');
    await page.locator('#urlForm [name="authors"]').fill('Test Author');
    await page.locator('#urlForm [name="languages"]').fill('English, French');
    await page.locator('#urlForm [name="description"]').fill('Created during the automated desktop smoke test.');
    await page.locator('#urlForm [type="submit"]').click();
    try {
      await page.waitForFunction(() => document.querySelectorAll('.resource-card').length === 18, null, { timeout: 8000 });
    } catch (error) {
      console.error('UI diagnostics:', await page.evaluate(() => ({
        cards: document.querySelectorAll('.resource-card').length,
        toast: document.querySelector('#toast')?.textContent,
        toastClass: document.querySelector('#toast')?.className,
        dialogOpen: document.querySelector('#urlDialog')?.open
      })));
      await page.screenshot({ path: path.join(artifactRoot, 'psyshelf-failure.png'), fullPage: true });
      throw error;
    }
    assert.equal(await page.locator('.resource-card').count(), 18, 'URL creation updates the database and UI');

    await page.locator('#settingsButton').click();
    await page.waitForSelector('#settingsDialog[open]');
    assert.equal(await page.locator('#modelInput').inputValue(), 'qwen3:4b');
    await page.locator('[data-close="settingsDialog"]').click();

    await page.locator('#correctButton').click();
    await page.locator('#correctionForm [name="title"]').fill('Smoke test resource — corrected');
    await page.locator('#correctionForm [name="reason"]').fill('Owner verified the preferred title.');
    await page.locator('#correctionForm [type="submit"]').click();
    await page.waitForSelector('#overrideButton', { timeout: 10000 });
    await page.locator('#overrideButton').click();
    await page.waitForFunction(() => document.querySelector('.detail-hero h2')?.textContent.includes('corrected'));
    assert.match(await page.locator('.detail-hero h2').textContent(), /corrected/);

    await page.locator('.library-view').evaluate(element => { element.scrollTop = 0; });
    await page.locator('#detailsPanel').evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({ path: screenshotPath });
    console.log(JSON.stringify({ passed: true, seedResources: 17, resourcesAfterCreate: 18, correctionOverride: true, screenshotPath }));
  } finally {
    await electronApp.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
