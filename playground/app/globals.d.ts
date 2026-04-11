declare module "*?serviceworker" {
  const url: string;
  export default url;
}

declare module "*?worker" {
  const worker: {
    new (options?: WorkerOptions): Worker;
  };
  export default worker;
}

declare module "*?worker&url" {
  const url: string;
  export default url;
}
