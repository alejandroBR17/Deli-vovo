import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getInstallPrompt, initializeAppInstall, subscribeInstallPrompt, takeInstallPrompt, type InstallPrompt } from '../src/utils/app-install';

test('installation retains early events, uses one listener and consumes each browser prompt once', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const target = new EventTarget();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: target });
  try {
    initializeAppInstall();
    initializeAppInstall();
    const event = new Event('beforeinstallprompt', { cancelable: true }) as InstallPrompt;
    target.dispatchEvent(event); // Arrives before the UI subscribes.
    assert.ok(event.defaultPrevented);
    assert.equal(getInstallPrompt(), event);
    let changes = 0;
    const unsubscribe = subscribeInstallPrompt(() => changes++);
    assert.equal(takeInstallPrompt(), event);
    assert.equal(takeInstallPrompt(), null);
    assert.equal(getInstallPrompt(), null);
    changes = 0;
    const next = new Event('beforeinstallprompt', { cancelable: true }) as InstallPrompt;
    target.dispatchEvent(next);
    assert.equal(changes, 1);
    assert.equal(getInstallPrompt(), next);
    target.dispatchEvent(new Event('appinstalled'));
    assert.equal(getInstallPrompt(), null);
    assert.equal(changes, 2);
    unsubscribe();
    target.dispatchEvent(new Event('appinstalled'));
    assert.equal(changes, 2);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else delete (globalThis as any).window;
  }
});
