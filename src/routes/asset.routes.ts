import express from "express";
import { createAsset, listAssets, deleteAsset } from "../controllers/asset.controller";

const assetRouter = express.Router();

assetRouter.post("/", createAsset);
assetRouter.get("/", listAssets);
assetRouter.delete("/:id", deleteAsset);

export default assetRouter;
