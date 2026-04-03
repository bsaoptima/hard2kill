import { createClient } from '@supabase/supabase-js';

// Check if we're in Node.js (server) or browser
const isServer = typeof window === 'undefined';

const supabaseUrl = isServer
    ? process.env.SUPABASE_URL || 'https://nyxpjzexjzzilkwivoiv.supabase.co'
    : 'https://nyxpjzexjzzilkwivoiv.supabase.co';

const supabaseAnonKey = isServer
    ? process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55eHBqemV4anp6aWxrd2l2b2l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjM0ODQsImV4cCI6MjA4Njk5OTQ4NH0.eUVsjHs-uGAiKeOsPqk4gDW95MsG2WCG2Pod_K457e4'
    : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55eHBqemV4anp6aWxrd2l2b2l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjM0ODQsImV4cCI6MjA4Njk5OTQ4NH0.eUVsjHs-uGAiKeOsPqk4gDW95MsG2WCG2Pod_K457e4';

// Extract project ref from URL for localStorage key
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || '';
export const SUPABASE_STORAGE_KEY = `sb-${projectRef}-auth-token`;

// Client for regular operations (respects RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for server operations (bypasses RLS) - Only available server-side!
export const supabaseAdmin = isServer && process.env.SUPABASE_SERVICE_KEY
    ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
    : null as any; // Type assertion for client-side (will never be used)

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

    // Use admin client if available (server-side), otherwise use regular client
    const client = supabaseAdmin || supabase;

    const { data, error } = await client
        .from('balances')
        .select('balance')
        .eq('id', targetUserId)
        .maybeSingle();

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
 * Credit balance (used by Stripe webhook and server-side operations)
 */
export async function creditBalance(userId: string, amount: number): Promise<void> {
    if (!supabaseAdmin) {
        console.error('Cannot credit balance: admin client not available');
        return;
    }

    const { data: balance } = await supabaseAdmin
        .from('balances')
        .select('balance')
        .eq('id', userId)
        .maybeSingle();

    const newBalance = (balance?.balance || 0) + amount;

    await supabaseAdmin
        .from('balances')
        .upsert({ id: userId, balance: newBalance });
}

/**
 * Deduct balance (used when placing bets)
 */
export async function deductBalance(userId: string, amount: number): Promise<boolean> {
    if (!supabaseAdmin) {
        console.error('Cannot deduct balance: admin client not available');
        return false;
    }

    const { data: balance } = await supabaseAdmin
        .from('balances')
        .select('balance')
        .eq('id', userId)
        .maybeSingle();

    const currentBalance = balance?.balance || 0;

    if (currentBalance < amount) {
        return false; // Insufficient balance
    }

    const newBalance = currentBalance - amount;

    const { error } = await supabaseAdmin
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
    startedAt: Date
): Promise<boolean> {
    if (!supabaseAdmin) {
        console.error('[logGameResult] Cannot log game result: admin client not available');
        return false;
    }

    console.log(`[logGameResult] Inserting: winner=${winnerId}, loser=${loserId}, amount=${amount}`);

    const { data, error } = await supabaseAdmin.from('game_history').insert({
        winner_id: winnerId,
        loser_id: loserId,
        amount,
        started_at: startedAt.toISOString(),
        ended_at: new Date().toISOString(),
    });

    if (error) {
        console.error('[logGameResult] Error logging game result:', JSON.stringify(error, null, 2));
        return false;
    }

    console.log('[logGameResult] Successfully inserted game history');
    return true;
}
