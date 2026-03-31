import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://nyxpjzexjzzilkwivoiv.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55eHBqemV4anp6aWxrd2l2b2l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjM0ODQsImV4cCI6MjA4Njk5OTQ4NH0.eUVsjHs-uGAiKeOsPqk4gDW95MsG2WCG2Pod_K457e4';

// Extract project ref from URL for localStorage key
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || '';
export const SUPABASE_STORAGE_KEY = `sb-${projectRef}-auth-token`;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Get the current user's balance (from session or by userId)
 */
export async function getBalance(userId?: string): Promise<number> {
    let targetUserId = userId;

    // If no userId provided, get from session
    if (!targetUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
            return 0;
        }
        targetUserId = session.user.id;
    }

    const { data, error } = await supabase
        .from('balances')
        .select('balance')
        .eq('id', targetUserId)
        .single();

    if (error) {
        console.error('Error fetching balance:', error);
        return 0;
    }
    return data?.balance || 0;
}

/**
 * Get the current user's pot (in-game currency)
 */
export async function getPot(): Promise<number> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
        return 100; // Default pot for guests
    }

    const { data, error } = await supabase
        .from('balances')
        .select('pot')
        .eq('id', session.user.id)
        .single();

    if (error) {
        console.error('Error fetching pot:', error);
        return 100;
    }
    return data?.pot || 100;
}

/**
 * Update the user's pot after kills/deaths
 */
export async function updatePot(newPot: number): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { error } = await supabase
        .from('balances')
        .update({ pot: newPot })
        .eq('id', session.user.id);

    if (error) {
        console.error('Error updating pot:', error);
    }
}

/**
 * Record a transaction
 */
export async function recordTransaction(
    amount: number,
    type: 'deposit' | 'withdraw' | 'bet' | 'win' | 'kill' | 'death',
    game?: string
): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    await supabase.from('transactions').insert({
        user_id: session.user.id,
        amount,
        type,
        game,
    });
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user || null;
}

/**
 * Credit balance (used by Stripe webhook)
 */
export async function creditBalance(userId: string, amount: number): Promise<void> {
    const { data: balance } = await supabase
        .from('balances')
        .select('balance')
        .eq('id', userId)
        .single();

    const newBalance = (balance?.balance || 0) + amount;

    await supabase
        .from('balances')
        .upsert({ id: userId, balance: newBalance });
}

/**
 * Deduct balance (used when placing bets)
 */
export async function deductBalance(userId: string, amount: number): Promise<boolean> {
    const { data: balance } = await supabase
        .from('balances')
        .select('balance')
        .eq('id', userId)
        .single();

    const currentBalance = balance?.balance || 0;

    if (currentBalance < amount) {
        return false; // Insufficient balance
    }

    const newBalance = currentBalance - amount;

    const { error } = await supabase
        .from('balances')
        .update({ balance: newBalance })
        .eq('id', userId);

    return !error;
}

/**
 * Log game result to database for leaderboard/analytics
 */
export async function logGameResult(
    winnerId: string,
    loserId: string,
    amount: number,
    duration: number,
    gameType: string = 'gladiatorz'
): Promise<void> {
    try {
        await supabase.from('game_history').insert({
            winner_id: winnerId,
            loser_id: loserId,
            amount,
            duration,
            game_type: gameType,
            ended_at: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Error logging game result:', error);
    }
}
