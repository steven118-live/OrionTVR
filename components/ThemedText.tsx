import React, { useEffect, useMemo, useState } from 'react';
import { Text, type TextProps } from 'react-native';

let RNLocalize: any = { getLocales: () => [] };
try {
  RNLocalize = require('react-native-localize');
} catch {
  RNLocalize = { getLocales: () => [] };
}

import { useThemeColor } from '@/hooks/useThemeColor';
import { useTextStyles } from '@/hooks/useTextStyles';
import { useSettingsStore } from '@/stores/settingsStore';
import { convertFastIfCached, convertSafeAsync, shouldSkipConvert } from '@/utils/convertSafe';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

const hasCJK = (s: string) => typeof s === 'string' && /[\u4e00-\u9fff]/.test(s);

function nodeToString(node: React.ReactNode): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeToString).join('');
  if (React.isValidElement(node)) {
    return nodeToString((node as React.ReactElement<any>).props?.children);
  }
  return '';
}

function replaceNodeWithString(node: React.ReactNode, newStr: string): React.ReactNode {
  if (node == null) return newStr;
  if (typeof node === 'string' || typeof node === 'number') return newStr;
  if (Array.isArray(node)) return [newStr];
  if (React.isValidElement(node)) {
    try {
      return React.cloneElement(node as React.ReactElement<any>, (node as any).props, newStr as React.ReactNode);
    } catch {
      return node;
    }
  }
  return newStr;
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
  const devicePrefSimplified = deviceLocales.some((l: any) =>
    /Hans|CN|Mainland|zh-CN|zh-SG|zh-Hans/i.test(l?.languageTag || l?.language || '')
  );

  const shouldConvert = useMemo(() => {
    if (displayPref === 'off') return false;
    if (displayPref === 'traditional') return true;
    if (displayPref === 'simplified') return false;
    return !devicePrefSimplified;
  }, [displayPref, devicePrefSimplified]);

  const initialDisplay = useMemo<React.ReactNode>(() => {
    if (!shouldConvert) return children;
    const s = nodeToString(children);
    if (!hasCJK(s) || shouldSkipConvert(s)) return children;
    const fast = convertFastIfCached(s);
    return fast !== s ? replaceNodeWithString(children, fast) : children;
  }, [children, shouldConvert]);

  const [displayChildren, setDisplayChildren] = useState<React.ReactNode>(initialDisplay);

  useEffect(() => {
    if (!shouldConvert) {
      setDisplayChildren(children);
      return;
    }

    let mounted = true;
    const s = nodeToString(children);
    if (!hasCJK(s) || shouldSkipConvert(s)) {
      setDisplayChildren(children);
      return;
    }

    convertSafeAsync(s)
      .then((converted) => {
        if (!mounted) return;
        if (converted && converted !== s) {
          try {
            setDisplayChildren(replaceNodeWithString(children, converted));
          } catch {
            setDisplayChildren(children);
          }
        } else {
          setDisplayChildren(children);
        }
      })
      .catch(() => {
        if (mounted) setDisplayChildren(children);
      });

    return () => {
      mounted = false;
    };
  }, [children, shouldConvert]);

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
      {displayChildren}
    </Text>
  );
}

export default ThemedText;
