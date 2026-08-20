import { Request, Response, NextFunction } from "express";
import { assetService } from "../services/asset.service";

export async function createAsset(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, type, file } = req.body;
    const asset = await assetService.create({ name, type, file });
    res.status(201).json(asset);
  } catch (error) {
    next(error);
  }
}

export async function createVoice(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, text, voice, speed } = req.body;
    res.status(201).json(await assetService.createVoiceFromText({ name, text, voice, speed }));
  } catch (error) {
    next(error);
  }
}

export async function createScenario(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, prompt, size } = req.body;
    res.status(202).json(await assetService.startScenario({ name, prompt, size }));
  } catch (error) {
    next(error);
  }
}

export async function scenarioStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const taskId = String(req.query.taskId ?? "");
    const name = String(req.query.name ?? "");
    res.json(await assetService.resolveScenario(taskId, name));
  } catch (error) {
    next(error);
  }
}

export async function listAssets(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await assetService.list(req.query.type as string | undefined));
  } catch (error) {
    next(error);
  }
}

export async function deleteAsset(req: Request, res: Response, next: NextFunction) {
  try {
    await assetService.remove(String(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
