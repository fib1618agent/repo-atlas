declare module "bun:sqlite" {
  export class Database {
    constructor(path: string, options?: { create?: boolean; readonly?: boolean });
    exec(sql: string): void;
    run(sql: string, ...params: unknown[]): void;
    prepare(sql: string): {
      run(...params: unknown[]): { lastInsertRowid: number | bigint };
      all(...params: unknown[]): unknown[];
      get(...params: unknown[]): unknown;
    };
    query(sql: string): {
      all(...params: unknown[]): unknown[];
      get(...params: unknown[]): unknown;
    };
    transaction(fn: () => void): () => void;
    close(): void;
  }
}
