import {test} from 'node:test';
import assert from 'node:assert/strict';
import {detectInstalledApp} from '../src/utils/installed-app';

test('installation detection only trusts this PWA and treats unavailable or failed browser checks as unknown', async () => {
  const origin = 'https://delivovo.vercel.app';
  assert.equal(await detectInstalledApp(origin, {getInstalledRelatedApps: async () => [{platform: 'webapp', url: origin + '/manifest.json'}]}), 'installed');
  assert.equal(await detectInstalledApp(origin, {getInstalledRelatedApps: async () => [{platform: 'webapp', id: origin + '/'}]}), 'installed');
  assert.equal(await detectInstalledApp(origin, {getInstalledRelatedApps: async () => []}), 'not-detected');
  assert.equal(await detectInstalledApp(origin, {getInstalledRelatedApps: async () => [{platform: 'webapp', id: 'https://deli-vovo.vercel.app/', url: 'https://deli-vovo.vercel.app/manifest.json'}, {platform: 'play', id: origin + '/'}]}), 'not-detected');
  assert.equal(await detectInstalledApp(origin, {}), 'unknown');
  assert.equal(await detectInstalledApp(origin, {getInstalledRelatedApps: async () => {throw new Error('Browser denied detection');}}), 'unknown');
  assert.equal(await detectInstalledApp(origin, {getInstalledRelatedApps: () => new Promise(() => {})}, 10), 'unknown');
  let installed = true;
  const browser = {getInstalledRelatedApps: async () => installed ? [{platform: 'webapp', id: origin + '/'}] : []};
  assert.equal(await detectInstalledApp(origin, browser), 'installed');
  installed = false;
  assert.equal(await detectInstalledApp(origin, browser), 'not-detected'); // No sticky storage flag after uninstall.
});
