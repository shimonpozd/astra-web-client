export type GamificationEvent = {
  amount: number;
  source:
    | 'chat'
    | 'focus'
    | 'workbench'
    | 'lexicon'
    | 'daily'
    | 'system';
  verb?: string;
  label?: string;
  meta?: Record<string, unknown>;
};

type Listener = (event: GamificationEvent) => void;

const listeners = new Set<Listener>();

export function emitGamificationEvent(event: GamificationEvent) {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      /* ignore listener errors */
    }
  });
}

export function onGamificationEvent(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
