# Core Exports

Install `@chiballc/utils` and import these values from the package root. This page covers every value and TypeScript type exported by that entry point.

```ts
import { execute, LRUCache, take } from "@chiballc/utils";
```

## Data helpers

### `Boolish`

`Boolish(value)` normalizes string representations of simple values. It trims strings, returns `true`, `false`, `null`, or `undefined` for those literal strings, returns `null` for an empty string, and otherwise returns the trimmed string. Values that are not strings are returned unchanged.

### `hasOwnProperties`

`hasOwnProperties(object, properties, options)` checks own properties rather than inherited ones. By default every requested property must exist. Set `partial` to accept any requested property, and set `allowNullish` to `false` when a present-but-falsy value should not count.

### `isEmpty`

`isEmpty(value)` returns `true` for nullish values, non-objects, and empty arrays, maps, sets, or objects. For objects, it checks own enumerable keys.

### `keys`

`keys(value, warn?)` is a generator that yields keys from objects, maps, sets, and arrays. For a string it yields the string itself. It refuses generators because consuming them for keys is ambiguous, and can warn when given an unsupported primitive.

### `entries`

`entries(value, warn?)` is a generator that yields `[key, value]` pairs. Objects use property keys, arrays use numeric indexes, maps and sets use their native entries, and iterable or generator values are indexed from zero. Asynchronous inputs produce an asynchronous generator.

### `values`

`values(value, warn?)` is the value-only counterpart to `entries`. It preserves map and set iteration semantics, indexes iterable and generator inputs internally, and becomes an asynchronous generator for asynchronous sources.

### `KeysFunc`

`KeysFunc` is the TypeScript call signature implemented by `keys`. It describes a generator of the input's key type and accepts the optional warning flag.

### `EntriesFunc`

`EntriesFunc` is the TypeScript call signature implemented by `entries`. It selects a synchronous or asynchronous generator based on the supplied source.

### `ValuesFunc`

`ValuesFunc` is the TypeScript call signature implemented by `values`. It models the generator type and value type inferred from the supplied source.

### `Peek`

`Peek` is the TypeScript overload interface for `peek`. It preserves the special return types for arrays, maps, sets, synchronous generators, and asynchronous generators.

### `isAsyncIterable`

`isAsyncIterable(value)` is a type guard for values with `Symbol.asyncIterator`. Use it before `for await...of` when the input type is not known.

### `omit`

`omit(object, key)` copies an object and removes one key or a list of keys. Dotted string paths remove nested properties from the copied result; the input object is not modified.

### `pick`

`pick(object, key)` copies selected keys into a new object. Dotted paths create the matching nested result. When given exactly one dotted path, it returns that nested value directly.

## Execution helpers

### `isPromise`

`isPromise(value)` checks for a truthy value with a `then` function. It is a lightweight thenable guard rather than a strict `Promise` constructor check.

### `execute`

`execute(valueOrFunctionOrPromise, ...args)` returns `{ result, error }`. It invokes functions with the supplied arguments, awaits promises, and captures thrown or rejected errors instead of throwing them from the immediate call site.

### `settle`

`settle(promises, onError?)` waits for all supplied promises and returns an array in the original order. Fulfilled positions contain their values; rejected positions contain `undefined` and are passed to `onError` when it is supplied.

### `race`

`race(promises)` resolves or rejects with the first settled promise. It rejects an empty input and falls back to an internal race implementation only on platforms without `Promise.race`.

### `makeThenable`

`makeThenable(source, promise)` returns a proxy that exposes the source object's properties and the promise's methods. This is useful when an object needs both an immediate API and awaitable completion.

## Generator helpers

### `isGenerator`

`isGenerator(value)` is a type guard for synchronous generator instances. It verifies the generator methods and generator identity without advancing the iterator.

### `isAsyncGenerator`

`isAsyncGenerator(value)` is the asynchronous equivalent of `isGenerator`. It does not call `next`, so it does not consume a value while checking.

### `mapOverGenerator`

`mapOverGenerator(generator, callback, options?)` calls `callback` for every yielded value and its zero-based index. It returns `void` for synchronous generators and a promise for asynchronous generators. `options.onReturn` receives the generator's final return value.

### `collectFromGenerator`

`collectFromGenerator(generator)` consumes a generator into an array. It returns an array for synchronous generators and a promise of an array for asynchronous generators.

### `joinGenerators`

`joinGenerators(...sources)` combines synchronous generators, asynchronous generators, and functions that produce either kind. It always returns an asynchronous generator and yields each source completely before moving to the next one.

## Collection helpers

### `peek`

`peek(value)` returns the first array item, map value, set value, iterable item, object value, or the value itself when it is not a collection. For generators it reads the first result and patches the generator so the next `next()` call returns that same result.

### `take`

`take(value, count, start?)` returns up to `count` values from an array, map, set, iterable, generator, object, or scalar. `start` defaults to zero. It warns before consuming a generator or iterator because that advances a non-reusable source.

### `toArray`

`toArray(value)` materializes maps, sets, generators, and other iterables into arrays. A string becomes a one-element array rather than a character array; a scalar also becomes a one-element array; nullish values become an empty array.

### `isIterable`

`isIterable(value)` is a type guard for values with `Symbol.iterator`. Strings are iterable, even though some collection helpers intentionally handle them as scalar values.

### `isFunction`

`isFunction(value)` is a type guard for JavaScript functions.

### `isNone`

`isNone(value)` is a type guard that returns `true` only for `null` and `undefined`.

## Number and locale helpers

### `toNumber`

`toNumber(value)` converts a value with `Number`, then falls back to `parseInt`. It logs and returns `0` when conversion cannot produce a number.

### `toFloat`

`toFloat(value)` converts a value with `Number`, then falls back to `parseFloat`. It logs and returns `0` when conversion fails.

### `toLocaleNumber`

`toLocaleNumber(value, locale?)` converts with `toNumber` and formats with zero minimum and maximum fraction digits.

### `toLocaleFloat`

`toLocaleFloat(value, locale?)` converts with `toFloat` and formats with exactly two minimum and maximum fraction digits.

## Timing helpers

### `debounce`

`debounce(function, delay?)` returns a function that waits until calls stop before invoking the original function. The default delay is 200 milliseconds, and the wrapper returns the most recent completed result.

### `throttle`

`throttle(function, limit)` returns a function that invokes the original at most once during each `limit` millisecond window. Calls inside the window return the last result.

### `sleep`

`sleep(milliseconds)` returns a promise that resolves after the supplied delay.

### `toMilliSeconds`

`toMilliSeconds(value, unit)` converts `"hr"`, `"min"`, or `"s"` to milliseconds. Passing `"ms"` is not supported and throws.

### `toSeconds`

`toSeconds(value, unit)` converts `"hr"`, `"min"`, or `"s"` to seconds. Passing `"ms"` is not supported and throws.

### `toHours`

`toHours(value, unit)` converts `"min"`, `"s"`, or `"ms"` to hours.

## Structures and algorithms

### `Queue`

`Queue<T>` is a FIFO queue. Create it with `new Queue<T>()`, add values with `enqueue`, remove the oldest value with `dequeue`, and read the current number of values through `length`. `dequeue` returns `null` when empty.

### `Cache`

`Cache<K, V>` is the abstract cache contract. It defines `get`, `set`, `has`, `delete`, `clear`, and `size` for implementations such as the two LRU caches.

### `LRUCache`

`LRUCache<K, V>` keeps a bounded number of recent values. `get` refreshes a value's recency, and `set` evicts the least recently used value when capacity is reached. Its constructor rejects a non-positive maximum size.

### `LRUTimeCache`

`LRUTimeCache<K, V>` adds a TTL to `LRUCache`. `set` defaults to a 60-second lifetime, `get` removes expired values, `has` respects expiry, and `update` replaces an existing value while keeping its TTL unless a new one is supplied.

### `binarySearch`

`binarySearch(sortedArray, target)` returns the target index or `-1`. For complex values, pass a comparator that receives an array item and one of `"<"`, `"="`, or `">"` and reports its relationship to the desired target.

### `ValidationError`

`ValidationError` is an `Error` subclass for failures that callers should identify as validation problems.

## Environment and identifiers

### `isVercel`

`isVercel` is evaluated at module load and is `true` when `VERCEL` or `NOW_REGION` exists in the process environment.

### `isDevelopment`

`isDevelopment` is evaluated at module load from `ENV` or `NODE_ENV`. It is `true` for `development` and `dev` values, including case-insensitive string forms.

### `isProduction`

`isProduction` is the inverse of `isDevelopment`.

### `isWebWorker`

`isWebWorker` is `true` when the current global scope is a `WorkerGlobalScope`.

### `isServiceWorker`

`isServiceWorker` is `true` when the current global scope is a `ServiceWorkerGlobalScope`.

### `isWorker`

`isWorker` is `true` when either `isWebWorker` or `isServiceWorker` is true.

### `kinoid`

`kinoid()` creates a stateful ID generator with `newId()` and `decodeId(id)`. `newId` creates a 17-character, base-36 identifier containing a time offset, sequence number, and process ID. `decodeId` returns those decoded fields or an error object. The identifiers are sortable and unique for the generator process, but are not cryptographic secrets.
