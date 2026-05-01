export default defineBackground({
  main() {
    console.log('BreakMate service worker started', { id: browser.runtime.id });
  },
});
