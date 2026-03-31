import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

// Extract project ref from URL for localStorage key
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || '';
export const SUPABASE_STORAGE_KEY = `sb-${projectRef}-auth-token`;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getBalance(): Promise<number> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
        return 0;
    }

    const { data, error } = await supabase
        .from('balances')
        .select('balance')
        .eq('id', session.user.id)
        .single();

    if (error) {
        console.error('Error fetching balance:', error);
        return 0;
    }
    return data?.balance || 0;
}

export async function recordTransaction(amount: number, type: 'deposit' | 'withdraw' | 'bet' | 'win') {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    await supabase.from('transactions').insert({
        user_id: session.user.id,
        amount,
        type,
    });
}
