import axios, { AxiosInstance } from "axios";
import { CustomError } from "../errors/customError.error";

export interface CreateVideoPayload {
  model: string;
  prompt: string;
  duration: number;
  resolution: string;
  aspect_ratio?: string;
  size?: string;
  image_urls?: string[];
}

export type NormalizedStatus = "pending" | "processing" | "completed" | "failed";

export interface NormalizedTask {
  status: NormalizedStatus;
  videoUrl?: string;
  error?: string;
  progress?: number;
  /** Costo real en USD que reporta APIMart al completar la tarea */
  actualCostUsd?: number;
  raw?: unknown;
}

export interface AccountBalance {
  remainUsd: number;
  usedUsd: number;
  remainCredits: number;
  usedCredits: number;
}

const PENDING = new Set(["pending", "submitted", "queued", "not_start"]);
const PROCESSING = new Set(["processing", "in_progress", "running", "generating"]);
const COMPLETED = new Set(["completed", "success", "succeeded", "finished"]);
const FAILED = new Set(["failed", "failure", "error", "cancelled", "canceled"]);

class ApimartService {
  private client: AxiosInstance;

  constructor() {
    const baseURL = process.env.APIMART_BASE_URL || "https://api.apimart.ai";
    const apiKey = process.env.APIMART_API_KEY;

    this.client = axios.create({
      baseURL,
      timeout: 60000,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
  }

  async createVideoTask(payload: CreateVideoPayload): Promise<string> {
    try {
      const { data } = await this.client.post("/v1/videos/generations", payload);
      const entry = Array.isArray(data?.data) ? data.data[0] : data?.data;
      const taskId = entry?.task_id || data?.task_id;
      if (!taskId) {
        throw new CustomError("APIMart no devolvió task_id", 502, data);
      }
      return taskId;
    } catch (error) {
      throw this.wrapError(error, "Error creando la tarea de video en APIMart");
    }
  }

  async getTask(taskId: string): Promise<NormalizedTask> {
    try {
      const { data } = await this.client.get(`/v1/tasks/${taskId}`);
      return this.normalizeTask(data);
    } catch (error) {
      throw this.wrapError(error, "Error consultando la tarea de video en APIMart");
    }
  }

  private normalizeTask(raw: any): NormalizedTask {
    const body = raw?.data ?? raw;
    const entry = Array.isArray(body) ? body[0] : body;
    const statusRaw = String(entry?.status ?? "").toLowerCase();

    let status: NormalizedStatus = "processing";
    if (PENDING.has(statusRaw)) status = "pending";
    else if (PROCESSING.has(statusRaw)) status = "processing";
    else if (COMPLETED.has(statusRaw)) status = "completed";
    else if (FAILED.has(statusRaw)) status = "failed";

    const videoUrl = this.extractVideoUrl(entry);
    // Algunas respuestas marcan completed sin URL todavía: seguir en processing
    if (status === "completed" && !videoUrl) status = "processing";

    const progress =
      typeof entry?.progress === "number"
        ? entry.progress
        : typeof entry?.progress === "string"
          ? parseInt(entry.progress, 10) || undefined
          : undefined;

    const error =
      entry?.fail_reason || entry?.error?.message || entry?.error || entry?.message;

    return {
      status,
      videoUrl,
      progress,
      actualCostUsd: typeof entry?.cost === "number" ? entry.cost : undefined,
      error: status === "failed" ? String(error ?? "Generación fallida") : undefined,
      raw: entry,
    };
  }

  /** TTS: genera audio mp3 (binario) con las voces de gpt-4o-mini-tts. */
  async generateSpeechMp3(
    input: string,
    voice: string,
    speed = 1.0,
  ): Promise<Buffer> {
    try {
      const { data } = await this.client.post(
        "/v1/audio/speech",
        { model: "gpt-4o-mini-tts", input, voice, response_format: "mp3", speed },
        { responseType: "arraybuffer", timeout: 120000 },
      );
      return Buffer.from(data);
    } catch (error) {
      throw this.wrapError(error, "Error generando la voz (TTS)");
    }
  }

  /** Genera una imagen (nano banana) y espera el resultado. Devuelve la URL temporal. */
  async generateImage(prompt: string, size = "16:9"): Promise<string> {
    let taskId: string;
    try {
      const { data } = await this.client.post("/v1/images/generations", {
        model: "gemini-2.5-flash-image-preview",
        prompt,
        size,
        n: 1,
      });
      const entry = Array.isArray(data?.data) ? data.data[0] : data?.data;
      taskId = entry?.task_id || data?.task_id;
      if (!taskId) throw new CustomError("APIMart no devolvió task_id de imagen", 502, data);
    } catch (error) {
      throw this.wrapError(error, "Error creando la imagen");
    }

    for (let i = 0; i < 36; i++) {
      await new Promise((r) => setTimeout(r, 2800));
      const task = await this.getTask(taskId);
      const entry: any = task.raw ?? {};
      const candidates = [
        ...(Array.isArray(entry.result?.images)
          ? entry.result.images.map((x: any) => x?.url ?? x)
          : []),
        ...(Array.isArray(entry.images) ? entry.images.map((x: any) => x?.url ?? x) : []),
        entry.result?.url,
        entry.image_url,
      ].flat(2);
      const url = candidates.find((c) => typeof c === "string" && /^https?:\/\//.test(c));
      if (task.status === "completed" && url) return url as string;
      if (task.status === "failed") {
        throw new CustomError(task.error || "La generación de imagen falló", 502);
      }
    }
    throw new CustomError("La imagen tardó demasiado; intenta de nuevo", 504);
  }

  async getBalance(): Promise<AccountBalance> {
    try {
      const { data } = await this.client.get("/v1/user/balance");
      return {
        remainUsd: Number(data?.remain_balance ?? 0),
        usedUsd: Number(data?.used_balance ?? 0),
        remainCredits: Number(data?.remain_credits ?? 0),
        usedCredits: Number(data?.used_credits ?? 0),
      };
    } catch (error) {
      throw this.wrapError(error, "Error consultando el saldo en APIMart");
    }
  }

  private extractVideoUrl(entry: any): string | undefined {
    if (!entry) return undefined;
    // `url` puede venir como string o como array de strings (ej. result.videos[0].url)
    const candidates = [
      entry.video_url,
      entry.url,
      entry.output?.video_url,
      entry.result?.video_url,
      entry.result?.url,
      ...(Array.isArray(entry.video_urls) ? entry.video_urls : []),
      ...(Array.isArray(entry.urls) ? entry.urls : []),
      ...(Array.isArray(entry.output) ? entry.output : []),
      ...(Array.isArray(entry.result?.urls) ? entry.result.urls : []),
      ...(Array.isArray(entry.result?.videos)
        ? entry.result.videos.map((v: any) => v?.url ?? v)
        : []),
      ...(Array.isArray(entry.videos) ? entry.videos.map((v: any) => v?.url ?? v) : []),
    ].flat(2);
    const found = candidates.find(
      (c) => typeof c === "string" && /^https?:\/\//.test(c),
    );
    return found as string | undefined;
  }

  private wrapError(error: unknown, fallback: string): CustomError {
    if (error instanceof CustomError) return error;
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 502;
      const details = error.response?.data;
      const message =
        details?.error?.message || details?.message || error.message || fallback;
      return new CustomError(message, status >= 400 && status < 600 ? status : 502, details);
    }
    return new CustomError(fallback, 502, error);
  }
}

export const apimartService = new ApimartService();
