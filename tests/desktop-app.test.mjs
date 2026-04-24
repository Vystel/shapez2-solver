import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('repo declares desktop app build scripts', () => {
  assert.ok(fs.existsSync(path.join(repoRoot, 'package.json')), 'package.json should exist');

  const pkg = JSON.parse(readRepoFile('package.json'));
  assert.equal(pkg.type, 'module');
  assert.equal(typeof pkg.scripts?.build, 'string', 'package.json should define a build script');
  assert.equal(typeof pkg.scripts?.dev, 'string', 'package.json should define a dev script');
  assert.equal(typeof pkg.scripts?.['tauri:build'], 'string', 'package.json should define a tauri:build script');
});

test('frontend no longer depends on remote CDN scripts', () => {
  const html = readRepoFile('index.html');
  const styles = readRepoFile('styles.css');

  assert.doesNotMatch(html, /https?:\/\/unpkg\.com/i);
  assert.doesNotMatch(html, /https?:\/\/cdn\.jsdelivr\.net/i);
  assert.doesNotMatch(styles, /https?:\/\/fonts\.googleapis\.com/i);
});

test('tauri app shell is configured in-repo', () => {
  const tauriConfigPath = path.join(repoRoot, 'src-tauri', 'tauri.conf.json');
  assert.ok(fs.existsSync(tauriConfigPath), 'src-tauri/tauri.conf.json should exist');

  const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));
  assert.equal(tauriConfig.productName, 'Shapez 2 Solver');
  assert.ok(tauriConfig.build?.frontendDist, 'Tauri build.frontendDist should be configured');
});
