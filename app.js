"use strict";

let TAX_DATA = null;

const CONFIG = {
    MAX_HISTORY: 5,
    DATA_URL: 'tax-data.json'
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
    region: document.getElementById('region'),
    regionGroup: document.getElementById('region-group'),
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
    metaDesc: document.getElementById('meta-desc'),
    historyChips: document.getElementById('history-chips')
};

const init = async () => {
    await loadTaxData();
    attachListeners();
    updateRegions();
    resetFeedbackRow();

    // Migrate legacy string history to objects
    state.calcHistory = state.calcHistory.map(h => typeof h === 'string' ? { text: h, amount: 0, country: 'USA', period: 'annual' } : h);
    // Hydrate history chips from local storage
    renderHistory();

    // Set dynamic text based on JSON data
    el.h1.textContent = `Free Paycheck Calculator — USA & Canada (${TAX_DATA.year})`;
    const trustBarSpan = document.querySelector('.trust-bar span');
    if (trustBarSpan) {
        trustBarSpan.textContent = `No data stored · Free forever · ${TAX_DATA.year} Tax Brackets`;
    }

    // Apply dark mode if persisted
    if (state.isDark) {
        document.body.classList.add('dark-mode');
        document.getElementById('sun-icon').classList.add('hidden');
        document.getElementById('moon-icon').classList.remove('hidden');
    }
    // Load state from URL if present
    parseUrlParams();
};

const loadTaxData = async () => {
    try {
        const cached = sessionStorage.getItem('taxData');
        if (cached) { TAX_DATA = JSON.parse(cached); return; }
        const res = await fetch(CONFIG.DATA_URL);
        TAX_DATA = await res.json();
        sessionStorage.setItem('taxData', JSON.stringify(TAX_DATA));
    } catch (err) { console.error("Critical: Failed to load tax data", err); }
};

const parseUrlParams = () => {
    const params = new URLSearchParams(window.location.search);
    const amt = params.get('amount');
    const country = params.get('country');
    const region = params.get('region');
    const period = params.get('period');
    const mode = params.get('mode') || 'gross-to-net';
    setMode(mode);
    if (country) {
        el.from.value = country;
        updateRegions();
    }
    if (amt && !isNaN(parseFloat(amt))) {
        el.amount.value = amt;
        if (region) el.region.value = region;
        if (period) el.to.value = period;
        validate();
        handleCalculate();
    }
};

const attachListeners = () => {
    [el.amount, el.from, el.to, el.region].forEach(input => input.addEventListener('input', validate));
    el.from.addEventListener('change', updateRegions);
    el.amount.addEventListener('keydown', e => { if (e.key === 'Enter') handleCalculate(); });
    document.getElementById('mode-gross').onclick = () => setMode('gross-to-net');
    document.getElementById('mode-net').onclick = () => setMode('net-to-gross');
    el.convertBtn.onclick = handleCalculate;
    el.resetBtn.onclick = handleReset;
    el.themeToggle.onclick = toggleTheme;
    el.pasteBtn.onclick = handlePaste;
    document.getElementById('share-btn').onclick = handleShare;
    document.getElementById('csv-btn').onclick = handleExportCSV;
    document.getElementById('clear-history-btn').onclick = () => {
        state.calcHistory = [];
        localStorage.removeItem('calcHistory');
        renderHistory();
    };
    document.getElementById('print-btn').onclick = () => window.print();
    document.getElementById('copy-btn').onclick = () => {
        navigator.clipboard.writeText(el.resultText.textContent);
        const btn = document.getElementById('copy-btn');
        btn.innerHTML = SVGS.check;
        btn.style.color = 'var(--primary)';
        setTimeout(() => {
            btn.innerHTML = SVGS.copy;
            btn.style.color = '';
        }, 1500);
    };
};

const updateRegions = () => {
    if (!TAX_DATA) return;
    const country = el.from.value;
    const list = TAX_DATA[country]?.regions || [];
    el.region.innerHTML = list.map(r => `<option value="${r.id}">${r.label}</option>`).join('');
    validate();
};

const setMode = (mode) => {
    state.mode = mode;
    document.getElementById('mode-gross').classList.toggle('active', mode === 'gross-to-net');
    document.getElementById('mode-net').classList.toggle('active', mode === 'net-to-gross');
    el.amount.placeholder = mode === 'gross-to-net' ? "e.g. 100000" : "e.g. 5000";
    document.querySelector('label[for="amount"]').textContent = 
        mode === 'gross-to-net' ? 'Salary (before tax)' : 'Target Take-Home';
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

const calcReverse = (targetNet, country, stateRate) => {
    let low = targetNet;
    let high = Math.max(targetNet * 5, 200000);
    for (let i = 0; i < 100; i++) {
        let mid = (low + high) / 2;
        let res = country === 'CAN' ? calcCanada(mid, stateRate) : calcUSA(mid, stateRate);
        if (Math.abs(res.takeHome - targetNet) < 1) return mid;
        if (res.takeHome < targetNet) low = mid;
        else high = mid;
    }
    return low;
};

const calcBrackets = (annual, brackets) => {
    if (!brackets) return 0;
    const bracket = brackets.slice().reverse().find(b => annual > b.min);
    if (!bracket) return annual * (brackets[0].rate || 0);
    return (annual - bracket.min) * bracket.rate + bracket.base;
};

const getRegionTax = (annual, country, regionId) => {
    const region = TAX_DATA[country]?.regions.find(r => r.id === regionId);
    if (!region || region.type === 'none') return 0;
    if (region.type === 'flat') return annual * region.rate;
    if (region.type === 'progressive') return calcBrackets(annual, region.brackets);
    return 0;
};

const calcCanada = (annual, regionId) => {
    const d = TAX_DATA.CAN.federal;
    const cppBase = Math.max(0, annual - 3500);
    const cpp = Math.min(cppBase * d.cpp_rate, d.cpp_cap);
    const ei = Math.min(annual * d.ei_rate, d.ei_cap);
    const taxable = Math.max(0, annual - 15000);
    const fed = calcBrackets(taxable, d.brackets);
    const stateTax = getRegionTax(annual, 'CAN', regionId);
    return { takeHome: annual - (cpp + ei + fed + stateTax), cpp, ei, tax: fed, stateTax };
};

const calcUSA = (annual, regionId) => {
    const d = TAX_DATA.USA.federal;
    const ss = Math.min(annual * d.ss_rate, d.ss_cap);
    const medicare = annual * d.medicare_rate;
    const taxable = Math.max(0, annual - 14600);
    const fed = calcBrackets(taxable, d.brackets);
    const stateTax = getRegionTax(annual, 'USA', regionId);
    return { takeHome: annual - (ss + medicare + fed + stateTax), ss, medicare, tax: fed, stateTax };
};

const handleCalculate = async () => {
    if (!TAX_DATA) return;
    const inputVal = parseFloat(el.amount.value);
    if (inputVal <= 0 || isNaN(inputVal)) return;
    const country = el.from.value;
    const regionId = el.region.value;
    const selectedOption = el.region.options[el.region.selectedIndex];
    const regionName = selectedOption?.text || 'Regional';
    const period = el.to.value;
    const annualInput = toAnnual(inputVal, period);
    
    let annualGross, result;
    if (state.mode === 'net-to-gross') {
        annualGross = calcReverse(annualInput, country, regionId);
    } else {
        annualGross = annualInput;
    }
    result = country === 'CAN' ? calcCanada(annualGross, regionId) : calcUSA(annualGross, regionId);
    state.lastResult = { gross: annualGross, country, period, region: regionId, regionName, ...result };

    // Show loading skeleton
    el.resultArea.classList.add('hidden');
    el.skeleton.classList.remove('hidden');
    el.convertBtn.disabled = true;

    // Simulate brief processing delay
    await new Promise(r => setTimeout(r, 400));

    el.skeleton.classList.add('hidden');
    validate();
    displayResult(annualGross, country, period, state.lastResult, inputVal);
};

const displayResult = (annualGross, country, period, r, inputVal) => {
    const perMonth = (r.takeHome / 12).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const perYear = r.takeHome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const hourly = (r.takeHome / 2080).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const keepRate = ((r.takeHome / annualGross) * 100).toFixed(1);
    const getPct = (val) => `(${((val / annualGross) * 100).toFixed(1)}%)`;
    
    el.resultText.innerHTML = `
        <div>Take-Home: $${perMonth}/mo</div>
        <div class="keep-rate-line">You keep: ${keepRate}% of your salary</div>
    `;
    
    const rows = country === 'CAN' ? [
        ['Federal Tax', r.tax],
        [r.regionName, r.stateTax],
        ['CPP', r.cpp],
        ['EI', r.ei]
    ] : [
        ['Federal Tax', r.tax],
        [r.regionName, r.stateTax],
        ['Social Security', r.ss],
        ['Medicare', r.medicare]
    ];

    const tableContent = rows.map(([label, val]) => 
        `<tr><td>${label}</td><td>$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${getPct(val)}</td></tr>`
    ).join('');

    const largest = rows.reduce((prev, current) => (prev[1] > current[1]) ? prev : current);
    const insight = `💡 ${largest[0]} is your largest deduction.`;
    const currency = country === 'CAN' ? 'CAD' : 'USD';

    el.resultBreakdown.innerHTML = `
    <div class="muted" style="margin-bottom: 0.75rem;">All amounts in ${currency}</div>
    <table class="breakdown-table">
        ${tableContent}
        <tr class="total-row"><td>You keep</td><td>${keepRate}%</td></tr>
        <tr class="total-row"><td>Hourly Take-home</td><td>$${hourly}/hr</td></tr>
    </table>
    <div class="insight-line">${insight}</div>`;

    state.resultsCount++;
    localStorage.setItem('resultsCount', state.resultsCount);
    el.resultCount.textContent = `${state.resultsCount} calculations so far`;
    el.resultArea.classList.remove('hidden');
    el.donateContainer.classList.remove('hidden');
    el.feedbackRow.classList.remove('hidden');

    const metaText = `Take-home: $${perMonth}/mo`;
    updateMetadata(metaText, inputVal, country, period, state.mode, r.region);
    
    const historyText = `$${(annualGross/1000).toFixed(0)}K → $${(r.takeHome/1000).toFixed(1)}K (${r.region})`;
    addHistory({ text: historyText, amount: inputVal, country, period, region: r.region });
};

const updateMetadata = (text, gross, country, period, mode, region) => {
    // We don't change H1 to the result anymore to keep "Smart insight" feel, but we update title
    document.title = `Paycheck: ${text} (${country})`;
    el.metaDesc.content = `Calculated take-home pay: ${text}. Based on ${TAX_DATA.year} ${country} tax regulations.`;
    history.replaceState(null, '', `?amount=${gross}&country=${country}&period=${period}&mode=${mode}&region=${region}`);
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
            updateRegions();
            el.region.value = data.region || '0';
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
    updateRegions();
    setMode('gross-to-net');
    el.h1.textContent = `Free Paycheck Calculator — USA & Canada (${TAX_DATA.year})`;
    document.title = 'Paycheck Calculator USA & Canada — Free Take-Home Pay';
    el.metaDesc.content = `Free paycheck calculator for USA and Canada. ${TAX_DATA.year} tax brackets. Free, instant, no signup.`;
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
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
};

const toggleTheme = () => {
    state.isDark = !state.isDark;
    localStorage.setItem('isDark', state.isDark);
    document.body.classList.toggle('dark-mode', state.isDark);
    document.getElementById('sun-icon').classList.toggle('hidden', state.isDark);
    document.getElementById('moon-icon').classList.toggle('hidden', !state.isDark);
};

init();
