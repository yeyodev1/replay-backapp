import axios from "axios";
import { CustomError } from "../errors/customError.error";

const RESEND_URL = "https://api.resend.com/emails";

class EmailService {
  private get from() {
    return process.env.MAIL_FROM || "Replay by Bakano <replay@bakano.ec>";
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new CustomError("RESEND_API_KEY no configurada", 500);
    }

    try {
      await axios.post(
        RESEND_URL,
        { from: this.from, to: [to], subject, html },
        { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 15000 },
      );
    } catch (error: any) {
      const details = error?.response?.data;
      throw new CustomError(
        details?.message || "Error enviando el correo",
        502,
        details,
      );
    }
  }

  async sendPasswordReset(to: string, name: string, resetUrl: string): Promise<void> {
    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; background:#f5f3ef; padding:32px;">
        <div style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden;">
          <div style="background:#191423; padding:24px 32px;">
            <h1 style="color:#ffffff; font-size:18px; margin:0;">Replay <span style="color:#e6285c;">Bakano</span></h1>
          </div>
          <div style="padding:32px;">
            <h2 style="color:#191423; font-size:20px; margin:0 0 12px;">Hola ${name} 👋</h2>
            <p style="color:#4b5563; font-size:14px; line-height:1.6; margin:0 0 24px;">
              Recibimos una solicitud para restablecer tu contraseña.
              Haz clic en el botón para crear una nueva. Este enlace expira en <strong>1 hora</strong>.
            </p>
            <div style="text-align:center; margin:0 0 24px;">
              <a href="${resetUrl}" style="display:inline-block; background:#e6285c; color:#ffffff; font-weight:bold; font-size:14px; padding:14px 32px; border-radius:12px; text-decoration:none;">
                Restablecer contraseña
              </a>
            </div>
            <p style="color:#9ca3af; font-size:12px; line-height:1.5; margin:0;">
              Si no solicitaste este cambio, ignora este correo — tu contraseña seguirá siendo la misma.
            </p>
          </div>
        </div>
      </div>
    `;
    await this.send(to, "Restablece tu contraseña — Replay by Bakano", html);
  }
}

export const emailService = new EmailService();
