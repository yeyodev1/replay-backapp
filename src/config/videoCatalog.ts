export interface VideoModelSpec {
  id: string;
  name: string;
  tagline: string;
  tier: "economico" | "equilibrado" | "audio" | "premium";
  hasAudio: boolean;
  /** El modelo acepta imagen de referencia (imagen → video) */
  supportsImage: boolean;
  /** El modelo EXIGE imagen inicial (no hace texto → video) */
  requiresImage: boolean;
  durations: number[];
  defaultDuration: number;
  resolutions: string[];
  defaultResolution: string;
  aspectRatios: string[];
  /** Restricciones específicas: resolución → duraciones permitidas */
  durationByResolution?: Record<string, number[]>;
  /** Restricciones específicas: resolución → aspects permitidos */
  aspectsByResolution?: Record<string, string[]>;
  /** Extras que soporta este modelo (los usa el frontend para mostrar campos) */
  extras: Array<"negativePrompt" | "seed" | "audioToggle" | "promptOptimizer">;
  /** Qué hace bien — se muestra en la tarjeta del modelo */
  features: string[];
  /** Consejo de prompt para sacar el mejor resultado */
  promptTip: string;
  // USD por segundo, por resolución (precios apimart con 20% dcto incluido)
  pricePerSecond: Record<string, number>;
}

export const VIDEO_CATALOG: VideoModelSpec[] = [
  {
    id: "seedance-1-0-pro-fast",
    name: "Seedance Fast",
    tagline: "El más barato — ideal para iterar rápido",
    tier: "economico",
    hasAudio: false,
    supportsImage: true,
    requiresImage: false,
    durations: [5, 10],
    defaultDuration: 5,
    resolutions: ["480p", "720p", "1080p"],
    defaultResolution: "720p",
    aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    extras: [],
    features: [
      "Texto → video e imagen → video",
      "6 formatos, incluido ultra-wide 21:9",
      "El mejor precio del catálogo",
    ],
    promptTip:
      "Describe sujeto + acción + estilo de cámara. Ej: 'gato dorado corre en cámara lenta, plano cinematográfico'.",
    pricePerSecond: { "480p": 0.011, "720p": 0.025, "1080p": 0.052 },
  },
  {
    id: "MiniMax-Hailuo-2.3-Fast",
    name: "Hailuo 2.3 Fast",
    tagline: "Anima tus fotos — requiere imagen inicial",
    tier: "equilibrado",
    hasAudio: false,
    supportsImage: true,
    requiresImage: true,
    durations: [6, 10],
    defaultDuration: 6,
    resolutions: ["768p", "1080p"],
    defaultResolution: "768p",
    aspectRatios: ["auto"],
    durationByResolution: { "1080p": [6] },
    extras: ["promptOptimizer"],
    features: [
      "Especialista imagen → video (foto obligatoria)",
      "15 comandos de cámara: [Zoom in], [Pan left], [Tilt up]…",
      "Optimización automática del prompt",
    ],
    promptTip:
      "Sube una imagen y describe el movimiento. Usa comandos: '[Zoom in] la modelo sonríe, [Pan right] se ve el producto'.",
    pricePerSecond: { "768p": 0.031, "1080p": 0.053 },
  },
  {
    id: "kling-v2-6",
    name: "Kling 2.6",
    tagline: "Look cinemático, gran calidad/precio",
    tier: "equilibrado",
    hasAudio: false,
    supportsImage: true,
    requiresImage: false,
    durations: [5, 10],
    defaultDuration: 5,
    resolutions: ["720p"],
    defaultResolution: "720p",
    aspectRatios: ["16:9", "9:16", "1:1"],
    extras: [],
    features: [
      "Movimiento fluido y realismo top",
      "Texto → video e imagen → video (primer frame)",
      "Modo estándar 720P silencioso",
    ],
    promptTip:
      "Brilla con descripciones físicas: materiales, luz, clima. Ej: 'lluvia sobre neón, reflejos en el asfalto, dolly lento'.",
    pricePerSecond: { "720p": 0.046 },
  },
  {
    id: "wan2.5-preview",
    name: "Wan 2.5",
    tagline: "Video con audio + control total (seed replicable)",
    tier: "audio",
    hasAudio: true,
    supportsImage: true,
    requiresImage: false,
    durations: [5, 10],
    defaultDuration: 5,
    resolutions: ["480p", "720p", "1080p"],
    defaultResolution: "720p",
    aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    aspectsByResolution: { "480p": ["16:9", "9:16", "1:1"] },
    extras: ["negativePrompt", "seed", "audioToggle"],
    features: [
      "Genera audio automático sincronizado",
      "Seed: repite el mismo video cambiando solo lo que quieras",
      "Prompt negativo para excluir defectos",
    ],
    promptTip:
      "Incluye qué se escucha: 'olas rompiendo, gaviotas de fondo'. Guarda el seed del resultado que te guste para variaciones.",
    pricePerSecond: { "480p": 0.042, "720p": 0.083, "1080p": 0.137 },
  },
  {
    id: "sora-2",
    name: "Sora 2",
    tagline: "Calidad OpenAI con audio y diálogos nativos",
    tier: "premium",
    hasAudio: true,
    supportsImage: true,
    requiresImage: false,
    durations: [4, 8, 12],
    defaultDuration: 8,
    resolutions: ["720p"],
    defaultResolution: "720p",
    aspectRatios: ["16:9", "9:16"],
    extras: [],
    features: [
      "Audio, voces y diálogos generados nativamente",
      "Física y coherencia de escena líderes",
      "Imagen → video (el formato lo define la imagen)",
    ],
    promptTip:
      "Puedes escribir diálogos: 'la barista dice \"tu café está listo\" sonriendo'. Describe escena, acción y tono.",
    pricePerSecond: { "720p": 0.1 },
  },
];

export const DEFAULT_MODEL_ID = "seedance-1-0-pro-fast";

export function findModel(id: string): VideoModelSpec | undefined {
  return VIDEO_CATALOG.find((m) => m.id === id);
}

export function allowedDurations(spec: VideoModelSpec, resolution: string): number[] {
  return spec.durationByResolution?.[resolution] ?? spec.durations;
}

export function allowedAspects(spec: VideoModelSpec, resolution: string): string[] {
  return spec.aspectsByResolution?.[resolution] ?? spec.aspectRatios;
}

export function estimateCost(
  spec: VideoModelSpec,
  resolution: string,
  duration: number,
): number {
  const perSecond = spec.pricePerSecond[resolution];
  if (perSecond === undefined) return 0;
  return Number((perSecond * duration).toFixed(4));
}
