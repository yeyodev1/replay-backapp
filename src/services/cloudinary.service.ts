import { v2 as cloudinary } from "cloudinary";
import { CustomError } from "../errors/customError.error";

let configured = false;
function ensureConfig() {
  if (configured) return;
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret) {
    throw new CustomError("Cloudinary no está configurado", 500);
  }
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  configured = true;
}

export interface UploadedAsset {
  url: string;
  publicId: string;
  resourceType: string;
  bytes: number;
  format?: string;
  duration?: number;
}

class CloudinaryService {
  /**
   * Sube un archivo (data URI base64 o URL remota).
   * resource_type "auto" acepta imágenes y audio (Cloudinary trata audio como video).
   */
  async upload(file: string, folder: string): Promise<UploadedAsset> {
    ensureConfig();
    try {
      const result = await cloudinary.uploader.upload(file, {
        folder: `replay/${folder}`,
        resource_type: "auto",
        overwrite: false,
      });
      return {
        url: result.secure_url,
        publicId: result.public_id,
        resourceType: result.resource_type,
        bytes: result.bytes,
        format: result.format,
        duration: (result as any).duration,
      };
    } catch (error: any) {
      throw new CustomError(
        error?.message || "Error subiendo el archivo a Cloudinary",
        502,
        error,
      );
    }
  }

  async destroy(publicId: string, resourceType: string): Promise<void> {
    ensureConfig();
    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType === "image" ? "image" : "video",
      });
    } catch (error) {
      // No bloquear el borrado local si Cloudinary falla
      console.error("Cloudinary destroy falló:", error);
    }
  }
}

export const cloudinaryService = new CloudinaryService();
