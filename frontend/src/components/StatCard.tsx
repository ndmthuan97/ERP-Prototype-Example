'use client';

import { Card, Typography } from 'antd';
import type { ReactNode } from 'react';

interface StatCardProps {
  icon: ReactNode;
  iconBgColor: string;
  iconColor: string;
  label: string;
  value: string | number;
  trend?: {
    text: string;
    color: 'green' | 'red' | 'orange';
  };
}

// Sakai deltas are plain colored text under the value (no pill)
const TREND_COLOR: Record<string, string> = {
  green: '#10b981',
  red: '#ef4444',
  orange: '#f97316',
};

export function StatCard({
  icon,
  iconBgColor,
  iconColor,
  label,
  value,
  trend,
}: StatCardProps) {
  return (
    <Card
      className="card-hover"
      styles={{
        body: { padding: 20, minHeight: 118 },
      }}
      style={{
        borderRadius: 12,
        border: '1px solid var(--surface-border)',
        boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
        height: '100%',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <Typography.Text
            style={{ fontSize: 14, fontWeight: 500, color: 'var(--surface-muted)', display: 'block', marginBottom: 8 }}
          >
            {label}
          </Typography.Text>
          <Typography.Text
            style={{ fontSize: 26, fontWeight: 700, color: 'var(--surface-text)', lineHeight: 1.2, whiteSpace: 'nowrap' }}
          >
            {value}
          </Typography.Text>
        </div>
        <div
          className="stat-icon"
          style={{
            background: iconBgColor,
            color: iconColor,
          }}
        >
          {icon}
        </div>
      </div>
      {trend && (
        <div style={{ marginTop: 14, fontSize: 13 }}>
          <span style={{ color: TREND_COLOR[trend.color], fontWeight: 600 }}>{trend.text}</span>
        </div>
      )}
    </Card>
  );
}
