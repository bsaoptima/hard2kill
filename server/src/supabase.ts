import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
}

// Use service role key on server for admin access
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function getBalance(userId: string): Promise<number> {
    const { data, error } = await supabase
        .from('balances')
        .select('balance')
        .eq('id', userId)
        .single();

    if (error) {
        // User doesn't exist in balances table yet - create them
        if (error.code === 'PGRST116') {
            await supabase.from('balances').insert({ id: userId, balance: 0 });
            return 0;
        }
        console.error('Error fetching balance:', error);
        return 0;
    }
    return data?.balance || 0;
}

export async function deductBalance(userId: string, amount: number): Promise<boolean> {
    const currentBalance = await getBalance(userId);
    if (currentBalance < amount) {
        return false;
    }

    const { error } = await supabase
        .from('balances')
        .update({ balance: currentBalance - amount, updated_at: new Date().toISOString() })
        .eq('id', userId);

    if (error) {
        console.error('Error deducting balance:', error);
        return false;
    }

    // Record transaction
    await supabase.from('transactions').insert({
        user_id: userId,
        amount: -amount,
        type: 'bet',
    });

    return true;
}

export async function creditBalance(userId: string, amount: number): Promise<boolean> {
    const currentBalance = await getBalance(userId);

    const { error } = await supabase
        .from('balances')
        .update({ balance: currentBalance + amount, updated_at: new Date().toISOString() })
        .eq('id', userId);

    if (error) {
        console.error('Error crediting balance:', error);
        return false;
    }

    // Record transaction
    await supabase.from('transactions').insert({
        user_id: userId,
        amount,
        type: 'win',
    });

    return true;
}

export async function logGameResult(
    winnerId: string,
    loserId: string,
    amount: number,
    startedAt: Date
): Promise<boolean> {
    const { error } = await supabase.from('game_history').insert({
        winner_id: winnerId,
        loser_id: loserId,
        amount,
        started_at: startedAt.toISOString(),
        ended_at: new Date().toISOString(),
    });

    if (error) {
        console.error('Error logging game result:', error);
        return false;
    }

    return true;
}
