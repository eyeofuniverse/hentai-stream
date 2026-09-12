import "server-only";
import { Resend } from "resend";

// this replaces Supabase's own auth-email sending — Supabase still generates
// and verifies the actual token (see api/auth/email-hook), we just own what
// the email looks like and who it's sent from. See SUPABASE_AUTH_HOOK_SECRET
// in .env for the webhook that calls into this.

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set");
    _resend = new Resend(key);
  }
  return _resend;
}

const FROM = "LustHentai <noreply@auth.lusthentai.com>";
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lusthentai.com";

function base(title: string, body: string): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#050508;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#050508;padding:40px 16px;">
  <tr><td align="center">
    <table role="presentation" width="480" cellspacing="0" cellpadding="0" border="0" style="max-width:480px;width:100%;">
      <tr>
        <td style="padding:0 0 24px;text-align:center;">
          <span style="font-size:22px;font-weight:800;letter-spacing:-0.3px;">
            <span style="color:#ffffff;">Lust</span><span style="color:#ff3d7f;">Hentai</span>
          </span>
        </td>
      </tr>
      <tr>
        <td style="background:#0d0d13;border:1px solid #1c1c26;border-radius:16px;padding:36px 32px;">
          ${body}
        </td>
      </tr>
      <tr>
        <td style="padding:24px 8px 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#55555f;">© ${year} LustHentai · 18+ only</p>
          <p style="margin:6px 0 0;font-size:12px;">
            <a href="${SITE}" style="color:#ff3d7f;text-decoration:none;">lusthentai.com</a>
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

const h1 = `font-size:20px;font-weight:800;color:#ffffff;margin:0 0 12px;`;
const p = `font-size:14px;color:#a3a3af;line-height:1.65;margin:0 0 20px;`;
const muted = `font-size:12px;color:#6b6b78;line-height:1.6;margin:16px 0 0;`;
const btn = `display:inline-block;background:#ff3d7f;color:#ffffff;text-decoration:none;padding:13px 30px;border-radius:10px;font-size:14px;font-weight:700;`;
const linkBox = `background:#050508;border:1px solid #1c1c26;border-radius:8px;padding:12px 14px;margin:0 0 20px;word-break:break-all;font-size:12px;color:#8b8b96;`;

function buildConfirmSignupHtml(confirmUrl: string): string {
  return base("Confirm your email", `
    <p style="${h1}">Confirm your email</p>
    <p style="${p}">Click below to activate your LustHentai account. This link expires in 24 hours.</p>
    <p style="text-align:center;margin:0 0 20px;"><a href="${confirmUrl}" style="${btn}">Confirm account</a></p>
    <p style="${linkBox}">${confirmUrl}</p>
    <p style="${muted}">If you didn't create an account on LustHentai, you can ignore this email.</p>
  `);
}
function buildConfirmSignupText(confirmUrl: string): string {
  return `Confirm your LustHentai account\n\n${confirmUrl}\n\nThis link expires in 24 hours. If you didn't create an account, ignore this email.`;
}

function buildPasswordResetHtml(resetUrl: string): string {
  return base("Reset your password", `
    <p style="${h1}">Reset your password</p>
    <p style="${p}">We got a request to reset your LustHentai password. This link expires in 1 hour.</p>
    <p style="text-align:center;margin:0 0 20px;"><a href="${resetUrl}" style="${btn}">Reset password</a></p>
    <p style="${linkBox}">${resetUrl}</p>
    <p style="${muted}">If you didn't request this, your password is safe — you can ignore this email.</p>
  `);
}
function buildPasswordResetText(resetUrl: string): string {
  return `Reset your LustHentai password\n\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`;
}

export async function sendConfirmSignupEmail(to: string, confirmUrl: string) {
  const { error } = await getResend().emails.send({
    from: FROM,
    to,
    subject: "Confirm your LustHentai account",
    html: buildConfirmSignupHtml(confirmUrl),
    text: buildConfirmSignupText(confirmUrl),
  });
  if (error) throw new Error(error.message);
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const { error } = await getResend().emails.send({
    from: FROM,
    to,
    subject: "Reset your LustHentai password",
    html: buildPasswordResetHtml(resetUrl),
    text: buildPasswordResetText(resetUrl),
  });
  if (error) throw new Error(error.message);
}
