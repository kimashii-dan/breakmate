import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'BreakMate',
    description: 'Health break reminder — activity-aware, local-only, privacy-first.',
    version: '0.0.1',
    permissions: ['alarms', 'storage', 'windows'],
    host_permissions: ['<all_urls>'],
  },
});
