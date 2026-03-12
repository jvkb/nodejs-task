import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("images")
export class Image {
  @PrimaryGeneratedColumn("uuid")
  public id: string;

  @Column({ length: 255 })
  public title: string;

  @Column({ name: "filename" })
  public filename: string;

  @Column({ name: "mime_type", default: "image/jpeg" })
  public mimeType: string;

  @Column({ type: "int" })
  public width: number;

  @Column({ type: "int" })
  public height: number;

  @Column({ name: "file_size", type: "int" })
  public fileSize: number;

  @CreateDateColumn({ name: "created_at" })
  public createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  public updatedAt: Date;
}
