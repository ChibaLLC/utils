# Core Utilities

`@chiballc/utils` provides small, typed helpers for common TypeScript application work. Its exports cover object and iterable access, generator consumption, async control flow, numeric formatting, caches, queues, timing, validation errors, and time-sortable identifiers.

The package is deliberately unopinionated. It does not impose an application framework or data model, so it can be used from browser, server, and build tooling code where the underlying platform APIs are available.

## Work with uncertain async operations

`execute` captures either a value or a thrown error. It accepts a promise, a function, or a plain value and preserves asynchronous results when necessary.

```ts
import { execute } from "@chiballc/utils";

const { result: account, error } = await execute(fetchAccount("acct_123"));

if (error) {
  reportAccountFailure(error);
  return;
}

console.log(account.name);
```

Use `settle` when several promises may fail independently. It returns the fulfilled values in their original order and calls the optional error handler for rejected entries.

## Handle collections consistently

`keys`, `entries`, and `values` work with objects, maps, sets, arrays, synchronous generators, and asynchronous generators. `toArray`, `take`, and `peek` help adapt an input when a consumer needs materialized data or only its first values.

```ts
import { take, values } from "@chiballc/utils";

const settings = { theme: "dark", locale: "en" };
const firstValue = take(settings, 1);
const allValues = [...values(settings)];
```

Generators are stateful. `take` and `peek` consume generator input, although `peek` arranges for the consumed first item to be returned by the next `next()` call. Prefer an array or another materialized collection when the source must be reusable.

## Store bounded data

`LRUCache` keeps only the most recently used values. `LRUTimeCache` adds per-value expiry, with a default TTL of one minute. Both require a positive maximum size.

```ts
import { LRUTimeCache } from "@chiballc/utils";

const sessions = new LRUTimeCache<string, { name: string }>(500);
sessions.set("session_123", { name: "Ada" }, 30_000);

const session = sessions.get("session_123");
```

The cache is in-memory only. It is appropriate for request-local or process-local acceleration, not shared state across processes or durable storage.

## Generate sortable identifiers

`kinoid()` creates an ID generator. Generated IDs are URL-friendly and ordered by creation time on the same machine. They are unique within the generator's process but are not cryptographically unpredictable.

```ts
import { kinoid } from "@chiballc/utils";

const ids = kinoid();
const id = ids.newId();
const details = ids.decodeId(id);
```

Use a dedicated cryptographic identifier mechanism for secrets, session tokens, or any value that must be difficult to guess.

## Complete API reference

### Data and object helpers

`Boolish` normalizes string values. Empty strings and `"null"` become `null`; `"true"`, `"false"`, and `"undefined"` become their corresponding JavaScript values; every other trimmed string is returned unchanged. Non-string values pass through unchanged.

`hasOwnProperties` checks whether an object has every requested own property, or at least one when `partial` is enabled. `allowNullish` controls whether a present-but-falsy property counts as present. `isEmpty` treats nullish values, non-objects, empty arrays, maps, sets, and objects without own enumerable properties as empty.

`keys`, `entries`, and `values` produce generators for objects, maps, sets, arrays, synchronous generators, and asynchronous generators. `isAsyncIterable` is the corresponding type guard. `omit` copies an object while removing one or more top-level or dotted nested paths. `pick` copies selected properties and supports the same dotted paths; a single nested path returns its selected value.

### Promises and generators

`isPromise` checks for a thenable value. `execute` returns `{ result, error }` for values, functions, and promises instead of throwing at the call site. `settle` waits for a tuple of promises and returns fulfilled values in order, optionally reporting rejected entries. `race` wraps `Promise.race`, rejects an empty input, and uses a local implementation only when the platform has no `Promise.race`.

`isGenerator` and `isAsyncGenerator` identify generator instances. `mapOverGenerator` invokes a callback for each yielded value and supports an `onReturn` callback for the generator's return value. `collectFromGenerator` materializes a generator into an array. `joinGenerators` combines synchronous generators, asynchronous generators, and factories that return either kind into one asynchronous generator.

### Collections and conversion

`peek` returns the first value from an array, set, map, object, iterable, or generator. For generators it preserves that first result for the next `next()` call. `take` returns up to `n` values, starting at an optional offset. It warns before consuming a generator or iterator because that source cannot be replayed. `toArray` materializes maps, sets, generators, other iterables, and scalar values into an array.

`toNumber` and `toFloat` convert a value and return zero when conversion fails. `toLocaleNumber` and `toLocaleFloat` format those converted values using `Intl.NumberFormat` options for zero or two decimal places. `isFunction`, `isIterable`, and `isNone` are type guards. `assertTruthy` throws with an optional message when a value is falsy. `makeThenable` combines an object with a promise so the object exposes the promise methods as well as its own properties.

### Timing and invocation control

`debounce` delays a function until calls stop for the configured delay, which defaults to 200 milliseconds. `throttle` runs a function at most once during the supplied interval. `sleep` resolves after a number of milliseconds. `toMilliSeconds` converts hours, minutes, or seconds to milliseconds; `toSeconds` converts hours, minutes, or seconds to seconds; `toHours` converts minutes, seconds, or milliseconds to hours.

### Structures, algorithms, and errors

`Queue` is a FIFO queue with `enqueue`, `dequeue`, and a `length` getter. `Cache` is the abstract cache contract implemented by `LRUCache` and `LRUTimeCache`. `LRUCache` has `get`, `set`, `has`, `delete`, `clear`, and `size`; reading a value refreshes its recency. `LRUTimeCache` has the same operations plus `update`, and expires individual values according to their TTL.

`binarySearch` returns the index of a value in a sorted array or `-1` when it is absent. For object arrays, pass a comparator that answers whether the candidate is less than, equal to, or greater than the search target. `ValidationError` is the package's validation-specific error class.

### Environment and identifiers

`isVercel`, `isDevelopment`, and `isProduction` expose environment checks evaluated when the module loads. `isWebWorker`, `isServiceWorker`, and `isWorker` identify worker execution contexts.

`kinoid` returns an object with `newId` and `decodeId`. `newId` creates a 17-character base-36 identifier that is sortable by creation time on the same machine. `decodeId` returns its date, sequence value, and process ID, or an error object when the supplied identifier has an invalid format.
