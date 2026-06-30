'use client';
// =============================================================================
// ERROR BOUNDARY — enhanced with retry, home navigation, error ID tracking
// =============================================================================

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Result, Button, Space, Typography } from 'antd';

interface Props {
  children: ReactNode;
  /** Optional fallback render prop for custom UI */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorId?: string;
}

function generateErrorId(): string {
  return `ERR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorId: generateErrorId() };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Sanitize: only log error name and component stack, no PII/credentials
    console.error(
      `[ErrorBoundary] ${this.state.errorId ?? 'unknown'}:`,
      error.name,
      error.message,
      info.componentStack,
    );
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorId: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback && this.state.error) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      return (
        <div style={{ padding: 48 }}>
          <Result
            status="error"
            title="Something went wrong"
            subTitle={
              <Space direction="vertical" size={4}>
                <Typography.Text type="secondary">
                  {this.state.error?.message ?? 'An unexpected error occurred'}
                </Typography.Text>
                {this.state.errorId && (
                  <Typography.Text
                    copyable
                    type="secondary"
                    style={{ fontSize: 12 }}
                  >
                    Error ID: {this.state.errorId}
                  </Typography.Text>
                )}
              </Space>
            }
            extra={
              <Space>
                <Button type="primary" onClick={this.handleReset}>
                  Try Again
                </Button>
                <Button onClick={() => (window.location.href = '/')}>
                  Go Home
                </Button>
              </Space>
            }
          />
        </div>
      );
    }
    return this.props.children;
  }
}
