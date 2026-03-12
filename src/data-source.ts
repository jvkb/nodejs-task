import { DataSource } from "typeorm";
import { Image } from "./images/entities/image.entity";

// Used exclusively by the TypeORM CLI (npm run migration:*)
// Not imported by the NestJS app itself.
export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST ?? "localhost",
  port: parseInt(process.env.DB_PORT ?? "5432", 10),
  username: process.env.DB_USERNAME ?? "postgres",
  password: process.env.DB_PASSWORD ?? "postgres",
  database: process.env.DB_DATABASE ?? "images_db",
  entities: [Image],
  migrations: ["src/migrations/*.ts"],
  synchronize: false,
});
