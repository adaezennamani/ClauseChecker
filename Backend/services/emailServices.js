const nodemailer = require('nodemailer');

// 1. Configure the transporter using Gmail credentials from your .env
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// 2. Function to send the password reset email
const sendPasswordResetEmail = async (email, resetToken) => { // Make sure this argument matches!
    const resetLink = `http://localhost:5000/api/reset-password?token=${resetToken}`;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Password Reset Request - ClauseCheck',
        html: `
            <p>You requested a password reset for your ClauseCheck account.</p>
            <p>Click the secure link below to reset your password. This link is valid for 1 hour:</p>
            <a href="${resetLink}">Reset Password</a>
        `
    };

    await transporter.sendMail(mailOptions);
};

module.exports = { sendPasswordResetEmail };