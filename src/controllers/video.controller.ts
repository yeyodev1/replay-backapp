import { Request, Response, NextFunction } from "express";
import { videoService } from "../services/video.service";

export async function getCatalog(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(videoService.getCatalog());
  } catch (error) {
    next(error);
  }
}

export async function createVideo(req: Request, res: Response, next: NextFunction) {
  try {
    const { prompt, model, resolution, aspectRatio, duration, imageUrls, options } =
      req.body;
    const job = await videoService.createJob({
      prompt,
      model,
      resolution,
      aspectRatio,
      duration,
      imageUrls,
      options,
    });
    res.status(201).json(job);
  } catch (error) {
    next(error);
  }
}

export async function getStats(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await videoService.getStats());
  } catch (error) {
    next(error);
  }
}

export async function listVideos(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await videoService.listJobs());
  } catch (error) {
    next(error);
  }
}

export async function getVideo(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await videoService.syncJob(String(req.params.id)));
  } catch (error) {
    next(error);
  }
}

export async function replicateExact(req: Request, res: Response, next: NextFunction) {
  try {
    const job = await videoService.replicateExact(String(req.params.id));
    res.status(201).json(job);
  } catch (error) {
    next(error);
  }
}

export async function deleteVideo(req: Request, res: Response, next: NextFunction) {
  try {
    await videoService.deleteJob(String(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
