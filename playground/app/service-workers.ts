export enum AppServiceWorkers {
  Test = "sw-test",
}

declare global {
  interface AppServiceWorkers {
    [AppServiceWorkers.Test]: AppServiceWorkers.Test;
  }
}
