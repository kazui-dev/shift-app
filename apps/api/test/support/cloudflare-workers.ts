// Stands in for the Workers runtime module when tests run on Node.
export class DurableObject {
  constructor(
    public ctx: unknown,
    public env: unknown
  ) {}
}

export class WorkerEntrypoint {
  constructor(
    public ctx: unknown,
    public env: unknown
  ) {}
}

export const exports = {
  SharedCache: {
    fetch: () => {
      throw new Error("Mock lib/shared-cache to reach SharedCache in tests")
    },
  },
}
