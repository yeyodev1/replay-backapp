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
