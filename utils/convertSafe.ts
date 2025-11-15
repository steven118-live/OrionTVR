// utils/convertSafe.ts
import OpenCC from 'opencc-js';

const converter = (OpenCC as any).Converter ? (OpenCC as any).Converter({ from: 'cn', to: 'tw' }) : (s: string) => s;
const convertCache = new Map<string, string>();
const SKIP_PATTERN = /https?:\/\/|\bRev\d+\b|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b|[`<>]/;
const MAX_STRING_LENGTH = 1024;

// circuit breaker state (in-memory, process-lifetime)
let failureCount = 0;
let successCount = 0;
let circuitOpenUntil = 0; // timestamp ms

const FAILURE_THRESHOLD = 5; // 連續失敗門檻（或短時間內）
const OPEN_DURATION_MS = 60_000; // 打開短路的持續時間（1 分鐘）
const CONVERT_TIMEOUT_MS = 80; // 每次轉換時間預算（ms）

function isCircuitOpen() {
  return Date.now() < circuitOpenUntil;
}

function recordFailure() {
  failureCount += 1;
  successCount = 0;
  if (failureCount >= FAILURE_THRESHOLD) {
    circuitOpenUntil = Date.now() + OPEN_DURATION_MS;
    console.warn('[convertSafe] circuit opened due to repeated failures');
  }
}

function recordSuccess() {
  successCount += 1;
  failureCount = 0;
  if (successCount > 10 && isCircuitOpen()) {
    circuitOpenUntil = 0; // 恢復
    console.info('[convertSafe] circuit closed after successes');
  }
}

export function shouldSkipConvert(s: string | undefined | null) {
  if (!s || typeof s !== 'string') return true;
  if (!/[\u4e00-\u9fff]/.test(s)) return true;
  if (SKIP_PATTERN.test(s)) return true;
  if (s.length > MAX_STRING_LENGTH) return true;
  return false;
}

export async function convertSafeAsync(s: string): Promise<string> {
  if (isCircuitOpen()) return s;
  if (shouldSkipConvert(s)) return s;

  const cached = convertCache.get(s);
  if (cached) return cached;

  // promise wrapper with timeout
  const p = new Promise<string>((resolve) => {
    try {
      // synchronous converter can be heavy; run inside setTimeout to avoid blocking render
      setTimeout(() => {
        try {
          const out = typeof converter === 'function' ? converter(s) : s;
          resolve(String(out));
        } catch (e) {
          console.warn('[convertSafe] convert error', e);
          resolve(s);
        }
      }, 0);
    } catch (e) {
      console.warn('[convertSafe] scheduling error', e);
      resolve(s);
    }
  });

  // enforce timeout
  const timeout = new Promise<string>((resolve) => {
    setTimeout(() => resolve(s), CONVERT_TIMEOUT_MS);
  });

  const result = await Promise.race([p, timeout]);
  if (result !== s) {
    convertCache.set(s, result);
    recordSuccess();
  } else {
    // we treat equal-to-input as either a no-op conversion or fallback
    // If converter threw, we will have returned original: count as failure only if converter threw earlier (we log above)
    recordFailure();
  }
  return result;
}

// synchronous helper that attempts fast path using cache; otherwise return original and let async replace later
export function convertFastIfCached(s: string): string {
  if (shouldSkipConvert(s)) return s;
  const cached = convertCache.get(s);
  return cached ?? s;
}