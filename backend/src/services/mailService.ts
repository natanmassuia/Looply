import { logger } from "../lib/logger";

export interface SendPasswordResetEmailInput {
  to: string;
  name: string;
  token: string;
}

export interface MailService {
  sendPasswordResetEmail(input: SendPasswordResetEmailInput): Promise<{ id?: string; simulated?: boolean }>;
}

// A3 (auditoria): dado de usuário interpolado em template de e-mail precisa
// de escape HTML — o campo name é texto livre do perfil (PATCH /api/auth/me).
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Render puro (sem rede) do e-mail de recuperação — testável diretamente.
// Únicas interpolações de dado de usuário: name (escapado abaixo) e token
// (server-side, encodeURIComponent). appUrl vem de env (confiável).
export function renderPasswordResetEmail(input: { name: string; token: string; appUrl: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const resetUrl = `${input.appUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(input.token)}`;

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
<body style="margin:0; padding:0; background-color:#FFF7F1; -webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFF7F1; padding:32px 16px;">
    <tr>
      <td align="center" style="padding:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px; width:100%; background-color:#FFFFFF; border-radius:20px; border:1px solid rgba(243,184,75,0.18); box-shadow:0 8px 32px rgba(42,23,31,0.06);">
          <tr>
            <td style="padding:32px 40px 24px 40px;">
              <!-- Logo: Looply / Human Relay -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding-bottom:20px;">
                    <span style="font-family:Manrope,'Segoe UI',Arial,Helvetica,sans-serif; font-size:24px; font-weight:800; color:#2A171F; letter-spacing:-0.5px;">Looply</span>
                    <span style="font-family:Manrope,'Segoe UI',Arial,Helvetica,sans-serif; font-size:12px; font-weight:600; color:#8F7C85; letter-spacing:0.08em; text-transform:uppercase; padding-left:8px;">Human Relay</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Blush recovery artwork/header -->
          <tr>
            <td style="background-color:#FFE3D7; padding:28px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom:14px;">
                    <span style="font-family:Manrope,'Segoe UI',Arial,Helvetica,sans-serif; display:inline-block; font-size:11px; font-weight:700; color:#F06D55; text-transform:uppercase; letter-spacing:0.08em; background-color:#FFFFFF; border-radius:999px; padding:6px 14px;">RECUPERAÇÃO DE ACESSO</span>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <h1 style="font-family:Manrope,'Segoe UI',Arial,Helvetica,sans-serif; margin:0; font-size:28px; line-height:1.25; color:#2A171F; font-weight:700;">Redefina sua senha</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px 8px 40px;">
              <p style="font-family:Manrope,'Segoe UI',Arial,Helvetica,sans-serif; margin:0 0 18px 0; font-size:15px; line-height:1.6; color:#5C4A52;">
                Olá, <strong style="color:#2A171F;">${escapeHtml(input.name)}</strong>!
              </p>
              <p style="font-family:Manrope,'Segoe UI',Arial,Helvetica,sans-serif; margin:0 0 24px 0; font-size:15px; line-height:1.6; color:#5C4A52;">
                Recebemos uma solicitação para redefinir a senha da sua conta no Looply. Para cadastrar uma nova senha, use o botão abaixo.
              </p>
              <!-- Coral CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" style="font-family:Manrope,'Segoe UI',Arial,Helvetica,sans-serif; display:inline-block; background-color:#F06D55; color:#FFFFFF; text-decoration:none; font-size:16px; font-weight:700; padding:14px 32px; border-radius:12px; box-shadow:0 4px 12px rgba(240,109,85,0.3);">Redefinir senha</a>
                  </td>
                </tr>
              </table>
              <!-- Amber validity notice -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px 0;">
                <tr>
                  <td style="background-color:#F3B84B; border-radius:12px; padding:14px 18px;">
                    <span style="font-family:Manrope,'Segoe UI',Arial,Helvetica,sans-serif; font-size:14px; line-height:1.5; color:#2A171F; font-weight:600;">Este link expira em 1 hora e pode ser usado apenas uma vez.</span>
                  </td>
                </tr>
              </table>
              <!-- Fallback reset URL -->
              <p style="font-family:Manrope,'Segoe UI',Arial,Helvetica,sans-serif; margin:0 0 8px 0; font-size:13px; line-height:1.5; color:#8F7C85;">
                Se o botão acima não funcionar, copie e cole este link no seu navegador:
              </p>
              <p style="margin:0 0 28px 0; word-break:break-all;">
                <a href="${resetUrl}" style="font-family:Manrope,'Segoe UI',Arial,Helvetica,sans-serif; font-size:13px; line-height:1.5; color:#F06D55; text-decoration:underline;">${resetUrl}</a>
              </p>
              <hr style="border:0; border-top:1px solid rgba(243,184,75,0.25); margin:0 0 20px 0;">
              <!-- Security notice -->
              <p style="font-family:Manrope,'Segoe UI',Arial,Helvetica,sans-serif; margin:0 0 24px 0; font-size:12px; line-height:1.5; color:#8F7C85;">
                Se você não solicitou a redefinição de senha, ignore este e-mail com segurança. Sua senha continuará a mesma.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px 40px; border-top:1px solid rgba(243,184,75,0.15);">
              <p style="font-family:Manrope,'Segoe UI',Arial,Helvetica,sans-serif; margin:0; font-size:12px; line-height:1.5; color:#B8A6AE;">
                Enviado por Looply — Human Relay · Operação de conteúdo para agências
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

  return { subject, text, html };
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
    const { subject, text, html } = renderPasswordResetEmail({
      name: input.name,
      token: input.token,
      appUrl: this.appUrl,
    });

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
          subject,
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
