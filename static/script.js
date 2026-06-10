let currentLang = 'ru';
let isSchemaVisible = false;
let myChart = null;
let currentData = null;
let currentDb = 'chinook.sqlite';
let availableDatabases = [];

const HISTORY_KEY = 'voicesql_history';
const MAX_HISTORY = 5;

const KNOWN_DB_FILENAMES = [
    'chinook.sqlite',
    'booking_db.sqlite',
    'comparedge_v1.sqlite',
    'tenis.sqlite',
];

// DB short label for status bar
const DB_SHORT = {
    'chinook.sqlite':       'Music Store',
    'booking_db.sqlite':    'Hotel Reviews',
    'comparedge_v1.sqlite': 'SaaS Compare',
    'tenis.sqlite':         'Tennis ATP/WTA',
};

const schemaButton      = document.getElementById('schemaButton');
const schemaContainer   = document.getElementById('schemaContainer');
const visualSchema      = document.getElementById('visualSchema');
const dbFileInput       = document.getElementById('dbFileInput');
const uploadDbBtn       = document.getElementById('uploadDbBtn');
const downloadCsvBtn    = document.getElementById('downloadCsvBtn');
const recordButton      = document.getElementById('recordButton');
const statusText        = document.getElementById('status');
const editorSection     = document.getElementById('editorSection');
const textInput         = document.getElementById('textInput');
const sendButton        = document.getElementById('sendButton');
const resultCard        = document.getElementById('resultCard');
const skeletonCard      = document.getElementById('skeletonCard');
const chartWrapper      = document.getElementById('chartWrapper');
const dbChips           = document.getElementById('dbChips');
const dbHoverDesc       = document.getElementById('dbHoverDesc');
const historyCard       = document.getElementById('historyCard');
const historyList       = document.getElementById('historyList');
const copySqlBtn        = document.getElementById('copySqlBtn');
const editSqlBtn        = document.getElementById('editSqlBtn');
const sqlEditorSection  = document.getElementById('sqlEditorSection');
const sqlEditor         = document.getElementById('sqlEditor');
const runSqlBtn         = document.getElementById('runSqlBtn');
const cancelEditBtn     = document.getElementById('cancelEditBtn');
const currentDbLabel    = document.getElementById('currentDbLabel');
const aiExplanation     = document.getElementById('aiExplanation');

// Status bar elements
const statusBarDb    = document.getElementById('statusBarDb');
const statusBarState = document.getElementById('statusBarState');
const statusBarLang  = document.getElementById('statusBarLang');

// ─── i18n ──────────────────────────────────────────────────────────────────────
i18next.use(i18nextHttpBackend).init({
    lng: currentLang,
    fallbackLng: 'en',
    backend: { loadPath: '/static/locales/{{lng}}.json' }
}).then(() => {
    initApp();
});

function initApp() {
    updateUITexts();
    loadDatabases().then(() => {
        renderChips();
        renderHistory();
        updateStatusBar();
    });
}

function updateUITexts() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key.startsWith('[placeholder]')) {
            el.placeholder = i18next.t(key.replace('[placeholder]', ''));
        } else {
            el.textContent = i18next.t(key);
        }
    });

    const specificPlaceholder = i18next.t(`placeholders.${currentDb}`, { defaultValue: '' });
    textInput.placeholder = specificPlaceholder || i18next.t('ui.placeholderDefault');

    schemaButton.textContent = i18next.t(isSchemaVisible ? 'ui.schemaBtnHide' : 'ui.schemaBtnShow');
}

function updateStatusBar() {
    const label = DB_SHORT[currentDb]
        || availableDatabases.find(d => d.filename === currentDb)?.label
        || currentDb;
    if (statusBarDb) statusBarDb.textContent = currentDb;
    if (currentDbLabel) currentDbLabel.textContent = currentDb;
    if (statusBarLang) statusBarLang.textContent = currentLang.toUpperCase();
}

function setStatusState(key) {
    const text = i18next.t(key);
    if (statusText) statusText.textContent = text;
    if (statusBarState) statusBarState.textContent = text;
}

// ─── Lang switcher ────────────────────────────────────────────────────────────
document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentLang = e.target.getAttribute('data-lang');
        i18next.changeLanguage(currentLang).then(() => {
            updateUITexts();
            renderChips();
            renderHistory();
            updateStatusBar();
        });
    });
});

// ─── Database list ────────────────────────────────────────────────────────────
async function loadDatabases() {
    try {
        const res = await fetch('/databases');
        const data = await res.json();
        availableDatabases = data.databases || [];
    } catch (e) {
        dbChips.innerHTML = `<span style="color:var(--red);font-size:12px;padding:0 10px">${i18next.t('errors.dbLoadError')}</span>`;
    }
}

function renderChips() {
    dbChips.innerHTML = '';
    availableDatabases.forEach(db => {
        const isCustom = !KNOWN_DB_FILENAMES.includes(db.filename);
        const item = document.createElement('div');
        item.className = 'db-item' + (db.filename === currentDb ? ' active' : '');
        item.dataset.filename = db.filename;

        const dot = document.createElement('span');
        dot.className = 'db-item-dot';

        const name = document.createElement('span');
        name.className = 'db-item-name';
        name.textContent = db.label;

        const badge = document.createElement('span');
        badge.className = 'db-item-badge';
        badge.textContent = isCustom ? 'custom' : 'built-in';

        item.append(dot, name, badge);

        item.addEventListener('mouseenter', () => {
            dbHoverDesc.textContent = db.descriptions[currentLang] || db.filename;
            dbHoverDesc.classList.add('active');
        });
        item.addEventListener('mouseleave', () => {
            dbHoverDesc.textContent = i18next.t('ui.descDefault');
            dbHoverDesc.classList.remove('active');
        });
        item.addEventListener('click', () => {
            currentDb = db.filename;
            renderChips();
            updateStatusBar();
            if (isSchemaVisible) loadSchema();
            resultCard.classList.add('hidden');
            if (myChart) myChart.destroy();
            const p = i18next.t(`placeholders.${currentDb}`, { defaultValue: '' });
            textInput.placeholder = p || i18next.t('ui.placeholderDefault');
        });

        dbChips.appendChild(item);
    });
}

// ─── Schema ───────────────────────────────────────────────────────────────────
schemaButton.addEventListener('click', () => {
    isSchemaVisible = !isSchemaVisible;
    schemaButton.textContent = i18next.t(isSchemaVisible ? 'ui.schemaBtnHide' : 'ui.schemaBtnShow');
    if (isSchemaVisible) {
        schemaContainer.classList.remove('hidden');
        loadSchema();
    } else {
        schemaContainer.classList.add('hidden');
    }
});

async function loadSchema() {
    visualSchema.innerHTML = `<span style="color:var(--text-3);font-size:12px">${i18next.t('ui.loading')}</span>`;
    try {
        const res = await fetch(`/schema?db=${encodeURIComponent(currentDb)}&lang=${currentLang}`);
        const data = await res.json();

        if (data.status === 'error') {
            visualSchema.innerHTML = `<span style="color:var(--red);font-size:12px">${data.message}</span>`;
            return;
        }
        if (!data.schema_json || data.schema_json.length === 0) {
            visualSchema.innerHTML = `<span style="color:var(--text-3);font-size:12px">${i18next.t('errors.emptyData')}</span>`;
            return;
        }

        visualSchema.innerHTML = '';
        data.schema_json.forEach(table => {
            const tableDiv = document.createElement('div');
            tableDiv.className = 'db-table';

            const header = document.createElement('div');
            header.className = 'db-table-header';
            header.textContent = table.name;
            tableDiv.appendChild(header);

            table.columns.forEach(col => {
                const row = document.createElement('div');
                row.className = 'db-table-row';

                const left = document.createElement('div');
                const nameSpan = document.createElement('span');
                nameSpan.textContent = col.name;
                const typeSpan = document.createElement('span');
                typeSpan.className = 'col-type';
                typeSpan.textContent = col.type ? col.type.toLowerCase() : '';
                left.append(nameSpan, typeSpan);

                const pkSpan = document.createElement('span');
                pkSpan.className = 'col-pk';
                if (col.pk) pkSpan.textContent = 'PK';

                row.append(left, pkSpan);
                tableDiv.appendChild(row);
            });
            visualSchema.appendChild(tableDiv);
        });
    } catch (err) {
        visualSchema.innerHTML = `<span style="color:var(--red);font-size:12px">${err.message}</span>`;
    }
}

// ─── File upload ──────────────────────────────────────────────────────────────
uploadDbBtn.addEventListener('click', () => dbFileInput.click());

dbFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('lang', currentLang);

    try {
        const res = await fetch('/upload-db', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.status === 'success') {
            await loadDatabases();
            currentDb = data.db_name;
            renderChips();
            updateStatusBar();
            if (isSchemaVisible) loadSchema();
        } else {
            alert(data.message);
        }
    } catch {
        alert(i18next.t('errors.uploadError'));
    } finally {
        dbFileInput.value = '';
    }
});

// ─── CSV download ─────────────────────────────────────────────────────────────
downloadCsvBtn.addEventListener('click', () => {
    if (!currentData || currentData.length === 0) return;
    const headers = Object.keys(currentData[0]).join(',');
    const rows = currentData.map(row =>
        Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + headers + '\n' + rows;
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `voice_sql_${currentDb.replace('.sqlite', '')}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// ─── Copy SQL ─────────────────────────────────────────────────────────────────
copySqlBtn.addEventListener('click', () => {
    const rawSql = document.getElementById('sqlQuery').dataset.raw || '';
    if (!rawSql) return;
    navigator.clipboard.writeText(rawSql).then(() => {
        copySqlBtn.textContent = i18next.t('ui.copiedMsg');
        setTimeout(() => {
            copySqlBtn.innerHTML = `
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="5" y="5" width="9" height="9" rx="1"/>
                    <path d="M11 5V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2"/>
                </svg>
                ${i18next.t('ui.copy')}`;
        }, 1500);
    });
});

// ─── SQL Edit panel ───────────────────────────────────────────────────────────
editSqlBtn.addEventListener('click', () => {
    const rawSql = document.getElementById('sqlQuery').dataset.raw || '';
    sqlEditor.value = rawSql;
    sqlEditorSection.classList.remove('hidden');
    editSqlBtn.classList.add('active');
    sqlEditor.focus();
});

cancelEditBtn.addEventListener('click', () => {
    sqlEditorSection.classList.add('hidden');
    editSqlBtn.classList.remove('active');
});

// ─── Run raw SQL ──────────────────────────────────────────────────────────────
runSqlBtn.addEventListener('click', async () => {
    const sql = sqlEditor.value.trim();
    if (!sql) return;
    runSqlBtn.disabled = true;
    runSqlBtn.textContent = i18next.t('ui.running');
    setStatusState('ui.statusProcessing');
    skeletonCard.classList.remove('hidden');
    resultCard.classList.add('hidden');

    try {
        const res = await fetch('/run-raw-sql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sql, db: currentDb, lang: currentLang })
        });
        const data = await res.json();
        skeletonCard.classList.add('hidden');
        setStatusState('ui.statusDone');
        sqlEditorSection.classList.add('hidden');
        editSqlBtn.classList.remove('active');

        if (data.status === 'success') {
            resultCard.classList.remove('hidden');
            aiExplanation.classList.add('hidden');
            const sqlEl = document.getElementById('sqlQuery');
            sqlEl.innerHTML = highlightSQL(sql);
            sqlEl.dataset.raw = sql;
            currentData = data.data;
            renderTable(currentData);
            renderChart(currentData, 'none');
        } else {
            showError(data.message);
        }
    } catch (err) {
        skeletonCard.classList.add('hidden');
        setStatusState('errors.serverError');
    } finally {
        runSqlBtn.disabled = false;
        runSqlBtn.textContent = i18next.t('ui.runSql');
    }
});

sqlEditor.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); runSqlBtn.click(); }
});

// ─── Chart ────────────────────────────────────────────────────────────────────
function renderChart(data, chartType) {
    const ctx = document.getElementById('resultChart').getContext('2d');
    if (myChart) myChart.destroy();
    if (chartType === 'none' || !data || data.length === 0 || Object.keys(data[0]).length < 2) {
        chartWrapper.classList.add('hidden');
        return;
    }
    chartWrapper.classList.remove('hidden');
    const keys    = Object.keys(data[0]);
    const labels  = data.map(r => r[keys[0]]);
    const values  = data.map(r => parseFloat(r[keys[1]]));

    const palette = [
        'rgba(124,106,247,0.75)', 'rgba(61,214,140,0.75)',
        'rgba(240,164,41,0.75)',  'rgba(224,82,82,0.75)',
        'rgba(91,165,247,0.75)',  'rgba(255,174,100,0.75)',
    ];

    myChart = new Chart(ctx, {
        type: chartType,
        data: {
            labels,
            datasets: [{
                label: keys[1],
                data: values,
                backgroundColor: palette,
                borderColor: palette.map(c => c.replace('0.75', '1')),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#9191A8', font: { family: 'Inter', size: 11 } } }
            },
            scales: chartType !== 'pie' ? {
                x: { ticks: { color: '#6B6B80', font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: '#1C1C26' } },
                y: { ticks: { color: '#6B6B80', font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: '#1C1C26' } }
            } : {}
        }
    });
}

// ─── Table ────────────────────────────────────────────────────────────────────
function renderTable(data) {
    const tableContainer = document.getElementById('tableContainer');
    tableContainer.innerHTML = '';
    if (!data || data.length === 0) {
        downloadCsvBtn.classList.add('hidden');
        if (myChart) myChart.destroy();
        chartWrapper.classList.add('hidden');
        tableContainer.innerHTML = `<p style="padding:16px;color:var(--text-3);font-size:13px">${i18next.t('errors.emptyData')}</p>`;
        return;
    }
    downloadCsvBtn.classList.remove('hidden');
    const table  = document.createElement('table');
    const thead  = document.createElement('thead');
    const hRow   = document.createElement('tr');
    Object.keys(data[0]).forEach(key => {
        const th = document.createElement('th');
        th.textContent = key;
        hRow.appendChild(th);
    });
    thead.appendChild(hRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    data.forEach(row => {
        const tr = document.createElement('tr');
        Object.values(row).forEach(val => {
            const td = document.createElement('td');
            td.textContent = val !== null ? val : 'NULL';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableContainer.appendChild(table);
}

function showError(msg) {
    resultCard.classList.remove('hidden');
    aiExplanation.className = 'error-block';
    aiExplanation.classList.remove('hidden');
    aiExplanation.textContent = msg;
    document.getElementById('sqlQuery').innerHTML = '';
    document.getElementById('tableContainer').innerHTML = '';
    chartWrapper.classList.add('hidden');
    downloadCsvBtn.classList.add('hidden');
    if (myChart) myChart.destroy();
}

// ─── History ──────────────────────────────────────────────────────────────────
function getHistory() {
    try { return JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]'); }
    catch { return []; }
}

function saveToHistory(query) {
    let h = getHistory().filter(x => x.text !== query.text || x.db !== query.db);
    h.unshift(query);
    if (h.length > MAX_HISTORY) h = h.slice(0, MAX_HISTORY);
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(h));
    renderHistory();
}

function restoreResult(item) {
    const data = item.result;
    if (!data) return;
    resultCard.classList.remove('hidden');
    skeletonCard.classList.add('hidden');
    setStatusState('ui.statusDone');

    if (data.explanation) {
        aiExplanation.className = 'result-explanation';
        aiExplanation.classList.remove('hidden');
        aiExplanation.textContent = data.explanation;
    } else {
        aiExplanation.classList.add('hidden');
    }

    const sqlEl = document.getElementById('sqlQuery');
    sqlEl.innerHTML = data.sql ? highlightSQL(data.sql) : '';
    sqlEl.dataset.raw = data.sql || '';
    currentData = data.data;
    renderTable(currentData);
    renderChart(currentData, data.chart_type || 'none');
}

function renderHistory() {
    const history = getHistory();
    if (history.length === 0) { historyCard.classList.add('hidden'); return; }
    historyCard.classList.remove('hidden');
    historyList.innerHTML = '';
    history.forEach(item => {
        const entry = document.createElement('div');
        entry.className = 'history-item';
        const dbMeta  = availableDatabases.find(d => d.filename === item.db);
        const dbLabel = dbMeta ? dbMeta.label : item.db;
        entry.innerHTML = `
            <span class="history-db-badge">${dbLabel}</span>
            <span class="history-text">${item.text}</span>
        `;
        entry.addEventListener('click', () => {
            if (item.db !== currentDb) {
                currentDb = item.db;
                renderChips();
                updateStatusBar();
                if (isSchemaVisible) loadSchema();
            }
            textInput.value = item.text;
            editorSection.classList.remove('hidden');
            restoreResult(item);
            resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        historyList.appendChild(entry);
    });
}

// ─── Recording ────────────────────────────────────────────────────────────────
let mediaRecorder;
let audioChunks = [];

recordButton.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        recordButton.textContent = i18next.t('ui.recordBtnStart');
        recordButton.classList.remove('recording');
        setStatusState('ui.statusRecognizing');
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const formData = new FormData();
            formData.append('file', audioBlob, 'record.webm');
            formData.append('lang', currentLang);
            try {
                const res  = await fetch('/transcribe', { method: 'POST', body: formData });
                const data = await res.json();
                textInput.value = data.text;
                editorSection.classList.remove('hidden');
                setStatusState('ui.statusReady');
            } catch {
                setStatusState('errors.serverError');
            }
        };
        mediaRecorder.start();
        editorSection.classList.add('hidden');
        resultCard.classList.add('hidden');
        skeletonCard.classList.add('hidden');
        recordButton.textContent = i18next.t('ui.recordBtnStop');
        recordButton.classList.add('recording');
        statusText.textContent = '—';
    } catch {
        alert(i18next.t('errors.micDenied'));
    }
});

// ─── Send query ───────────────────────────────────────────────────────────────
sendButton.addEventListener('click', async () => {
    const textToProcess = textInput.value.trim();
    if (!textToProcess) return;
    sendButton.disabled = true;
    setStatusState('ui.statusProcessing');
    resultCard.classList.add('hidden');
    skeletonCard.classList.remove('hidden');

    try {
        const res  = await fetch('/execute-sql', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ text: textToProcess, lang: currentLang, db: currentDb })
        });
        const data = await res.json();
        skeletonCard.classList.add('hidden');
        setStatusState('ui.statusDone');

        if (data.status === 'success') {
            saveToHistory({ text: textToProcess, db: currentDb, timestamp: Date.now(), result: data });
            resultCard.classList.remove('hidden');

            if (data.explanation) {
                aiExplanation.className = 'result-explanation';
                aiExplanation.classList.remove('hidden');
                aiExplanation.textContent = data.explanation;
            } else {
                aiExplanation.classList.add('hidden');
            }

            const sqlEl = document.getElementById('sqlQuery');
            sqlEl.innerHTML = data.sql ? highlightSQL(data.sql) : '';
            sqlEl.dataset.raw = data.sql || '';
            currentData = data.data;
            renderTable(currentData);
            renderChart(currentData, data.chart_type || 'none');
        } else {
            showError(data.message);
        }
    } catch {
        skeletonCard.classList.add('hidden');
        setStatusState('errors.serverError');
    } finally {
        sendButton.disabled = false;
    }
});

textInput.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); sendButton.click(); }
});

// ─── SQL highlight ────────────────────────────────────────────────────────────
function highlightSQL(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/("[^"]*"|'[^']*')/g, '<span class="str">$1</span>')
        .replace(/\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP BY|ORDER BY|LIMIT|UNION|ALL|AS|IN|AND|OR|NOT|DESC|ASC|IS|NULL|COUNT|SUM|AVG|MAX|MIN|HAVING|DISTINCT|CASE|WHEN|THEN|ELSE|END|WITH|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|INDEX)\b/gi,
            '<span class="kw">$1</span>')
        .replace(/\n/g, '<br>');
}