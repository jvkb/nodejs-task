import { Test, TestingModule } from "@nestjs/testing";
import { PassThrough } from "stream";
import { ImagesController } from "./images.controller";
import { ImagesService } from "./images.service";

const mockImagesService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  getFileStream: jest.fn(),
};

describe("ImagesController", () => {
  let controller: ImagesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImagesController],
      providers: [{ provide: ImagesService, useValue: mockImagesService }],
    }).compile();

    controller = module.get<ImagesController>(ImagesController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("findAll", () => {
    it("delegates to service and returns results", async () => {
      const mockResult = { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
      mockImagesService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll({ page: 1, limit: 10 });

      expect(mockImagesService.findAll).toHaveBeenCalledWith({ page: 1, limit: 10 });
      expect(result.total).toBe(0);
    });
  });

  describe("findOne", () => {
    it("delegates to service with id", async () => {
      mockImagesService.findOne.mockResolvedValue({ id: "uuid-1", title: "Test" });

      await controller.findOne("uuid-1");

      expect(mockImagesService.findOne).toHaveBeenCalledWith("uuid-1");
    });
  });

  describe("serveFile", () => {
    it("sets Content-Type and returns a StreamableFile", async () => {
      mockImagesService.getFileStream.mockResolvedValue({
        stream: new PassThrough(),
        mimeType: "image/jpeg",
      });

      const mockRes = { set: jest.fn() } as any;
      const result = await controller.serveFile("uuid-1", mockRes);

      expect(mockImagesService.getFileStream).toHaveBeenCalledWith("uuid-1");
      expect(mockRes.set).toHaveBeenCalledWith(expect.objectContaining({ "Content-Type": "image/jpeg" }));
      expect(result).toBeDefined();
    });
  });
});
