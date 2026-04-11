import type {
  GeneratorValue,
  IterableKind,
  JSFunction,
  MapEntries,
  None,
  SetItem,
  UnArray,
  MaybeArray,
} from "@chiballc/types";
import { collectFromGenerator, isAsyncGenerator, isGenerator, values, isPromise } from "./index";

export function debounce<T extends (...args: any[]) => any>(func: T, delay: number = 200) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastResult: ReturnType<T>;

  return (...args: Parameters<T>): ReturnType<T> => {
    lastArgs = args;
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      if (lastArgs) {
        lastResult = func(...lastArgs);
      }
    }, delay);

    return lastResult;
  };
}

export function throttle<T extends (...args: any[]) => any>(func: T, limit: number) {
  let lastCall = 0;
  let lastResult: ReturnType<T>;
  return (...args: Parameters<T>): ReturnType<T> => {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      lastResult = func(...args);
    }
    return lastResult;
  };
}

export function toNumber(n: any) {
  if (!n) return 0;
  if (typeof n === "number") return n;
  try {
    let num = Number(n);
    if (Number.isNaN(num)) {
      num = parseInt(n);
    }

    if (isNaN(num)) {
      console.error("encountered a NaN");
      num = 0;
    }

    return num;
  } catch (e) {
    console.error(e);
    return 0;
  }
}

export function toFloat(n: any) {
  if (!n) return 0.0;
  if (typeof n === "number") return n;
  try {
    let num = Number(n);
    if (Number.isNaN(num)) {
      num = parseFloat(n);
    }

    if (isNaN(num)) {
      console.warn("encountered a NaN", n);
      num = 0;
    }

    return num;
  } catch (e) {
    console.error(e);
    return 0;
  }
}

export function toLocaleFloat(n: any, locale?: Intl.LocalesArgument) {
  const num = toFloat(n);
  return num.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function toLocaleNumber(n: any, locale?: Intl.LocalesArgument) {
  const num = toNumber(n);
  return num.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function isFunction<T extends JSFunction>(param: any): param is T {
  if (typeof param === "function") {
    return true;
  }
  return false;
}

export function isIterable<T = any>(obj: unknown): obj is Iterable<T> {
  return obj != null && typeof (obj as any)[Symbol.iterator] === "function";
}

export function peek<T>(item?: T[]): T | undefined;
export function peek<T>(item?: Set<T>): T | undefined;
export function peek<K, V>(item?: Map<K, V>): V | undefined;
export function peek<TGen extends Generator<any, any, any>>(item?: TGen): GeneratorValue<TGen> | undefined;
export function peek<TGen extends AsyncGenerator<any, any, any>>(
  item?: TGen,
): Promise<GeneratorValue<TGen> | undefined>;
export function peek<T>(item?: MaybeArray<T>): UnArray<T> | undefined;
export function peek(item: any): any {
  if (Array.isArray(item)) {
    return item.at(0);
  }

  if (item instanceof Map || item instanceof Set) {
    return item.values().next().value;
  }

  if (isGenerator(item) || isAsyncGenerator(item)) {
    const nextResult = item.next();

    const isNextPromise = isPromise(nextResult);
    const first = isNextPromise ? nextResult.then((r) => r.value) : nextResult.value;

    let usedFirst = false;
    const originalNext = item.next.bind(item);

    // @ts-ignore
    item.next = function (...args: any[]) {
      if (!usedFirst) {
        usedFirst = true;
        return isNextPromise ? Promise.resolve({ value: first, done: false }) : { value: first, done: false };
      }
      // @ts-ignore
      return originalNext(...args);
    };

    return first;
  }

  if (typeof item !== "string" && isIterable(item)) {
    for (const first of item) {
      return first;
    }
  }

  if (typeof item === "object") {
    return values(item).next().value;
  }

  return item;
}

export function take<T>(item: T[], n: number, start?: number): T[];
export function take<T>(item: Set<T>, n: number, start?: number): T[];
export function take<K, V>(item: Map<K, V>, n: number, start?: number): V[];
export function take<TGen extends Generator<any, any, any>>(
  item: TGen,
  n: number,
  start?: number,
): GeneratorValue<TGen>[];
export function take<TGen extends AsyncGenerator<any, any, any>>(
  item: TGen,
  n: number,
  start?: number,
): Promise<GeneratorValue<TGen>[]>;
export function take<T>(item: MaybeArray<T>, n: number, start?: number): T[];
export function take(item: any, n: number, start: number = 0): any {
  if (n <= 0) return [];

  const warnIfNonMaterialized = (source: string) => {
    console.warn(
      `[take] Warning: The provided input is a ${source} (not materialized). ` +
        `Consuming it will advance its internal state and it cannot be reused.`,
    );
  };

  // Arrays
  if (Array.isArray(item)) {
    return item.slice(start, start + n);
  }

  // Sets and Maps
  if (item instanceof Set) {
    return Array.from(item).slice(start, start + n);
  }
  if (item instanceof Map) {
    return Array.from(item.values()).slice(start, start + n);
  }

  // Sync Generator
  if (isGenerator(item)) {
    warnIfNonMaterialized("synchronous generator");

    const result: any[] = [];
    let index = 0;
    while (true) {
      const next = item.next();
      if (next.done) break;

      if (index >= start && result.length < n) {
        result.push(next.value);
      }

      if (result.length >= n) break;
      index++;
    }
    return result;
  }

  // Async Generator
  if (isAsyncGenerator(item)) {
    warnIfNonMaterialized("asynchronous generator");

    return (async () => {
      const result: any[] = [];
      let index = 0;
      for await (const value of item) {
        if (index >= start && result.length < n) {
          result.push(value);
        }
        if (result.length >= n) break;
        index++;
      }
      return result;
    })();
  }

  // Iterables (non-materialized iterators)
  if (typeof item !== "string" && isIterable(item)) {
    if (isIterator(item)) {
      warnIfNonMaterialized("iterator");
    }
    return Array.from(item).slice(start, start + n);
  }

  // Primitive or Object
  if (typeof item === "object" && item !== null) {
    return Object.values(item).slice(start, start + n);
  }

  // Fallback for non-iterables
  return [item];
}

// Example helper to detect iterators
function isIterator(obj: any): boolean {
  return obj != null && typeof obj.next === "function";
}

export function toArray<T extends Map<any, any>>(map: T | None): MapEntries<T>;
export function toArray<T extends Set<any>>(set: T | None): SetItem<T>[];
export function toArray<T>(items: T | IterableKind<T> | None): T[];
export function toArray(items: any) {
  if (!items) return [] as any;

  if (typeof items === "string") {
    return [items] as any;
  }

  if (Array.isArray(items)) {
    return items as any;
  }

  if (isGenerator(items)) {
    return collectFromGenerator(items) as any;
  }

  if (isIterable(items)) {
    return Array.from(items as any) as any;
  }

  return [items] as any;
}

export function isNone(v: any): v is undefined | null {
  return v === undefined || v === null;
}

export async function settle<T extends readonly unknown[]>(
  promises: readonly [...{ [K in keyof T]: Promise<T[K]> }],
): Promise<{ [K in keyof T]: T[K] | undefined }> {
  const results = await Promise.allSettled(promises);

  return results.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    } else {
      const log = (globalThis as any).console || console;
      log.error(`Promise at index ${index} failed:`, result.reason);
      // @ts-ignore
      if (globalThis.$alert && globalThis.$alert.error && typeof globalThis.$alert.error === "function") {
        // @ts-ignore
        globalThis.$alert.error("An error occured: " + result.reason);
      }
      return undefined;
    }
  }) as { [K in keyof T]: T[K] | undefined };
}

/**
 * Safe wrapper for Promise.race with a local shim if it's not available.
 */
export async function race<T extends readonly unknown[]>(
  promises: readonly [...{ [K in keyof T]: Promise<T[K]> }],
): Promise<T[number]> {
  if (promises.length === 0) {
    throw new Error("Promise.race called with no promises");
  }

  const log = (globalThis as any).console || console;
  const raceShim = async (promises: readonly [...{ [K in keyof T]: Promise<T[K]> }]): Promise<T[number]> => {
    return new Promise((resolve, reject) => {
      let settled = false;

      for (const p of promises) {
        p.then(
          (value) => {
            if (!settled) {
              settled = true;
              resolve(value);
            }
          },
          (error) => {
            if (!settled) {
              settled = true;
              reject(error);
            }
          },
        );
      }
    });
  };

  try {
    const raceFn = typeof Promise.race === "function" ? Promise.race.bind(Promise) : raceShim;
    return await raceFn(promises);
  } catch (error) {
    log.error("Promise.race failed:", error);
    if ((globalThis as any).$alert?.error) {
      (globalThis as any).$alert.error("An error occurred: " + (error as Error).message);
    }

    throw error;
  }
}

export function assertTruthy<T>(value: T, message?: string): asserts value is NonNullable<T> {
  if (!value) {
    throw new Error(message || "Expected value to be truthy, but got falsy value.");
  }
}

export function makeThenable<T, S extends object>(source: S, promise: Promise<T>) {
  const thenable = new Proxy(source as S & Promise<T>, {
    get(target, prop, receiver) {
      if (prop in promise) {
        // @ts-ignore
        const value = promise[prop];
        return typeof value === "function" ? value.bind(promise) : value;
      }
      return Reflect.get(target, prop, receiver);
    },
  });
  return thenable as S & Promise<T>;
}

export function getRandomId() {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}
