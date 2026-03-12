export interface ImageResponseDto {
  id: string;
  title: string;
  url: string;
  width: number;
  height: number;
  fileSize: number;
  createdAt: Date;
}

export interface PaginatedImages {
  data: ImageResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
