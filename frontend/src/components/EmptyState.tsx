'use client';
// =============================================================================
// EMPTY STATE — reusable empty state with icon, message, and CTA button
// =============================================================================

import { Empty, Button, Typography } from 'antd';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title = 'No data',
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div style={{ padding: '48px 0', textAlign: 'center' }}>
      <Empty
        image={icon ?? Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <>
            <Typography.Text strong style={{ display: 'block', fontSize: 16, marginBottom: 4 }}>
              {title}
            </Typography.Text>
            {description && (
              <Typography.Text type="secondary">{description}</Typography.Text>
            )}
          </>
        }
      >
        {actionLabel && onAction && (
          <Button type="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </Empty>
    </div>
  );
}
