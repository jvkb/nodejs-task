import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UploadedFile,
  UseInterceptors,
  ParseUUIDPipe,
  Res,
  StreamableFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody, ApiParam, ApiQuery } from "@nestjs/swagger";
import { Response } from "express";
import { ImagesService } from "./images.service";
import { CreateImageDto } from "./dto/create-image.dto";
import { QueryImagesDto } from "./dto/query-images.dto";
import { MAX_FILE_SIZE } from "./images.const";

@ApiTags("images")
@Controller("images")
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  /**
   * (POST) Creates new "image" document
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Upload a new image" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file", "title"],
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "Image file (JPEG, PNG, WebP, GIF, TIFF, AVIF)",
        },
        title: { type: "string", description: "Display title" },
        width: {
          type: "integer",
          description: "Target width in pixels",
          minimum: 1,
          maximum: 8000,
        },
        height: {
          type: "integer",
          description: "Target height in pixels",
          minimum: 1,
          maximum: 8000,
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: "Image uploaded successfully" })
  @ApiResponse({
    status: 400,
    description: "Invalid file type, missing file, or validation error",
  })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
          return cb(new BadRequestException("Only image files are allowed"), false);
        }
        cb(null, true);
      },
    })
  )
  public async create(@UploadedFile() file: Express.Multer.File, @Body() dto: CreateImageDto) {
    if (!file) {
      throw new BadRequestException("File is required");
    }
    return this.imagesService.create(file, dto);
  }

  /**
   * (GET) Find one image document, by its ID
   * @param query
   */
  @Get()
  @ApiOperation({
    summary: "List all images with optional filtering and pagination",
  })
  @ApiQuery({
    name: "title",
    required: false,
    description: "Filter by title (contains, case-insensitive)",
  })
  @ApiQuery({
    name: "page",
    required: false,
    description: "Page number (default: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Items per page (default: 10)",
  })
  @ApiResponse({ status: 200, description: "Paginated list of images" })
  findAll(@Query() query: QueryImagesDto) {
    return this.imagesService.findAll(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single image by ID" })
  @ApiParam({ name: "id", type: "string", format: "uuid" })
  @ApiResponse({ status: 200, description: "Image metadata" })
  @ApiResponse({ status: 404, description: "Image not found" })
  public findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.imagesService.findOne(id);
  }

  /**
   * (GET) Serve file as stream
   */
  @Get(":id/file")
  @ApiOperation({ summary: "Serve the actual image file" })
  @ApiParam({ name: "id", type: "string", format: "uuid" })
  @ApiResponse({
    status: 200,
    description: "Image binary data",
    content: { "image/jpeg": {} },
  })
  @ApiResponse({ status: 404, description: "Image not found" })
  public async serveFile(@Param("id", ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const { stream, mimeType } = await this.imagesService.getFileStream(id);
    res.set({
      "Content-Type": mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
    });
    return new StreamableFile(stream);
  }
}
