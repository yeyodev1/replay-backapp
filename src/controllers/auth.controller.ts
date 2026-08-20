import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/AuthRequest";
import { authService } from "../services/auth.service";

export async function register(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { name, email, password } = req.body;
    const user = await authService.register({ name, email, password });
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
}

export async function login(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    res.json(await authService.login(email, password));
  } catch (error) {
    next(error);
  }
}

export async function me(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json(await authService.me(req.user!.userId));
  } catch (error) {
    next(error);
  }
}

export async function listUsers(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json(await authService.listUsers());
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await authService.deleteUser(String(req.params.id), req.user!.userId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await authService.forgotPassword(req.body.email);
    res.json({ message: "Si el email existe, enviamos un enlace de recuperación" });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { token, password } = req.body;
    await authService.resetPassword(token, password);
    res.json({ message: "Contraseña actualizada. Ya puedes iniciar sesión." });
  } catch (error) {
    next(error);
  }
}
