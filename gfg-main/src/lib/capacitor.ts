 import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';

/**
 * Returns true when running inside a native Capacitor shell
 * (Android / iOS), false when running in a regular browser.
 */
export const isNativePlatform = () => Capacitor.isNativePlatform();

/**
 * Initialise native plugins. Call once from your app entry point.
 * Safe to call on web — every block is guarded by a platform check.
 */
export async function initCapacitor() {
  if (!Capacitor.isNativePlatform()) return;

  // ── Keyboard ─────────────────────────────────────────────
  try {
    Keyboard.addListener('keyboardWillShow', (info) => {
      document.documentElement.style.setProperty(
        '--keyboard-height',
        `${info.keyboardHeight}px`,
      );
    });
    Keyboard.addListener('keyboardWillHide', () => {
      document.documentElement.style.setProperty('--keyboard-height', '0px');
    });
  } catch {
    // Keyboard plugin may not be available on all platforms
  }

  // ── Android back button ──────────────────────────────────
  try {
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });
  } catch {
    // App plugin may not be available
  }
}
