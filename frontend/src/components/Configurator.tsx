'use client';
// =============================================================================
// Configurator — sakai's topbar controls: a dark-mode toggle and a popover to
// pick the primary color. State lives in ThemeConfigProvider (persisted).
// =============================================================================
import { Popover, Tooltip, Typography, Segmented } from 'antd';
import { BgColorsOutlined, BulbFilled, BulbOutlined } from '@ant-design/icons';
import { useThemeConfig } from '@/lib/theme/ThemeConfigContext';
import { PRIMARY_PRESETS } from '@/lib/theme/themeConfig';

const iconBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 36,
  height: 36,
  borderRadius: 8,
  cursor: 'pointer',
  color: 'var(--surface-muted)',
  fontSize: 17,
};

export function Configurator() {
  const { dark, setDark, primaryKey, setPrimaryKey } = useThemeConfig();

  const panel = (
    <div style={{ width: 244 }}>
      <Typography.Text strong style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>
        Primary
      </Typography.Text>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 18 }}>
        {PRIMARY_PRESETS.map((p) => {
          const active = p.key === primaryKey;
          return (
            <button
              key={p.key}
              type="button"
              title={p.label}
              aria-label={p.label}
              onClick={() => setPrimaryKey(p.key)}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: p.color,
                cursor: 'pointer',
                padding: 0,
                border: active ? '2px solid var(--surface-text)' : '2px solid transparent',
                outline: active ? '2px solid var(--surface-card)' : 'none',
                outlineOffset: -4,
                boxShadow: active ? `0 0 0 2px ${p.color}` : 'none',
                transition: 'transform 0.1s ease',
              }}
            />
          );
        })}
      </div>

      <Typography.Text strong style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>
        Color Scheme
      </Typography.Text>
      <Segmented
        block
        value={dark ? 'dark' : 'light'}
        onChange={(v) => setDark(v === 'dark')}
        options={[
          { label: 'Light', value: 'light', icon: <BulbOutlined /> },
          { label: 'Dark', value: 'dark', icon: <BulbFilled /> },
        ]}
      />
    </div>
  );

  return (
    <>
      <Tooltip title={dark ? 'Light mode' : 'Dark mode'}>
        <span
          role="button"
          tabIndex={0}
          style={iconBtnStyle}
          onClick={() => setDark(!dark)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setDark(!dark);
            }
          }}
        >
          {dark ? <BulbFilled /> : <BulbOutlined />}
        </span>
      </Tooltip>
      <Popover content={panel} trigger="click" placement="bottomRight">
        <Tooltip title="Theme">
          <span role="button" tabIndex={0} style={iconBtnStyle}>
            <BgColorsOutlined />
          </span>
        </Tooltip>
      </Popover>
    </>
  );
}
