import { creditBalance, deductBalance, logGameResult, Currency } from '@hard2kill/shared';

export interface CS16MatchResult {
    matchId: string;
    winnerId: string | null;
    loserId: string | null;
    winnerKills: number;
    loserKills: number;
    reason: 'killlimit' | 'timelimit' | 'forfeit' | 'draw';
}

export interface CS16ActiveMatch {
    matchId: string;
    p1: { userId: string; username: string };
    p2: { userId: string; username: string };
    betAmount: number;
    currency: Currency;
    startedAt: Date;
    resolved: boolean;
    safetyTimer: NodeJS.Timeout;
}

const MATCH_SAFETY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

const activeMatches = new Map<string, CS16ActiveMatch>();

export function getMatch(matchId: string): CS16ActiveMatch | undefined {
    return activeMatches.get(matchId);
}

/**
 * Called by CS16MatchmakingRoom when a pair is found.
 * Deducts bets from both players, registers the match, starts the safety timer.
 * Returns false if either deduct fails (opponent should be refunded by caller).
 */
export async function registerAndDebitMatch(match: Omit<CS16ActiveMatch, 'resolved' | 'safetyTimer' | 'startedAt'>): Promise<boolean> {
    const p1ok = await deductBalance(match.p1.userId, match.betAmount, match.currency);
    if (!p1ok) {
        console.error(`[CS16] Failed to deduct from ${match.p1.userId}`);
        return false;
    }
    const p2ok = await deductBalance(match.p2.userId, match.betAmount, match.currency);
    if (!p2ok) {
        // Refund p1 since p2 couldn't pay.
        await creditBalance(match.p1.userId, match.betAmount, match.currency);
        console.error(`[CS16] Failed to deduct from ${match.p2.userId} — refunded ${match.p1.userId}`);
        return false;
    }

    const full: CS16ActiveMatch = {
        ...match,
        startedAt: new Date(),
        resolved: false,
        safetyTimer: setTimeout(() => {
            void refundMatch(match.matchId, 'timeout');
        }, MATCH_SAFETY_TIMEOUT_MS),
    };
    activeMatches.set(match.matchId, full);
    console.log(`[CS16] Match registered: ${match.matchId} (${match.p1.username} vs ${match.p2.username}, ${match.betAmount} ${match.currency})`);
    return true;
}

/**
 * Called by the webhook handler on a valid match_end POST.
 * Credits the winner, logs to game_history, clears the match.
 */
export async function resolveMatch(result: CS16MatchResult): Promise<void> {
    const match = activeMatches.get(result.matchId);
    if (!match || match.resolved) return;
    match.resolved = true;
    clearTimeout(match.safetyTimer);

    if (result.reason === 'draw' || !result.winnerId || !result.loserId) {
        console.log(`[CS16] Match ${result.matchId} ended as draw/invalid — refunding`);
        await refundActive(match);
        return;
    }

    const totalPot = match.betAmount * 2;
    await creditBalance(result.winnerId, totalPot, match.currency);
    console.log(`[CS16] Credited ${totalPot} ${match.currency} to winner ${result.winnerId}`);

    await logGameResult(
        result.winnerId,
        result.loserId,
        totalPot,
        match.startedAt,
        match.currency,
        'cs16',
    );

    activeMatches.delete(result.matchId);
}

async function refundMatch(matchId: string, reason: string): Promise<void> {
    const match = activeMatches.get(matchId);
    if (!match || match.resolved) return;
    match.resolved = true;
    console.warn(`[CS16] Refunding match ${matchId} (${reason})`);
    await refundActive(match);
}

async function refundActive(match: CS16ActiveMatch): Promise<void> {
    await creditBalance(match.p1.userId, match.betAmount, match.currency);
    await creditBalance(match.p2.userId, match.betAmount, match.currency);
    console.log(`[CS16] Refunded ${match.betAmount} ${match.currency} to both players in ${match.matchId}`);
    activeMatches.delete(match.matchId);
}
