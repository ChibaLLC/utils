import { defineWRouter } from "@chiballc/utils/web-workers";

/**
 * A simple web worker for playground testing.
 * Uses the library's defineWRouter for structured communication.
 */
defineWRouter({
  async PING(data, event) {
    console.log("[Worker] Got PING:", data);
    return {
      message: "Hello from Web Worker!",
      at: Date.now(),
      received: data,
    };
  },

  async CALCULATE(data) {
    const { n } = data;
    // Simulate some work
    let result = 0;
    for (let i = 0; i < n; i++) {
      result += i;
    }
    return { result, n };
  },

  async TEST_ERROR() {
    throw new Error("Simulated Web Worker Error");
  },
});
