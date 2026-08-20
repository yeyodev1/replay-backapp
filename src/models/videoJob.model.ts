import { Schema, model } from "mongoose";

export type VideoJobStatus = "pending" | "processing" | "completed" | "failed";

export interface VideoJobOptions {
  negativePrompt?: string;
  seed?: number;
  audio?: boolean;
  promptOptimizer?: boolean;
  /** URL de audio (voz) para modelos con audio custom, ej. wan2.5 */
  audioUrl?: string;
}

export interface IVideoJob {
  prompt: string;
  model: string;
  modelName: string;
  resolution: string;
  aspectRatio: string;
  duration: number;
  imageUrls: string[];
  options?: VideoJobOptions;
  status: VideoJobStatus;
  taskId: string;
  videoUrl?: string;
  error?: string;
  progress?: number;
  estimatedCostUsd: number;
  actualCostUsd?: number;
  /** JSON literal enviado a APIMart (auditoria + replica exacta) */
  sentPayload?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const videoJobSchema = new Schema<IVideoJob>(
  {
    prompt: { type: String, required: true, trim: true },
    model: { type: String, required: true },
    modelName: { type: String, required: true },
    resolution: { type: String, required: true },
    aspectRatio: { type: String, required: true },
    duration: { type: Number, required: true },
    imageUrls: { type: [String], default: [] },
    options: { type: Schema.Types.Mixed },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },
    taskId: { type: String, required: true, index: true },
    videoUrl: { type: String },
    error: { type: String },
    progress: { type: Number },
    estimatedCostUsd: { type: Number, required: true },
    actualCostUsd: { type: Number },
    sentPayload: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export const VideoJob = model<IVideoJob>("VideoJob", videoJobSchema);
