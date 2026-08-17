import { logger } from "../lib/logger";

export interface SendPasswordResetEmailInput {
  to: string;
  name: string;
  token: string;
}

export interface MailService {
  sendPasswordResetEmail(input: SendPasswordResetEmailInput): Promise<{ id?: string; simulated?: boolean }>;
}

export class ResendMailService implements MailService {
  private readonly apiKey: string | undefined;
  private readonly from: string;
  private readonly replyTo: string;
  private readonly appUrl: string;

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY;
    this.from = process.env.RESEND_FROM || process.env.MAIL_FROM || "Looply <acesso@auth.verbumlab.com.br>";
    this.replyTo = process.env.RESEND_REPLY_TO || process.env.MAIL_REPLY_TO || "suporte@verbumlab.com.br";
    this.appUrl = process.env.FRONTEND_URL || process.env.APP_URL || process.env.PUBLIC_APP_URL || "https://looply.verbumlab.com.br";
  }

  async sendPasswordResetEmail(input: SendPasswordResetEmailInput): Promise<{ id?: string; simulated?: boolean }> {
    const resetUrl = `${this.appUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(input.token)}`;

    const subject = "Redefina sua senha do Looply";
    const text = `Olá, ${input.name}!\n\nRecebemos uma solicitação para redefinir a senha da sua conta no Looply.\n\nPara cadastrar uma nova senha, acesse o link abaixo:\n${resetUrl}\n\nEste link é válido por 1 hora e só pode ser utilizado uma única vez.\n\nSe você não solicitou esta alteração, ignore este e-mail. Sua senha atual permanecerá segura.\n\nEquipe Looply`;

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FFF7F1; margin: 0; padding: 40px 20px; color: #2A171F;">
  <div style="max-width: 520px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; border: 1px solid #F3B84B33; padding: 40px; box-shadow: 0 4px 16px rgba(42, 23, 31, 0.04);">
    <div style="margin-bottom: 28px;">
      <span style="font-size: 24px; font-weight: 800; color: #F06D55; letter-spacing: -0.5px;">Looply</span>
    </div>
    
    <div style="display: inline-block; padding: 4px 10px; border-radius: 9999px; background: #FFE3D7; color: #F06D55; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px;">
      Recuperação de Acesso
    </div>

    <h1 style="font-size: 22px; font-weight: 700; color: #2A171F; margin: 0 0 16px 0; line-height: 1.3;">
      Redefinição de senha
    </h1>

    <p style="font-size: 15px; line-height: 1.6; color: #5C4A52; margin: 0 0 24px 0;">
      Olá, <strong>${input.name}</strong>!<br>
      Recebemos um pedido para redefinir a senha da sua conta no Looply.
    </p>

    <div style="margin: 32px 0;">
      <a href="${resetUrl}" style="background-color: #F06D55; color: #FFFFFF; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 2px 8px rgba(240, 109, 85, 0.25);">
        Redefinir senha
      </a>
    </div>

    <p style="font-size: 13px; line-height: 1.5; color: #8F7C85; margin: 0 0 16px 0;">
      Este link é válido por <strong>1 hora</strong> e só pode ser utilizado uma vez.<br>
      Se o botão acima não funcionar, copie e cole este link no seu navegador:<br>
      <a href="${resetUrl}" style="color: #F06D55; word-break: break-all;">${resetUrl}</a>
    </p>

    <hr style="border: 0; border-top: 1px solid #F3B84B22; margin: 28px 0;">

    <p style="font-size: 12px; line-height: 1.5; color: #8F7C85; margin: 0;">
      Se você não solicitou a redefinição de senha, ignore este e-mail com segurança. Sua senha continuará a mesma.
    </p>
  </div>
</body>
</html>
    `.trim();

    if (!this.apiKey || this.apiKey === "disabled" || process.env.NODE_ENV === "test") {
      logger.info("[MailService] Simulating password reset email", {
        to: input.to,
        from: this.from,
        appUrl: this.appUrl,
      });
      return { id: "simulated-mail-id", simulated: true };
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: [input.to],
          reply_to: this.replyTo,
          subject: "Redefinição de senha — Looply",
          html,
          text,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error("[MailService] Resend API error", {
          status: response.status,
          error: errorBody,
        });
        throw new Error(`Resend API error: ${response.status} ${errorBody}`);
      }

      const data = (await response.json()) as { id: string };
      logger.info("[MailService] Password reset email sent via Resend", {
        id: data.id,
      });
      return { id: data.id };
    } catch (err: any) {
      logger.error("[MailService] Failed to send email via Resend", {
        error: err.message,
      });
      throw err;
    }
  }
}

export const mailService = new ResendMailService();
