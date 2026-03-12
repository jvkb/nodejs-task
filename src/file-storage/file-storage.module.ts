import { Global, Module } from "@nestjs/common";

import { FileService } from "./file.service";
import { LocalFileService } from "./local-file.service";

/**
 * Global module that provides the file-storage abstraction.
 *
 * Registering this module in AppModule once with @Global() makes FileService
 * available for injection throughout the entire application without each
 * feature module needing to import it explicitly.
 *
 * ─── Switching storage backends ──────────────────────────────────────────────
 * Change only the `useClass` binding below — no other file needs to change:
 *
 *   { provide: FileService, useClass: LocalFileService }   ← current
 *   { provide: FileService, useClass: S3FileService }       ← Amazon S3
 *   { provide: FileService, useClass: AzureFileService }    ← Azure Blob
 */
@Global()
@Module({
  providers: [
    {
      provide: FileService,
      useClass: LocalFileService,
    },
  ],
  exports: [FileService],
})
export class FileStorageModule {}
