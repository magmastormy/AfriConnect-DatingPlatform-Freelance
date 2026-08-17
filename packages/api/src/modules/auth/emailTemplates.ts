import { config } from '@config/index';

/** Plain + HTML bodies for the email verification link (PRIMARY channel). */
export function verificationEmail(verifyUrl: string): {
  subject: string;
  html: string;
  text: string;
} {
  return {
    subject: 'Verify your AfriConnect email',
    text:
      'Welcome to AfriConnect Professionals.\n\n' +
      'Please verify your email to activate your account by opening this link:\n' +
      `${verifyUrl}\n\n` +
      'This link expires in 30 minutes. If you did not request this, you can ignore the email.\n\n' +
      '—The AfriConnect team',
    html:
      '<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto">' +
      '<h2>Verify your AfriConnect email</h2>' +
      '<p>Welcome to AfriConnect Professionals. Confirm your email to activate your account.</p>' +
      `<p><a href="${verifyUrl}" style="background:#0b6b5b;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Verify my email</a></p>` +
      '<p style="color:#666;font-size:13px">This link expires in 30 minutes. If you did not request it, ignore this email.</p>' +
      '</div>',
  };
}

/** Build the absolute verification link from config (no raw token in logs). */
export function buildVerificationUrl(token: string): string {
  const base = config.webBaseUrl.replace(/\/+$/, '');
  return `${base}/verify?token=${encodeURIComponent(token)}`;
}
