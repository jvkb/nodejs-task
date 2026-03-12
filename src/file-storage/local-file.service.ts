import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { createReadStream } from "fs";
import { mkdir, writeFile, unlink, access } from "fs/promises";
import { join, basename } from "path";
import { Readable } from "stream";
import { FileNotFoundError, FileService } from "./file.service";

/**
 * Filesystem-backed implementation of {@link FileService}.
 */
@Injectable()
export class LocalFileService extends FileService implements OnModuleInit {
  /**
   * Logger instance
   * @private
   */
  private readonly logger = new Logger(LocalFileService.name);

  /**
   * Path of the "Storage Root"
   * @private
   */
  private readonly storageRoot: string;

  constructor() {
    super();
    this.storageRoot = process.env.UPLOADS_DIR ?? join(process.cwd(), "uploads");
  }

  /**
   * Runs after NestJS has fully assembled the module graph, before the app
   * starts accepting requests.  Guarantees the storage directory exists before
   * any `save()` call arrives.
   */
  public async onModuleInit(): Promise<void> {
    await mkdir(this.storageRoot, { recursive: true });
    this.logger.log(`Storage root ready: ${this.storageRoot}`);
  }

  /**
   * Resolve a storage key to an absolute filesystem path.
   * `path.basename` strips any path separators to prevent directory traversal.
   */
  private resolvePath(key: string): string {
    return join(this.storageRoot, basename(key));
  }

  /**
   * Save file in storage
   * @param key
   * @param data
   */
  public async save(key: string, data: Buffer): Promise<void> {
    const filePath = this.resolvePath(key);
    await writeFile(filePath, data);
    this.logger.debug(`Saved: ${filePath} (${data.byteLength} bytes)`);
  }

  /**
   * Open a read stream for the given key
   */
  public createReadStream(key: string): Promise<Readable> {
    const filePath = this.resolvePath(key);

    return new Promise<Readable>((resolve, reject) => {
      const stream = createReadStream(filePath);

      const onError = (err: NodeJS.ErrnoException) => {
        reject(err.code === "ENOENT" ? new FileNotFoundError(key) : err);
      };

      stream.once("open", () => {
        stream.removeListener("error", onError);
        resolve(stream);
      });

      stream.once("error", onError);
    });
  }

  /**
   * Delete a file. Silently ignores ENOENT so the method is idempotent —
   * calling delete on an already-absent key is not an error.
   */
  public async delete(key: string): Promise<void> {
    const filePath = this.resolvePath(key);
    try {
      await unlink(filePath);
      this.logger.debug(`Deleted: ${filePath}`);
    } catch (err: any) {
      if (err?.code === "ENOENT") return;
      throw err;
    }
  }

  /**
   * Check if file exists, by its key
   * @param key
   */
  public async exists(key: string): Promise<boolean> {
    return access(this.resolvePath(key))
      .then(() => true)
      .catch(() => false);
  }
}
