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

## Other useful exports

`binarySearch` searches a sorted array, including arrays of objects through a comparator. `Queue` provides FIFO storage. `debounce` and `throttle` regulate calls. `sleep`, `toMilliSeconds`, `toSeconds`, and `toHours` help make timing calculations explicit. `ValidationError` is available when callers need to distinguish validation failures from other errors.
