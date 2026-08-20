import { Schema, model } from "mongoose";

export type AssetType = "escenario" | "avatar" | "perspectiva" | "voz" | "otro";

export interface IAsset {
  name: string;
  type: AssetType;
  url: string;
  publicId: string;
  resourceType: string; // image | video (audio va como video en Cloudinary)
  bytes?: number;
  format?: string;
  duration?: number;
  createdAt: Date;
  updatedAt: Date;
}

const assetSchema = new Schema<IAsset>(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["escenario", "avatar", "perspectiva", "voz", "otro"],
      required: true,
      index: true,
    },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    resourceType: { type: String, required: true },
    bytes: { type: Number },
    format: { type: String },
    duration: { type: Number },
  },
  { timestamps: true },
);

export const Asset = model<IAsset>("Asset", assetSchema);
