const CONFIG = {
    API_URL: 'https://open.er-api.com/v6/latest/',
    MAX_HISTORY: 5
};

const state = {
    resultsCount: 0,
    history: [],
    isDark: false,
    lastResult: null
};

// UI Elements
const el = {
    amount: document.getElementById('amount'),
    from: document.getElementById('from-currency'),
    to: document.getElementById('to-currency'),
    convertBtn: document.getElementById('convert-btn'),
    resetBtn: document.getElementById('reset-btn'),
    resultArea: document.getElementById('result-area'),
    skeleton: document.getElementById('result-skeleton'),
    resultText: document.getElementById('result-text'),
    resultCount: document.getElementById('result-count'),
    feedbackRow: document.getElementById('feedback-row'),
    donateContainer: document.getElementById('donate-container'),
    themeToggle: document.getElementById('theme-toggle'),
    pasteBtn: document.getElementById('paste-btn'),
    h1: document.getElementById('main-h1'),
    metaTitle: document.getElementById('meta-title'),
    metaDesc: document.getElementById('meta-desc'),
    qrContainer: document.getElementById('qr-container'),
    historyChips: document.getElementById('history-chips')
};

// SVG Assets
const SVGS = {
    thumbsUp: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>`,
    thumbsDown: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/></svg>`,
    star: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
};

const init = () => {
    attachListeners();
    resetFeedbackRow();
    checkUrlParams();
};

const attachListeners = () => {
    [el.amount, el.from, el.to].forEach(input => {
        input.addEventListener('input', validate);
    });

    el.convertBtn.onclick = handleConvert;
    el.resetBtn.onclick = handleReset;
    el.themeToggle.onclick = toggleTheme;
    el.pasteBtn.onclick = handlePaste;
    
    document.getElementById('print-btn').onclick = () => window.print();
    document.getElementById('copy-btn').onclick = handleCopy;
    document.getElementById('csv-btn').onclick = handleCSV;
    document.getElementById('qr-btn').onclick = toggleQR;
};

const validate = () => {
    const isValid = el.amount.value > 0 && el.from.value && el.to.value;
    el.convertBtn.disabled = !isValid;
};

const handlePaste = async () => {
    const text = await navigator.clipboard.readText();
    const num = parseFloat(text);
    if (!isNaN(num)) {
        el.amount.value = num;
        validate();
    }
};

const handleConvert = async () => {
    const amt = el.amount.value;
    const from = el.from.value;
    const to = el.to.value;

    el.skeleton.classList.remove('hidden');
    el.resultArea.classList.add('hidden');

    try {
        const res = await fetch(`${CONFIG.API_URL}${from}`);
        const data = await res.json();
        
        if (data.result === 'success') {
            const rate = data.rates[to];
            const result = (amt * rate).toFixed(2);
            displayResult(amt, from, to, result);
        }
    } catch (e) {
        console.error("API Error", e);
    } finally {
        el.skeleton.classList.add('hidden');
    }
};

const displayResult = (amt, from, to, res) => {
    const text = `${amt} ${from} = ${res} ${to}`;
    el.resultText.textContent = text;
    state.lastResult = { amt, from, to, res, date: new Date().toISOString() };
    
    state.resultsCount++;
    el.resultCount.textContent = `${state.resultsCount} results so far`;
    
    // SEO & History
    updateMetadata(text, amt, from, to);
    addHistory(text);
    
    // UI Logic
    el.resultArea.classList.remove('hidden');
    el.donateContainer.classList.remove('hidden');
    el.qrContainer.classList.add('hidden');
};

const updateMetadata = (text, amt, from, to) => {
    el.h1.textContent = text;
    el.metaTitle.textContent = `${text} - Converter`;
    el.metaDesc.content = `Real-time conversion: ${text}. Live exchange rates provided by Rivlosys.`;
    history.replaceState(null, '', `?amount=${amt}&from=${from}&to=${to}`);
};

const addHistory = (item) => {
    state.history.unshift(item);
    if (state.history.length > CONFIG.MAX_HISTORY) state.history.pop();
    el.historyChips.innerHTML = state.history.map(h => `<span class="chip">${h}</span>`).join('');
};

const handleReset = () => {
    // Clear Inputs
    el.amount.value = '';
    el.from.selectedIndex = 0;
    el.to.selectedIndex = 0;
    validate();

    // Reset Branding/SEO
    el.h1.textContent = 'Currency Converter';
    el.metaTitle.textContent = 'Live Currency Converter - Real-Time Exchange Rates';
    el.metaDesc.content = 'Convert 160+ currencies with real-time exchange rates. Free, fast, and mobile-friendly currency conversion tool.';
    history.replaceState(null, '', '/');

    // Reset Result Areas
    el.resultArea.classList.add('hidden');
    el.qrContainer.innerHTML = '';
    el.qrContainer.classList.add('hidden');
    resetFeedbackRow();
};

const resetFeedbackRow = () => {
    el.feedbackRow.innerHTML = `
        <span>${SVGS.star} Did this help?</span>
        <div class="feedback-btns">
            <button id="fb-yes" class="fb-btn">${SVGS.thumbsUp} Yes</button>
            <button id="fb-no" class="fb-btn">${SVGS.thumbsDown} Not really</button>
        </div>
    `;
    document.getElementById('fb-yes').onclick = () => el.feedbackRow.innerHTML = 'Thanks! 🙌';
    document.getElementById('fb-no').onclick = () => el.feedbackRow.innerHTML = 'Thanks for the feedback.';
};

const handleCopy = () => {
    navigator.clipboard.writeText(el.resultText.textContent);
};

const handleCSV = () => {
    if (!state.lastResult) return;
    const csv = `Date,From,Amount,To,Result\n${state.lastResult.date},${state.lastResult.from},${state.lastResult.amt},${state.lastResult.to},${state.lastResult.res}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversion-${Date.now()}.csv`;
    a.click();
};

const toggleQR = () => {
    if (!el.qrContainer.classList.contains('hidden')) {
        el.qrContainer.classList.add('hidden');
        return;
    }
    el.qrContainer.innerHTML = '';
    new QRCode(el.qrContainer, {
        text: window.location.href,
        width: 128,
        height: 128
    });
    el.qrContainer.classList.remove('hidden');
};

const toggleTheme = () => {
    state.isDark = !state.isDark;
    document.body.classList.toggle('dark-mode', state.isDark);
    document.getElementById('sun-icon').classList.toggle('hidden', state.isDark);
    document.getElementById('moon-icon').classList.toggle('hidden', !state.isDark);
};

const checkUrlParams = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('amount')) {
        el.amount.value = params.get('amount');
        el.from.value = params.get('from');
        el.to.value = params.get('to');
        validate();
        handleConvert();
    }
};

init();
