import { CustomError } from "../errors/customError.error";
import { VideoJobOptions } from "../models/videoJob.model";

/**
 * Contrato declarativo por modelo: describe EXACTAMENTE el JSON que cada
 * modelo de APIMart espera (docs.apimart.ai). Agregar un modelo nuevo =
 * agregar su manifiesto aquí; no se toca código.
 */
export interface ModelContract {
  /** Cómo espera las imágenes de referencia */
  imageMode: "image_urls" | "first_frame_image" | "frames" | "none";
  maxImages: number;
  /** Nombre del campo de aspecto (wan usa `size`); undefined = no se envía */
  aspectField?: "aspect_ratio" | "size";
  /** Si hay imagen, el aspecto no se envía (la imagen manda) — ej. sora-2 */
  aspectSkippedWithImage?: boolean;
  /** ¿Se envía el campo resolution? */
  sendResolution: boolean;
  /** Campos fijos que siempre van (mode, watermark, etc.) */
  constants?: Record<string, string | number | boolean>;
  /** Mapa de opciones genéricas → nombre de campo del modelo */
  optionMap?: Partial<
    Record<keyof VideoJobOptions | "prompt_extend", string>
  >;
}

export const MODEL_CONTRACTS: Record<string, ModelContract> = {
  "seedance-1-0-pro-fast": {
    imageMode: "frames", // images: [{url, role: "first_frame"}]
    maxImages: 1,
    aspectField: "aspect_ratio",
    sendResolution: true,
  },
  "MiniMax-Hailuo-2.3-Fast": {
    imageMode: "first_frame_image",
    maxImages: 1,
    sendResolution: true,
    constants: { watermark: false },
    optionMap: { promptOptimizer: "prompt_optimizer" },
  },
  "kling-v2-6": {
    imageMode: "image_urls",
    maxImages: 2, // primer y último frame
    aspectField: "aspect_ratio",
    sendResolution: false,
    constants: { mode: "std" },
  },
  "wan2.5-preview": {
    imageMode: "image_urls",
    maxImages: 1,
    aspectField: "size",
    // Verificado en vivo: con imagen, wan2.5 rechaza `size` (el aspecto lo define la imagen)
    aspectSkippedWithImage: true,
    sendResolution: true,
    constants: { watermark: false, prompt_extend: true },
    optionMap: {
      negativePrompt: "negative_prompt",
      seed: "seed",
      audio: "audio",
      audioUrl: "audio_url",
    },
  },
  "sora-2": {
    imageMode: "image_urls",
    maxImages: 2,
    aspectField: "aspect_ratio",
    aspectSkippedWithImage: true,
    sendResolution: true,
  },
};

export interface PayloadInput {
  prompt: string;
  resolution: string;
  aspectRatio: string;
  duration: number;
  imageUrls: string[];
  options: VideoJobOptions;
}

/** Construye el JSON exacto del modelo a partir de su contrato. */
export function buildPayloadFromContract(
  modelId: string,
  input: PayloadInput,
): Record<string, unknown> {
  const contract = MODEL_CONTRACTS[modelId];
  if (!contract) {
    throw new CustomError(`No hay contrato definido para el modelo ${modelId}`, 500);
  }

  const { prompt, resolution, aspectRatio, duration, imageUrls, options } = input;
  const payload: Record<string, unknown> = { model: modelId, prompt, duration };

  if (contract.sendResolution) payload.resolution = resolution;

  const images = imageUrls.slice(0, contract.maxImages);

  if (contract.aspectField) {
    const skip = contract.aspectSkippedWithImage && images.length > 0;
    if (!skip) payload[contract.aspectField] = aspectRatio;
  }

  if (images.length) {
    switch (contract.imageMode) {
      case "image_urls":
        payload.image_urls = images;
        break;
      case "first_frame_image":
        payload.first_frame_image = images[0];
        break;
      case "frames":
        payload.images = images.map((url, i) => ({
          url,
          role: i === 0 ? "first_frame" : "last_frame",
        }));
        break;
    }
  }

  Object.assign(payload, contract.constants ?? {});

  for (const [option, field] of Object.entries(contract.optionMap ?? {})) {
    const value = (options as Record<string, unknown>)[option];
    if (value !== undefined && value !== null && value !== "") {
      payload[field] = value;
    }
  }

  validatePayload(modelId, payload);
  return payload;
}

/** Validación final: nada de undefined/null y campos base presentes. */
function validatePayload(modelId: string, payload: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) {
      throw new CustomError(
        `Payload inválido para ${modelId}: el campo "${key}" quedó vacío`,
        500,
        payload,
      );
    }
  }
  if (!payload.prompt || !payload.duration) {
    throw new CustomError(
      `Payload inválido para ${modelId}: faltan prompt o duration`,
      500,
      payload,
    );
  }
}
