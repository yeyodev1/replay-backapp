import { HydratedDocument } from "mongoose";
import { VideoJob, IVideoJob, VideoJobOptions } from "../models/videoJob.model";
import { CustomError } from "../errors/customError.error";
import {
  VIDEO_CATALOG,
  VideoModelSpec,
  findModel,
  estimateCost,
  allowedDurations,
  allowedAspects,
  DEFAULT_MODEL_ID,
} from "../config/videoCatalog";
import { apimartService } from "./apimart.service";
import { buildPayloadFromContract } from "../config/modelContracts";

type VideoJobDoc = HydratedDocument<IVideoJob>;

export interface CreateVideoJobInput {
  prompt: string;
  model?: string;
  resolution?: string;
  aspectRatio?: string;
  duration?: number;
  imageUrls?: string[];
  options?: VideoJobOptions;
}

class VideoService {
  getCatalog() {
    return { models: VIDEO_CATALOG, defaultModel: DEFAULT_MODEL_ID };
  }

  async createJob(input: CreateVideoJobInput): Promise<VideoJobDoc> {
    const prompt = input.prompt?.trim();
    if (!prompt) {
      throw new CustomError("El prompt es obligatorio", 400);
    }

    const spec = findModel(input.model || DEFAULT_MODEL_ID);
    if (!spec) {
      throw new CustomError(`Modelo no soportado: ${input.model}`, 400);
    }

    const resolution = input.resolution || spec.defaultResolution;
    if (!spec.resolutions.includes(resolution)) {
      throw new CustomError(
        `Resolución ${resolution} no soportada por ${spec.name}. Opciones: ${spec.resolutions.join(", ")}`,
        400,
      );
    }

    const validDurations = allowedDurations(spec, resolution);
    const duration = input.duration || validDurations[0];
    if (!validDurations.includes(duration)) {
      throw new CustomError(
        `Duración ${duration}s no soportada por ${spec.name} en ${resolution}. Opciones: ${validDurations.join(", ")}s`,
        400,
      );
    }

    const validAspects = allowedAspects(spec, resolution);
    const aspectRatio = input.aspectRatio || validAspects[0];
    if (!validAspects.includes(aspectRatio)) {
      throw new CustomError(
        `Formato ${aspectRatio} no soportado por ${spec.name} en ${resolution}. Opciones: ${validAspects.join(", ")}`,
        400,
      );
    }

    const imageUrls = (input.imageUrls ?? []).filter(
      (u) => typeof u === "string" && /^https?:\/\//.test(u),
    );
    if (spec.requiresImage && !imageUrls.length) {
      throw new CustomError(
        `${spec.name} requiere una imagen inicial (imagen → video)`,
        400,
      );
    }

    const options: VideoJobOptions = {
      audioUrl:
        input.options?.audioUrl && /^https?:\/\//.test(input.options.audioUrl)
          ? input.options.audioUrl
          : undefined,
      negativePrompt: input.options?.negativePrompt?.trim() || undefined,
      seed:
        typeof input.options?.seed === "number" && input.options.seed >= 0
          ? Math.floor(input.options.seed)
          : undefined,
      audio: input.options?.audio,
      promptOptimizer: input.options?.promptOptimizer,
    };

    const payload = buildPayloadFromContract(spec.id, {
      prompt,
      resolution,
      aspectRatio,
      duration,
      imageUrls,
      options,
    });

    const taskId = await apimartService.createVideoTask(payload as any);

    const job = await VideoJob.create({
      prompt,
      model: spec.id,
      modelName: spec.name,
      resolution,
      aspectRatio,
      duration,
      imageUrls,
      options,
      status: "pending",
      taskId,
      estimatedCostUsd: estimateCost(spec, resolution, duration),
      sentPayload: payload,
    });

    return job;
  }

  /** Reenvia EXACTAMENTE el mismo JSON de un job anterior (replica 100% fiel). */
  async replicateExact(id: string): Promise<VideoJobDoc> {
    const source = await this.getJob(id);
    if (!source.sentPayload) {
      throw new CustomError(
        "Este video no tiene payload guardado (es anterior a la mejora); usa Replicar normal",
        400,
      );
    }
    const taskId = await apimartService.createVideoTask(source.sentPayload as any);
    return VideoJob.create({
      prompt: source.prompt,
      model: source.model,
      modelName: source.modelName,
      resolution: source.resolution,
      aspectRatio: source.aspectRatio,
      duration: source.duration,
      imageUrls: source.imageUrls,
      options: source.options,
      status: "pending",
      taskId,
      estimatedCostUsd: source.estimatedCostUsd,
      sentPayload: source.sentPayload,
    });
  }

  async listJobs(): Promise<VideoJobDoc[]> {
    return VideoJob.find().sort({ createdAt: -1 }).limit(100);
  }

  async getJob(id: string): Promise<VideoJobDoc> {
    const job = await VideoJob.findById(id);
    if (!job) throw new CustomError("Video no encontrado", 404);
    return job;
  }

  /** Consulta APIMart y sincroniza el estado del job si sigue activo. */
  async syncJob(id: string): Promise<VideoJobDoc> {
    const job = await this.getJob(id);
    if (job.status === "completed" || job.status === "failed") return job;

    const task = await apimartService.getTask(job.taskId);
    job.status = task.status;
    if (task.progress !== undefined) job.progress = task.progress;
    if (task.videoUrl) job.videoUrl = task.videoUrl;
    if (task.error) job.error = task.error;
    if (task.actualCostUsd !== undefined) job.actualCostUsd = task.actualCostUsd;
    await job.save();
    return job;
  }

  /** Panel de gastos: saldo APIMart + agregados de todos los jobs. */
  async getStats() {
    const [jobs, balance] = await Promise.all([
      VideoJob.find().sort({ createdAt: -1 }),
      apimartService.getBalance().catch(() => null),
    ]);

    const billable = jobs.filter((j) => j.status !== "failed");
    const spentOf = (j: IVideoJob) => j.actualCostUsd ?? j.estimatedCostUsd ?? 0;
    const totalSpent = billable.reduce((s, j) => s + spentOf(j), 0);

    const byModelMap = new Map<
      string,
      { model: string; name: string; count: number; spentUsd: number; seconds: number }
    >();
    for (const j of billable) {
      const e = byModelMap.get(j.model) ?? {
        model: j.model,
        name: j.modelName,
        count: 0,
        spentUsd: 0,
        seconds: 0,
      };
      e.count += 1;
      e.spentUsd += spentOf(j);
      e.seconds += j.duration;
      byModelMap.set(j.model, e);
    }

    const now = Date.now();
    const last30 = billable.filter(
      (j) => now - new Date(j.createdAt).getTime() < 30 * 24 * 3600 * 1000,
    );

    return {
      balance,
      totals: {
        videos: jobs.length,
        completed: jobs.filter((j) => j.status === "completed").length,
        failed: jobs.filter((j) => j.status === "failed").length,
        spentUsd: Number(totalSpent.toFixed(4)),
        spentLast30Usd: Number(last30.reduce((s, j) => s + spentOf(j), 0).toFixed(4)),
        secondsGenerated: billable.reduce((s, j) => s + j.duration, 0),
        avgCostUsd: billable.length
          ? Number((totalSpent / billable.length).toFixed(4))
          : 0,
      },
      byModel: [...byModelMap.values()].sort((a, b) => b.spentUsd - a.spentUsd),
      recent: jobs.slice(0, 15).map((j) => ({
        _id: j._id,
        prompt: j.prompt,
        modelName: j.modelName,
        status: j.status,
        estimatedCostUsd: j.estimatedCostUsd,
        actualCostUsd: j.actualCostUsd,
        duration: j.duration,
        resolution: j.resolution,
        createdAt: j.createdAt,
      })),
    };
  }

  async deleteJob(id: string): Promise<void> {
    const result = await VideoJob.findByIdAndDelete(id);
    if (!result) throw new CustomError("Video no encontrado", 404);
  }

  /** Barrido periódico de jobs activos (respaldo del polling del frontend). */
  async sweepActiveJobs(): Promise<void> {
    const active = await VideoJob.find({
      status: { $in: ["pending", "processing"] },
    }).limit(20);

    for (const job of active) {
      try {
        await this.syncJob(String(job._id));
      } catch (error) {
        console.error(`Sweep falló para job ${job._id}:`, error);
      }
    }
  }
}

export const videoService = new VideoService();

const SWEEP_INTERVAL_MS = 20000;
export function startVideoJobSweeper() {
  setInterval(() => {
    videoService.sweepActiveJobs().catch((err) => {
      console.error("Video sweeper error:", err);
    });
  }, SWEEP_INTERVAL_MS);
}
