"use strict";

let TAX_DATA = null;
const TAX_YEAR = new Date().getFullYear();

const CONFIG = {
    MAX_HISTORY: 5,
    DATA_URL: 'tax-data.json'
};

let deferredPrompt;

const SVGS = {
    check: '✓',
    copy: '📋',
    star: '⭐',
    thumbsUp: '👍',
    thumbsDown: '👎',
    info: 'ℹ️'
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
    payPeriod: document.getElementById('pay-period'),
    region: document.getElementById('region'),
    regionGroup: document.getElementById('region-group'),
    convertBtn: document.getElementById('convert-btn'),
    resetBtn: document.getElementById('reset-btn'),
    skeleton: document.getElementById('loading-skeleton'),
    resultArea: document.getElementById('result-area'),
    resultText: document.getElementById('result-text'),
    monthlyTakehome: document.getElementById('monthly-takehome'),
    annualTakehome: document.getElementById('annual-takehome'),
    hourlyTakehome: document.getElementById('hourly-takehome'),
    resultBreakdown: document.getElementById('result-breakdown'),
    resultCount: document.getElementById('result-count'),
    feedbackRow: document.getElementById('feedback-row'),
    donateContainer: document.getElementById('donate-container'),
    themeToggle: document.getElementById('theme-toggle'),
    pasteBtn: document.getElementById('paste-btn'),
    h1: document.getElementById('main-h1'),
    metaDesc: document.getElementById('meta-desc'),
    insightHeadline: document.getElementById('insight-headline'),
    historyChips: document.getElementById('history-chips'),
    reverseModeBtn: document.getElementById('reverse-mode-btn'),
    resultViz: document.getElementById('result-viz'),
    step1Tab: document.getElementById('step-1-tab'),
    step2Tab: document.getElementById('step-2-tab'),
    step1Content: document.getElementById('step-1-content'),
    step2Content: document.getElementById('step-2-content')
};

let calcTimeout;

const init = async () => {
    // Detect if embedded in iframe for clean SEO page display
    if (window.self !== window.top) {
        document.body.classList.add('is-iframe');
    }

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    // Set smart defaults if no state loaded via URL
    const params = new URLSearchParams(window.location.search);
    if (!params.get('salary') && !params.get('amount') && !el.amount.value) {
        el.from.value = 'CAN';
    }

    await loadTaxData();
    attachListeners();

    if (el.from && el.region && !params.get('amount') && (!el.amount || !el.amount.value)) {
        el.region.value = 'ON';
    }

    resetFeedbackRow();
    updateYearUI();

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
    document.getElementById('footer-year').textContent = new Date().getFullYear();
};

const updateYearUI = () => {
    const yearStr = TAX_DATA ? TAX_DATA.year.toString() : TAX_YEAR.toString();
    
    // Update elements explicitly meant to change dynamically
    document.querySelectorAll('.dynamic-year').forEach(e => {
        e.textContent = yearStr;
    });
    
    // Smoothly update the meta description tag safely without touching H1
    if (el.metaDesc && el.metaDesc.content) {
        el.metaDesc.content = el.metaDesc.content.replace(/202[0-9]/g, yearStr);
    }
};

const loadTaxData = async () => {
    try {
        const cached = sessionStorage.getItem('taxData');
        if (cached) {
            TAX_DATA = JSON.parse(cached);
        } else {
            const res = await fetch(CONFIG.DATA_URL);
            TAX_DATA = await res.json();
            sessionStorage.setItem('taxData', JSON.stringify(TAX_DATA));
        }
        updateRegions();
    } catch (err) { console.error("Critical: Failed to load tax data", err); }
};

const parseUrlParams = () => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode') || 'gross-to-net';
    setMode(mode);

    const amt = params.get('salary') || params.get('amount');
    const country = params.get('country');
    const region = params.get('region');
    const period = params.get('period');
    if (country && el.from) {
        el.from.value = country;
        updateRegions();
    }
    if (el.amount && amt && !isNaN(parseFloat(amt))) {
        el.amount.value = amt;
        if (region) el.region.value = region;
        if (period) el.payPeriod.value = period;
        validate();
        handleCalculate();
    }
};

const attachListeners = () => {
    [el.amount, el.from, el.payPeriod, el.region].forEach(input => {
        if (!input) return;
        input.addEventListener('input', () => {
            if (input === el.amount && input.value < 0) input.value = 0;
            validate();
            clearTimeout(calcTimeout);
            if (!el.convertBtn.disabled) {
                calcTimeout = setTimeout(handleCalculate, 500);
            }
        });
    });

    // Sticky CTA logic
    const sticky = document.getElementById('sticky-cta');
    if (sticky && el.convertBtn) {
        window.addEventListener('scroll', () => {
            const rect = el.convertBtn.getBoundingClientRect();
            if (rect.bottom < 0) sticky.classList.add('show');
            else sticky.classList.remove('show');
        });
        sticky.onclick = () => {
            if (el.amount) el.amount.focus();
            window.scrollTo({ top: (el.amount?.offsetTop || 0) - 100, behavior: 'smooth' });
        };
    }

    if (el.from) el.from.addEventListener('change', updateRegions);
    if (el.amount) {
        el.amount.addEventListener('keydown', e => { 
            if (e.key === 'Enter') {
                e.preventDefault();
                el.convertBtn.click(); 
            }
        });
    }

    if (el.step1Tab) el.step1Tab.onclick = () => showStep(1);
    if (el.step2Tab) el.step2Tab.onclick = () => showStep(2);

    const modeGross = document.getElementById('mode-gross');
    const modeNet = document.getElementById('mode-net');
    if (modeGross) modeGross.onclick = () => setMode('gross-to-net');
    if (modeNet) modeNet.onclick = () => setMode('net-to-gross');
    
    if (el.convertBtn) el.convertBtn.onclick = (e) => { e.preventDefault(); handleCalculate(); };
    el.resetBtn.onclick = handleReset;
    if (el.themeToggle) el.themeToggle.onclick = toggleTheme;
    if (el.pasteBtn) el.pasteBtn.onclick = handlePaste;
    
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
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `Copied ✓`;
        btn.style.color = 'var(--primary)';
        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.style.color = '';
        }, 1500);
    };
    if (document.getElementById('qr-btn')) {
        document.getElementById('qr-btn').onclick = () => {
            const container = document.getElementById('qr-container');
            const img = document.getElementById('qr-code-img');
            const isHidden = container.classList.toggle('hidden');
            if (!isHidden) {
                const url = encodeURIComponent(window.location.href);
                img.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${url}`;
            }
        };
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const installBtn = document.getElementById('pwa-install');
        if (installBtn) installBtn.classList.remove('hidden');
    });

    if (document.getElementById('pwa-install')) {
        document.getElementById('pwa-install').onclick = (e) => {
            e.preventDefault();
            if (deferredPrompt) deferredPrompt.prompt();
        };
    }

    if (el.reverseModeBtn) el.reverseModeBtn.onclick = handleReverseModeToggle;
};

const showStep = (step) => {
    if (step === 2 && el.step2Tab.disabled) return;
    
    el.step1Tab.classList.toggle('active', step === 1);
    el.step2Tab.classList.toggle('active', step === 2);
    
    if (step === 1) {
        el.step1Content.classList.remove('hidden');
        el.step2Content.classList.add('hidden');
    } else {
        el.step1Content.classList.add('hidden');
        el.step2Content.classList.remove('hidden');
    }
};

const updateRegions = () => {
    if (!TAX_DATA || !el.from || !el.from.value) return;
    const country = el.from.value;
    const list = TAX_DATA[country]?.regions || [];
    el.region.innerHTML = list.map(r => `<option value="${r.id}">${r.label}</option>`).join('');
    validate();
};

const setMode = (mode) => {
    if (!el.amount) return;
    state.mode = mode;
    document.getElementById('mode-gross').classList.toggle('active', mode === 'gross-to-net');
    document.getElementById('mode-net').classList.toggle('active', mode === 'net-to-gross');
    el.amount.placeholder = mode === 'gross-to-net' ? "e.g. 80000" : "e.g. 5000";
    document.querySelector('label[for="amount"]').textContent = 
        mode === 'gross-to-net' ? 'Salary (before tax)' : 'Target take-home';
};

const validate = () => {
    if (!el.amount) return;
    const val = parseFloat(el.amount.value);
    const isValid = val > 0 && val <= 10000000;
    el.convertBtn.disabled = !isValid;
    el.resetBtn.classList.toggle('hidden', !el.amount.value);
};

const handlePaste = async () => {
    if (!el.amount) return;
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
    const errorEl = document.getElementById('calc-error');
    if (errorEl) errorEl.classList.add('hidden');

    if (!TAX_DATA) return;
    const inputVal = parseFloat(el.amount.value);
    
    if (isNaN(inputVal) || inputVal <= 0) {
        if (el.amount.value && errorEl) {
            errorEl.textContent = "Please enter a valid salary amount.";
            errorEl.classList.remove('hidden');
        }
        return;
    }

    const country = el.from.value;
    const regionId = el.region.value;
    const regionName = el.region.options[el.region.selectedIndex]?.text || 'Regional';
    const period = el.payPeriod.value;
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
    showStep(2);
    el.resultArea.classList.add('hidden');
    el.skeleton.classList.remove('hidden');
    el.convertBtn.disabled = true;
    el.step2Tab.disabled = false;

    // Simulate brief processing delay
    await new Promise(r => setTimeout(r, 150));

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
    const taxRate = (100 - parseFloat(keepRate)).toFixed(1);

    // FIX: Structure the visualization container correctly to activate your updated CSS subgrid rules
    el.resultViz.innerHTML = `
        <div class="viz-row">
            <span class="viz-label">Keep</span>
            <div class="viz-bar-bg"><div class="viz-bar-fill keep" style="width: ${keepRate}%"></div></div>
            <span class="viz-percent">${keepRate}%</span>
        </div>
        <div class="viz-row">
            <span class="viz-label">Tax</span>
            <div class="viz-bar-bg"><div class="viz-bar-fill tax" style="width: ${taxRate}%"></div></div>
            <span class="viz-percent">${taxRate}%</span>
        </div>
    `;

    if (el.monthlyTakehome) el.monthlyTakehome.textContent = `$${perMonth}`;
    if (el.annualTakehome) el.annualTakehome.textContent = `$${perYear}`;
    if (el.hourlyTakehome) el.hourlyTakehome.textContent = `$${hourly}`;

    el.resultText.innerHTML = `You keep: ${keepRate}% of your salary`;

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

    const totalDeductions = rows.reduce((sum, current) => sum + current[1], 0);
    const taxRateTotal = (100 - parseFloat(keepRate)).toFixed(1);
    const monthlyLoss = ((annualGross - r.takeHome) / 12).toLocaleString(undefined, {maximumFractionDigits: 0});
    
    if (el.insightHeadline) {
        el.insightHeadline.textContent = taxRateTotal > 25 
            ? `😬 You lose ${taxRateTotal}% of your income to taxes`
            : `✅ Your effective tax rate is ${taxRateTotal}%`;
    }

    const insight = totalDeductions > 0 
        ? `💸 You're losing ${taxRateTotal}% to taxes<br>≈ $${monthlyLoss}/month goes to deductions`
        : `💡 You have no deductions!`;
    const currency = country === 'CAN' ? 'CAD' : 'USD';

    // FIX: This eliminates hardcoded string values on inner HTML injection steps
    el.resultBreakdown.innerHTML = `
        <div class="muted" style="margin-bottom: 0.75rem;">All amounts in ${currency}</div>
        <table class="breakdown-table">
            ${tableContent}
            <tr class="total-row"><td>You keep</td><td>${keepRate}%</td></tr>
            <tr class="total-row"><td>Hourly Take-home</td><td>$${hourly}/hr</td></tr>
        </table>
        <div class="insight-line" style="margin-top:1rem; font-weight:500; color:var(--primary);">${insight}</div>
    <p class="result-note muted" style="margin-top:1rem; font-size:0.85rem;">Estimate based on current tax rates. No deductions or credits included.</p>
    `;

    state.resultsCount++;
    localStorage.setItem('resultsCount', state.resultsCount);
    el.resultCount.textContent = `${state.resultsCount} calculations so far`;
    
    const emptyHint = document.getElementById('empty-hint');
    if (emptyHint) emptyHint.classList.add('hidden');
    
    el.resultArea.classList.remove('hidden');
    el.donateContainer.classList.remove('hidden');
    el.feedbackRow.classList.remove('hidden');

    const metaText = `Take-home pay: $${perYear}`;
    updateMetadata(metaText, inputVal, country, period, state.mode, r.region);
    
    generateCompareLinks(annualGross);
    const historyText = `$${(annualGross/1000).toFixed(0)}K → $${(r.takeHome/1000).toFixed(1)}K (${r.region})`;
    addHistory({ text: historyText, amount: inputVal, country, period, region: r.region });
};

const updateMetadata = (text, gross, country, period, mode, region) => {
    const year = TAX_DATA ? TAX_DATA.year : TAX_YEAR;
    
    if (el.h1) {
        const formattedGross = parseFloat(gross).toLocaleString(undefined, { maximumFractionDigits: 0 });
        const currencySymbol = country === 'CAN' ? 'CAD ' : '$';
        el.h1.textContent = `${currencySymbol}${formattedGross} Salary After Tax — What Do You Actually Take Home?`;
    }
    
    document.title = `${text} (${country}) — ${year} Calculator | Usecos`;
    if (el.metaDesc) {
        el.metaDesc.content = `Calculated take-home pay: ${text}. Based on ${year} ${country} tax regulations.`;
    }
    history.replaceState(null, '', window.location.pathname + `?salary=${gross}&country=${country}&period=${period}&mode=${mode}&region=${region}`);
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
        `<span class="chip" data-idx="${i}" title="${h.text}">${h.text}</span>`
    ).join('');
    
    el.historyChips.querySelectorAll('.chip').forEach(chip => {
        chip.onclick = () => {
            const data = state.calcHistory[chip.dataset.idx];
            el.amount.value = data.amount;
            el.from.value = data.country;
            updateRegions();
            el.region.value = data.region || '0';
            el.payPeriod.value = data.period;
            validate();
            handleCalculate();
        };
    });
};

const generateCompareLinks = (annualGross) => {
    const container = document.getElementById('compare-links');
    if (!container) return;
    const steps = [0.8, 1.2, 1.5];
    container.innerHTML = steps.map(step => {
        const val = Math.round((annualGross * step) / 1000) * 1000;
        const label = val >= 1000 ? `$${(val / 1000).toFixed(0)}K` : `$${val}`;
        return `<span class="chip compare-chip" data-val="${val}">Try ${label}</span>`;
    }).join('');

    container.querySelectorAll('.compare-chip').forEach(chip => {
        chip.onclick = () => {
            el.amount.value = chip.dataset.val;
            el.payPeriod.value = 'annual';
            validate();
            handleCalculate();
            // Smooth scroll back to input for better UX on mobile
            const target = el.amount.offsetTop - 100;
            window.scrollTo({ top: target, behavior: 'smooth' });
        };
    });
};

const handleReset = () => {
    if (el.amount) el.amount.value = '';
    el.from.selectedIndex = 0;
    el.payPeriod.selectedIndex = 0;
    updateRegions();
    setMode('gross-to-net');
    
    // RESTORE THE DEFAULT HEADING
    if (el.h1) {
        el.h1.textContent = `Salary After Tax Calculator — See Your Take‑Home Pay Instantly`;
    }

    document.title = `Paycheck Calculator USA & Canada — Free Take-Home Pay | Usecos Tools`;
    el.resultArea.classList.add('hidden');
    el.feedbackRow.classList.add('hidden');
    
    // Completely flush inner HTML/Text to prevent layout shifting
    if (el.resultText) el.resultText.textContent = '';
    if (el.monthlyTakehome) el.monthlyTakehome.textContent = '$0.00';
    if (el.annualTakehome) el.annualTakehome.textContent = '$0.00';
    if (el.hourlyTakehome) el.hourlyTakehome.textContent = '$0.00';
    if (el.resultBreakdown) el.resultBreakdown.innerHTML = ''; 
    if (el.resultViz) el.resultViz.innerHTML = '';
    
    if (el.step2Tab) {
        el.step2Tab.disabled = true;
        showStep(1);
    }
    if (el.donateContainer) el.donateContainer.classList.add('hidden');
    history.replaceState(null, '', '/');
    resetFeedbackRow();
    validate();
    updateYearUI(); // Let this update any stray text layers
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

const handleReverseModeToggle = () => {
    if (!state.lastResult) return;
    const r = state.lastResult;
    setMode('net-to-gross');

    const divisor = { annual: 1, monthly: 12, biweekly: 26, weekly: 52 }[r.period];
    el.amount.value = (r.takeHome / divisor).toFixed(2);
    el.payPeriod.value = r.period;

    validate();
    window.scrollTo({ top: el.amount.offsetTop - 100, behavior: 'smooth' });
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
