export const catalogChangedEvent = 'infra-map:catalog-changed';
export function notifyCatalogChanged() {
  window.dispatchEvent(new Event(catalogChangedEvent));
}
