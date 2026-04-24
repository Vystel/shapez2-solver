import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

test('release workflow publishes macOS bundles to GitHub Releases', () => {
  const workflowPath = path.join(repoRoot, '.github', 'workflows', 'release.yml');

  assert.ok(fs.existsSync(workflowPath), '.github/workflows/release.yml should exist');

  const workflow = fs.readFileSync(workflowPath, 'utf8');

  assert.match(workflow, /push:\s*\n\s*tags:\s*\n\s*-\s*['"]v\*['"]/m);
  assert.match(workflow, /contents:\s*write/m);
  assert.match(workflow, /tauri-apps\/tauri-action@v0\.6\.2/);
  assert.match(workflow, /tagName:\s*\$\{\{\s*github\.ref_name\s*\}\}/);
  assert.match(workflow, /releaseName:\s*['"]Shapez 2 Solver \$\{\{\s*github\.ref_name\s*\}\}['"]/);
  assert.match(workflow, /generateReleaseNotes:\s*true/);
  assert.match(workflow, /--bundles app,dmg/);
  assert.match(workflow, /aarch64-apple-darwin/);
  assert.match(workflow, /x86_64-apple-darwin/);
});
