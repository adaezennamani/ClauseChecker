const { Pool } = require('pg');

// Replace this string with the actual URI you copied from Supabase!
// Make sure to replace [YOUR-PASSWORD] with the password you created.
const connectionString = 'postgresql://postgres.kqshdmjnzyqjslibaieb:Chinagorom02_@aws-1-eu-west-1.pooler.supabase.com:6543/postgres'

const pool = new Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false // This is required to securely connect to cloud databases
    }
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};