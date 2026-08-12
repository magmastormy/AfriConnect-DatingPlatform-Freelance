import { Request, Response, NextFunction } from 'express';

// Paths that legitimate clients never hit but bots/scanners always probe.
// Any request matching is trapped and rejected with a generic 403 — no route,
// no detail. This bleeds scanner effort and hides the real surface.
const HONEYPOT_PATH = [
  /\/\.env/i,
  /\/\.git/i,
  /\/wp-(admin|login|content|includes)/i,
  /\/phpmyadmin/i,
  /\/admin\.php/i,
  /\/xmlrpc\.php/i,
  /\/config\.(php|json|yml|yaml)/i,
  /\/\.aws/i,
  /\/server-status/i,
  /\/actuator/i,
  /\/vendor\//i,
  /\.(sql|zip|tar|gz|env|bak)$/i,
];

const HONEYPOT_UA = [
  /sqlmap/i,
  /nikto/i,
  /masscan/i,
  /nmap/i,
  /acunetix/i,
  /nessus/i,
  /dirbuster/i,
  /hydra/i,
  /zgrab/i,
];

// Obfuscated-API scanners often probe well-known prefixes. Anything that looks
// like a guessed API root (but isn't the configured mount) is also trapped.
function looksLikeApiProbe(path: string): boolean {
  return (
    /\/(api|v1|v2|api\/v1|rest|graphql|swagger|openapi)\b/i.test(path) && !path.includes('/uploads')
  );
}

export function honeypotMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const url = req.originalUrl || req.url || '';
    const ua = (req.headers['user-agent'] as string) || '';

    const trapped =
      HONEYPOT_PATH.some((re) => re.test(url)) ||
      HONEYPOT_UA.some((re) => re.test(ua)) ||
      looksLikeApiProbe(url);

    if (trapped) {
      // Generic, identical response — gives scanners nothing to fingerprint on.
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } });
      return;
    }
    next();
  };
}
