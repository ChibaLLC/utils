import type { Keys, Ommit, PPick, Prettify, None } from "@chiballc/types";
import { isAsyncGenerator, isGenerator } from "./generator";
import { isIterable } from "./tools";

/**
 * This function is used to convert a string to a truthy or falsy value.
 *
 * The truthy values are: `true`, `false` or the string itself.
 * The falsy values are: `null` and `undefined`.
 *
 * It takes care of trimming the string and converting it to lowercase.
 * It returns null, true, false, undefined or the original value.
 *
 *
 * @example
 *
 * Boolish("true") // true
 *
 * Boolish("FALSE") // false
 *
 * Boolish("null") // null
 *
 * Boolish("undefined") // undefined
 *
 * Boolish("hello") // "hello"
 *
 * Boolish("") // null
 *
 * Boolish(" ") // null
 *
 * Boolish("TRUE") // true
 *
 */
type MaybeValue<T> = T extends undefined ? null | boolean | string | undefined | any : T;
export function Boolish<T = undefined>(val: any): MaybeValue<T> {
  if (typeof val !== "string") return val;
  val = val.trim();
  switch (true) {
    case val === "":
    case val === "null":
      return null as MaybeValue<T>;
    case val === "true":
      return true as MaybeValue<T>;
    case val === "false":
      return false as MaybeValue<T>;
    case val === "undefined":
      return undefined as MaybeValue<T>;
    default:
      return val;
  }
}

/**
 * This function is used to check if an object has a list of properties.
 *
 * It returns true if the object has all the properties, false otherwise.
 *
 * If `allowNullish` is set to true, it will also check if the property is truthy.
 *
 * @example
 *
 * const obj = {name: "John", age: 20, address: null}
 *
 * hasOwnProperties(obj, ["name", "age"]) // true
 *
 * hasOwnProperties(obj, ["name", "age", "sex"]) // false
 *
 * hasOwnProperties(obj, ["name", "age", "address"], {allowNullish: true}) // false
 */
export function hasOwnProperties<T extends Object>(
  obj: T | any,
  properties: (keyof T)[],
  {
    allowNullish,
    partial,
  }: {
    allowNullish?: boolean;
    partial?: boolean;
  } = {
    allowNullish: true,
    partial: false,
  },
): obj is T {
  if (!obj) return false;
  if (typeof obj !== "object") return false;
  const predicate = (property: keyof T) => {
    if (allowNullish) return Object.prototype.hasOwnProperty.call(obj, property);
    return Object.prototype.hasOwnProperty.call(obj, property) && Boolish<T>(obj[property]);
  };

  if (partial) {
    return properties.some(predicate);
  }

  return properties.every(predicate);
}

export function isEmpty<T extends Object | None>(obj: T | any): obj is None {
  if (!obj) return true;
  if (typeof obj !== "object") return true;
  if (Array.isArray(obj)) return obj.length === 0;
  if (obj instanceof Map) return obj.size === 0;
  if (obj instanceof Set) return obj.size === 0;

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return false;
    }
  }

  return true;
}

type ExtractValue<T> =
  T extends Map<any, infer V>
    ? V
    : T extends Set<infer V>
      ? V
      : T extends (infer V)[]
        ? V
        : T extends AsyncGenerator<infer V>
          ? V
          : T extends AsyncIterator<infer V>
            ? V
            : T extends AsyncIterable<infer V>
              ? V
              : T extends Generator<infer V>
                ? V
                : T extends Iterator<infer V>
                  ? V
                  : T extends Iterable<infer V>
                    ? V
                    : T extends object
                      ? T[keyof T]
                      : never;

type ExtractKey<T> =
  T extends Map<infer K, any>
    ? K
    : T extends Set<infer V>
      ? V
      : T extends any[]
        ? number
        : T extends object
          ? keyof T
          : never;

type ExtractEntry<T> =
  T extends Map<infer K, infer V>
    ? [K, V]
    : T extends Set<infer V>
      ? [V, V]
      : T extends (infer V)[]
        ? [number, V]
        : T extends AsyncGenerator<infer V>
          ? [number, V]
          : T extends AsyncIterator<infer V>
            ? [number, V]
            : T extends AsyncIterable<infer V>
              ? [number, V]
              : T extends Generator<infer V>
                ? [number, V]
                : T extends Iterator<infer V>
                  ? [number, V]
                  : T extends Iterable<infer V>
                    ? [number, V]
                    : T extends object
                      ? [keyof T, T[keyof T]]
                      : never;

type ReturnGenerator<T> = T extends AsyncGenerator<any> | AsyncIterator<any> | AsyncIterable<any>
  ? AsyncGenerator<ExtractValue<T>>
  : Generator<ExtractValue<T>>;

type ReturnGeneratorEntry<T> = T extends AsyncGenerator<any> | AsyncIterator<any> | AsyncIterable<any>
  ? AsyncGenerator<ExtractEntry<T>>
  : Generator<ExtractEntry<T>>;

type ExtractPeekValue<T> = T extends (infer V)[]
  ? V
  : T extends Set<infer V>
    ? V
    : T extends Map<any, infer V>
      ? V
      : T extends Generator<infer V, any, any>
        ? V
        : T extends AsyncGenerator<infer V, any, any>
          ? V
          : T extends Iterator<infer V>
            ? V
            : T extends AsyncIterator<infer V>
              ? V
              : T extends Iterable<infer V>
                ? V
                : T extends AsyncIterable<infer V>
                  ? V
                  : T extends object
                    ? T[keyof T]
                    : T;

type PeekReturn<T> = T extends AsyncGenerator<any, any, any> | AsyncIterator<any> | AsyncIterable<any>
  ? Promise<ExtractPeekValue<T> | undefined>
  : ExtractPeekValue<T> | undefined;

export interface KeysFunc {
  <T>(obj: T | None, warn?: boolean): Generator<ExtractKey<T>>;
}

export interface EntriesFunc {
  <T>(obj: T | None, warn?: boolean): ReturnGeneratorEntry<T>;
}

export interface ValuesFunc {
  <T>(obj: T | None, warn?: boolean): ReturnGenerator<T>;
}

export interface Peek {
  <T>(item?: T): PeekReturn<T>;
}

export const keys: KeysFunc = function* <T>(obj: T | None, warn = true): Generator<any> {
  if (!obj) {
    return;
  }

  if (obj instanceof Map) {
    yield* obj.keys();
    return;
  }

  if (obj instanceof Set) {
    yield* obj.keys();
    return;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      yield i;
    }
    return;
  }

  if (typeof obj === "string") {
    yield obj;
    return;
  }

  if (typeof obj !== "object") {
    if (warn) console.warn("None object passed to function.", obj);
    return;
  }

  if (isGenerator(obj) || isAsyncGenerator(obj)) {
    console.error("Generator passed to function.", obj);
    return;
  }

  for (const key in obj) {
    yield key;
  }
};

export function isAsyncIterable<T = any>(obj: unknown): obj is AsyncIterable<T> {
  return obj != null && typeof (obj as any)[Symbol.asyncIterator] === "function";
}

export const entries: EntriesFunc = function* <T>(obj: T | None, warn = true): Generator<any> | AsyncGenerator<any> {
  if (obj instanceof Map) {
    yield* obj.entries();
    return;
  }

  if (obj instanceof Set) {
    yield* obj.entries();
    return;
  }

  if (isAsyncGenerator(obj)) {
    const gen = async function* () {
      let index = 0;
      for await (const value of obj) {
        yield [index++, value] as [number, any];
      }
    };
    return gen() as any;
  }

  if (isAsyncIterable(obj)) {
    const gen = async function* () {
      let index = 0;
      for await (const value of obj) {
        yield [index++, value] as [number, any];
      }
    };
    return gen() as any;
  }

  if (isGenerator(obj)) {
    let index = 0;
    for (const value of obj) {
      yield [index++, value];
    }
    return;
  }

  if (isIterable(obj) && !Array.isArray(obj) && typeof obj !== "string") {
    let index = 0;
    for (const value of obj) {
      yield [index++, value];
    }
    return;
  }

  for (const key of keys(obj, warn)) {
    yield [key, (obj as any)[key]];
  }
} as any;

export const values: ValuesFunc = function* <T>(obj: T | None, warn = true): Generator<any> | AsyncGenerator<any> {
  if (obj instanceof Map) {
    yield* obj.values();
    return;
  }

  if (obj instanceof Set) {
    yield* obj.values();
    return;
  }

  if (isAsyncGenerator(obj)) {
    const gen = async function* () {
      for await (const value of obj) {
        yield value;
      }
    };
    return gen() as any;
  }

  if (isAsyncIterable(obj)) {
    const gen = async function* () {
      for await (const value of obj) {
        yield value;
      }
    };
    return gen() as any;
  }

  if (isGenerator(obj)) {
    for (const value of obj) {
      yield value;
    }
    return;
  }

  if (isIterable(obj) && !Array.isArray(obj) && typeof obj !== "string") {
    for (const value of obj) {
      yield value;
    }
    return;
  }

  for (const key of keys(obj, warn)) {
    yield (obj as any)[key];
  }
} as any;



// TODO: Perf need to go brr
export function omit<T extends object, K extends Keys<T>>(data: T, key?: K | Array<K>): Prettify<Ommit<T, K>> {
  if (!data) return data;
  if (!key) {
    return data as any;
  }

  const keysToRemove = new Set(Array.isArray(key) ? key : [key]);
  const result: any = {};

  // First, copy all properties
  for (const k in data) {
    if (Object.prototype.hasOwnProperty.call(data, k)) {
      result[k] = data[k];
    }
  }

  // Then remove the specified keys (including nested ones)
  for (const keyToRemove of keysToRemove) {
    if (typeof keyToRemove === "string" && keyToRemove.includes(".")) {
      // Handle nested path removal
      const keys = keyToRemove.split(".");
      let current = result;

      for (let i = 0; i < keys.length - 1; i++) {
        if (current && typeof current === "object" && keys[i]! in current) {
          current = current[keys[i]!];
        } else {
          break;
        }
      }

      if (current && typeof current === "object") {
        delete current[keys[keys.length - 1]!];
      }
    } else {
      // Handle top-level property removal
      delete result[keyToRemove];
    }
  }

  return result as Prettify<Ommit<T, K>>;
}

// Helper function to get nested property value
function getNestedValue<T extends object>(obj: T, path: string): any {
  return path.split(".").reduce((current: any, key: string) => {
    return current && current[key];
  }, obj);
}

// Helper function to set nested property value
function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split(".");
  const lastKey = keys.pop()!;
  const target = keys.reduce((current: any, key: string) => {
    if (!(key in current)) {
      current[key] = {};
    }
    return current[key];
  }, obj);
  target[lastKey] = value;
}
export function pick<T extends object, K extends Keys<T>>(data: T, key: K | Array<K>): Prettify<PPick<T, K>> {
  if (!data) return {} as any;
  if (!key) {
    return data as any;
  }

  const keysToPick = Array.isArray(key) ? key : [key];

  // If picking a single nested property, return just the value
  if (keysToPick.length === 1 && typeof keysToPick[0] === "string" && keysToPick[0].includes(".")) {
    return getNestedValue(data, keysToPick[0]);
  }

  const result: any = {};

  for (const keyToPick of keysToPick) {
    if (typeof keyToPick === "string" && keyToPick.includes(".")) {
      // Handle nested property picking
      const value = getNestedValue(data, keyToPick);
      if (value !== undefined) {
        setNestedValue(result, keyToPick, value);
      }
    } else {
      // Handle top-level property picking
      if (Object.prototype.hasOwnProperty.call(data, keyToPick)) {
        // @ts-ignore
        result[keyToPick] = data[keyToPick];
      }
    }
  }

  return result;
}