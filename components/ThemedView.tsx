import React, { useEffect, useMemo, useState } from 'react';
import { View, type ViewProps } from 'react-native';

let RNLocalize: any = { getLocales: () => [] };
try {
  RNLocalize = require('react-native-localize');
} catch {
  RNLocalize = { getLocales: () => [] };
}

import { useThemeColor } from '@/hooks/useThemeColor';
import { useSettingsStore } from '@/stores/settingsStore';
import { convertFastIfCached, convertSafeAsync, shouldSkipConvert } from '@/utils/convertSafe';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

const hasCJK = (s: string) => typeof s === 'string' && /[\u4e00-\u9fff]/.test(s);

function firstStringChild(children: React.ReactNode): string | null {
  if (children == null) return null;
  if (typeof children === 'string') return children;
  if (Array.isArray(children) && children.length > 0) {
    for (const c of children) {
      if (typeof c === 'string') return c;
      if (React.isValidElement(c) && typeof (c as React.ReactElement<any>).props?.children === 'string') {
        return (c as React.ReactElement<any>).props.children;
      }
    }
  }
  if (React.isValidElement(children) && typeof (children as React.ReactElement<any>).props?.children === 'string') {
    return (children as React.ReactElement<any>).props.children;
  }
  return null;
}

function replaceFirstStringChild(children: React.ReactNode, newStr: string): React.ReactNode {
  if (children == null) return children;
  if (typeof children === 'string' || typeof children === 'number') return newStr;
  if (Array.isArray(children) && children.length > 0) {
    const out = children.slice();
    for (let i = 0; i < out.length; i++) {
      if (typeof out[i] === 'string' || typeof out[i] === 'number') {
        out[i] = newStr;
        return out;
      }
      if (React.isValidElement(out[i]) && typeof (out[i] as React.ReactElement<any>).props?.children === 'string') {
        try {
          return out.map((it, idx) => (idx === i ? React.cloneElement(it as React.ReactElement<any>, (it as any).props, newStr) : it));
        } catch {
          break;
        }
      }
    }
    return children;
  }
  if (React.isValidElement(children) && typeof (children as React.ReactElement<any>).props?.children === 'string') {
    try {
      return React.cloneElement(children as React.ReactElement<any>, (children as any).props, newStr);
    } catch {
      return children;
    }
  }
  return children;
}

export function ThemedView({
  style,
  lightColor,
  darkColor,
  children,
  accessibilityLabel,
  ...otherProps
}: ThemedViewProps) {
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');

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

  const firstChildStr = useMemo(() => firstStringChild(children), [children]);
  const initialChildDisplay = useMemo<React.ReactNode>(() => {
    if (!shouldConvert) return children;
    if (!firstChildStr || !hasCJK(firstChildStr) || shouldSkipConvert(firstChildStr)) return children;
    const fast = convertFastIfCached(firstChildStr);
    return fast !== firstChildStr ? replaceFirstStringChild(children, fast) : children;
  }, [children, firstChildStr, shouldConvert]);

  const initialLabelDisplay = useMemo(() => {
    if (!shouldConvert) return accessibilityLabel;
    if (typeof accessibilityLabel !== 'string' || !hasCJK(accessibilityLabel) || shouldSkipConvert(accessibilityLabel)) return accessibilityLabel;
    const fast = convertFastIfCached(accessibilityLabel);
    return fast !== accessibilityLabel ? fast : accessibilityLabel;
  }, [accessibilityLabel, shouldConvert]);

  const [displayChildren, setDisplayChildren] = useState<React.ReactNode>(initialChildDisplay);
  const [displayLabel, setDisplayLabel] = useState<string | undefined>(initialLabelDisplay as string | undefined);

  useEffect(() => {
    if (!shouldConvert) {
      setDisplayChildren(children);
      setDisplayLabel(accessibilityLabel as string | undefined);
      return;
    }

    let mounted = true;

    const s = firstChildStr;
    if (s && hasCJK(s) && !shouldSkipConvert(s)) {
      convertSafeAsync(s)
        .then((converted) => {
          if (!mounted) return;
          if (converted && converted !== s) {
            try {
              setDisplayChildren(replaceFirstStringChild(children, converted));
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
    } else {
      setDisplayChildren(children);
    }

    const lab = accessibilityLabel;
    if (typeof lab === 'string' && hasCJK(lab) && !shouldSkipConvert(lab)) {
      convertSafeAsync(lab)
        .then((converted) => {
          if (!mounted) return;
          if (converted && converted !== lab) setDisplayLabel(converted);
          else setDisplayLabel(lab);
        })
        .catch(() => {
          if (mounted) setDisplayLabel(lab);
        });
    } else {
      setDisplayLabel(accessibilityLabel as string | undefined);
    }

    return () => {
      mounted = false;
    };
  }, [children, accessibilityLabel, shouldConvert, firstChildStr]);

  return (
    <View
      style={[{ backgroundColor }, style]}
      accessibilityLabel={displayLabel}
      {...otherProps}
    >
      {displayChildren}
    </View>
  );
}

export default ThemedView;
