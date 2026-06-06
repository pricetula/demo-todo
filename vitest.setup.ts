import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";

// ─── Global IndexedDB reset guard ──────────────────────────────────────────
// `fake-indexeddb/auto` polyfills `indexedDB` on the global object.
// Each `beforeEach` / `afterEach` in test files explicitly wipes all databases
// to guarantee clean-room isolation between test cases.

// ─── jsdom polyfills ───────────────────────────────────────────────────────
// jsdom does not implement PointerEvent methods, scrollIntoView, or
// IntersectionObserver. Stub these to prevent TypeError crashes when React
// effects or Radix UI call them internally.

if (typeof Element.prototype.hasPointerCapture !== "function") {
  Element.prototype.hasPointerCapture = () => false;
}
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = () => {};
}

if (typeof globalThis.IntersectionObserver !== "function") {
  class IntersectionObserverMock {
    readonly root: Element | Document | null = null;
    readonly rootMargin: string = "0px";
    readonly thresholds: ReadonlyArray<number> = [0];

    private callback: IntersectionObserverCallback;

    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
    }

    observe(_target: Element): void {
      // Do not fire — no real layout in jsdom
    }

    unobserve(_target: Element): void {}

    disconnect(): void {}

    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  globalThis.IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver;
}
