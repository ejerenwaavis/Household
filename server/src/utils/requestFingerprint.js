import { createHash } from 'crypto';

function normalizeIp(ip = '') {
  const value = String(ip || '').trim();
  if (!value) return 'unknown';
  const first = value.split(',')[0]?.trim() || value;

  // Mask IPv4 to /24 to reduce false positives from small IP changes.
  const octets = first.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (octets) {
    return `${octets[1]}.${octets[2]}.${octets[3]}.0`;
  }

  // Collapse IPv6 to first four hextets.
  const hextets = first.split(':').filter(Boolean);
  if (hextets.length > 0) {
    return `${hextets.slice(0, 4).join(':')}::`;
  }

  return first;
}

function getRequestIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded || req.ip || req.socket?.remoteAddress || '';
  return normalizeIp(ip);
}

export function createRequestFingerprint(req) {
  const userAgent = String(req.headers['user-agent'] || '').toLowerCase();
  const acceptLanguage = String(req.headers['accept-language'] || '').toLowerCase();
  const platform = String(req.headers['sec-ch-ua-platform'] || '').toLowerCase();
  const ip = getRequestIp(req);

  const source = [userAgent, acceptLanguage, platform, ip].join('|');
  const hash = createHash('sha256').update(source).digest('hex');

  return {
    hash,
    context: {
      ip,
      userAgent,
      acceptLanguage,
      platform,
    },
  };
}

export default createRequestFingerprint;
