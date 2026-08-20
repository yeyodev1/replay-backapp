import { HydratedDocument } from "mongoose";
import { Asset, IAsset, AssetType } from "../models/asset.model";
import { CustomError } from "../errors/customError.error";
import { cloudinaryService } from "./cloudinary.service";

type AssetDoc = HydratedDocument<IAsset>;

const VALID_TYPES: AssetType[] = ["escenario", "avatar", "perspectiva", "voz", "otro"];

export interface CreateAssetInput {
  name?: string;
  type?: string;
  /** data URI base64 (data:image/png;base64,...) o URL http(s) */
  file?: string;
}

class AssetService {
  async create(input: CreateAssetInput): Promise<AssetDoc> {
    const name = input.name?.trim();
    if (!name) throw new CustomError("El nombre del recurso es obligatorio", 400);

    const type = input.type as AssetType;
    if (!VALID_TYPES.includes(type)) {
      throw new CustomError(
        `Tipo inválido. Opciones: ${VALID_TYPES.join(", ")}`,
        400,
      );
    }

    const file = input.file;
    if (!file || !(file.startsWith("data:") || /^https?:\/\//.test(file))) {
      throw new CustomError(
        "Envía el archivo como data URI base64 o una URL pública",
        400,
      );
    }

    const uploaded = await cloudinaryService.upload(file, type);

    // Las voces deben ser audio; los demás tipos, imagen
    if (type === "voz" && uploaded.resourceType === "image") {
      await cloudinaryService.destroy(uploaded.publicId, uploaded.resourceType);
      throw new CustomError("El recurso de voz debe ser un audio (mp3/wav)", 400);
    }
    if (type !== "voz" && uploaded.resourceType !== "image") {
      await cloudinaryService.destroy(uploaded.publicId, uploaded.resourceType);
      throw new CustomError(`El recurso de tipo ${type} debe ser una imagen`, 400);
    }

    return Asset.create({
      name,
      type,
      url: uploaded.url,
      publicId: uploaded.publicId,
      resourceType: uploaded.resourceType,
      bytes: uploaded.bytes,
      format: uploaded.format,
      duration: uploaded.duration,
    });
  }

  async list(type?: string): Promise<AssetDoc[]> {
    const filter = type && VALID_TYPES.includes(type as AssetType) ? { type } : {};
    return Asset.find(filter).sort({ createdAt: -1 });
  }

  async remove(id: string): Promise<void> {
    const asset = await Asset.findById(id);
    if (!asset) throw new CustomError("Recurso no encontrado", 404);
    await cloudinaryService.destroy(asset.publicId, asset.resourceType);
    await asset.deleteOne();
  }
}

export const assetService = new AssetService();
