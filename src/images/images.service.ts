import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, ILike } from "typeorm";
import sharp from "sharp";
import { v4 } from "uuid";
import { Readable } from "stream";
import { Image } from "./entities/image.entity";
import { CreateImageDto } from "./dto/create-image.dto";
import { QueryImagesDto } from "./dto/query-images.dto";
import { ImageResponseDto, PaginatedImages } from "./images.service.types";
import { convertImageToResponseDTO } from "./images.helpers";
import { ALLOWED_MIME_TYPES } from "./images.const";
import { FileService, FileNotFoundError } from "../file-storage/file.service";

@Injectable()
export class ImagesService {
  /**
   * Logger instance
   * @private
   */
  private readonly logger = new Logger(ImagesService.name);

  constructor(
    @InjectRepository(Image)
    private readonly imageRepository: Repository<Image>,
    private readonly fileService: FileService
  ) {}

  /**
   * Save image in storage
   * @param file
   * @param dto
   */
  public async create(file: Express.Multer.File, dto: CreateImageDto): Promise<ImageResponseDto> {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`);
    }

    const filename = `${v4()}.jpg`;

    let pipeline = sharp(file.buffer);

    if (dto.width && dto.height) {
      pipeline = pipeline.resize(dto.width, dto.height, { fit: "fill" });
    } else if (dto.width || dto.height) {
      pipeline = pipeline.resize(dto.width ?? null, dto.height ?? null, {
        fit: "inside",
        withoutEnlargement: false,
      });
    }

    const { data, info } = await pipeline.jpeg({ quality: 85, progressive: true }).toBuffer({ resolveWithObject: true });

    await this.fileService.save(filename, data, { contentType: "image/jpeg" });

    const image = this.imageRepository.create({
      title: dto.title,
      filename,
      mimeType: "image/jpeg",
      width: info.width,
      height: info.height,
      fileSize: info.size,
    });

    const saved = await this.imageRepository.save(image);
    return convertImageToResponseDTO(saved);
  }

  /**
   * Find all images (with pagination)
   * @param query
   */
  public async findAll(query: QueryImagesDto): Promise<PaginatedImages> {
    const { page = 1, limit = 10, title } = query;
    const skip = (page - 1) * limit;

    const where = title ? { title: ILike(`%${title}%`) } : {};

    const [data, total] = await this.imageRepository.findAndCount({
      where,
      order: { createdAt: "DESC" },
      skip,
      take: limit,
    });

    return {
      data: data.map(convertImageToResponseDTO),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find one "image" by it's ID
   * @param id
   */
  public async findOne(id: string): Promise<ImageResponseDto> {
    const image = await this.imageRepository.findOne({ where: { id } });
    if (!image) {
      throw new NotFoundException(`Image with id "${id}" not found`);
    }
    return convertImageToResponseDTO(image);
  }

  /**
   * Get file stream based on "image" id
   * @param id
   */
  public async getFileStream(id: string): Promise<{ stream: Readable; mimeType: string }> {
    const image = await this.imageRepository.findOne({ where: { id } });
    if (!image) {
      throw new NotFoundException(`Image with id "${id}" not found`);
    }

    try {
      const stream = await this.fileService.createReadStream(image.filename);
      return { stream, mimeType: image.mimeType };
    } catch (err) {
      if (err instanceof FileNotFoundError) {
        this.logger.error(`File "${image.filename}" missing from storage for image id "${id}"`);
        throw new NotFoundException("Image file is not available");
      }
      throw err;
    }
  }
}
