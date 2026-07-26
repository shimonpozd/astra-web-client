import { lazy, ComponentType } from 'react';

export function safeLazy<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T } | any>
) {
  return lazy(async () => {
    const pageHasBeenReloaded = sessionStorage.getItem('vite_chunk_reload');
    try {
      const component = await componentImport();
      sessionStorage.removeItem('vite_chunk_reload');
      return component.default ? component : { default: component.default || component };
    } catch (error) {
      if (!pageHasBeenReloaded) {
        sessionStorage.setItem('vite_chunk_reload', 'true');
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw error;
    }
  });
}
