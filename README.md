# Image Upload API

A REST API for uploading and serving images, built with NestJS, PostgreSQL, and Docker.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 LTS |
| Framework | NestJS 10 |
| Database | PostgreSQL 16 + TypeORM 0.3 |
| Image processing | sharp (resize, JPEG conversion) |
| File upload | multer (memory storage) |
| API docs | Swagger / OpenAPI 3 |
| Dev environment | Docker + docker-compose |

---

## Quick Start

```bash
cp .env.example .env
docker-compose up --build
```

| URL | Description |
|---|---|
| `http://localhost:3000` | API base |
| `http://localhost:3000/docs` | Swagger UI |

---

## Development (hot-reload)

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

The dev override mounts the source directory into the container and runs `nest start --watch`, so every file save triggers an automatic restart — no rebuild needed.

---

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed. All variables have sensible defaults for local development.

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Controls schema sync and query logging |
| `PORT` | `3000` | HTTP port |
| `DB_HOST` | `postgres` | PostgreSQL host (service name inside Docker) |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USERNAME` | `postgres` | Database user |
| `DB_PASSWORD` | `postgres` | Database password |
| `DB_DATABASE` | `images_db` | Database name |
| `UPLOADS_DIR` | `/app/uploads` | Absolute path where image files are stored |
| `APP_BASE_URL` | `http://localhost:3000` | Base URL used to build `url` fields in responses |

> **Note:** `APP_BASE_URL` must match the public address of the API so that the `url` returned in responses correctly points to `GET /api/images/:id/file`.

---

## API Docs (Swagger UI)

The interactive API documentation is available at:

```
http://localhost:3000/docs
```

It is generated automatically from the code using **Swagger / OpenAPI 3** and lets you explore all endpoints, inspect request/response schemas, and try out requests directly in the browser — no Postman required.

> The `/docs` path is intentionally separate from the `/api` prefix so that the UI is never accidentally caught by any API-level middleware.

---

## API Reference

### `POST /api/images` — Upload an image

Accepts `multipart/form-data`. The image is resized (if dimensions are provided) and stored as JPEG.

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | binary | ✅ | Image file — JPEG, PNG, WebP, GIF, TIFF, AVIF. Max 10 MB. |
| `title` | string | ✅ | Display title |
| `width` | integer | ☐ | Target width in pixels (1–8000) |
| `height` | integer | ☐ | Target height in pixels (1–8000) |

Resize behaviour:
- Both `width` and `height` provided → image is stretched to exact dimensions (`fill`)
- Only one dimension → the other is scaled proportionally (`inside`)
- Neither provided → original dimensions kept, file is converted to JPEG

**Response `201`:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Mountain sunset",
  "url": "http://localhost:3000/api/images/550e8400-e29b-41d4-a716-446655440000/file",
  "width": 1280,
  "height": 720,
  "fileSize": 84210,
  "createdAt": "2026-03-11T12:00:00.000Z"
}
```

---

### `GET /api/images` — List images

Returns a paginated list. Supports case-insensitive title filtering.

| Query param | Default | Description |
|---|---|---|
| `title` | — | Filter: title must contain this string |
| `page` | `1` | Page number (1-based) |
| `limit` | `10` | Items per page |

**Response `200`:**
```json
{
  "data": [ { "id": "...", "title": "...", "url": "...", "width": 1280, "height": 720, "fileSize": 84210, "createdAt": "..." } ],
  "total": 42,
  "page": 1,
  "limit": 10,
  "totalPages": 5
}
```

---

### `GET /api/images/:id` — Get image metadata

Returns the metadata object for a single image. `404` if not found.

---

### `GET /api/images/:id/file` — Serve image file

Streams the image binary. Response header:
```
Content-Type: image/jpeg
Cache-Control: public, max-age=31536000, immutable
```

Files are keyed by UUID, so URLs are permanent — the `immutable` directive allows browsers and CDNs to cache them indefinitely.

---

## Running Tests

No Docker required for tests — they run entirely in-process.

```bash
npm install

# Unit tests
npm test

# Unit tests in watch mode
npm run test:watch

# Coverage report
npm run test:cov

# E2E tests (uses SQLite in-memory, no Postgres needed)
npm run test:e2e
```

---

## Project Structure

```
src/
├── main.ts                        # Bootstrap: Swagger, ValidationPipe, listen
├── app.module.ts                  # Root module
├── data-source.ts                 # TypeORM CLI config (migrations)
│
├── file-storage/                  # Storage abstraction layer
│   ├── file.service.ts            # Abstract FileService (DI token + contract)
│   ├── local-file.service.ts      # Filesystem implementation
│   ├── file-storage.errors.ts     # FileNotFoundError (domain error)
│   └── file-storage.module.ts     # @Global() module
│
└── images/                        # Images feature module
    ├── images.module.ts
    ├── images.controller.ts       # HTTP layer — endpoints, multer, StreamableFile
    ├── images.service.ts          # Business logic — sharp pipeline, TypeORM queries
    ├── images.service.types.ts    # ImageResponseDto, PaginatedImages
    ├── images.helpers.ts          # convertImageToResponseDTO, buildFileUrl
    ├── images.const.ts            # ALLOWED_MIME_TYPES, MAX_FILE_SIZE
    ├── dto/
    │   ├── create-image.dto.ts    # POST body — title, width?, height?
    │   └── query-images.dto.ts    # GET query — title?, page, limit
    └── entities/
        └── image.entity.ts        # TypeORM entity — images table
```

---

## Storage Architecture

File I/O is handled by an **abstract `FileService`** class that acts as both the TypeScript interface and the NestJS DI token. `ImagesService` depends on the abstraction, not the concrete implementation.

```
ImagesService
    └── FileService (abstract)
            └── LocalFileService   ← current binding
```

To switch storage backends, change **one line** in `src/file-storage/file-storage.module.ts`:

```ts
// Current — local filesystem
{ provide: FileService, useClass: LocalFileService }

// Amazon S3
{ provide: FileService, useClass: S3FileService }

// Azure Blob Storage
{ provide: FileService, useClass: AzureFileService }
```

Any new implementation only needs to extend `FileService` and implement four methods:

| Method | Description |
|---|---|
| `save(key, data, options?)` | Persist a buffer under a storage key |
| `createReadStream(key)` | Return a readable stream; throw `FileNotFoundError` if absent |
| `delete(key)` | Remove a file (idempotent — no error if absent) |
| `exists(key)` | Return `true` / `false` |

---

## Database

In `development` mode (`NODE_ENV !== 'production'`) TypeORM auto-syncs the schema on startup — no manual migrations needed.

In `production` mode, migrations run automatically on startup (`migrationsRun: true`). To generate a new migration after changing an entity:

```bash
# Requires a running Postgres (or set DB_* vars to point at one)
npm run migration:generate -- src/migrations/MigrationName
npm run migration:run
```

---

## Code Style

```bash
npm run format       # Prettier
npm run lint         # ESLint --fix
```
