import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ImagesModule } from "./images/images.module";
import { Image } from "./images/entities/image.entity";
import { FileStorageModule } from "./file-storage/file-storage.module";

@Module({
  imports: [
    FileStorageModule,
    TypeOrmModule.forRoot({
      type: "postgres",
      host: process.env.DB_HOST ?? "localhost",
      port: parseInt(process.env.DB_PORT ?? "5432", 10),
      username: process.env.DB_USERNAME ?? "postgres",
      password: process.env.DB_PASSWORD ?? "postgres",
      database: process.env.DB_DATABASE ?? "images_db",
      entities: [Image],
      synchronize: process.env.NODE_ENV !== "production",
      migrations: ["dist/migrations/*.js"],
      migrationsRun: process.env.NODE_ENV === "production",
      logging: process.env.NODE_ENV === "development",
    }),
    ImagesModule,
  ],
})
export class AppModule {}
