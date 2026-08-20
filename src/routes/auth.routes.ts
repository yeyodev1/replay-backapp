import express, { Response, NextFunction } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { AuthRequest } from "../types/AuthRequest";
import { authService } from "../services/auth.service";
import {
  register,
  login,
  me,
  listUsers,
  deleteUser,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controller";

const authRouter = express.Router();

/**
 * Bootstrap: si la base no tiene usuarios, el primer registro es libre
 * (permite crear el usuario inicial vía curl). Después, solo usuarios
 * autenticados pueden crear más usuarios.
 */
async function registerGuard(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!(await authService.hasUsers())) return next();
    return authMiddleware(req, res, next);
  } catch (error) {
    next(error);
  }
}

authRouter.post("/register", registerGuard, register);
authRouter.post("/login", login);
authRouter.post("/forgot-password", forgotPassword);
authRouter.post("/reset-password", resetPassword);
authRouter.get("/me", authMiddleware, me);
authRouter.get("/users", authMiddleware, listUsers);
authRouter.delete("/users/:id", authMiddleware, deleteUser);

export default authRouter;
