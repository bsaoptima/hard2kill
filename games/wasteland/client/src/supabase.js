import { createClient } from '@supabase/supabase-js';

// These are shared with HARD2KILL - same Supabase project
const supabaseUrl = 'https://nyxpjzexjzzilkwivoiv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55eHBqemV4anp6aWxrd2l2b2l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjM0ODQsImV4cCI6MjA4Njk5OTQ4NH0.eUVsjHs-uGAiKeOsPqk4gDW95MsG2WCG2Pod_K457e4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Get the current user's balance
 * @returns {Promise<number>} The user's balance or 0 if not logged in
 */
export async function getBalance() {
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

/**
 * Get the current user's pot (in-game currency)
 * @returns {Promise<number>} The user's pot or 100 (default) if not logged in
 */
export async function getPot() {
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
 * @param {number} newPot - The new pot value
 */
export async function updatePot(newPot) {
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
 * Record a transaction (kill reward, death loss, etc.)
 * @param {number} amount - The amount (positive or negative)
 * @param {'kill' | 'death' | 'win' | 'lose'} type - The transaction type
 */
export async function recordTransaction(amount, type) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    await supabase.from('transactions').insert({
        user_id: session.user.id,
        amount,
        type,
        game: 'three-fps',
    });
}

/**
 * Get current authenticated user
 * @returns {Promise<{id: string, email: string} | null>}
 */
export async function getCurrentUser() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user || null;
}
