import type { Message } from '../types/index';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main(ctx) {
    let lastActivityAt = 0;

    document.addEventListener(
      'keydown',
      () => {
        lastActivityAt = Date.now();
      },
      { passive: true, signal: ctx.signal }
    );
    document.addEventListener(
      'mousemove',
      () => {
        lastActivityAt = Date.now();
      },
      { passive: true, signal: ctx.signal }
    );

    ctx.setInterval(() => {
      try {
        if (Date.now() - lastActivityAt < 5_000) {
          browser.runtime.sendMessage({ type: 'HEARTBEAT' } satisfies Message).catch(() => {});
        }
      } catch {
        /* swallow invalidated context errors */
      }
    }, 5_000);
  },
});
