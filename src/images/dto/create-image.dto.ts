import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export class CreateImageDto {
  @ApiProperty({
    description: "Display title for the image",
    example: "My vacation photo",
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    description: "Target width in pixels. If only width is given, height is scaled proportionally.",
    example: 800,
    minimum: 1,
    maximum: 8000,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8000)
  @Type(() => Number)
  width?: number;

  @ApiPropertyOptional({
    description: "Target height in pixels. If only height is given, width is scaled proportionally.",
    example: 600,
    minimum: 1,
    maximum: 8000,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8000)
  @Type(() => Number)
  height?: number;
}
