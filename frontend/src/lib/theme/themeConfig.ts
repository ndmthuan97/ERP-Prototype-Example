// =============================================================================
// Sakai-ng theme for Ant Design — emerald-default primary + slate surfaces,
// with a light/dark algorithm. buildTheme() is fed by ThemeConfigProvider from
// the configurator's current { primary, dark } selection.
// =============================================================================
import { theme as antdTheme, type ThemeConfig } from 'antd';

export interface PrimaryPreset {
  key: string;
  label: string;
  color: string; // Tailwind-500 hue, matching sakai's configurator palette
}

// Subset of sakai's configurator colors (each is the -500 shade).
export const PRIMARY_PRESETS: PrimaryPreset[] = [
  { key: 'emerald', label: 'Emerald', color: '#10b981' },
  { key: 'green', label: 'Green', color: '#22c55e' },
  { key: 'teal', label: 'Teal', color: '#14b8a6' },
  { key: 'cyan', label: 'Cyan', color: '#06b6d4' },
  { key: 'sky', label: 'Sky', color: '#0ea5e9' },
  { key: 'blue', label: 'Blue', color: '#3b82f6' },
  { key: 'indigo', label: 'Indigo', color: '#6366f1' },
  { key: 'violet', label: 'Violet', color: '#8b5cf6' },
  { key: 'purple', label: 'Purple', color: '#a855f7' },
  { key: 'pink', label: 'Pink', color: '#ec4899' },
  { key: 'rose', label: 'Rose', color: '#f43f5e' },
  { key: 'orange', label: 'Orange', color: '#f97316' },
];

export const DEFAULT_PRIMARY_KEY = 'emerald';

export function primaryColorFromKey(key: string): string {
  return (PRIMARY_PRESETS.find((p) => p.key === key) ?? PRIMARY_PRESETS[0]).color;
}

const FONT =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export function buildTheme(primary: string, dark: boolean): ThemeConfig {
  // Slate surfaces in dark, cool-white in light (sakai Aura look).
  const s = dark
    ? { layout: '#0f172a', container: '#1e293b', border: '#334155', headerBg: '#233145', hover: '#233145', headerText: '#94a3b8' }
    : { layout: '#f5f7fa', container: '#ffffff', border: '#e5e9f0', headerBg: '#f8fafc', hover: '#f1f5f9', headerText: '#64748b' };

  return {
    algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: primary,
      colorInfo: primary,
      colorSuccess: '#10b981',
      colorWarning: '#f97316',
      colorError: '#ef4444',
      ...(dark ? {} : { colorTextBase: '#1e293b' }),
      colorBgLayout: s.layout,
      colorBgContainer: s.container,
      colorBgElevated: s.container,
      colorBorderSecondary: s.border,
      borderRadius: 8,
      fontFamily: FONT,
    },
    components: {
      Card: { borderRadiusLG: 12 },
      Table: {
        headerBg: s.headerBg,
        headerColor: s.headerText,
        borderRadius: 12,
        cellPaddingBlock: 12,
        rowHoverBg: s.hover,
      },
      Button: { borderRadius: 8, primaryShadow: 'none' },
      Menu: {
        itemBorderRadius: 8,
        itemHeight: 42,
        iconSize: 17,
        groupTitleColor: '#94a3b8',
        itemHoverBg: s.hover,
        activeBarBorderWidth: 0,
      },
      Tabs: { inkBarColor: primary },
      Layout: { bodyBg: s.layout, headerBg: s.container },
    },
  };
}
