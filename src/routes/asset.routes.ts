import express from "express";
import {
  createAsset,
  listAssets,
  deleteAsset,
  createVoice,
  createScenario,
} from "../controllers/asset.controller";

const assetRouter = express.Router();

assetRouter.post("/", createAsset);
assetRouter.post("/voice", createVoice);
assetRouter.post("/scenario", createScenario);
assetRouter.get("/", listAssets);
assetRouter.delete("/:id", deleteAsset);

export default assetRouter;
