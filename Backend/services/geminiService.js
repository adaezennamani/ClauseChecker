const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI();

/**
 * Helper function to retry an async operation if it fails due to high demand (503)
 */
async function retryWithBackoff(fn, retries = 3, delay = 2000) {
    try {
        return await fn();
    } catch (error) {
        if (retries > 0 && (error.message.includes('503') || error.message.includes('UNAVAILABLE'))) {
            console.log(`--> Gemini model busy (503). Retrying in ${delay / 1000}s... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryWithBackoff(fn, retries - 1, delay * 2);
        }
        throw error;
    }
}

const runGeminiAnalysis = async (documentText) => {
    try {
        const prompt = `
      You are an expert legal assistant. Analyze the following legal document text for potential risks, unfavorable clauses, and liabilities.
      
      Return your response strictly as a valid JSON object with the following structure (do not include markdown ticks like \`\`\`json in your response, just raw JSON text):
      {
        "aiSummary": "A concise 2-3 sentence overview of the document's purpose and general risk profile.",
        "riskScore": "Low / Medium / High",
        "keyRisks": [
          {
            "clauseTitle": "Title of the risky clause",
            "explanation": "Why this is a risk to the user",
            "recommendation": "Actionable advice on how to negotiate or handle it"
          }
        ]
      }

      Document Text to Analyze:
      ${documentText.substring(0, 15000)}
    `;

        // Wrap the API call in our retry function
        const response = await retryWithBackoff(async () => {
            return await ai.models.generateContent({
                model: 'gemini-3.6-flash',
                contents: prompt,
            });
        });

        const rawResponseText = response.text.trim();
        const cleanedJson = rawResponseText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

        return {
            engineUsed: 'gemini_ai_online',
            analysis: JSON.parse(cleanedJson)
        };

    } catch (error) {
        throw new Error(`Gemini AI analysis failed: ${error.message}`);
    }
};

module.exports = { runGeminiAnalysis };