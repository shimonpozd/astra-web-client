import { useEffect } from 'react';
import TopBar from '@/components/layout/TopBar';
import GraphCanvas from './components/GraphCanvas';
import Inspector from './components/controls/Inspector';
import Toolbar from './components/controls/Toolbar';
import { useMapActions } from './hooks/useMapActions';

export default function SederMapPage() {
  const { loadMap } = useMapActions();

  useEffect(() => {
    loadMap();
  }, []);

  return (
    <div className="h-screen w-full bg-background text-foreground flex flex-col">
      <TopBar />
      <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_520px] gap-4 p-4">
        <main className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Карта סדר השתלשלות</h2>
          </div>
          <Toolbar />
          <div className="flex-1 min-h-0">
            <GraphCanvas />
          </div>
        </main>
        <Inspector />
      </div>
    </div>
  );
}
