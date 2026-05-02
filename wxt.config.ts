import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'BreakMate',
    description: 'Health break reminder — activity-aware, local-only, privacy-first.',
    version: '0.0.1',
    permissions: ['alarms', 'idle', 'storage', 'windows'],
    icons: {
      16: 'icons/icon16.png',
      32: 'icons/icon32.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
  },
});
