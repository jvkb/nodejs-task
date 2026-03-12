import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { PassThrough } from "stream";

import { ImagesService } from "./images.service";
import { Image } from "./entities/image.entity";
import { FileService, FileNotFoundError } from "../file-storage/file.service";

// ─── Module-level mocks ───────────────────────────────────────────────────────

// sharp uses a default export — `__esModule: true` tells Jest to expose the
// mock via `.default` so that `import sharp from 'sharp'` resolves correctly.
jest.mock("sharp", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue({
      data: Buffer.from("fake-jpeg"),
      info: { width: 800, height: 600, size: 50000 },
    }),
  })),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockImageRepository = (): Partial<Record<keyof Repository<Image>, jest.Mock>> => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
});

const mockFileService = (): jest.Mocked<FileService> => ({
  save: jest.fn().mockResolvedValue(undefined),
  createReadStream: jest.fn().mockResolvedValue(new PassThrough()),
  delete: jest.fn().mockResolvedValue(undefined),
  exists: jest.fn().mockResolvedValue(true),
});

// ─── Fixtures ────────────────────────────────────────────────────────────────

const makeFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File =>
  ({
    fieldname: "file",
    originalname: "test.jpg",
    encoding: "7bit",
    mimetype: "image/jpeg",
    buffer: Buffer.from("fake-image-data"),
    size: 1000,
    ...overrides,
  }) as Express.Multer.File;

const makeImageEntity = (overrides: Partial<Image> = {}): Image =>
  ({
    id: "uuid-123",
    title: "Test",
    filename: "uuid-123.jpg",
    mimeType: "image/jpeg",
    width: 800,
    height: 600,
    fileSize: 50000,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Image;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ImagesService", () => {
  let service: ImagesService;
  let imageRepo: ReturnType<typeof mockImageRepository>;
  let fileService: ReturnType<typeof mockFileService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImagesService,
        { provide: getRepositoryToken(Image), useFactory: mockImageRepository },
        { provide: FileService, useFactory: mockFileService },
      ],
    }).compile();

    service = module.get(ImagesService);
    imageRepo = module.get(getRepositoryToken(Image));
    fileService = module.get(FileService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create ────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("persists the processed image and returns a response DTO", async () => {
      const entity = makeImageEntity();
      imageRepo.create.mockReturnValue(entity);
      imageRepo.save.mockResolvedValue(entity);

      const result = await service.create(makeFile(), {
        title: "Test",
        width: 800,
        height: 600,
      });

      expect(fileService.save).toHaveBeenCalledWith(expect.stringMatching(/\.jpg$/), expect.any(Buffer), { contentType: "image/jpeg" });
      expect(result.title).toBe("Test");
      expect(result.width).toBe(800);
      expect(result.url).toContain("/api/images/uuid-123/file");
    });

    it("rejects unsupported MIME types before touching the filesystem", async () => {
      await expect(service.create(makeFile({ mimetype: "application/pdf" }), { title: "T" })).rejects.toThrow(BadRequestException);

      expect(fileService.save).not.toHaveBeenCalled();
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("returns a correctly shaped pagination envelope", async () => {
      imageRepo.findAndCount.mockResolvedValue([[makeImageEntity()], 1]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result).toMatchObject({ total: 1, page: 1, limit: 10, totalPages: 1 });
      expect(result.data).toHaveLength(1);
    });

    it("passes an ILike filter when title is provided", async () => {
      imageRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ title: "vacation", page: 1, limit: 10 });

      expect(imageRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: { title: expect.anything() } }));
    });

    it("returns empty data when no images exist", async () => {
      imageRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result).toMatchObject({ total: 0, totalPages: 0, data: [] });
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe("findOne", () => {
    it("returns the response DTO for an existing image", async () => {
      imageRepo.findOne.mockResolvedValue(makeImageEntity());

      const result = await service.findOne("uuid-123");

      expect(result.id).toBe("uuid-123");
    });

    it("throws NotFoundException for an unknown id", async () => {
      imageRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne("missing-id")).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getFileStream ─────────────────────────────────────────────────────────

  describe("getFileStream", () => {
    it("returns a stream and mimeType for an existing image", async () => {
      imageRepo.findOne.mockResolvedValue(makeImageEntity());

      const result = await service.getFileStream("uuid-123");

      expect(fileService.createReadStream).toHaveBeenCalledWith("uuid-123.jpg");
      expect(result.mimeType).toBe("image/jpeg");
      expect(result.stream).toBeDefined();
    });

    it("throws NotFoundException when the DB record is missing", async () => {
      imageRepo.findOne.mockResolvedValue(null);

      await expect(service.getFileStream("missing-id")).rejects.toThrow(NotFoundException);
    });

    it("translates FileNotFoundError into NotFoundException", async () => {
      imageRepo.findOne.mockResolvedValue(makeImageEntity());
      fileService.createReadStream.mockRejectedValue(new FileNotFoundError("uuid-123.jpg"));

      await expect(service.getFileStream("uuid-123")).rejects.toThrow(NotFoundException);
    });
  });
});
