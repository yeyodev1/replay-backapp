import express from "express";
import {
  getCatalog,
  createVideo,
  listVideos,
  getVideo,
  deleteVideo,
  getStats,
} from "../controllers/video.controller";

const videoRouter = express.Router();

videoRouter.get("/models", getCatalog);
videoRouter.get("/stats", getStats);
videoRouter.post("/", createVideo);
videoRouter.get("/", listVideos);
videoRouter.get("/:id", getVideo);
videoRouter.delete("/:id", deleteVideo);

export default videoRouter;
