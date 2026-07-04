'use client';
// =============================================================================
// D365 form primitives — shared by all detail/record pages.
//   <FormSection title>  → titled block with a responsive 1–2 column field grid
//   <Field label>        → label on the left, value on an underlined line
// Matches the Power Apps model-driven "form" look (label-left, subtle underline).
// =============================================================================
import type { ReactNode } from 'react';
import { Typography } from 'antd';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', minWidth: 0 }}>
      <div style={{ width: 150, flexShrink: 0, fontSize: 13, color: 'var(--surface-muted)' }}>{label}</div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          borderBottom: '1px solid var(--surface-border)',
          paddingBottom: 6,
          minHeight: 24,
          fontSize: 14,
          color: 'var(--surface-text)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <Typography.Text
        strong
        style={{ display: 'block', marginBottom: 16, color: 'var(--surface-muted)', fontSize: 13 }}
      >
        {title}
      </Typography.Text>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '18px 48px',
        }}
      >
        {children}
      </div>
    </section>
  );
}
