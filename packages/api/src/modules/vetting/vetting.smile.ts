import { config } from '@config/index';
import { logger } from '@africonnect/shared';
import type { CreateVettingSessionResult, VettingMode } from './vetting.types';

const SANDBOX_PATH = '/vetting/sandbox';

// Built server-side from webBaseUrl; the browser just renders the returned URL.
function sandboxHostedUrl(sessionId: string): string {
  return `${config.webBaseUrl}${SANDBOX_PATH}?session=${sessionId}`;
}

/**
 * Starts a KYC verification session.
 *
 * - Sandbox (default, no keys): returns a local simulator URL so the entire
 *   cross-device flow is exercisable for free. The QR opens our own
 *   /vetting/sandbox page, which approves the check locally.
 * - Live (SMILE_PARTNER_ID + key/secret + SMILE_SANDBOX=false): delegates to the
 *   Smile ID hosted-web SDK to produce a real capture URL (ID + SmartSelfie
 *   liveness + government-DB checks) the member opens on their phone.
 */
export async function startSmileSession(input: {
  userId: string;
  sessionId: string;
}): Promise<CreateVettingSessionResult> {
  if (config.smile.sandbox || !config.smile.partnerId) {
    return {
      sessionId: input.sessionId,
      mode: 'sandbox' as VettingMode,
      hostedUrl: sandboxHostedUrl(input.sessionId),
    };
  }

  // ── Live path (Smile ID hosted web integration) ────────────────────────────
  // Lazily imported so the testing/sandbox path never requires the dependency to
  // be installed. Requires SMILE_PARTNER_ID / SMILE_API_KEY / SMILE_API_SECRET.
  // NOTE: validate the exact SDK method signatures against your installed
  // `smile-identity-core` version before going live.
  const mod: any = await import('smile-identity-core');
  const { WebApi } = mod;
  const partnerParams = {
    partner_id: Number(config.smile.partnerId),
    api_key: config.smile.apiKey,
  };
  // sid_server: 0 = Sandbox, 1 = Production (Smile ID convention).
  const connection = new WebApi(mod, partnerParams, config.smile.apiSecret, 1);

  const callbackUrl = `${config.apiBaseUrl}/${config.apiMountPath}/v1/vetting/smile/webhook`;
  const webToken: string = await connection.get_web_token({
    callback_url: callbackUrl,
    user_id: input.userId,
    job_type: 5, // Basic KYC: ID number + Selfie (liveness). See Smile ID docs.
  });

  const hostedUrl = `https://${config.smile.partnerId}.smileidentity.com/?token=${webToken}`;
  return {
    sessionId: input.sessionId,
    mode: 'live' as VettingMode,
    hostedUrl,
    webToken,
  };
}

/**
 * Verifies the signature on a Smile ID webhook callback and returns the parsed
 * decision. Throws if the signature is invalid. Live path only — sandbox uses
 * our own /vetting/sandbox simulator and never calls this.
 */
export async function verifySmileWebhook(
  rawBody: Buffer,
  signature: string,
  timestamp: string,
): Promise<{ userId: string; approved: boolean; jobId: string }> {
  const mod: any = await import('smile-identity-core');
  const { Signature } = mod;
  const sig = new Signature(config.smile.apiKey, config.smile.apiSecret);
  const valid = sig.confirm_signature(rawBody.toString('utf8'), Number(timestamp), signature);
  if (!valid) {
    throw new Error('Invalid Smile ID webhook signature');
  }
  const payload = JSON.parse(rawBody.toString('utf8'));
  const userId = String(payload?.PartnerParams?.user_id ?? '');
  const jobId = String(payload?.PartnerParams?.job_id ?? '');
  // Smile ID result_code: 0/1 = pass (ID match + liveness), anything else = fail.
  const resultCode = Number(payload?.result_code ?? payload?.ResultCode ?? -1);
  const approved = resultCode === 0 || resultCode === 1;
  logger.info({ jobId, userId, resultCode, approved }, 'Smile ID webhook verified');
  return { userId, approved, jobId };
}
