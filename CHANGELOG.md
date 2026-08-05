## 2.5.0

### Minor Changes

- 0a37731: Add declarative object-form Ho3 controllers with one-or-many routes while retaining scoped callback composition.

- Run route middleware for ordinary handlers, preserve OpenAPI typing for readonly middleware arrays, install generated 405 handlers before controller wildcards, and retain exact-path `all` handlers as concrete routes.

## 2.4.0

### Minor Changes

- 332cc47: Add relative nested controller composition with inherited middleware environments and ordered wildcard handling.

## 2.3.0

### Minor Changes

- 5f3adfa: Add the `@chiballc/utils/ho3` entry point for typed Hono middleware, handlers, controllers, and application composition.

## 2.2.22

### Patch Changes

- Allow callers to configure Kibao's bounded response size while keeping the 64 KiB default.
