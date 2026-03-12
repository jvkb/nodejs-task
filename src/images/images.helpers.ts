import { ImageResponseDto } from "./images.service.types";
import { Image } from "./entities/image.entity";

export function buildFileUrl(imageId: string): string {
  const base = (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/images/${imageId}/file`;
}

/**
 * Converts Image entity into ImageResponseDTO type
 * @param image
 */
export function convertImageToResponseDTO(image: Image): ImageResponseDto {
  return {
    id: image.id,
    title: image.title,
    url: buildFileUrl(image.id),
    width: image.width,
    height: image.height,
    fileSize: image.fileSize,
    createdAt: image.createdAt,
  };
}
