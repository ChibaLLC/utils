import type { GeneratorReturn, GeneratorValue, OneOf } from "@chiballc/types";
import { isPromise } from "./execute";

export function isAsyncGenerator(gen: any): gen is AsyncGenerator {
  // Check if it has the right structure without calling .next()
  return (
    gen &&
    typeof gen.next === "function" &&
    typeof gen.throw === "function" &&
    typeof gen.return === "function" &&
    (gen.constructor?.name === "AsyncGenerator" ||
      Object.getPrototypeOf(gen)?.constructor?.name === "AsyncGenerator" ||
      gen[Symbol.toStringTag] === "AsyncGenerator")
  );
}

export function isGenerator(gen: any): gen is Generator {
  return (
    gen &&
    typeof gen.next === "function" &&
    typeof gen.throw === "function" &&
    typeof gen.return === "function" &&
    (gen.constructor?.name === "Generator" ||
      Object.getPrototypeOf(gen)?.constructor?.name === "Generator" ||
      gen[Symbol.toStringTag] === "Generator")
  );
}

/**
 * Maps over values produced by a generator or async generator.
 *
 * @param it - The generator or async generator to map over
 * @param func - The function to apply to each value
 * @param options - Optional configuration
 * @returns A new generator or async generator with mapped values
 */
export function mapOverGenerator<T extends Generator<any, any, any>>(
  it: T,
  func: (value: GeneratorValue<T>, index: number) => any,
  options?: {
    onReturn?: (value: GeneratorReturn<T>) => void;
  },
): void;
export async function mapOverGenerator<T extends AsyncGenerator<any, any, any>>(
  it: T,
  func: (value: GeneratorValue<T>, index: number) => any,
  options?: {
    onReturn?: (value: GeneratorReturn<T>) => void;
  },
): Promise<void>;
export function mapOverGenerator<T extends OneOf<[Generator<any, any, any>, AsyncGenerator<any, any, any>]>>(
  it: T,
  func: (value: GeneratorValue<T>, index: number) => any,
  options?: {
    onReturn?: (value: GeneratorReturn<T>) => void;
  },
): void | Promise<void> {
  if (isAsyncGenerator(it)) {
    return (async () => {
      let result;
      let index = 0;

      try {
        while (!(result = await it.next()).done) {
          const funcResult = func(result.value as GeneratorValue<T>, index++);
          if (isPromise(funcResult)) {
            await funcResult;
          }
        }

        if (options?.onReturn && result) {
          options.onReturn(result.value);
        }
      } catch (error) {
        await it.throw(error);
        throw error;
      }
    })();
  }

  // Handle synchronous generators
  let result;
  let index = 0;

  try {
    while (!(result = it.next()).done) {
      func(result.value as GeneratorValue<T>, index++);
    }

    if (options?.onReturn && result) {
      options.onReturn(result.value);
    }
  } catch (error) {
    it.throw?.(error);
    throw error;
  }
}

/**
 * Collects all values from a generator or async generator into an array.
 * Returns a Promise if the generator is async, otherwise returns an array.
 */
export function collectFromGenerator<T extends Generator<any, any, any>>(it: T): GeneratorValue<T>[];
export async function collectFromGenerator<T extends AsyncGenerator<any, any, any>>(
  it: T,
): Promise<GeneratorValue<T>[]>;
export function collectFromGenerator<T extends OneOf<[Generator<any, any, any>, AsyncGenerator<any, any, any>]>>(
  it: T,
): GeneratorValue<T>[] | Promise<GeneratorValue<T>[]> {
  if (isAsyncGenerator(it)) {
    return (async () => {
      const results: GeneratorValue<T>[] = [];
      await mapOverGenerator(it, (value) => {
        results.push(value);
      });
      return results;
    })();
  }

  const results: GeneratorValue<T>[] = [];
  mapOverGenerator(it, (value) => {
    results.push(value);
  });
  return results;
}

/**
 * Joins multiple generators or async generators into a single async generator.
 * Supports generator instances or functions that return generators.
 */
export async function* joinGenerators<T, Ret = any, Nxt = any>(
  ...sources: Array<
    | Generator<T, Ret, Nxt>
    | AsyncGenerator<T, Ret, Nxt>
    | (() => Generator<T, Ret, Nxt>)
    | (() => AsyncGenerator<T, Ret, Nxt>)
  >
): AsyncGenerator<T> {
  for (const source of sources) {
    const iterator = typeof source === "function" ? source() : source;

    if (isAsyncGenerator(iterator)) {
      for await (const value of iterator as AsyncGenerator<T>) {
        yield value;
      }
    } else if (isGenerator(iterator)) {
      for (const value of iterator as Generator<T>) {
        yield value;
      }
    } else {
      throw new TypeError("Invalid generator input");
    }
  }
}
