import { HydratedDocument } from "mongoose";
import { Asset, IAsset, AssetType } from "../models/asset.model";
import { CustomError } from "../errors/customError.error";
import { cloudinaryService } from "./cloudinary.service";
import { apimartService } from "./apimart.service";

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

  /** Crea una VOZ con IA (TTS) y la guarda en la biblioteca. */
  async createVoiceFromText(input: {
    name?: string;
    text?: string;
    voice?: string;
    speed?: number;
  }): Promise<AssetDoc> {
    const name = input.name?.trim();
    const text = input.text?.trim();
    if (!name) throw new CustomError("El nombre de la voz es obligatorio", 400);
    if (!text) throw new CustomError("Escribe el guion de la voz", 400);
    if (text.length > 4096) throw new CustomError("El guion supera 4096 caracteres", 400);
    const VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
    const voice = VOICES.includes(input.voice ?? "") ? input.voice! : "nova";
    const speed = Math.min(2, Math.max(0.5, input.speed ?? 1));

    const mp3 = await apimartService.generateSpeechMp3(text, voice, speed);
    const dataUri = `data:audio/mpeg;base64,${mp3.toString("base64")}`;
    const uploaded = await cloudinaryService.upload(dataUri, "voz");

    return Asset.create({
      name,
      type: "voz",
      url: uploaded.url,
      publicId: uploaded.publicId,
      resourceType: uploaded.resourceType,
      bytes: uploaded.bytes,
      format: uploaded.format,
      duration: uploaded.duration,
    });
  }

  /** Genera un ESCENARIO con IA (imagen) y lo guarda en la biblioteca. */
  async createScenarioFromPrompt(input: {
    name?: string;
    prompt?: string;
    size?: string;
  }): Promise<AssetDoc> {
    const name = input.name?.trim();
    const prompt = input.prompt?.trim();
    if (!name) throw new CustomError("El nombre del escenario es obligatorio", 400);
    if (!prompt) throw new CustomError("Describe el escenario a generar", 400);
    const size = ["16:9", "9:16", "1:1"].includes(input.size ?? "") ? input.size! : "16:9";

    const tempUrl = await apimartService.generateImage(prompt, size);
    const uploaded = await cloudinaryService.upload(tempUrl, "escenario");

    return Asset.create({
      name,
      type: "escenario",
      url: uploaded.url,
      publicId: uploaded.publicId,
      resourceType: uploaded.resourceType,
      bytes: uploaded.bytes,
      format: uploaded.format,
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
