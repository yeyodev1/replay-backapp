import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User } from "../models/user.model";
import { CustomError } from "../errors/customError.error";
import { emailService } from "./email.service";
import { JwtPayload } from "../types/AuthRequest";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

function toPublic(user: any): PublicUser {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

class AuthService {
  private signToken(userId: string, email: string): string {
    const payload: JwtPayload = { userId, email, accountType: "admin" };
    return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: "7d" });
  }

  async hasUsers(): Promise<boolean> {
    return (await User.estimatedDocumentCount()) > 0;
  }

  async register(input: {
    name?: string;
    email?: string;
    password?: string;
  }): Promise<PublicUser> {
    const email = input.email?.trim().toLowerCase();
    const password = input.password ?? "";
    const name = input.name?.trim() || email?.split("@")[0] || "Usuario";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new CustomError("Email inválido", 400);
    }
    if (password.length < 8) {
      throw new CustomError("La contraseña debe tener al menos 8 caracteres", 400);
    }

    const existing = await User.findOne({ email });
    if (existing) {
      throw new CustomError("Ya existe un usuario con ese email", 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash });
    return toPublic(user);
  }

  async login(email?: string, password?: string) {
    const normalized = email?.trim().toLowerCase();
    if (!normalized || !password) {
      throw new CustomError("Email y contraseña son obligatorios", 400);
    }

    const user = await User.findOne({ email: normalized });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new CustomError("Credenciales incorrectas", 401);
    }

    return {
      token: this.signToken(String(user._id), user.email),
      user: toPublic(user),
    };
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await User.findById(userId);
    if (!user) throw new CustomError("Usuario no encontrado", 404);
    return toPublic(user);
  }

  async listUsers(): Promise<PublicUser[]> {
    const users = await User.find().sort({ createdAt: 1 });
    return users.map(toPublic);
  }

  async deleteUser(id: string, requesterId: string): Promise<void> {
    if (id === requesterId) {
      throw new CustomError("No puedes eliminar tu propio usuario", 400);
    }
    const result = await User.findByIdAndDelete(id);
    if (!result) throw new CustomError("Usuario no encontrado", 404);
  }

  async forgotPassword(email?: string): Promise<void> {
    const normalized = email?.trim().toLowerCase();
    if (!normalized) throw new CustomError("Email es obligatorio", 400);

    const user = await User.findOne({ email: normalized });
    // Respuesta siempre OK para no revelar qué emails existen
    if (!user) return;

    const rawToken = crypto.randomBytes(32).toString("hex");
    user.resetTokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    user.resetTokenExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save();

    const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(
      /\/+$/,
      "",
    );
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;
    await emailService.sendPasswordReset(user.email, user.name, resetUrl);
  }

  async resetPassword(token?: string, password?: string): Promise<void> {
    if (!token) throw new CustomError("Token inválido", 400);
    if (!password || password.length < 8) {
      throw new CustomError("La contraseña debe tener al menos 8 caracteres", 400);
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetTokenHash: tokenHash,
      resetTokenExpires: { $gt: new Date() },
    });
    if (!user) {
      throw new CustomError("El enlace de recuperación es inválido o expiró", 400);
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    user.resetTokenHash = undefined;
    user.resetTokenExpires = undefined;
    await user.save();
  }
}

export const authService = new AuthService();
