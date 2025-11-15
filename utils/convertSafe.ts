// utils/convertSafe.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import OpenCC from 'opencc-js';

/**
 * 目的
 * - 避免在含有 URL、電子郵件、Rev 標記、程式碼標記或注音符號時做轉換（跳過）
 * - 提供同步快速快取轉換、以及非同步安全轉換 API
 */

// 匹配：URL | Rev### | email | 特殊字元 | Bopomofo (注音) Unicode 範圍
// Unicode 範圍：\u3100-\u312F 與 \u31A0-\u31BF 為注音相關區段
const SKIP_PATTERN = /https?:\/\/|\bRev\d+\b|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b|[`<>]|\u3100-\u312F|\u31A0-\u31BF/;

type ConverterFunc = (s: string) => string;

const converter: ConverterFunc =
  (OpenCC as any)?.Converter ? (OpenCC as any).Converter({ from: 'cn', to: 'tw' }) : ((s: string) => s);

const convertCache = new Map<string, string>();

export function shouldSkipConvert(s?: string | null): boolean {
  if (!s) return true;
  if (typeof s !== 'string') return true;
  if (!s.trim()) return true;
  if (SKIP_PATTERN.test(s)) return true;
  return false;
}

/**
 * 快速且同步的轉換（若有快取或 converter 可用）
 * - 不會發生非同步副作用
 */
export function convertFastIfCached(s: string): string {
  if (!s) return s;
  const cached = convertCache.get(s);
  if (cached) return cached;
  if (shouldSkipConvert(s)) return s;
  try {
    const out = converter(s);
    if (out && out !== s) convertCache.set(s, out);
    return out;
  } catch {
    return s;
  }
}

/**
 * 非同步且安全的轉換（外層元件可 await / .then）
 * - 內部仍同步呼叫 converter，保護 try/catch
 * - 回傳原字串當發生錯誤或被判定為 skip
 */
export async function convertSafeAsync(s: string): Promise<string> {
  if (!s) return s;
  if (shouldSkipConvert(s)) return s;
  try {
    const out = converter(s);
    if (out && out !== s) convertCache.set(s, out);
    return out;
  } catch {
    return s;
  }
}

/**
 * 清除快取（如需）
 */
export function clearConvertCache() {
  convertCache.clear();
}
