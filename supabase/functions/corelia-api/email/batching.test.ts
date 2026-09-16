import { describe, expect, it } from "vitest";
import { chunked } from "./batching.ts";

describe("Email Center high-volume batching", () => {
  it("partitions 100,000 recipients without dropping or duplicating any row", () => {
    function* fakeProviderInput() { for (let index = 0; index < 100_000; index += 1) yield index; }
    let batchCount = 0;
    let expected = 0;
    let largestBatch = 0;
    for (const batch of chunked(fakeProviderInput(), 100)) {
      batchCount += 1;
      largestBatch = Math.max(largestBatch, batch.length);
      for (const recipient of batch) {
        expect(recipient).toBe(expected);
        expected += 1;
      }
    }
    expect(batchCount).toBe(1_000);
    expect(expected).toBe(100_000);
    expect(largestBatch).toBe(100);
  });

  it("keeps a final partial batch", () => {
    expect([...chunked([1, 2, 3], 2)]).toEqual([[1, 2], [3]]);
  });
});
