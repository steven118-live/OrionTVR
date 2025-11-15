import React, { useMemo } from 'react';
import { Text, type TextProps } from 'react-native';
import OpenCC from 'opencc-js';

let RNLocalize: any = { getLocales: () => [] };
try {
  RNLocalize = require('react-native-localize');
} catch {
  RNLocalize = { getLocales: () => [] };
}

import { useThemeColor } from '@/hooks/useThemeColor';
import { useTextStyles } from '@/hooks/useTextStyles';
import { useSettingsStore } from '@/stores/settingsStore';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

const converter = (OpenCC as any).Converter ? (OpenCC as any).Converter({ from: 'cn', to: 'tw' }) : (s: string) => s;
const convertCache = new Map<string, string>();
const hasCJK = (s: string) => /[\u4e00-\u9fff]/.test(s);
const SKIP_PATTERN = /https?:\/\/|\bRev\d+\b|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b|[`<>]/;

function convertString(s: string): string {
  if (!hasCJK(s)) return s;
  if (SKIP_PATTERN.test(s)) return s;
  const cached = convertCache.get(s);
  if (cached) return cached;
  try {
    const converted = typeof converter === 'function' ? converter(s) : s;
    convertCache.set(s, converted);
    return converted;
  } catch {
    return s;
  }
}

function convertNode(node: any, shouldConvert: boolean): any {
  if (!shouldConvert) return node;
  if (node == null) return node;
  if (typeof node === 'string') return convertString(node);
  if (typeof node === 'number') return node;
  if (Array.isArray(node)) return node.map((n) => convertNode(n, shouldConvert));
  if (React.isValidElement(node)) {
    const child = node.props?.children;
    if (child === undefined) return node;
    const newChildren = Array.isArray(child) ? child.map((c) => convertNode(c, shouldConvert)) : convertNode(child, shouldConvert);
    return React.cloneElement(node, node.props, newChildren);
  }
  return node;
}

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  children,
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  const styles = useTextStyles();

  let settingsStore: any = null;
  try {
    settingsStore = useSettingsStore ? useSettingsStore() : null;
  } catch {
    settingsStore = null;
  }
  const displayPref = settingsStore?.displayLanguagePreference || 'auto';

  const deviceLocales = RNLocalize.getLocales?.() || [];
  const devicePrefSimplified = deviceLocales.some((l) =>
    /Hans|CN|Mainland|zh-CN|zh-SG|zh-Hans/i.test(l?.languageTag || l?.language || '')
  );

  const shouldConvert = useMemo(() => {
    if (displayPref === 'off') return false;
    if (displayPref === 'traditional') return true;
    if (displayPref === 'simplified') return false;
    return !devicePrefSimplified;
  }, [displayPref, devicePrefSimplified]);

  const convertedChildren = useMemo(() => convertNode(children, shouldConvert), [children, shouldConvert]);

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        style,
      ]}
      {...rest}
    >
      {convertedChildren}
    </Text>
  );
}

export default ThemedText;

export function _prewarmConvert(strs: string[]) {
  for (const s of strs) {
    if (!hasCJK(s) || SKIP_PATTERN.test(s)) continue;
    try {
      const converted = typeof converter === 'function' ? converter(s) : s;
      convertCache.set(s, converted);
    } catch {}
  }
}
