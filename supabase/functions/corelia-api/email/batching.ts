export function* chunked<T>(items: Iterable<T>, size: number): Generator<T[]> {
  if (!Number.isInteger(size) || size < 1) throw new Error("invalid_batch_size");
  let batch: T[] = [];
  for (const item of items) {
    batch.push(item);
    if (batch.length === size) {
      yield batch;
      batch = [];
    }
  }
  if (batch.length) yield batch;
}
