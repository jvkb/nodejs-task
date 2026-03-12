import { Readable } from "stream";
import { FileNotFoundError } from "./file-storage.errors";

export interface SaveOptions {
  /**
   * MIME type of the file (e.g. 'image/jpeg'). Used by remote backends like S3.
   * */
  contentType?: string;
  /**
   * Arbitrary key-value metadata stored alongside the object.
   * */
  metadata?: Record<string, string>;
}

/**
 * Abstract storage service that defines the contract for all file operations.
 */
export abstract class FileService {
  /**
   * Persist `data` under the given storage `key`.
   *
   * @param key     - Unique file identifier (e.g. a UUID-based filename).
   * @param data    - Raw file contents.
   * @param options - Optional upload hints (content-type, metadata).
   */
  abstract save(key: string, data: Buffer, options?: SaveOptions): Promise<void>;

  /**
   * Return a {@link Readable} stream for the file identified by `key`.
   * @throws {FileNotFoundError} if no file exists for the given key.
   */
  abstract createReadStream(key: string): Promise<Readable>;

  /**
   * Permanently remove the file identified by `key`.
   * Must be idempotent — resolves without error even when the key is absent.
   */
  abstract delete(key: string): Promise<void>;

  /**
   * Return `true` if a file exists for the given `key`, `false` otherwise.
   */
  abstract exists(key: string): Promise<boolean>;
}

export { FileNotFoundError };
