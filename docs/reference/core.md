# Core Exports

Install `@chiballc/utils` and import these values from the package root. This page covers every value and TypeScript type exported by that entry point. Unless a snippet shows a narrower import, its identifiers come from this root import.

```ts
import { execute, LRUCache, take } from "@chiballc/utils";
```

## Data helpers

### `Boolish`

`Boolish(value)` normalizes string representations of simple values. It trims strings, returns `true`, `false`, `null`, or `undefined` for those literal strings, returns `null` for an empty string, and otherwise returns the trimmed string. Values that are not strings are returned unchanged.

```ts
Boolish(" true "); // true
Boolish(42); // 42
```

### `hasOwnProperties`

`hasOwnProperties(object, properties, options)` checks own properties rather than inherited ones. By default every requested property must exist. Set `partial` to accept any requested property, and set `allowNullish` to `false` when a present-but-falsy value should not count.

```ts
const profile = { name: "Ada", enabled: false };
hasOwnProperties(profile, ["name"]); // true
hasOwnProperties(profile, ["name", "missing"], { partial: true }); // true
```

### `isEmpty`

`isEmpty(value)` returns `true` for nullish values, non-objects, and empty arrays, maps, sets, or objects. For objects, it checks own enumerable keys.

```ts
isEmpty({}); // true
isEmpty(new Set(["ready"])); // false
```

### `keys`

`keys(value, warn?)` is a generator that yields keys from objects, maps, sets, and arrays. For a string it yields the string itself. It refuses generators because consuming them for keys is ambiguous, and can warn when given an unsupported primitive.

```ts
const getKeys: KeysFunc = keys;
[...getKeys({ theme: "dark" })]; // ["theme"]
```

### `entries`

`entries(value, warn?)` is a generator that yields `[key, value]` pairs. Objects use property keys, arrays use numeric indexes, maps and sets use their native entries, and iterable or generator values are indexed from zero. Asynchronous inputs produce an asynchronous generator.

```ts
[...entries(["a", "b"])]; // [[0, "a"], [1, "b"]]
async function* stream() {
  yield "event";
}
for await (const entry of entries(stream())) console.log(entry);
```

### `values`

`values(value, warn?)` is the value-only counterpart to `entries`. It preserves map and set iteration semantics, indexes iterable and generator inputs internally, and becomes an asynchronous generator for asynchronous sources.

```ts
const getValues: ValuesFunc = values;
[...getValues(new Set(["a", "b"]))]; // ["a", "b"]
```

### `KeysFunc`

`KeysFunc` is the TypeScript call signature implemented by `keys`. It describes a generator of the input's key type and accepts the optional warning flag.

```ts
const getKeys: KeysFunc = keys;
const objectKeys = [...getKeys({ id: 1 })]; // string[]
```

### `EntriesFunc`

`EntriesFunc` is the TypeScript call signature implemented by `entries`. It selects a synchronous or asynchronous generator based on the supplied source.

```ts
const getEntries: EntriesFunc = entries;
const pairs = [...getEntries({ id: 1 })]; // [["id", 1]]
```

### `ValuesFunc`

`ValuesFunc` is the TypeScript call signature implemented by `values`. It models the generator type and value type inferred from the supplied source.

```ts
const getValues: ValuesFunc = values;
const items = [...getValues({ id: 1 })]; // [1]
```

### `Peek`

`Peek` is the TypeScript overload interface for `peek`. It preserves the special return types for arrays, maps, sets, synchronous generators, and asynchronous generators.

```ts
const first: Peek = peek;
const item = first(["first", "second"]); // string | undefined
```

### `isAsyncIterable`

`isAsyncIterable(value)` is a type guard for values with `Symbol.asyncIterator`. Use it before `for await...of` when the input type is not known.

```ts
if (isAsyncIterable<string>(source)) {
  for await (const value of source) console.log(value);
}
```

### `omit`

`omit(object, key)` copies an object and removes one key or a list of keys. Dotted string paths remove nested properties from the copied result; the input object is not modified.

```ts
omit({ id: 1, secret: "x", user: { email: "a@b.test" } }, ["secret", "user.email"]);
// { id: 1, user: {} }
```

### `pick`

`pick(object, key)` copies selected keys into a new object. Dotted paths create the matching nested result. When given exactly one dotted path, it returns that nested value directly.

```ts
pick({ id: 1, user: { name: "Ada" } }, ["id", "user.name"]);
pick({ user: { name: "Ada" } }, "user.name"); // "Ada"
```

## Execution helpers

### `isPromise`

`isPromise(value)` checks for a truthy value with a `then` function. It is a lightweight thenable guard rather than a strict `Promise` constructor check.

```ts
isPromise(Promise.resolve("ready")); // true
isPromise({ then() {} }); // true
```

### `execute`

`execute(valueOrFunctionOrPromise, ...args)` returns `{ result, error }`. It invokes functions with the supplied arguments, awaits promises, and captures thrown or rejected errors instead of throwing them from the immediate call site.

```ts
execute(42); // { result: 42, error: undefined }
execute((name: string) => name.toUpperCase(), "ada");
await execute(Promise.resolve({ ok: true }));
```

### `settle`

`settle(promises, onError?)` waits for all supplied promises and returns an array in the original order. Fulfilled positions contain their values; rejected positions contain `undefined` and are passed to `onError` when it is supplied.

```ts
const [profile, settings] = await settle([getProfile(), getSettings()], (index, error) => {
  console.warn(`Request ${index} failed`, error.reason);
});
```

### `race`

`race(promises)` resolves or rejects with the first settled promise. It rejects an empty input and falls back to an internal race implementation only on platforms without `Promise.race`.

```ts
const response = await race([fetch("/primary"), fetch("/replica")]);
```

### `makeThenable`

`makeThenable(source, promise)` returns a proxy that exposes the source object's properties and the promise's methods. This is useful when an object needs both an immediate API and awaitable completion.

```ts
const task = makeThenable({ id: "sync-id" }, Promise.resolve("complete"));
task.id; // "sync-id"
await task; // "complete"
```

## Generator helpers

### `isGenerator`

`isGenerator(value)` is a type guard for synchronous generator instances. It verifies the generator methods and generator identity without advancing the iterator.

```ts
function* pages() {
  yield 1;
}
isGenerator(pages()); // true
```

### `isAsyncGenerator`

`isAsyncGenerator(value)` is the asynchronous equivalent of `isGenerator`. It does not call `next`, so it does not consume a value while checking.

```ts
async function* pages() {
  yield 1;
}
isAsyncGenerator(pages()); // true
```

### `mapOverGenerator`

`mapOverGenerator(generator, callback, options?)` calls `callback` for every yielded value and its zero-based index. It returns `void` for synchronous generators and a promise for asynchronous generators. `options.onReturn` receives the generator's final return value.

```ts
function* ids() {
  yield "a";
  return "done";
}
mapOverGenerator(ids(), (id, index) => console.log(index, id), {
  onReturn: (result) => console.log(result),
});
```

### `collectFromGenerator`

`collectFromGenerator(generator)` consumes a generator into an array. It returns an array for synchronous generators and a promise of an array for asynchronous generators.

```ts
function* ids() {
  yield "a";
  yield "b";
}
collectFromGenerator(ids()); // ["a", "b"]
```

### `joinGenerators`

`joinGenerators(...sources)` combines synchronous generators, asynchronous generators, and functions that produce either kind. It always returns an asynchronous generator and yields each source completely before moving to the next one.

```ts
function* local() {
  yield "local";
}
async function* remote() {
  yield "remote";
}
for await (const value of joinGenerators(local(), remote)) console.log(value);
```

## Collection helpers

### `peek`

`peek(value)` returns the first array item, map value, set value, iterable item, object value, or the value itself when it is not a collection. For generators it reads the first result and patches the generator so the next `next()` call returns that same result.

```ts
peek(["first", "second"]); // "first"
peek(new Map([["id", 42]])); // 42
peek({ status: "ready" }); // "ready"
```

### `take`

`take(value, count, start?)` returns up to `count` values from an array, map, set, iterable, generator, object, or scalar. `start` defaults to zero. It warns before consuming a generator or iterator because that advances a non-reusable source.

```ts
take(["a", "b", "c"], 2); // ["a", "b"]
take(new Set(["a", "b", "c"]), 1, 1); // ["b"]
take({ first: "a", second: "b" }, 1); // ["a"]
```

### `toArray`

`toArray(value)` materializes maps, sets, generators, and other iterables into arrays. A string becomes a one-element array rather than a character array; a scalar also becomes a one-element array; nullish values become an empty array.

```ts
toArray(new Map([["id", 42]])); // [["id", 42]]
toArray("one"); // ["one"]
toArray(null); // []
```

### `isIterable`

`isIterable(value)` is a type guard for values with `Symbol.iterator`. Strings are iterable, even though some collection helpers intentionally handle them as scalar values.

```ts
isIterable([1, 2]); // true
isIterable("text"); // true
isIterable({}); // false
```

### `isFunction`

`isFunction(value)` is a type guard for JavaScript functions.

```ts
isFunction(() => {}); // true
isFunction({ call() {} }); // false
```

### `isNone`

`isNone(value)` is a type guard that returns `true` only for `null` and `undefined`.

```ts
isNone(undefined); // true
isNone(null); // true
isNone(0); // false
```

## Number and locale helpers

### `toNumber`

`toNumber(value)` converts a value with `Number`, then falls back to `parseInt`. It logs and returns `0` when conversion cannot produce a number.

```ts
toNumber("42"); // 42
toNumber("not-a-number"); // 0
```

### `toFloat`

`toFloat(value)` converts a value with `Number`, then falls back to `parseFloat`. It logs and returns `0` when conversion fails.

```ts
toFloat("3.14"); // 3.14
toFloat("not-a-number"); // 0
```

### `toLocaleNumber`

`toLocaleNumber(value, locale?)` converts with `toNumber` and formats with zero minimum and maximum fraction digits.

```ts
toLocaleNumber(12345.67, "en-US"); // "12,346"
```

### `toLocaleFloat`

`toLocaleFloat(value, locale?)` converts with `toFloat` and formats with exactly two minimum and maximum fraction digits.

```ts
toLocaleFloat(12345.6, "en-US"); // "12,345.60"
```

## Timing helpers

### `debounce`

`debounce(function, delay?)` returns a function that waits until calls stop before invoking the original function. The default delay is 200 milliseconds, and the wrapper returns the most recent completed result.

```ts
const saveDraft = debounce((text: string) => api.save(text), 300);
saveDraft("first");
saveDraft("latest"); // only this call runs after 300 ms
```

### `throttle`

`throttle(function, limit)` returns a function that invokes the original at most once during each `limit` millisecond window. Calls inside the window return the last result.

```ts
const reportScroll = throttle(() => analytics.track("scroll"), 500);
window.addEventListener("scroll", reportScroll);
```

### `sleep`

`sleep(milliseconds)` returns a promise that resolves after the supplied delay.

```ts
await sleep(250);
```

### `toMilliSeconds`

`toMilliSeconds(value, unit)` converts `"hr"`, `"min"`, or `"s"` to milliseconds. Passing `"ms"` is not supported and throws.

```ts
toMilliSeconds(2, "hr"); // 7_200_000
toMilliSeconds(5, "min"); // 300_000
toMilliSeconds(30, "s"); // 30_000
```

### `toSeconds`

`toSeconds(value, unit)` converts `"hr"`, `"min"`, or `"s"` to seconds. Passing `"ms"` is not supported and throws.

```ts
toSeconds(2, "hr"); // 7_200
toSeconds(5, "min"); // 300
toSeconds(30, "s"); // 30
```

### `toHours`

`toHours(value, unit)` converts `"min"`, `"s"`, or `"ms"` to hours.

```ts
toHours(120, "min"); // 2
toHours(7_200, "s"); // 2
toHours(7_200_000, "ms"); // 2
```

## Structures and algorithms

### `Queue`

`Queue<T>` is a FIFO queue. Create it with `new Queue<T>()`, add values with `enqueue`, remove the oldest value with `dequeue`, and read the current number of values through `length`. `dequeue` returns `null` when empty.

```ts
const jobs = new Queue<string>();
jobs.enqueue("email");
jobs.enqueue("report");
jobs.dequeue(); // "email"
jobs.length; // 1
```

### `Cache`

`Cache<K, V>` is the abstract cache contract. It defines `get`, `set`, `has`, `delete`, `clear`, and `size` for implementations such as the two LRU caches.

```ts
const cache: Cache<string, number> = new LRUCache(10);
cache.set("attempts", 1);
```

### `LRUCache`

`LRUCache<K, V>` keeps a bounded number of recent values. `get` refreshes a value's recency, and `set` evicts the least recently used value when capacity is reached. Its constructor rejects a non-positive maximum size.

```ts
const cache = new LRUCache<string, number>(2);
cache.set("a", 1);
cache.set("b", 2);
cache.get("a"); // refreshes "a"
cache.set("c", 3); // evicts "b"
```

### `LRUTimeCache`

`LRUTimeCache<K, V>` adds a TTL to `LRUCache`. `set` defaults to a 60-second lifetime, `get` removes expired values, `has` respects expiry, and `update` replaces an existing value while keeping its TTL unless a new one is supplied.

```ts
const cache = new LRUTimeCache<string, string>(10);
cache.set("status", "ready", 5_000);
cache.update("status", "complete");
cache.get("status"); // "complete" until expiry
```

### `binarySearch`

`binarySearch(sortedArray, target)` returns the target index or `-1`. For complex values, pass a comparator that receives an array item and one of `"<"`, `"="`, or `">"` and reports its relationship to the desired target.

```ts
binarySearch([2, 4, 6, 8], 6); // 2
binarySearch([{ id: 1 }, { id: 3 }], (item, op) =>
  op === "=" ? item.id === 3 : op === "<" ? item.id < 3 : item.id > 3,
); // 1
```

### `ValidationError`

`ValidationError` is an `Error` subclass for failures that callers should identify as validation problems.

```ts
if (!email.includes("@")) throw new ValidationError("A valid email is required");
```

## Environment and identifiers

### `isVercel`

`isVercel` is evaluated at module load and is `true` when `VERCEL` or `NOW_REGION` exists in the process environment.

```ts
if (isVercel) enableDeploymentTelemetry();
```

### `isDevelopment`

`isDevelopment` is evaluated at module load from `ENV` or `NODE_ENV`. It is `true` for `development` and `dev` values, including case-insensitive string forms.

```ts
if (isDevelopment) enableVerboseLogs();
```

### `isProduction`

`isProduction` is the inverse of `isDevelopment`.

```ts
if (isProduction) enableProductionOnlyCaching();
```

### `isWebWorker`

`isWebWorker` is `true` when the current global scope is a `WorkerGlobalScope`.

```ts
if (isWebWorker) self.postMessage("worker ready");
```

### `isServiceWorker`

`isServiceWorker` is `true` when the current global scope is a `ServiceWorkerGlobalScope`.

```ts
if (isServiceWorker) self.skipWaiting();
```

### `isWorker`

`isWorker` is `true` when either `isWebWorker` or `isServiceWorker` is true.

```ts
if (isWorker) console.log("running outside the window context");
```

### `kinoid`

`kinoid()` creates a stateful ID generator with `newId()` and `decodeId(id)`. `newId` creates a 17-character, base-36 identifier containing a time offset, sequence number, and process ID. `decodeId` returns those decoded fields or an error object. The identifiers are sortable and unique for the generator process, but are not cryptographic secrets.

```ts
const ids = kinoid();
const id = ids.newId();
const decoded = ids.decodeId(id);
```
