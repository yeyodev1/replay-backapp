import express from "express";
import cors from "cors";
import http from "http";
import mongoose from "mongoose";
import routerApi from "./routes";
import { dbConnect } from "./config/mongo";
import { globalErrorHandler } from "./middlewares/globalErrorHandler.middleware";

const whitelist = [
  "http://localhost:8100",
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:8101",
  "https://replay.bakano.ec",
  "https://api-replay.bakano.ec",
  "https://replay-neon.vercel.app",
  "https://replay-proyectos-de-diego.vercel.app",
];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

const app = express();

app.use(cors(corsOptions));
app.use(express.json({ limit: "50mb" }));

// En serverless (Vercel) nadie llama dbConnect() al arrancar: se asegura aquí,
// una sola vez por instancia, antes de atender cualquier request.
let dbReady: Promise<void> | null = null;
app.use((_req, _res, next) => {
  if (mongoose.connection.readyState === 1) return next();
  if (!dbReady) dbReady = dbConnect();
  dbReady.then(() => next()).catch(next);
});

app.get("/", (_req, res) => {
  res.send("Server is alive");
});

routerApi(app);

app.use(globalErrorHandler);

export function createApp() {
  const server = http.createServer(app);
  return { app, server };
}

export default app;
