'use client';
// =============================================================================
// D365 CommandBar — the flat action strip above a list/record (Power Apps look).
// Put icon+text <Button type="text"> actions inside. Use <div style={{flex:1}}/>
// as a spacer to push trailing items (e.g. keyword search) to the right.
// =============================================================================
import type { ReactNode, CSSProperties } from 'react';

export function CommandBar({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        background: 'var(--surface-card)',
        border: '1px solid var(--surface-border)',
        borderRadius: 8,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
