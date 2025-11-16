/* eslint-disable @typescript-eslint/no-explicit-any */
import OpenCC from 'opencc-js';

/**
 * 單次轉換工具：不保留快取、不影響下一次輸入
 * - 繁→簡：搜尋輸入
 * - 簡→繁：顯示結果
 */

// 匹配：URL | Rev### | email | 特殊字元 | Bopomofo (注音) Unicode 範圍
const SKIP_PATTERN =
  /https?:\/\/|\bRev\d+\b|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b|[`<>]|\u3100-\u312F|\u31A0-\u31BF/;

type ConverterFunc = (s: string) => string;

// 建立兩個方向的 converter
const cn2tw: ConverterFunc =
  (OpenCC as any)?.Converter ? (OpenCC as any).Converter({ from: 'cn', to: 'tw' }) : (s: string) => s;

const tw2cn: ConverterFunc =
  (OpenCC as any)?.Converter ? (OpenCC as any).Converter({ from: 'tw', to: 'cn' }) : (s: string) => s;

export function shouldSkipConvert(s?: string | null): boolean {
  if (!s) return true;
  if (typeof s !== 'string') return true;
  if (!s.trim()) return true;
  if (SKIP_PATTERN.test(s)) return true;
  return false;
}

/**
 * 簡→繁（單次轉換）
 */
export function convertCn2TwFast(s: string): string {
  if (!s) return s;
  if (shouldSkipConvert(s)) return s;
  try {
    return cn2tw(s);
  } catch {
    return s;
  }
}

/**
 * 繁→簡（單次轉換）
 */
export function convertTw2CnFast(s: string): string {
  if (!s) return s;
  if (shouldSkipConvert(s)) return s;
  try {
    return tw2cn(s);
  } catch {
    return s;
  }
}

/**
 * 非同步安全轉換（簡→繁）
 */
export async function convertCn2TwSafeAsync(s: string): Promise<string> {
  if (!s) return s;
  if (shouldSkipConvert(s)) return s;
  try {
    return cn2tw(s);
  } catch {
    return s;
  }
}

/**
 * 非同步安全轉換（繁→簡）
 */
export async function convertTw2CnSafeAsync(s: string): Promise<string> {
  if (!s) return s;
  if (shouldSkipConvert(s)) return s;
  try {
    return tw2cn(s);
  } catch {
    return s;
  }
}
