const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
// Use SUPABASE_ANON_KEY if that is what you named it in your .env file
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env file!");
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;