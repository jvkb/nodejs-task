/**
 * Thrown when a requested storage key does not resolve to an existing file.
 */
export class FileNotFoundError extends Error {
  constructor(public readonly key: string) {
    super(`File not found in storage: "${key}"`);
    this.name = "FileNotFoundError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
