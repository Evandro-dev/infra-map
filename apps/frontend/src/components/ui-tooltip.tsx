import type { ReactNode } from 'react';
/** Shared n8n-style tooltip for browser controls; displays the actual keyboard shortcut. */
export function IconTip({
  label,
  shortcut,
  side = 'top',
  className,
  children,
}: {
  label: string;
  shortcut?: string;
  side?: 'top' | 'right' | 'left';
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`ui-tooltip ui-tooltip-${side} ${className ?? ''}`}>
      {children}
      <span className="ui-tooltip-popover" role="tooltip">
        <span>{label}</span>
        {shortcut && <kbd>{shortcut}</kbd>}
      </span>
    </div>
  );
}
