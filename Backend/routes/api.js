const express = require('express');
const router = express.Router();
const { sendPasswordResetEmail } = require('../services/emailServices');
const { createClient } = require('@supabase/supabase-js');

// Ensure these variable names match exactly what is in your .env file
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Imports for registration, database, and security
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const authenticateToken = require('../Middleware/auth');
const crypto = require('crypto');

// Existing imports for analysis
const upload = require('../config/multer');
const { extractText } = require('../services/extractor');
const { runOfflineAnalysis } = require('../services/ruleEngine');
const { runGeminiAnalysis } = require('../services/geminiService');

//USER REGISTRATION ROUTE
// POST /api/register
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const insertQuery = `
            INSERT INTO users (username, email, password_hash)
            VALUES ($1, $2, $3)
            RETURNING id, username, email, created_at;
        `;
        const result = await db.query(insertQuery, [username, email, passwordHash]);

        res.status(201).json({
            message: 'User registered successfully!',
            user: result.rows[0]
        });

    } catch (error) {
        console.error('Registration error:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'An account with this email already exists.' });
        }
        res.status(500).json({ error: 'Server error during registration.' });
    }
});



//USER LOGIN ROUTE 
// POST /api/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
        const userQuery = 'SELECT * FROM users WHERE email = $1';
        const result = await db.query(userQuery, [email]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const secretKey = process.env.JWT_SECRET || 'super_secret_development_key';
        const token = jwt.sign(
            { id: user.id, username: user.username },
            secretKey,
            { expiresIn: '24h' }
        );

        res.status(200).json({
            message: 'Login successful!',
            token,
            name: user.username, // Added top-level name property for easy frontend access
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login.' });
    }
});



//DOCUMENT ANALYSIS ROUTE (SECURED)
router.post('/analyze', authenticateToken, upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No valid file uploaded. Please provide a .docx or .pdf file.' });
        }

        const mode = req.query.mode || 'offline';
        const documentText = await extractText(req.file);

        if (!documentText || documentText.trim().length === 0) {
            return res.status(400).json({ error: 'The uploaded document appears to be empty or unreadable.' });
        }

        let analysisResults;

        if (mode === 'online') {
            analysisResults = await runGeminiAnalysis(documentText);
        } else {
            analysisResults = await Promise.resolve(runOfflineAnalysis(documentText));
        }

        if (mode === 'online') {
            analysisResults = await runGeminiAnalysis(documentText);
        } else {
            analysisResults = await Promise.resolve(runOfflineAnalysis(documentText));
        }

        // ADD THIS LINE RIGHT HERE:
        console.log("Analysis Output:", analysisResults);

        // 1. SAVE THE DOCUMENT ANALYSIS TO SUPABASE...

        // 1. SAVE THE DOCUMENT ANALYSIS TO SUPABASE
        const insertQuery = `
            INSERT INTO documents (user_id, filename, extracted_text, analysis_results)
            VALUES ($1, $2, $3, $4)
            RETURNING id, created_at;
        `;
        const savedDoc = await db.query(insertQuery, [
            req.user.id, // Comes from your authenticateToken middleware
            req.file.originalname,
            documentText,
            JSON.stringify(analysisResults)
        ]);

        return res.status(200).json({
            success: true,
            message: `File successfully processed using ${mode} mode!`,
            documentId: savedDoc.rows[0].id,
            filename: req.file.originalname,
            characterCount: documentText.length,
            extractedText: documentText,
            ...analysisResults
        });

    } catch (error) {
        console.error("--> Error in analyze route:", error.message);
        const statusCode = error.message.includes('Unsupported') || error.message.includes('failed') ? 400 : 500;
        return res.status(statusCode).json({ error: error.message });
    }
});

// GET DOCUMENT HISTORY ROUTE (SECURED)
// Fetch user's document history
router.get('/history', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Updated to match your exact Supabase columns: filename, analysis_results, created_at
        const { data: documents, error } = await supabase
            .from('documents')
            .select('id, filename, analysis_results, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(15);

        if (error) throw error;

        // Format data for frontend to map riskScore and createdAt properly
        const formattedDocs = (documents || []).map(doc => {
            // Extract risk score from analysis_results JSON if it exists there, default to Medium
            let risk = 'Medium';
            if (doc.analysis_results && doc.analysis_results.riskScore) {
                risk = doc.analysis_results.riskScore;
            }

            return {
                id: doc.id,
                filename: doc.filename,
                riskScore: risk,
                createdAt: doc.created_at
            };
        });

        res.json(formattedDocs);
    } catch (err) {
        console.error('Failed to fetch history:', err.message);
        res.status(500).json({ error: 'Failed to load document history' });
    }
});

// Fetch a single document's full analysis results
router.get('/history/:id', authenticateToken, async (req, res) => {
    try {
        const docId = req.params.id;
        const userId = req.user.id;

        const { data: document, error } = await supabase
            .from('documents')
            .select('*')
            .eq('id', docId)
            .eq('user_id', userId)
            .single();

        if (error) throw error;
        if (!document) return res.status(404).json({ error: 'Document not found' });

        res.json(document);
    } catch (err) {
        console.error('Failed to fetch document details:', err.message);
        res.status(500).json({ error: 'Failed to load document analysis' });
    }
});

// 4. FORGOT PASSWORD ROUTE
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        const userQuery = 'SELECT id FROM users WHERE email = $1';
        const result = await db.query(userQuery, [email]);

        if (result.rows.length === 0) {
            return res.status(200).json({ message: 'If an account exists, a reset link has been sent to your email.' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenExpires = Date.now() + 3600000;

        await db.query(
            'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3',
            [resetToken, tokenExpires, email]
        );

        await sendPasswordResetEmail(email, resetToken);

        res.status(200).json({
            message: 'If an account exists, a reset link has been sent to your email.'
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Server error processing request.' });
    }
});


// GET /reset-password - Serves the reset password form page in the browser
router.get('/reset-password', async (req, res) => {
    const { token } = req.query;

    if (!token) {
        return res.status(400).send('Invalid or missing password reset token.');
    }

    try {
        const userQuery = 'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > $2';
        const currentTime = Date.now();
        const result = await db.query(userQuery, [token, currentTime]);

        if (result.rows.length === 0) {
            return res.status(400).send('Password reset link is invalid or has expired.');
        }

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Reset Password</title>
                <style>
                    body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f4f6f8; }
                    .card { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
                    h2 { margin-bottom: 20px; color: #333; }
                    label { display: block; margin-bottom: 8px; font-weight: bold; color: #555; }
                    input { width: 100%; padding: 10px; margin-bottom: 20px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
                    button { width: 100%; padding: 10px; background-color: #007bff; color: white; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; }
                    button:hover { background-color: #0056b3; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>Reset Your Password</h2>
                    <form action="/api/reset-password" method="POST">
                        <input type="hidden" name="token" value="${token}" />
                        <label for="newPassword">New Password:</label>
                        <input type="password" id="newPassword" name="newPassword" required />
                        <button type="submit">Update Password</button>
                    </form>
                </div>
            </body>
            </html>
        `);

    } catch (error) {
        console.error('Error loading reset page:', error);
        res.status(500).send('Server error loading reset page.');
    }
});


// 5. RESET PASSWORD ROUTE
router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token and new password are required.' });
    }

    try {
        const userQuery = 'SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > $2';
        const currentTime = Date.now();
        const result = await db.query(userQuery, [token, currentTime]);

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired password reset token.' });
        }

        const user = result.rows[0];
        const saltRounds = 10;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

        const updateQuery = `
            UPDATE users 
            SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL 
            WHERE id = $2
        `;
        await db.query(updateQuery, [newPasswordHash, user.id]);

        res.status(200).json({ message: 'Password has been successfully reset! You can now log in.' });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Server error during password reset.' });
    }
});

module.exports = router;