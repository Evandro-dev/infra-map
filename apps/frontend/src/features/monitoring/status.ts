import type { MonitorState, ObservationStatus } from '@infra/contracts';
export const healthColor: Record<MonitorState | ObservationStatus, string> = {
  OK: '#23815b',
  WARNING: '#b77616',
  CRITICAL: '#c83d3d',
  PARTIAL: '#b77616',
  UNKNOWN: '#7f8794',
  STALE: '#8b7895',
  DISABLED: '#b7bcc4',
  UNAVAILABLE: '#7f8794',
};
export const healthLabel: Record<MonitorState | ObservationStatus, string> = {
  OK: 'Sem alertas',
  WARNING: 'Atenção',
  CRITICAL: 'Crítico',
  PARTIAL: 'Parcial',
  UNKNOWN: 'Sem leitura',
  STALE: 'Dados antigos',
  DISABLED: 'Desativado',
  UNAVAILABLE: 'Indisponível',
};
