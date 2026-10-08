document.addEventListener("DOMContentLoaded", () => {

    // --- Authentication Check ---
    const token = localStorage.getItem('token');
    if (!token) {
        // If no token is found, kick them back to the login page immediately
        window.location.href = 'login.html';
        return;
    }

    // Tab Navigation
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => goToView(tab.dataset.view));
    });

    function goToView(name) {
        document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
        document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === name));
    }

    //Claude-Style Sidebar & Tooltip Controls
    const sidebar = document.getElementById('appSidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarToggleInternal = document.getElementById('sidebarToggleInternal');
    const userProfileName = document.getElementById('userProfileName');
    const historyList = document.getElementById('documentHistoryList');

    //Load registered username cleanly into footer
    const storedUsername = localStorage.getItem('username') || 'User';
    userProfileName.textContent = storedUsername;

    function toggleSidebar() {
        const isOpen = sidebar.classList.toggle('open');
        const tooltipText = isOpen ? 'Hide sidebar' : 'Show sidebar';
        sidebarToggle.setAttribute('title', tooltipText);
        sidebarToggleInternal.setAttribute('title', tooltipText);
    }

    sidebarToggle.addEventListener('click', toggleSidebar);
    sidebarToggleInternal.addEventListener('click', toggleSidebar);

    //Robust Hover Logic (Desktop Only)
    //Hover to Open Sidebar via the Toggle Icon
    if (window.innerWidth >= 768) {
        // When you hover over the toggle button, open the sidebar
        sidebarToggle.addEventListener('mouseenter', () => {
            if (!sidebar.classList.contains('open')) {
                sidebar.classList.add('open');
                sidebarToggle.setAttribute('title', 'Hide sidebar');
                if (sidebarToggleInternal) sidebarToggleInternal.setAttribute('title', 'Hide sidebar');
            }
        });

        // When your mouse leaves BOTH the toggle button and the sidebar, close it
        const closeSidebarOnMouseLeave = (e) => {
            // Check where the mouse is moving to; if it's going into the sidebar or staying on the toggle, don't close
            setTimeout(() => {
                const isStillInside = sidebar.contains(document.activeElement) ||
                    sidebar.matches(':hover') ||
                    sidebarToggle.matches(':hover');
                if (!isStillInside && sidebar.classList.contains('open')) {
                    sidebar.classList.remove('open');
                    sidebarToggle.setAttribute('title', 'Show sidebar');
                    if (sidebarToggleInternal) sidebarToggleInternal.setAttribute('title', 'Show sidebar');
                }
            }, 100);
        };

        sidebarToggle.addEventListener('mouseleave', closeSidebarOnMouseLeave);
        sidebar.addEventListener('mouseleave', closeSidebarOnMouseLeave);
    }

    document.getElementById('newAnalysisBtn').addEventListener('click', () => {
        goToView('upload');
        selectedFile = null;
        const dropzoneFileName = document.getElementById('dropzoneFileName');
        if (dropzoneFileName) dropzoneFileName.textContent = '';

        if (window.innerWidth < 768) {
            sidebar.classList.remove('open');
        }
    });

    // --- Click Anywhere Outside to Close Sidebar ---
    // --- Click Anywhere Outside to Close Sidebar ---
    document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('open')) {
            const isClickInsideSidebar = sidebar.contains(e.target);
            const isClickOnToggle = sidebarToggle.contains(e.target) || sidebarToggleInternal.contains(e.target);

            // If the click is outside the sidebar and NOT on the toggle, close it
            if (!isClickInsideSidebar && !isClickOnToggle) {
                sidebar.classList.remove('open');
                sidebarToggle.setAttribute('title', 'Show sidebar');
                sidebarToggleInternal.setAttribute('title', 'Show sidebar');
            }
        }
    });
    // FIXED: Fetch and Render Document History from Backend
    async function fetchDocumentHistory() {
        try {
            const response = await fetch('/api/history', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to fetch history');
            const history = await response.json();

            renderHistory(history);
        } catch (error) {
            console.error('History fetch error:', error);
            historyList.innerHTML = '<div style="color:#64748b;font-size:0.85rem;padding:10px;">Failed to load history.</div>';
        }
    }

    function timeAgo(dateString) {
        if (!dateString) return 'Recently';
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 86400) {
            const timeOpts = { hour: 'numeric', minute: '2-digit', hour12: true };
            return `Today, ${date.toLocaleTimeString('en-US', timeOpts)}`;
        }
        if (diffInSeconds < 172800) return 'Yesterday';
        if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
        return `${Math.floor(diffInSeconds / 604800)} weeks ago`;
    }

    function renderHistory(documents) {
        historyList.innerHTML = '';

        if (!documents || documents.length === 0) {
            historyList.innerHTML = '<div style="color:#64748b;font-size:0.85rem;padding:10px;">No past analyses found.</div>';
            return;
        }

        documents.forEach((doc, index) => {
            const score = doc.riskScore || 'Medium';
            let dotClass = 'dot-medium';
            if (score === 'High') dotClass = 'dot-high';
            if (score === 'Low') dotClass = 'dot-low';

            const item = document.createElement('div');
            item.className = `history-item ${index === 0 ? 'active' : ''}`;

            item.innerHTML = `
                <div class="history-doc-title" style="color: #ffffff; font-size: 0.9rem; font-weight: 500; margin-bottom: 4px;">${escapeHtml(doc.filename || 'Document.pdf')}</div>
                <div class="history-doc-meta" style="display: flex; align-items: center; gap: 6px; color: #64748b; font-size: 0.75rem;">
                    <div class="risk-dot ${dotClass}" style="width: 6px; height: 6px; border-radius: 50%;"></div>
                    <span>${score} risk · ${timeAgo(doc.createdAt)}</span>
                </div>
            `;

            // Fully wired click handler to load past analysis on click (Supporting both Rule and AI flags)
            item.addEventListener('click', async () => {
                document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');

                try {
                    const response = await fetch(`/api/history/${doc.id}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (!response.ok) throw new Error('Failed to fetch document details');
                    const fullDoc = await response.json();

                    // Update scoped text and analysis results
                    documentText = fullDoc.extracted_text || '';
                    const results = fullDoc.analysis_results || {};

                    // 1. Generate rule flags
                    const ruleFlags = runRuleEngine(documentText);

                    // 2. Extract saved AI flags from your JSON analysis_results structure
                    let rawAiFlags = [];
                    if (results.analysis && results.analysis.keyRisks) {
                        rawAiFlags = results.analysis.keyRisks;
                    } else if (results.keyRisks) {
                        rawAiFlags = results.keyRisks;
                    } else if (results.aiFlags || results.flags) {
                        rawAiFlags = results.aiFlags || results.flags;
                    }

                    const aiFlags = rawAiFlags.map((flag, index) => {
                        const title = flag.clauseTitle || flag.short || 'AI Flagged Issue';
                        const explanationText = flag.explanation || flag.plain || 'No detailed explanation provided.';
                        const recommendationText = flag.recommendation || flag.rewrite || '';
                        return {
                            id: `ai-${index}`,
                            source: 'AI',
                            severity: flag.severity || 'High',
                            type: flag.type || 'AI Insight',
                            highlightClass: 'risk',
                            clauseText: title,
                            start: -1,
                            end: -1,
                            short: title,
                            plain: explanationText,
                            rewrite: recommendationText
                        };
                    });

                    // 3. Combine both rule flags and AI flags together
                    allFlags = [...ruleFlags, ...aiFlags].sort((a, b) => a.start - b.start);

                    goToView('results');

                    renderDocument();
                    populateTypeFilter();
                    renderFlags();
                    renderDonut();

                    if (window.innerWidth < 768) {
                        sidebar.classList.remove('open');
                    }
                } catch (err) {
                    console.error('Error loading history item:', err);
                }
            });

            historyList.appendChild(item);
        });
    }

    // Trigger history fetch on load
    fetchDocumentHistory();

    // Theme Toggle
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggleBtn.textContent = '🌙 Dark Mode';
    }
    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        themeToggleBtn.textContent = isDark ? '🌙 Dark Mode' : '☀️ Light Mode';
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });

    // Rule-based detection engine (Fallback/Client-side sync)
    const RULES = [
        {
            pattern: /without\s+notice\s+and\s+without\s+cause/gi,
            severity: 'High', type: 'Termination', highlightClass: 'risk',
            short: 'One-sided termination clause — leaves the other party with no protection or exit terms.',
            plain: 'This means the other side can end the contract at any moment, for any reason, without warning you first.',
            rewrite: 'Suggested: "This Agreement may be terminated by either party with 30 days written notice, or immediately in the event of material breach."'
        },
        {
            pattern: /chosen\s+solely\s+by\s+the\s+(company|client|employer|licensor)/gi,
            severity: 'High', type: 'Dispute Resolution', highlightClass: 'risk',
            short: "Unilateral arbitration/venue selection — favors one party's convenience and leverage.",
            plain: 'Letting only one party pick where disputes are resolved gives them a home-field advantage — higher travel costs or unfamiliar procedures for the other side.',
            rewrite: 'Suggested: "...in a jurisdiction mutually agreed upon by both parties, or failing agreement, in [neutral location]."'
        },
        {
            pattern: /a\s+reasonable\s+(period|time|timeframe)/gi,
            severity: 'Medium', type: 'Payment', highlightClass: 'ambig',
            short: 'Ambiguous timeframe — no defined number of days, open to dispute.',
            plain: '"Reasonable" is not a fixed number, so if a deadline is missed, both sides could argue about what counts as reasonable.',
            rewrite: 'Suggested: replace with a specific number of days, e.g. "within 14 days".'
        },
        {
            pattern: /reasonable\s+prior\s+notice/gi,
            severity: 'Low', type: 'Amendment', highlightClass: 'ambig',
            short: 'Vague notice period for amendments — consider specifying exact number of days.',
            plain: 'Without a fixed number of days, you might get very little warning before terms change.',
            rewrite: 'Suggested: "...with at least 14 days prior written notice."'
        },
        {
            pattern: /sole\s+discretion/gi,
            severity: 'Medium', type: 'General', highlightClass: 'ambig',
            short: '"Sole discretion" gives one party unchecked decision-making power over this term.',
            plain: 'This phrase means one side can decide the matter however they like, with no obligation to justify it or apply any standard.',
            rewrite: 'Suggested: tie the decision to an objective standard, e.g. "acting reasonably" or a defined process.'
        },
        {
            pattern: /indemnify\s+and\s+hold\s+harmless/gi,
            severity: 'High', type: 'Indemnity', highlightClass: 'risk',
            short: 'Broad indemnification clause — may expose one party to open-ended liability.',
            plain: 'This obligates you to cover losses or legal costs the other party incurs, sometimes even for issues you did not directly cause, depending on scope.',
            rewrite: 'Suggested: limit indemnity to losses "directly caused by [party]\'s breach or negligence."'
        },
        {
            pattern: /perpetuity|in\s+perpetuum/gi,
            severity: 'Medium', type: 'Term', highlightClass: 'ambig',
            short: 'An obligation with no end date — binds a party indefinitely.',
            plain: 'Without a defined end date or exit clause, this commitment never naturally expires.',
            rewrite: 'Suggested: define a fixed term with renewal conditions instead of an indefinite commitment.'
        },
        {
            pattern: /automatically\s+renew\s+for\s+successive\s+periods?/gi,
            severity: 'High', type: 'Term & Renewal', highlightClass: 'risk',
            short: 'Auto-renewal trap — locks the client into extended terms without active consent.',
            plain: 'If you miss the specific cancellation window, this contract will automatically lock you in for another full term.',
            rewrite: 'Suggested: "This Agreement may be renewed only upon mutual written agreement of both Parties."'
        },
        {
            pattern: /termination\s+fee\s+equal\s+to\s+the\s+greater\s+of/gi,
            severity: 'High', type: 'Termination', highlightClass: 'risk',
            short: 'Punitive early termination fee — designed to prevent the client from exiting the agreement.',
            plain: 'You will be forced to pay a massive penalty just to cancel the contract early, likely covering the entire remaining contract value.',
            rewrite: 'Suggested: "Either party may terminate this agreement with 30 days written notice without penalty."'
        },
        {
            pattern: /increase\s+fees\s+at\s+any\s+time/gi,
            severity: 'High', type: 'Payment', highlightClass: 'risk',
            short: 'Unilateral fee increases — allows the company to raise prices without consent.',
            plain: 'The company can decide to charge you more money whenever they want, for almost any reason, without your approval.',
            rewrite: 'Suggested: "Fees may only be increased annually, capped at 5%, with 60 days prior written notice."'
        },
        {
            pattern: /(modify|amend)\s+this\s+Agreement\s+at\s+any\s+time/gi,
            severity: 'High', type: 'Amendment', highlightClass: 'risk',
            short: 'Unilateral amendment clause — allows one side to change the contract terms after signing.',
            plain: 'The company can change the rules of the contract at any time, and your continued use means you automatically agree to the new rules.',
            rewrite: 'Suggested: "Any modification or amendment to this Agreement must be made in writing and signed by both Parties."'
        },
        {
            pattern: /arbitrators?\s+chosen\s+by\s+the\s+Company/gi,
            severity: 'High', type: 'Dispute Resolution', highlightClass: 'risk',
            short: 'Biased arbitrator selection — compromises the neutrality of dispute resolution.',
            plain: 'If you have a legal dispute, the company gets to hand-pick the judge (arbitrator) from their own list, putting you at a severe disadvantage.',
            rewrite: 'Suggested: "Arbitration shall be conducted by a single neutral arbitrator mutually agreed upon by both Parties."'
        },
        {
            pattern: /waives?\s+any\s+right\s+to\s+participate\s+in\s+a\s+class\s+action/gi,
            severity: 'Medium', type: 'Dispute Resolution', highlightClass: 'ambig',
            short: 'Class action waiver — strips the right to join forces with others who were wronged.',
            plain: 'You cannot join a class-action lawsuit against the company, even if they commit the same violation against hundreds of clients.',
            rewrite: 'Suggested: Consider striking this clause entirely if local consumer protection laws prohibit class action waivers.'
        },
        {
            pattern: /regardless\s+of\s+whether\s+the\s+Company\s+contributed/gi,
            severity: 'High', type: 'Indemnity', highlightClass: 'risk',
            short: 'Absolute indemnity — forces the client to cover costs even when the company is at fault.',
            plain: 'You have to pay for legal claims and damages even if the company\'s own actions actually caused or contributed to the problem.',
            rewrite: 'Suggested: "The Client shall indemnify the Company except to the extent that such claims arise from the Company\'s gross negligence or willful misconduct."'
        },
        {
            pattern: /perpetual,\s+irrevocable,\s+worldwide,\s+transferable,\s+sublicensable\s+right/gi,
            severity: 'High', type: 'Data Privacy', highlightClass: 'risk',
            short: 'Overbroad data rights — grants the company permanent, unrestricted ownership of your data.',
            plain: 'You are giving the company the right to use, sell, or transfer your personal and property information forever, all over the world, even after you leave.',
            rewrite: 'Suggested: "Client grants a limited right to use information solely for the purpose of providing the services during the Term of this Agreement."'
        }
    ];

    function runRuleEngine(text) {
        const flags = [];
        let idCounter = 1;
        RULES.forEach(rule => {
            let match;
            rule.pattern.lastIndex = 0;
            while ((match = rule.pattern.exec(text)) !== null) {
                flags.push({
                    id: `rule-${idCounter++}`,
                    source: 'Rule',
                    severity: rule.severity,
                    type: rule.type,
                    highlightClass: rule.highlightClass,
                    clauseText: match[0],
                    start: match.index,
                    end: match.index + match[0].length,
                    short: rule.short,
                    plain: rule.plain,
                    rewrite: rule.rewrite
                });
                if (!rule.pattern.global) break;
            }
        });
        return flags;
    }

    // File capture UI handlers
    const dropzoneArea = document.getElementById('dropzoneArea');
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const dropzoneFileName = document.getElementById('dropzoneFileName');
    const uploadError = document.getElementById('uploadError');

    let selectedFile = null;

    dropzoneArea.addEventListener('click', (e) => {
        if (e.target !== uploadBtn) fileInput.click();
    });
    dropzoneArea.addEventListener('dragover', (e) => { e.preventDefault(); dropzoneArea.classList.add('dragover'); });
    dropzoneArea.addEventListener('dragleave', () => dropzoneArea.classList.remove('dragover'));
    dropzoneArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzoneArea.classList.remove('dragover');
        if (e.dataTransfer.files?.length) handleFileSelected(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => {
        if (fileInput.files?.length) handleFileSelected(fileInput.files[0]);
    });

    function handleFileSelected(file) {
        const validExt = /\.(pdf|docx|txt)$/i.test(file.name);
        if (!validExt) {
            showUploadError('Please upload a .pdf, .docx, or .txt file.');
            return;
        }
        selectedFile = file;
        dropzoneFileName.textContent = `Selected: ${file.name}`;
        hideUploadError();
    }

    function showUploadError(msg) {
        uploadError.textContent = msg;
        uploadError.classList.add('show');
    }
    function hideUploadError() {
        uploadError.classList.remove('show');
    }

    // Processing Pipeline (Communicates securely with Backend API)
    uploadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!selectedFile) {
            showUploadError('Please select a document first.');
            return;
        }
        runPipeline(selectedFile);
    });

    function showToast(msg) {
        const t = document.getElementById('toast');
        document.getElementById('toastMsg').textContent = msg;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 3200);
    }

    function setStep(id, state, text) {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.remove('active', 'done', 'skipped', 'error');
        if (state) el.classList.add(state);
        if (text) {
            const p = el.querySelector('p[id$="StatusText"]');
            if (p) p.textContent = text;
        }
    }

    let documentText = '';
    let allFlags = [];

    async function runPipeline(file) {
        const isOffline = document.getElementById('simOffline').checked || !navigator.onLine;
        if (isOffline) showToast('No internet connection detected — switching to offline analysis');

        goToView('processing');
        const btn = document.getElementById('viewResultsBtn');
        btn.classList.remove('ready');
        document.getElementById('offlineBanner').classList.toggle('show', isOffline);

        setStep('step-extract', 'active', 'Uploading and extracting text on server...');
        setStep('step-rule', null);
        setStep('step-gemini', null, 'Reviewing ambiguous or context-dependent language...');

        try {
            const formData = new FormData();
            formData.append('document', file);

            const mode = isOffline ? 'offline' : 'online';

            const response = await fetch(`/api/analyze?mode=${mode}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Server processing failed.');
            }

            documentText = result.extractedText || result.documentText || '';
            setStep('step-extract', 'done');

            setStep('step-rule', 'active');
            await new Promise(r => setTimeout(r, 300));
            setStep('step-rule', 'done');

            if (isOffline) {
                setStep('step-gemini', 'skipped', 'Skipped. offline mode active');
            } else {
                setStep('step-gemini', 'active');
                await new Promise(r => setTimeout(r, 300));
                setStep('step-gemini', 'done');
            }

            const ruleFlags = runRuleEngine(documentText);

            let rawAiFlags = [];
            if (result.analysis && result.analysis.keyRisks) {
                rawAiFlags = result.analysis.keyRisks;
            } else if (result.aiFlags || result.flags) {
                rawAiFlags = result.aiFlags || result.flags;
            }

            const aiFlags = rawAiFlags.map((flag, index) => {
                const title = flag.clauseTitle || 'AI Flagged Issue';
                const explanationText = flag.explanation || 'No detailed explanation provided.';
                const recommendationText = flag.recommendation || '';
                return {
                    id: `ai-${index}`,
                    source: 'AI',
                    severity: 'High',
                    type: 'AI Insight',
                    highlightClass: 'risk',
                    clauseText: title,
                    start: -1,
                    end: -1,
                    short: title,
                    plain: explanationText,
                    rewrite: recommendationText
                };
            });

            allFlags = [...ruleFlags, ...aiFlags].sort((a, b) => a.start - b.start);
            btn.classList.add('ready');

        } catch (err) {
            setStep('step-extract', 'error', err.message || 'Could not process file.');
            showToast(`Text extraction/analysis failed: ${err.message || 'unknown error'}`);
            console.error('Pipeline failed:', err);
        }
    }

    document.getElementById('viewResultsBtn').addEventListener('click', () => {
        goToView('results');
        renderDocument();
        populateTypeFilter();
        renderFlags();
        renderDonut();
    });

    // Rendering: highlighted document text
    function escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function renderDocument() {
        const docTextEl = document.getElementById('docText');
        if (!documentText) {
            docTextEl.innerHTML = '<em>No document text available.</em>';
            return;
        }

        const spans = allFlags
            .filter(f => f.start !== undefined && f.start >= 0 && f.end > f.start)
            .sort((a, b) => a.start - b.start);

        let html = '';
        let cursor = 0;
        spans.forEach(f => {
            if (f.start < cursor) return;
            html += escapeHtml(documentText.slice(cursor, f.start));
            const tip = escapeHtml(f.short);
            html += `<mark class="${f.highlightClass}" data-tip="${tip}">${escapeHtml(documentText.slice(f.start, f.end))}</mark>`;
            cursor = f.end;
        });
        html += escapeHtml(documentText.slice(cursor));
        docTextEl.innerHTML = html;
    }

    // Rendering: flags panel + filters
    const listEl = document.getElementById('flagsList');
    const countEl = document.getElementById('flagCount');
    const sevSel = document.getElementById('filterSeverity');
    const srcSel = document.getElementById('filterSource');
    const typeSel = document.getElementById('filterType');

    function populateTypeFilter() {
        typeSel.innerHTML = '<option value="all">All clause types</option>';
        [...new Set(allFlags.map(f => f.type))].forEach(t => {
            const opt = document.createElement('option');
            opt.value = t; opt.textContent = t;
            typeSel.appendChild(opt);
        });
    }

    function renderFlags() {
        const isOffline = document.getElementById('simOffline').checked || !navigator.onLine;
        const sev = sevSel.value, src = srcSel.value, typ = typeSel.value;

        const filtered = allFlags.filter(f =>
            (!isOffline || f.source === 'Rule') &&
            (sev === 'all' || f.severity === sev) &&
            (src === 'all' || f.source === src) &&
            (typ === 'all' || f.type === typ)
        );

        countEl.textContent = filtered.length;
        listEl.innerHTML = '';

        if (!filtered.length) {
            listEl.innerHTML = '<div style="color:#64748b;font-size:13px;padding:10px 0;">No flags match these filters.</div>';
            return;
        }

        filtered.forEach(f => {
            const badgeClass = f.source === 'AI' ? 'ai' : 'rule';
            const div = document.createElement('div');
            div.className = 'flag-item';
            div.innerHTML = `
                <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                  <span class="badge ${badgeClass}">${f.source}</span>
                  <span style="font-size:11px;color:#64748b;">${f.severity} severity</span>
                </div>
                <div style="font-size:12.5px;font-style:italic;color:#64748b;margin-bottom:6px;">"${escapeHtml(f.clauseText)}"</div>
                <div style="font-size:13px;">${escapeHtml(f.short)}</div>
                <div class="tag">${escapeHtml(f.type)}</div>
                <div class="flag-expand">
                  <div style="font-size:11px;text-transform:uppercase;color:#64748b;margin-bottom:2px;">In plain terms</div>
                  <div style="margin-bottom:8px;">${escapeHtml(f.plain || 'No additional explanation provided.')}</div>
                  <div style="font-size:11px;text-transform:uppercase;color:#64748b;margin-bottom:2px;">Suggested rewrite</div>
                  <div style="color:var(--green-color);">${escapeHtml(f.rewrite || 'No rewrite suggested.')}</div>
                </div>
            `;
            div.addEventListener('click', () => div.classList.toggle('open'));
            listEl.appendChild(div);
        });
    }

    [sevSel, srcSel, typeSel].forEach(sel => sel.addEventListener('change', renderFlags));
    document.getElementById('simOffline').addEventListener('change', () => {
        if (document.getElementById('results').classList.contains('active')) {
            document.getElementById('offlineBanner').classList.toggle('show', document.getElementById('simOffline').checked);
            renderFlags();
            renderDonut();
        }
    });

    // Rendering: risk donut
    function renderDonut() {
        const total = allFlags.length;
        const high = allFlags.filter(f => f.severity === 'High').length;
        const med = allFlags.filter(f => f.severity === 'Medium').length;
        const low = allFlags.filter(f => f.severity === 'Low').length;

        const highPct = total ? Math.round((high / total) * 100) : 0;
        const medPct = total ? Math.round((med / total) * 100) : 0;
        const lowPct = total ? Math.max(0, 100 - highPct - medPct) : 0;

        const donutHigh = document.getElementById('donutHigh');
        const donutMed = document.getElementById('donutMed');
        const donutLow = document.getElementById('donutLow');

        donutHigh.setAttribute('stroke-dasharray', `${highPct} ${100 - highPct}`);
        donutMed.setAttribute('stroke-dasharray', `${medPct} ${100 - medPct}`);
        donutMed.style.strokeDashoffset = `${-highPct}`;
        donutLow.setAttribute('stroke-dasharray', `${lowPct} ${100 - lowPct}`);
        donutLow.style.strokeDashoffset = `${-(highPct + medPct)}`;

        document.getElementById('donutPct').textContent = `${highPct}%`;

        document.getElementById('scoreBreakdown').innerHTML = `
            <span><i class="score-swatch" style="background:var(--red-color)"></i> High severity  ${highPct}% (${high})</span>
            <span><i class="score-swatch" style="background:var(--secondary-color)"></i> Medium severity  ${medPct}% (${med})</span>
            <span><i class="score-swatch" style="background:var(--green-color)"></i> Low severity  ${lowPct}% (${low})</span>
        `;
    }

    // Report download
    document.getElementById('downloadBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (!allFlags.length) {
            showToast('No analysis to export yet.');
            return;
        }
        let report = 'CLAUSECHECK — RISK ANALYSIS REPORT\n=====================================\n\n';
        allFlags.forEach((f, i) => {
            report += `${i + 1}. [${f.severity} severity | ${f.source}-flagged | ${f.type}]\n`;
            report += `   Clause: "${f.clauseText}"\n`;
            report += `   Issue: ${f.short}\n`;
            report += `   Suggested rewrite: ${f.rewrite || 'N/A'}\n\n`;
        });
        report += '\nClauseCheck may miss issues — always verify with a qualified lawyer.\n';
        const blob = new Blob([report], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'clausecheck-report.txt';
        link.click();
    });

    // Info modal
    const infoModal = document.getElementById('infoModal');
    const modalTabHow = document.getElementById('modalTabHow');
    const modalTabSamples = document.getElementById('modalTabSamples');
    const modalViewHow = document.getElementById('modalViewHow');
    const modalViewSamples = document.getElementById('modalViewSamples');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    let lastFocusedBeforeModal = null;

    function showModalTab(name) {
        const isHow = name === 'how';
        modalTabHow.classList.toggle('active', isHow);
        modalTabSamples.classList.toggle('active', !isHow);
        modalViewHow.classList.toggle('active', isHow);
        modalViewSamples.classList.toggle('active', !isHow);
    }

    function openInfoModal(tabName) {
        lastFocusedBeforeModal = document.activeElement;
        showModalTab(tabName);
        infoModal.classList.add('show');
        modalCloseBtn.focus();
        document.addEventListener('keydown', handleModalKeydown);
    }

    function closeInfoModal() {
        infoModal.classList.remove('show');
        document.removeEventListener('keydown', handleModalKeydown);
        if (lastFocusedBeforeModal) lastFocusedBeforeModal.focus();
    }

    function handleModalKeydown(e) {
        if (e.key === 'Escape') closeInfoModal();
    }

    document.getElementById('howItWorksCard').addEventListener('click', () => openInfoModal('how'));
    document.getElementById('sampleFlagsCard').addEventListener('click', () => openInfoModal('samples'));
    modalTabHow.addEventListener('click', () => showModalTab('how'));
    modalTabSamples.addEventListener('click', () => showModalTab('samples'));
    modalCloseBtn.addEventListener('click', closeInfoModal);
    infoModal.addEventListener('click', (e) => {
        if (e.target === infoModal) closeInfoModal();
    });
    document.getElementById('tryItYourselfBtn').addEventListener('click', () => {
        closeInfoModal();
        goToView('upload');
        dropzoneArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

});