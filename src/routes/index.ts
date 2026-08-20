import express, { Application } from "express";
import videoRouter from "./video.routes";
import authRouter from "./auth.routes";
import assetRouter from "./asset.routes";
import { authMiddleware } from "../middlewares/auth.middleware";

function routerApi(app: Application) {
  const router = express.Router();
  app.use("/api", router);

  router.use("/auth", authRouter);
  router.use("/videos", authMiddleware, videoRouter);
  router.use("/assets", authMiddleware, assetRouter);
}

export default routerApi;
