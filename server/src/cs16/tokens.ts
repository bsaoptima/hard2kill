import { createHmac, timingSafeEqual } from 'crypto';

export interface MatchTokenPayload {
    matchId: string;
    userId: string;
    username: string;
    betAmount: number;
    currency: 'cash' | 'coins';
    exp: number;
}

const SECRET = process.env.CS16_WEBHOOK_SECRET || '';

function b64url(buf: Buffer): string {
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str: string): Buffer {
    const pad = '='.repeat((4 - (str.length % 4)) % 4);
    return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

export function signMatchToken(payload: MatchTokenPayload): string {
    if (!SECRET) throw new Error('CS16_WEBHOOK_SECRET not configured');
    const body = b64url(Buffer.from(JSON.stringify(payload)));
    const sig = b64url(createHmac('sha256', SECRET).update(body).digest());
    return `${body}.${sig}`;
}

export function verifyMatchToken(token: string): MatchTokenPayload | null {
    if (!SECRET) return null;
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;

    const expected = b64url(createHmac('sha256', SECRET).update(body).digest());
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

    try {
        const payload = JSON.parse(b64urlDecode(body).toString()) as MatchTokenPayload;
        if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
        return payload;
    } catch {
        return null;
    }
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!SECRET || !signature) return false;
    const expected = createHmac('sha256', SECRET).update(rawBody).digest('hex');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    return sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);
}
