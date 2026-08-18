export type VettingMode = 'sandbox' | 'live';
export type VettingSessionStatus = 'pending' | 'approved' | 'rejected';

/** A verification session the member can open on another device (QR target). */
export interface VettingSessionView {
  sessionId: string;
  mode: VettingMode;
  status: VettingSessionStatus;
  hostedUrl: string;
  createdAt: string;
}

/** Result of starting a session; `hostedUrl` is what the QR encodes. */
export interface CreateVettingSessionResult {
  sessionId: string;
  mode: VettingMode;
  hostedUrl: string;
  /** Live only: the provider token used to map the async callback back. */
  webToken?: string;
}
