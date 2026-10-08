const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
/**
 * Extracts plain text from an uploaded file (.docx or .pdf)
 * @param {Object} file - The multer file object
 * @returns {Promise<string>} - The extracted text
 */
const extractText = async (file) => {
    try {
        const filePath = file.path;
        const fileExtension = path.extname(file.originalname).replace('.', '').toLowerCase();
        if (fileExtension === 'docx') {
            const result = await mammoth.extractRawText({ path: filePath });
            // Clean up uploaded temp file after extraction
            fs.unlinkSync(filePath);
            return result.value;
        }
        else if (fileExtension === 'pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            // Pass options to avoid worker thread issues with pdf-parse
            const data = await pdfParse(dataBuffer, {
                pagerender: function (pageData) {
                    return pageData.getTextContent().then(function (textContent) {
                        let text = '';
                        for (let item of textContent.items) {
                            text += item.str + ' ';
                        }
                        return text;
                    });
                }
            });
            fs.unlinkSync(filePath);
            return data.text;
        }
        else {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            throw new Error('Unsupported file format. Please upload a .docx or .pdf file.');
        }
    } catch (error) {
        if (file && file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }
        throw new Error(`Text extraction failed: ${error.message}`);
    }
};

module.exports = { extractText };