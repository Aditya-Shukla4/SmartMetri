import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
// Yahan humne ANON key hata kar SERVICE key laga di hai
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase URL or Service Key in .env");
}

export const supabase = createClient(supabaseUrl, supabaseKey);