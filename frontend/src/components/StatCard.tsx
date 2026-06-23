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

const TREND_STYLES: Record<string, { bg: string; color: string }> = {
  green: { bg: 'rgba(82, 196, 26, 0.1)', color: '#52c41a' },
  red: { bg: 'rgba(255, 77, 79, 0.1)', color: '#ff4d4f' },
  orange: { bg: 'rgba(250, 173, 20, 0.1)', color: '#faad14' },
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
        body: { padding: 20, minHeight: 120 },
      }}
      style={{
        borderRadius: 12,
        border: '1px solid #f0f0f0',
        height: '100%',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <Typography.Text
            style={{ fontSize: 14, color: '#8c8c8c', display: 'block', marginBottom: 8 }}
          >
            {label}
          </Typography.Text>
          <Typography.Text
            style={{ fontSize: 24, fontWeight: 700, color: '#262626', lineHeight: 1.2, whiteSpace: 'nowrap' }}
          >
            {value}
          </Typography.Text>
          {trend && (
            <div
              style={{
                marginTop: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 12,
                background: TREND_STYLES[trend.color]?.bg,
                color: TREND_STYLES[trend.color]?.color,
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {trend.color === 'green' ? '↑' : trend.color === 'red' ? '↓' : ''}
              {trend.text}
            </div>
          )}
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
    </Card>
  );
}
