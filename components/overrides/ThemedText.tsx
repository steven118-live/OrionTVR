import React, { useMemo } from 'react';
import { Text, type TextProps } from 'react-native';
import OpenCC from 'opencc-js';
import * as RNLocalize from 'react-native-localize';

import { useThemeColor } from '@/hooks/useThemeColor';
import { useTextStyles } from '@/hooks/useTextStyles';
import { useSettingsStore } from '@/stores/settingsStore'; // 若沒有 settings store，呼叫會捕獲並退回 null

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

// opencc 初始化（若你使用的 opencc-js 版本不同，請微調這行）
const converter = OpenCC.Converter ? OpenCC.Converter({ from: 'cn', to: 'tw' }) : (s: string) => s;

// 全域快取避免重複轉換
const convertCache = new Map<string, string>();

// 中文檢測：沒有中文就跳過
const hasCJK = (s: string) => /[\u4e00-\u9fff]/.test(s);

// 跳過模式（URLs、版本號、email、程式碼片段等）
const SKIP_PATTERN = /https?:\/\/|\bRev\d+\b|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b|[`<>]/;

function convertNode(node: any, shouldConvert: boolean): any {
  if (!shouldConvert) return node;
  if (node == null) return node;
  if (typeof node === 'string') {
    if (!hasCJK(node)) return node;
    if (SKIP_PATTERN.test(node)) return node;
    const cached = convertCache.get(node);
    if (cached) return cached;
    try {
      const converted = typeof converter === 'function' ? converter(node) : node;
      convertCache.set(node, converted);
      return converted;
    } catch {
      return node;
    }
  }
  if (typeof node === 'number') return node;
  if (Array.isArray(node)) return node.map((n) => convertNode(n, shouldConvert));
  if (React.isValidElement(node)) {
    const child = node.props?.children;
    if (child === undefined) return node;
    const newChildren = Array.isArray(child)
      ? child.map((c) => convertNode(c, shouldConvert))
      : convertNode(child, shouldConvert);
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

  // safety: 嘗試呼叫 settings store，失敗則視為 null
  let settingsStore: any = null;
  try {
    settingsStore = useSettingsStore ? useSettingsStore() : null;
  } catch {
    settingsStore = null;
  }

  const displayPref = settingsStore?.displayLanguagePreference || 'auto'; // 'auto' | 'traditional' | 'simplified' | 'off'

  // 判斷 device 是否為繁體傾向
  const deviceLocales = RNLocalize.getLocales?.() || [];
  const devicePrefTraditional = deviceLocales.some((l) =>
    /Hant|TW|HK|MO/i.test(l?.languageTag || l?.language || '')
  );

  // 決定是否要做簡轉繁
  const shouldConvert = useMemo(() => {
    if (displayPref === 'off') return false;
    if (displayPref === 'traditional') return true;
    if (displayPref === 'simplified') return false;
    // auto: 若 device 為繁體地區則轉（原始為簡體，需顯示繁體）
    return !devicePrefTraditional;
  }, [displayPref, devicePrefTraditional]);

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

// optional: 預加載 helper（如要啟用，解除註解 export 並在 App init 呼叫）
export function _prewarmConvert(strs: string[]) {
  for (const s of strs) {
    if (!hasCJK(s) || SKIP_PATTERN.test(s)) continue;
    try {
      const converted = typeof converter === 'function' ? converter(s) : s;
      convertCache.set(s, converted);
    } catch {}
  }
}