import { SettingsPanel } from '../../components/SettingsPanel';

export default function App() {
  return (
    <div className="min-h-screen bg-bm-bg overflow-y-auto scrollbar-hide">
      <div className="mx-auto max-w-sm py-10">
        <div className="rounded-xl border border-bm-border bg-bm-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-bm-border">
            <h1 className="text-base font-semibold text-bm-text-primary">BreakMate Settings</h1>
          </div>
          <SettingsPanel />
        </div>
      </div>
    </div>
  );
}
