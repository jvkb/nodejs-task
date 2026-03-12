import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ImagesModule } from "../src/images/images.module";
import { Image } from "../src/images/entities/image.entity";
import { FileStorageModule } from "../src/file-storage/file-storage.module";
import * as path from "path";
import * as fs from "fs";

/**
 * E2E tests use SQLite in-memory via better-sqlite3.
 * No Docker or PostgreSQL required for running tests.
 */
describe("Images API (e2e)", () => {
  let app: INestApplication;
  const uploadsTestDir = path.join(__dirname, "test-uploads");

  // Minimal valid 1x1 JPEG in base64
  const minimalJpegBase64 =
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=";

  beforeAll(async () => {
    fs.mkdirSync(uploadsTestDir, { recursive: true });
    process.env.UPLOADS_DIR = uploadsTestDir;
    process.env.APP_BASE_URL = "http://localhost:3000";

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // FileStorageModule is @Global() — importing it here registers
        // FileService for the entire test module context.
        FileStorageModule,
        TypeOrmModule.forRoot({
          type: "better-sqlite3",
          database: ":memory:",
          entities: [Image],
          synchronize: true,
          dropSchema: true,
        }),
        ImagesModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      })
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(uploadsTestDir, { recursive: true, force: true });
  });

  describe("POST /images", () => {
    it("should upload an image and return metadata", async () => {
      const minimalJpeg = Buffer.from(minimalJpegBase64, "base64");

      return request(app.getHttpServer())
        .post("/api/images")
        .attach("file", minimalJpeg, {
          filename: "test.jpg",
          contentType: "image/jpeg",
        })
        .field("title", "Test Image")
        .field("width", "200")
        .field("height", "200")
        .expect(201)
        .expect((res) => {
          expect(res.body.id).toBeDefined();
          expect(res.body.title).toBe("Test Image");
          expect(res.body.url).toContain("/file");
          expect(typeof res.body.width).toBe("number");
          expect(typeof res.body.height).toBe("number");
        });
    });

    it("should upload an image without dimensions", async () => {
      const minimalJpeg = Buffer.from(minimalJpegBase64, "base64");

      return request(app.getHttpServer())
        .post("/api/images")
        .attach("file", minimalJpeg, {
          filename: "test.jpg",
          contentType: "image/jpeg",
        })
        .field("title", "No Resize")
        .expect(201)
        .expect((res) => {
          expect(res.body.id).toBeDefined();
          expect(res.body.title).toBe("No Resize");
        });
    });

    it("should return 400 for missing file", () => {
      return request(app.getHttpServer()).post("/api/images").field("title", "No File").expect(400);
    });

    it("should return 400 for missing title", () => {
      const minimalJpeg = Buffer.from(minimalJpegBase64, "base64");
      return request(app.getHttpServer())
        .post("/api/images")
        .attach("file", minimalJpeg, {
          filename: "test.jpg",
          contentType: "image/jpeg",
        })
        .expect(400);
    });
  });

  describe("GET /images", () => {
    it("should return a paginated list of images", () => {
      return request(app.getHttpServer())
        .get("/api/images")
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(typeof res.body.total).toBe("number");
          expect(res.body.page).toBe(1);
          expect(res.body.limit).toBe(10);
          expect(typeof res.body.totalPages).toBe("number");
        });
    });

    it("should filter by title", () => {
      return request(app.getHttpServer())
        .get("/api/images?title=Test")
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.data)).toBe(true);
          res.body.data.forEach((img: any) => {
            expect(img.title.toLowerCase()).toContain("test");
          });
        });
    });

    it("should paginate results", () => {
      return request(app.getHttpServer())
        .get("/api/images?page=1&limit=5")
        .expect(200)
        .expect((res) => {
          expect(res.body.limit).toBe(5);
          expect(res.body.page).toBe(1);
        });
    });
  });

  describe("GET /images/:id", () => {
    let createdImageId: string;

    beforeAll(async () => {
      const minimalJpeg = Buffer.from(minimalJpegBase64, "base64");
      const res = await request(app.getHttpServer())
        .post("/api/images")
        .attach("file", minimalJpeg, {
          filename: "fetch-test.jpg",
          contentType: "image/jpeg",
        })
        .field("title", "Fetch Test");
      createdImageId = res.body.id;
    });

    it("should return image by id", () => {
      return request(app.getHttpServer())
        .get(`/api/images/${createdImageId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(createdImageId);
          expect(res.body.title).toBe("Fetch Test");
          expect(res.body.url).toBeDefined();
          expect(res.body.width).toBeDefined();
          expect(res.body.height).toBeDefined();
        });
    });

    it("should return 404 for non-existent image", () => {
      return request(app.getHttpServer()).get("/api/images/00000000-0000-0000-0000-000000000000").expect(404);
    });

    it("should return 400 for invalid UUID", () => {
      return request(app.getHttpServer()).get("/api/images/not-a-uuid").expect(400);
    });
  });

  describe("GET /images/:id/file", () => {
    let createdImageId: string;

    beforeAll(async () => {
      const minimalJpeg = Buffer.from(minimalJpegBase64, "base64");
      const res = await request(app.getHttpServer())
        .post("/api/images")
        .attach("file", minimalJpeg, {
          filename: "file-test.jpg",
          contentType: "image/jpeg",
        })
        .field("title", "File Test");
      createdImageId = res.body.id;
    });

    it("should serve the image file", () => {
      return request(app.getHttpServer()).get(`/api/images/${createdImageId}/file`).expect(200).expect("Content-Type", /image/);
    });

    it("should return 404 for non-existent file", () => {
      return request(app.getHttpServer()).get("/api/images/00000000-0000-0000-0000-000000000000/file").expect(404);
    });
  });
});
