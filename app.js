"use strict";

const CONFIG = {
    MAX_HISTORY: 5,
    LAST_UPDATED: "2025-01-24" // Current logic timestamp
};

const state = {
    resultsCount: parseInt(localStorage.getItem('resultsCount')) || 0,
    calcHistory: JSON.parse(localStorage.getItem('calcHistory')) || [],
    mode: 'gross-to-net',
    lastResult: null,
    isDark: localStorage.getItem('isDark') === 'true'
};

const el = {
    amount: document.getElementById('amount'),
    from: document.getElementById('from-currency'),
    to: document.getElementById('to-currency'),
    convertBtn: document.getElementById('convert-btn'),
    resetBtn: document.getElementById('reset-btn'),
    skeleton: document.getElementById('loading-skeleton'),
    resultArea: document.getElementById('result-area'),
    resultText: document.getElementById('result-text'),
    resultBreakdown: document.getElementById('result-breakdown'),
    resultCount: document.getElementById('result-count'),
    feedbackRow: document.getElementById('feedback-row'),
    donateContainer: document.getElementById('donate-container'),
    themeToggle: document.getElementById('theme-toggle'),
    pasteBtn: document.getElementById('paste-btn'),
    h1: document.getElementById('main-h1'),
    metaTitle: document.getElementById('meta-title'),
    metaDesc: document.getElementById('meta-desc'),
    historyChips: document.getElementById('history-chips')
};

const SVGS = {
    thumbsUp: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>`,
    thumbsDown: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/></svg>`,
    star: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    check: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
    info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
};

const init = () => {
    attachListeners();
    resetFeedbackRow();
    // Migrate legacy string history to objects
    state.calcHistory = state.calcHistory.map(h => typeof h === 'string' ? { text: h, amount: 0, country: 'USA', period: 'annual' } : h);
    // Hydrate history chips from local storage
    renderHistory();
    // Apply dark mode if persisted
    if (state.isDark) {
        document.body.classList.add('dark-mode');
        document.getElementById('sun-icon').classList.add('hidden');
        document.getElementById('moon-icon').classList.remove('hidden');
    }
    // Load state from URL if present
    parseUrlParams();
};

const parseUrlParams = () => {
    const params = new URLSearchParams(window.location.search);
    const amt = params.get('amount');
    const country = params.get('country');
    const period = params.get('period');
    const mode = params.get('mode') || 'gross-to-net';
    setMode(mode);
    if (amt && !isNaN(parseFloat(amt))) {
        el.amount.value = amt;
        if (country) el.from.value = country;
        if (period) el.to.value = period;
        validate();
        handleCalculate();
    }
};

const attachListeners = () => {
    [el.amount, el.from, el.to].forEach(input => input.addEventListener('input', validate));
    el.amount.addEventListener('keydown', e => { if (e.key === 'Enter') handleCalculate(); });
    document.getElementById('mode-gross').onclick = () => setMode('gross-to-net');
    document.getElementById('mode-net').onclick = () => setMode('net-to-gross');
    el.convertBtn.onclick = handleCalculate;
    el.resetBtn.onclick = handleReset;
    el.themeToggle.onclick = toggleTheme;
    el.pasteBtn.onclick = handlePaste;
    document.getElementById('share-btn').onclick = handleShare;
    document.getElementById('csv-btn').onclick = handleExportCSV;
    document.getElementById('print-btn').onclick = () => window.print();
    document.getElementById('copy-btn').onclick = () => {
        navigator.clipboard.writeText(el.resultText.textContent);
        const original = document.getElementById('copy-btn').style.color;
        document.getElementById('copy-btn').style.color = 'var(--primary)';
        setTimeout(() => document.getElementById('copy-btn').style.color = original, 1500);
    };
};

const setMode = (mode) => {
    state.mode = mode;
    document.getElementById('mode-gross').classList.toggle('active', mode === 'gross-to-net');
    document.getElementById('mode-net').classList.toggle('active', mode === 'net-to-gross');
    el.amount.placeholder = mode === 'gross-to-net' ? "0.00" : "Desired net amount";
    document.querySelector('label[for="amount"]').textContent = 
        mode === 'gross-to-net' ? 'Gross Pay' : 'Desired Net Pay';
};

const validate = () => {
    const val = parseFloat(el.amount.value);
    el.convertBtn.disabled = !(val > 0 && val <= 10000000);
};

const handlePaste = async () => {
    try {
        const text = await navigator.clipboard.readText();
        const num = parseFloat(text.replace(/[^0-9.]/g, ''));
        if (!isNaN(num)) {
            el.amount.value = num;
            validate();
        }
    } catch (e) { console.error("Clipboard access denied"); }
};

const toAnnual = (amt, period) => ({
    annual: amt, monthly: amt * 12,
    biweekly: amt * 26, weekly: amt * 52
}[period]);

const calcReverse = (targetNet, country) => {
    let low = targetNet * 1.0;
    let high = Math.max(targetNet * 5, 200000);
    for (let i = 0; i < 100; i++) {
        let mid = (low + high) / 2;
        let res = country === 'CAN' ? calcCanada(mid) : calcUSA(mid);
        if (Math.abs(res.takeHome - targetNet) < 0.01) return mid;
        if (res.takeHome < targetNet) low = mid;
        else high = mid;
    }
    return low;
};

const calcCanada = (annual) => {
    const cpp = Math.min(annual * 0.0595, 4075.75);
    const ei = Math.min(annual * 0.0166, 1049.12);
    let fed = 0;
    if (annual > 246752) fed = (annual - 246752) * 0.33 + 40438;
    else if (annual > 173205) fed = (annual - 173205) * 0.29 + 18827;
    else if (annual > 111733) fed = (annual - 111733) * 0.26 + 12736;
    else if (annual > 57375) fed = (annual - 57375) * 0.205 + 4386;
    else fed = annual * 0.15;
    return { takeHome: annual - (cpp + ei + fed), cpp, ei, tax: fed };
};

const calcUSA = (annual) => {
    const ss = Math.min(annual * 0.062, 10453.20);
    const medicare = annual * 0.0145;
    let fed = 0;
    if (annual > 609350) fed = (annual - 609350) * 0.37 + 183647;
    else if (annual > 243725) fed = (annual - 243725) * 0.35 + 52832;
    else if (annual > 191950) fed = (annual - 191950) * 0.32 + 36660;
    else if (annual > 100525) fed = (annual - 100525) * 0.24 + 17400;
    else if (annual > 47150) fed = (annual - 47150) * 0.22 + 5147;
    else if (annual > 11600) fed = (annual - 11600) * 0.12 + 1160;
    else fed = annual * 0.10;
    return { takeHome: annual - (ss + medicare + fed), ss, medicare, tax: fed };
};

const handleCalculate = async () => {
    const inputVal = parseFloat(el.amount.value);
    if (inputVal <= 0 || isNaN(inputVal)) return;
    const country = el.from.value;
    const period = el.to.value;
    const annualInput = toAnnual(inputVal, period);
    
    let annualGross, result;
    if (state.mode === 'net-to-gross') {
        annualGross = calcReverse(annualInput, country);
    } else {
        annualGross = annualInput;
    }
    result = country === 'CAN' ? calcCanada(annualGross) : calcUSA(annualGross);
    state.lastResult = { gross: annualGross, country, period, ...result };

    // Show loading skeleton
    el.resultArea.classList.add('hidden');
    el.skeleton.classList.remove('hidden');
    el.convertBtn.disabled = true;

    // Simulate brief processing delay
    await new Promise(r => setTimeout(r, 400));

    el.skeleton.classList.add('hidden');
    validate();
    displayResult(annualGross, country, period, result);
};

const displayResult = (annualGross, country, period, r) => {
    const perMonth = (r.takeHome / 12).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const perYear = r.takeHome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const text = `Take-Home: $${perMonth}/mo ($${perYear}/yr)`;
    const effectiveRate = ((r.tax / annualGross) * 100).toFixed(1);
    
    el.resultText.textContent = text;
    el.resultBreakdown.textContent = country === 'CAN'
        ? `Federal Tax: $${r.tax.toFixed(2)} | CPP: $${r.cpp.toFixed(2)} | EI: $${r.ei.toFixed(2)} | Effective rate: ${effectiveRate}%`
        : `Federal Tax: $${r.tax.toFixed(2)} | Soc. Security: $${r.ss.toFixed(2)} | Medicare: $${r.medicare.toFixed(2)} | Effective rate: ${effectiveRate}%`;

    state.resultsCount++;
    localStorage.setItem('resultsCount', state.resultsCount);
    el.resultCount.textContent = `${state.resultsCount} calculations so far`;
    el.feedbackRow.classList.remove('hidden');
    el.resultArea.classList.remove('hidden');
    el.donateContainer.classList.remove('hidden');
    
    updateMetadata(text, annualGross, country, period, state.mode);
    addHistory({ text, amount: annualGross, country, period });
};

const updateMetadata = (text, gross, country, period, mode) => {
    el.h1.textContent = text;
    const newTitle = `Paycheck: ${text} (${country})`;
    el.metaTitle.textContent = newTitle;
    document.title = newTitle;
    el.metaDesc.content = `Calculated take-home pay: ${text}. Based on 2025 ${country} tax regulations.`;
    history.replaceState(null, '', `?amount=${gross}&country=${country}&period=${period}&mode=${mode}`);
};

const addHistory = (item) => {
    // Prevent duplicates
    state.calcHistory = state.calcHistory.filter(h => typeof h === 'string' ? h !== item.text : h.text !== item.text);
    state.calcHistory.unshift(item);
    if (state.calcHistory.length > CONFIG.MAX_HISTORY) state.calcHistory.pop();
    localStorage.setItem('calcHistory', JSON.stringify(state.calcHistory));
    renderHistory();
};

const renderHistory = () => {
    const hasHistory = state.calcHistory.length > 0;
    document.querySelector('.history-section').classList.toggle('hidden', !hasHistory);
    
    el.historyChips.innerHTML = state.calcHistory.map((h, i) => 
        `<span class="chip" data-idx="${i}">${h.text}</span>`
    ).join('');
    
    el.historyChips.querySelectorAll('.chip').forEach(chip => {
        chip.onclick = () => {
            const data = state.calcHistory[chip.dataset.idx];
            el.amount.value = data.amount;
            el.from.value = data.country;
            el.to.value = data.period;
            validate();
            handleCalculate();
        };
    });
};

const handleReset = () => {
    el.amount.value = '';
    el.from.selectedIndex = 0;
    el.to.selectedIndex = 0;
    setMode('gross-to-net');
    el.h1.textContent = 'Free Paycheck Calculator — USA & Canada (2025)';
    document.title = 'Paycheck Calculator USA & Canada — Free Take-Home Pay';
    el.metaTitle.textContent = 'Paycheck Calculator USA & Canada — Free Take-Home Pay';
    el.metaDesc.content = 'Free paycheck calculator for USA and Canada. See take-home pay after federal tax, CPP, EI, Social Security.';
    el.resultArea.classList.add('hidden');
    el.feedbackRow.classList.add('hidden');
    el.resultBreakdown.textContent = '';
    el.donateContainer.classList.add('hidden');
    history.replaceState(null, '', '/');
    resetFeedbackRow();
    validate();
};

const resetFeedbackRow = () => {
    el.feedbackRow.innerHTML = `
        <span>${SVGS.star} Did this help?</span>
        <div class="feedback-btns">
            <button id="fb-yes" class="fb-btn">${SVGS.thumbsUp} Yes</button>
            <button id="fb-no" class="fb-btn">${SVGS.thumbsDown} Not really</button>
        </div>
    `;
    document.getElementById('fb-yes').onclick = () => el.feedbackRow.innerHTML = `<span style="display:flex;align-items:center;gap:0.5rem;">${SVGS.check} Thanks!</span>`;
    document.getElementById('fb-no').onclick = () => el.feedbackRow.innerHTML = `<span style="display:flex;align-items:center;gap:0.5rem;">${SVGS.info} Thanks for the feedback.</span>`;
};

const handleShare = async () => {
    try {
        await navigator.clipboard.writeText(window.location.href);
        const btn = document.getElementById('share-btn');
        btn.style.color = 'var(--primary)';
        setTimeout(() => btn.style.color = '', 1500);
    } catch (err) { console.error("Could not copy link"); }
};

const handleExportCSV = () => {
    if (!state.lastResult) return;
    const r = state.lastResult;
    const headers = "Gross,Country,Period,TakeHome,Tax,Deductions\n";
    const row = `${r.gross},${r.country},${r.period},${r.takeHome.toFixed(2)},${r.tax.toFixed(2)},${(r.cpp ?? 0) + (r.ei ?? 0) + (r.ss ?? 0) + (r.medicare ?? 0)}`;
    const blob = new Blob([headers + row], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `paycheck-${r.country}-${Date.now()}.csv`);
    a.click();
};

const toggleTheme = () => {
    state.isDark = !state.isDark;
    localStorage.setItem('isDark', state.isDark);
    document.body.classList.toggle('dark-mode', state.isDark);
    document.getElementById('sun-icon').classList.toggle('hidden', state.isDark);
    document.getElementById('moon-icon').classList.toggle('hidden', !state.isDark);
};

init();
