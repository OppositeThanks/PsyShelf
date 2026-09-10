const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { copyFiles } = require('../src/file-copy.cjs');
const { FileJobs, workerTask } = require('../src/file-jobs.cjs');

function fixture(t, megabytes = 4) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'psyshelf-files-test-'));
  const library = path.join(root, 'library-files');
  fs.mkdirSync(library);
  const source = path.join(root, 'source.bin');
  const fd = fs.openSync(source, 'wx');
  fs.ftruncateSync(fd, megabytes * 1024 * 1024);
  fs.closeSync(fd);
  t.after(() => {
    assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('psyshelf-files-test-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  return { root, source, library };
}

test('chunk cancellation removes the partial destination and preserves the source', t => {
  const f = fixture(t);
  const destination = path.join(f.library, 'partial.bin');
  let checks = 0;
  assert.throws(() => copyFiles([{ source: f.source, destination }], {
    check: () => { if (++checks === 5) throw new Error('cancelled'); }
  }), /cancelled/);
  assert.equal(fs.existsSync(destination), false);
  assert.equal(fs.statSync(f.source).size, 4 * 1024 * 1024);
});

test('copy refuses to overwrite an existing file and detects a changed source', t => {
  const f = fixture(t);
  const destination = path.join(f.library, 'existing.bin');
  fs.writeFileSync(destination, 'Keep this');
  assert.throws(() => copyFiles([{ source: f.source, destination }]), /EEXIST/);
  assert.equal(fs.readFileSync(destination, 'utf8'), 'Keep this');
  const changed = path.join(f.library, 'changed.bin');
  let modified = false;
  assert.throws(() => copyFiles([{ source: f.source, destination: changed }], {
    progress: value => {
      if (value.copiedBytes > 0 && !modified) { modified = true; fs.appendFileSync(f.source, 'change'); }
    }
  }), /changed during copying/);
  assert.equal(fs.existsSync(changed), false);
});

test('worker imports report progress, avoid duplicate filenames, and leave catalog commit to the main process', async t => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.root, 'other'));
  const other = path.join(f.root, 'other', 'source.bin');
  fs.writeFileSync(other, 'Second file');
  const states = [];
  const result = await workerTask('import', { sources: [f.source, other], managedLibraryPath: f.library, userData: f.root }, {
    progress: value => states.push(value)
  });
  assert.equal(result.files.length, 2);
  assert.notEqual(result.files[0].filePath, result.files[1].filePath);
  assert.deepEqual(fs.readdirSync(f.library), []);
  assert.ok(states.some(value => value.totalFiles === 2));
  assert.equal(fs.readFileSync(result.files[1].destination, 'utf8'), 'Second file');
  await workerTask('cleanup-import', { userData: f.root, staging: result.staging });
  assert.equal(fs.existsSync(result.staging), false);
});

test('worker cancellation interrupts a large file and cleans its staging folder', async t => {
  const f = fixture(t, 128);
  const signal = new SharedArrayBuffer(4);
  let sawCopy = false;
  await assert.rejects(workerTask('import', { sources: [f.source], managedLibraryPath: f.library, userData: f.root }, {
    signal, progress: value => {
      if (value.phase === 'Copying files') { sawCopy = true; Atomics.store(new Int32Array(signal), 0, 1); }
    }
  }), { name: 'AbortError' });
  assert.ok(sawCopy);
  assert.deepEqual(fs.readdirSync(f.library), []);
  assert.equal(fs.readdirSync(f.root).filter(name => name.startsWith('.import-')).length, 0);
  assert.equal(fs.statSync(f.source).size, 128 * 1024 * 1024);
});

test('job manager serializes operations and stops cooperatively without blocking the event loop', async t => {
  const f = fixture(t, 128);
  const states = [];
  let stopPromise;
  const jobs = new FileJobs(status => {
    states.push(status);
    if (status.phase === 'Copying files' && !stopPromise) stopPromise = jobs.stop();
  });
  let ticks = 0;
  const interval = setInterval(() => ticks++, 1);
  try {
    const operation = jobs.run('Import files', job => job.task('import', {
      sources: [f.source], managedLibraryPath: f.library, userData: f.root
    }));
    await assert.rejects(jobs.run('Second operation', () => {}), /Another file operation/);
    await assert.rejects(operation, { name: 'AbortError' });
    await stopPromise;
    assert.ok(ticks > 0, 'The main event loop remained responsive');
    assert.equal(jobs.busy, false);
    assert.equal(jobs.status.state, 'cancelled');
    assert.ok(states.some(status => status.phase === 'Cancelling…'));
  } finally { clearInterval(interval); }
});

test('cancellation is refused after the atomic commit boundary', async () => {
  const jobs = new FileJobs();
  await jobs.run('Commit', async job => {
    job.commit();
    assert.equal(jobs.cancel(jobs.status.id), false);
    job.check();
  });
  assert.equal(jobs.status.state, 'completed');
});

test('shared resource.json attachments cannot overwrite the export metadata', async t => {
  const f = fixture(t);
  const source = path.join(f.root, 'resource.json');
  fs.writeFileSync(source, 'Original attachment');
  const result = await workerTask('share', { root: f.root, resource: { title: 'Shared resource', filePath: source }, includeFile: true });
  const metadata = JSON.parse(fs.readFileSync(path.join(result.folder, 'resource.json'), 'utf8'));
  assert.equal(metadata.title, 'Shared resource');
  assert.equal(fs.readFileSync(path.join(result.folder, metadata.attachment), 'utf8'), 'Original attachment');
});
