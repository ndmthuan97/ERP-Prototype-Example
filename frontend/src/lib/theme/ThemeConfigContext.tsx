'use client';
// =============================================================================
// Theme config — holds the sakai configurator state (primary color + dark mode),
// persists it to localStorage, drives AntD's ConfigProvider, and mirrors it onto
// the <html> element as `.dark` + `--brand` so inline CSS-var styles flip too.
// =============================================================================
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import { buildTheme, primaryColorFromKey, DEFAULT_PRIMARY_KEY } from './themeConfig';

interface ThemeConfigValue {
  dark: boolean;
  setDark: (v: boolean) => void;
  primaryKey: string;
  setPrimaryKey: (k: string) => void;
}

const Ctx = createContext<ThemeConfigValue | null>(null);

export function useThemeConfig(): ThemeConfigValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useThemeConfig must be used within ThemeConfigProvider');
  return v;
}

const LS_DARK = 'wecare.theme.dark';
const LS_PRIMARY = 'wecare.theme.primary';

export function ThemeConfigProvider({ children }: { children: ReactNode }) {
  // ponytail: default on first paint, then hydrate from localStorage in effect.
  // A saved dark theme flashes light for one frame — fine for a prototype; add a
  // blocking <head> script if the flash ever matters.
  const [dark, setDarkState] = useState(false);
  const [primaryKey, setPrimaryKeyState] = useState(DEFAULT_PRIMARY_KEY);

  useEffect(() => {
    const d = localStorage.getItem(LS_DARK);
    if (d != null) setDarkState(d === '1');
    const p = localStorage.getItem(LS_PRIMARY);
    if (p) setPrimaryKeyState(p);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  useEffect(() => {
    document.documentElement.style.setProperty('--brand', primaryColorFromKey(primaryKey));
  }, [primaryKey]);

  const setDark = (v: boolean) => {
    setDarkState(v);
    localStorage.setItem(LS_DARK, v ? '1' : '0');
  };
  const setPrimaryKey = (k: string) => {
    setPrimaryKeyState(k);
    localStorage.setItem(LS_PRIMARY, k);
  };

  return (
    <Ctx.Provider value={{ dark, setDark, primaryKey, setPrimaryKey }}>
      <ConfigProvider locale={enUS} theme={buildTheme(primaryColorFromKey(primaryKey), dark)}>
        {children}
      </ConfigProvider>
    </Ctx.Provider>
  );
}
