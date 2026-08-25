const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const playwrightModule = process.env.PSYSHELF_PLAYWRIGHT_MODULE || 'playwright';
const { _electron: electron } = require(playwrightModule);

/** Exercises the packaged desktop workflow against an isolated test database. */
async function run() {
  const projectRoot = path.resolve(__dirname, '..');
  const artifactRoot = path.join(projectRoot, 'artifacts');
  const userData = path.join(artifactRoot, 'e2e-user-data');
  const screenshotPath = path.join(artifactRoot, 'psyshelf-home.png');
  const hardwareScreenshotPath = path.join(artifactRoot, 'hardware-recommendation.png');
  const settingsScreenshotPath = path.join(artifactRoot, 'hardware-settings.png');
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
    await page.setViewportSize({ width: 1034, height: 641 });
    page.on('pageerror', error => console.error('Renderer error:', error));
    page.on('console', message => {
      if (message.type() === 'error') console.error('Renderer console:', message.text());
    });
    await page.waitForSelector('.resource-card');
    await page.waitForSelector('#hardwareDialog[open]', { timeout: 15000 });
    assert.match(await page.locator('#firstRunModelName').textContent(), /Qwen3/);
    assert.match(await page.locator('#firstRunModelSize').textContent(), /Ollama/);
    assert.equal(await page.locator('#firstRunHardwareSpecs .hardware-spec').count(), 4, 'First-run analysis displays four local hardware facts');
    await page.screenshot({ path: hardwareScreenshotPath });
    await page.locator('#useFirstRunRecommendation').click();
    await page.waitForFunction(() => !document.querySelector('#hardwareDialog')?.open);
    assert.equal(await page.locator('.resource-card').count(), 17, 'Google Sheet seed count');
    assert.ok(await page.locator('#backupCard').isVisible(), 'Privacy and backup status stays visible');
    assert.ok(await page.locator('#settingsButton').isVisible(), 'Agent settings stays visible');
    const sidebarLayout = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar').getBoundingClientRect();
      const scroll = document.querySelector('.sidebar-scroll').getBoundingClientRect();
      const footer = document.querySelector('.sidebar-footer').getBoundingClientRect();
      return { viewportHeight: window.innerHeight, sidebar: { top: sidebar.top, bottom: sidebar.bottom, height: sidebar.height }, scroll: { top: scroll.top, bottom: scroll.bottom, height: scroll.height }, footer: { top: footer.top, bottom: footer.bottom, height: footer.height } };
    });
    fs.writeFileSync(path.join(artifactRoot, 'sidebar-layout.json'), JSON.stringify(sidebarLayout, null, 2));
    assert.ok(sidebarLayout.footer.top >= 0 && sidebarLayout.footer.bottom <= sidebarLayout.viewportHeight, `Sidebar footer is inside the viewport: ${JSON.stringify(sidebarLayout)}`);
    if (process.env.PSYSHELF_LAYOUT_ONLY === 'true') {
      console.log(JSON.stringify({ passed: true, sidebarLayout }));
      return;
    }
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
    assert.match(await page.locator('#modelInput').inputValue(), /^qwen3:(0\.6b|1\.7b|4b|8b|14b|30b)$/);
    assert.match(await page.locator('#recommendedModelName').textContent(), /Recommended: Qwen3/);
    await page.locator('#reanalyzeHardware').click();
    await page.waitForFunction(() => !document.querySelector('#reanalyzeHardware')?.disabled);
    assert.match(await page.locator('#hardwareAnalysisDate').textContent(), /Analyzed locally/);
    await page.screenshot({ path: settingsScreenshotPath });
    await page.locator('[data-close="settingsDialog"]').click();

    await page.locator('#correctButton').click();
    await page.locator('#correctionForm [name="title"]').fill('Smoke test resource — corrected');
    await page.locator('#correctionForm [name="reason"]').fill('Owner verified the preferred title.');
    await page.locator('#correctionForm [type="submit"]').click();
    await page.waitForSelector('#correctionResult:not([hidden])', { timeout: 120000 });
    if (await page.locator('#overrideButton').count()) await page.locator('#overrideButton').click();
    await page.waitForFunction(() => document.querySelector('.detail-hero h2')?.textContent.includes('corrected'));
    assert.match(await page.locator('.detail-hero h2').textContent(), /corrected/);

    assert.ok(await page.locator('#agentBubble').isVisible(), 'Floating Ask library bubble is visible');
    await page.locator('#agentBubble').click();
    await page.waitForSelector('#floatingChat.open');
    assert.equal(await page.locator('#floatingChat').getAttribute('aria-hidden'), 'false');

    const bubbleBefore = await page.locator('#agentBubble').boundingBox();
    assert.ok(bubbleBefore, 'Floating bubble has a position');
    await page.mouse.move(bubbleBefore.x + bubbleBefore.width / 2, bubbleBefore.y + bubbleBefore.height / 2);
    await page.mouse.down();
    await page.mouse.move(bubbleBefore.x - 85, bubbleBefore.y - 55, { steps: 6 });
    await page.mouse.up();
    const bubbleAfter = await page.locator('#agentBubble').boundingBox();
    assert.ok(Math.abs(bubbleAfter.x - bubbleBefore.x) > 20, 'Floating bubble can be moved');

    await page.locator('#collapseDetails').click();
    await page.waitForFunction(() => document.querySelector('.app-shell')?.classList.contains('details-collapsed'));
    assert.ok(await page.locator('#detailsToggle').isVisible(), 'Details restore tab appears after folding');
    await page.locator('#detailsToggle').click();
    await page.waitForFunction(() => !document.querySelector('.app-shell')?.classList.contains('details-collapsed'));
    await page.locator('#collapseDetails').click();

    await page.locator('.library-view').evaluate(element => { element.scrollTop = 0; });
    await page.locator('#detailsPanel').evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({ path: screenshotPath });
    console.log(JSON.stringify({ passed: true, seedResources: 17, resourcesAfterCreate: 18, firstRunHardwareAdvice: true, manualHardwareReanalysis: true, correctionReview: true, floatingAgent: true, collapsibleDetails: true, pinnedSidebarFooter: true, screenshotPath, hardwareScreenshotPath, settingsScreenshotPath }));
  } finally {
    await electronApp.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
