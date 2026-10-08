const fs = require('fs');
const path = require('path');

/**
 * Runs the offline regex rule engine against extracted document text.
 * @param {string} documentText - The raw text of the document
 * @returns {Array} - An array of matched risky clauses
 */
const runOfflineAnalysis = (documentText) => {
    try {
        // 1. Load the rules JSON file
        const rulesPath = path.join(__dirname, '../rules/rules.json');
        const rawData = fs.readFileSync(rulesPath, 'utf8');
        const rulesConfig = JSON.parse(rawData);

        const flaggedClauses = [];

        // 2. Iterate through each rule
        rulesConfig.rules.forEach(rule => {
            const { pre_filter_keywords, pattern, flags } = rule.match_criteria;

            // Fast check: Ensure at least one keyword exists in the document text first
            const hasKeyword = pre_filter_keywords.some(kw =>
                documentText.toLowerCase().includes(kw.toLowerCase())
            );

            if (hasKeyword) {
                // Deep check: Run the regex pattern
                const regex = new RegExp(pattern, flags);
                const match = documentText.match(regex);

                if (match) {
                    flaggedClauses.push({
                        ruleId: rule.rule_id,
                        clauseType: rule.clause_type,
                        riskLevel: rule.risk_level,
                        severityColor: rule.severity_color,
                        matchedText: match[0],
                        label: rule.extraction_label,
                        recommendation: rule.user_recommendation
                    });
                }
            }
        });

        return {
            engineUsed: 'offline_rule_engine',
            totalFlagsFound: flaggedClauses.length,
            flags: flaggedClauses
        };

    } catch (error) {
        throw new Error(`Offline analysis failed: ${error.message}`);
    }
};

module.exports = { runOfflineAnalysis };