import type { LucideIcon } from 'lucide-react';
export type ContextMenuActionId =
  | 'rename'
  | 'fit'
  | 'lock'
  | 'forward'
  | 'backward'
  | 'hide'
  | 'delete'
  | 'duplicate'
  | 'copy'
  | 'align'
  | 'clear'
  | 'disconnect';
export type ContextMenuAction = {
  id: ContextMenuActionId;
  label: string;
  shortcut: string;
  icon: LucideIcon;
  danger?: boolean;
  divider?: boolean;
};
