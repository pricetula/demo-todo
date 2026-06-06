import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";

// ─── Global IndexedDB reset guard ──────────────────────────────────────────
// `fake-indexeddb/auto` polyfills `indexedDB` on the global object.
// Each `beforeEach` / `afterEach` in test files explicitly wipes all databases
// to guarantee clean-room isolation between test cases.

// ─── Radix UI polyfills ────────────────────────────────────────────────────
// jsdom does not implement PointerEvent methods or scrollIntoView. Radix
// Select calls these internally; stub to prevent TypeError crashes.
if (typeof Element.prototype.hasPointerCapture !== "function") {
  Element.prototype.hasPointerCapture = () => false;
}
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = () => {};
}
