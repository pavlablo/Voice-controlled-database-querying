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

const schemaButton = document.getElementById('schemaButton');
const schemaContainer = document.getElementById('schemaContainer');
const visualSchema = document.getElementById('visualSchema');
const dbFileInput = document.getElementById('dbFileInput');
const downloadCsvBtn = document.getElementById('downloadCsvBtn');
const recordButton = document.getElementById('recordButton');
const statusText = document.getElementById('status');
const editorSection = document.getElementById('editorSection');
const textInput = document.getElementById('textInput');
const sendButton = document.getElementById('sendButton');
const resultCard = document.getElementById('resultCard');
const skeletonCard = document.getElementById('skeletonCard');
const chartWrapper = document.getElementById('chartWrapper');
const dbChips = document.getElementById('dbChips');
const dbHoverDesc = document.getElementById('dbHoverDesc');
const historyCard = document.getElementById('historyCard');
const historyList = document.getElementById('historyList');
const copySqlBtn = document.getElementById('copySqlBtn');
const editSqlBtn = document.getElementById('editSqlBtn');
const sqlEditorSection = document.getElementById('sqlEditorSection');
const sqlEditor = document.getElementById('sqlEditor');
const runSqlBtn = document.getElementById('runSqlBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

i18next.use(i18nextHttpBackend).init({
    lng: currentLang,
    fallbackLng: 'en',
    backend: {
        loadPath: '/static/locales/{{lng}}.json'
    }
}).then(() => {
    initApp();
});

function initApp() {
    updateUITexts();
    loadDatabases().then(() => {
        renderChips();
        renderHistory();
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

    if (isSchemaVisible) {
        schemaButton.textContent = i18next.t('ui.schemaBtnHide');
    } else {
        schemaButton.textContent = i18next.t('ui.schemaBtnShow');
    }
}

document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentLang = e.target.getAttribute('data-lang');
        i18next.changeLanguage(currentLang).then(() => {
            updateUITexts();
            renderChips();
            renderHistory();
        });
    });
});

async function loadDatabases() {
    try {
        const res = await fetch('/databases');
        const data = await res.json();
        availableDatabases = data.databases || [];
    } catch (e) {
        dbChips.innerHTML = `<span style="color:#e74c3c">${i18next.t('errors.dbLoadError')}</span>`;
    }
}

function renderChips() {
    dbChips.innerHTML = '';

    availableDatabases.forEach(db => {
        const isCustom = !KNOWN_DB_FILENAMES.includes(db.filename);
        const chip = document.createElement('div');
        chip.className = 'db-chip' + (db.filename === currentDb ? ' active' : '') + (isCustom ? ' custom-chip' : '');
        chip.textContent = db.emoji + ' ' + db.label;
        chip.dataset.filename = db.filename;

        chip.addEventListener('mouseenter', () => {
            dbHoverDesc.textContent = db.descriptions[currentLang] || db.filename;
        });
        chip.addEventListener('mouseleave', () => {
            dbHoverDesc.textContent = i18next.t('ui.descDefault');
        });
        chip.addEventListener('click', () => {
            currentDb = db.filename;
            renderChips();
            if (isSchemaVisible) loadSchema();
            resultCard.classList.add('hidden');
            if (myChart) myChart.destroy();
            const specificPlaceholder = i18next.t(`placeholders.${currentDb}`, { defaultValue: '' });
            textInput.placeholder = specificPlaceholder || i18next.t('ui.placeholderDefault');
        });

        dbChips.appendChild(chip);
    });

    const uploadChip = document.createElement('div');
    uploadChip.className = 'db-chip upload-chip';
    uploadChip.textContent = '📁 +';
    uploadChip.addEventListener('click', () => dbFileInput.click());
    dbChips.appendChild(uploadChip);
}

async function loadSchema() {
    visualSchema.innerHTML = i18next.t('ui.loading');
    try {
        const response = await fetch(`/schema?db=${encodeURIComponent(currentDb)}&lang=${currentLang}`);
        const data = await response.json();

        if (data.status === 'error') {
            visualSchema.innerHTML = `<span style="color: #e74c3c; font-weight: bold;">${i18next.t('errors.serverError')}: ${data.message}</span>`;
            return;
        }

        if (!data.schema_json || data.schema_json.length === 0) {
            visualSchema.innerHTML = `<span>${i18next.t('errors.emptyData')}</span>`;
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

                const nameSpan = document.createElement('span');
                nameSpan.textContent = col.name;

                const typeSpan = document.createElement('span');
                typeSpan.className = 'col-type';
                typeSpan.textContent = col.type ? col.type.toLowerCase() : '';

                const pkSpan = document.createElement('span');
                pkSpan.className = 'col-pk';
                if (col.pk) pkSpan.textContent = 'PK';

                const leftWrapper = document.createElement('div');
                leftWrapper.appendChild(nameSpan);
                leftWrapper.appendChild(typeSpan);

                row.appendChild(leftWrapper);
                row.appendChild(pkSpan);
                tableDiv.appendChild(row);
            });
            visualSchema.appendChild(tableDiv);
        });
    } catch (error) {
        visualSchema.innerHTML = `<span style="color: #e74c3c;">${i18next.t('errors.serverError')}: ${error.message}</span>`;
    }
}

schemaButton.addEventListener('click', () => {
    isSchemaVisible = !isSchemaVisible;
    if (isSchemaVisible) {
        schemaContainer.classList.remove('hidden');
        schemaButton.textContent = i18next.t('ui.schemaBtnHide');
        loadSchema();
    } else {
        schemaContainer.classList.add('hidden');
        schemaButton.textContent = i18next.t('ui.schemaBtnShow');
    }
});

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
            alert(i18next.t('errors.uploadSuccess'));
            await loadDatabases();
            currentDb = data.db_name;
            renderChips();
            if (isSchemaVisible) loadSchema();
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert(i18next.t('errors.uploadError'));
    } finally {
        dbFileInput.value = '';
    }
});

downloadCsvBtn.addEventListener('click', () => {
    if (!currentData || currentData.length === 0) return;
    const headers = Object.keys(currentData[0]).join(',');
    const rows = currentData.map(row =>
        Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers + '\n' + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "voice_sql_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

copySqlBtn.addEventListener('click', () => {
    const rawSql = document.getElementById('sqlQuery').dataset.raw || '';
    if (!rawSql) return;
    navigator.clipboard.writeText(rawSql).then(() => {
        copySqlBtn.textContent = i18next.t('ui.copiedMsg');
        setTimeout(() => { copySqlBtn.textContent = i18next.t('ui.copy'); }, 1500);
    });
});

function renderChart(data, chartType) {
    const ctx = document.getElementById('resultChart').getContext('2d');

    if (myChart) myChart.destroy();
    if (chartType === 'none' || !data || data.length === 0 || Object.keys(data[0]).length < 2) {
        chartWrapper.classList.add('hidden');
        return;
    }

    chartWrapper.classList.remove('hidden');

    const keys = Object.keys(data[0]);
    const labelKey = keys[0];
    const valueKey = keys[1];
    const labels = data.map(row => row[labelKey]);
    const values = data.map(row => parseFloat(row[valueKey]));
    myChart = new Chart(ctx, {
        type: chartType,
        data: {
            labels: labels,
            datasets: [{
                label: valueKey,
                data: values,
                backgroundColor: [
                    'rgba(52, 152, 219, 0.7)', 'rgba(231, 76, 60, 0.7)',
                    'rgba(46, 204, 113, 0.7)', 'rgba(241, 196, 15, 0.7)',
                    'rgba(155, 89, 182, 0.7)', 'rgba(52, 73, 94, 0.7)'
                ],
                borderWidth: 1
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function getHistory() {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveToHistory(query) {
    let history = getHistory();
    history = history.filter(h => h.text !== query.text || h.db !== query.db);
    history.unshift(query);
    if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    renderHistory();
}

function restoreResult(item) {
    const data = item.result;
    if (!data) return;

    resultCard.classList.remove('hidden');
    skeletonCard.classList.add('hidden');
    statusText.textContent = i18next.t('ui.statusDone');

    document.getElementById('aiExplanation').textContent = data.explanation || "";

    const sqlEl = document.getElementById('sqlQuery');
    sqlEl.innerHTML = data.sql ? highlightSQL(data.sql) : "No SQL";
    sqlEl.dataset.raw = data.sql || '';

    currentData = data.data;
    const tableContainer = document.getElementById('tableContainer');
    tableContainer.innerHTML = '';
    if (currentData && currentData.length > 0) {
        downloadCsvBtn.classList.remove('hidden');
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        Object.keys(currentData[0]).forEach(key => {
            const th = document.createElement('th');
            th.textContent = key;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        currentData.forEach(row => {
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
        renderChart(currentData, data.chart_type || 'none');
    } else {
        downloadCsvBtn.classList.add('hidden');
        if (myChart) myChart.destroy();
        chartWrapper.classList.add('hidden');
        tableContainer.innerHTML = `<p>${i18next.t('errors.emptyData')}</p>`;
    }
}

function renderHistory() {
    const history = getHistory();
    if (history.length === 0) {
        historyCard.classList.add('hidden');
        return;
    }

    historyCard.classList.remove('hidden');
    historyList.innerHTML = '';

    history.forEach(item => {
        const entry = document.createElement('div');
        entry.className = 'history-item';

        const dbMeta = availableDatabases.find(d => d.filename === item.db);
        const dbLabel = dbMeta ? (dbMeta.emoji + ' ' + dbMeta.label) : item.db;

        entry.innerHTML = `
            <span class="history-db-badge">${dbLabel}</span>
            <span class="history-text">${item.text}</span>
        `;
        entry.addEventListener('click', () => {
            if (item.db !== currentDb) {
                currentDb = item.db;
                renderChips();
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

let mediaRecorder;
let audioChunks = [];

recordButton.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        recordButton.textContent = i18next.t('ui.recordBtnStart');
        recordButton.classList.remove('recording');
        statusText.textContent = i18next.t('ui.statusRecognizing');
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
                const response = await fetch('/transcribe', { method: 'POST', body: formData });
                const data = await response.json();
                textInput.value = data.text;
                editorSection.classList.remove('hidden');
                statusText.textContent = i18next.t('ui.statusReady');
            } catch (error) {
                statusText.textContent = i18next.t('errors.serverError');
            }
        };

        mediaRecorder.start();
        editorSection.classList.add('hidden');
        resultCard.classList.add('hidden');
        skeletonCard.classList.add('hidden');
        recordButton.textContent = i18next.t('ui.recordBtnStop');
        recordButton.classList.add('recording');
        statusText.textContent = "...";
    } catch (err) {
        alert(i18next.t('errors.micDenied'));
    }
});

function highlightSQL(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/("[^"]*"|'[^']*')/g, '<span class=str>$1</span>')
        .replace(/\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP BY|ORDER BY|LIMIT|UNION|ALL|AS|IN|AND|OR|NOT|DESC|ASC|IS|NULL|COUNT|SUM|AVG|MAX|MIN|HAVING|DISTINCT|CASE|WHEN|THEN|ELSE|END)\b/gi, '<span class=kw>$1</span>')
        .replace(/\n/g, '<br>');
}

sendButton.addEventListener('click', async () => {
    const textToProcess = textInput.value.trim();
    if (!textToProcess) return;

    sendButton.disabled = true;
    statusText.textContent = i18next.t('ui.statusProcessing');
    resultCard.classList.add('hidden');
    skeletonCard.classList.remove('hidden');

    try {
        const response = await fetch('/execute-sql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: textToProcess, lang: currentLang, db: currentDb })
        });
        const data = await response.json();

        skeletonCard.classList.add('hidden');
        statusText.textContent = i18next.t('ui.statusDone');

        if (data.status === 'success') {
            saveToHistory({ text: textToProcess, db: currentDb, timestamp: Date.now(), result: data });
            resultCard.classList.remove('hidden');
            document.getElementById('aiExplanation').textContent = data.explanation || "";

            const sqlEl = document.getElementById('sqlQuery');
            sqlEl.innerHTML = data.sql ? highlightSQL(data.sql) : "No SQL";
            sqlEl.dataset.raw = data.sql || '';

            currentData = data.data;
            const tableContainer = document.getElementById('tableContainer');
            tableContainer.innerHTML = '';
            if (currentData && currentData.length > 0) {
                downloadCsvBtn.classList.remove('hidden');
                const table = document.createElement('table');
                const thead = document.createElement('thead');
                const headerRow = document.createElement('tr');
                Object.keys(currentData[0]).forEach(key => {
                    const th = document.createElement('th');
                    th.textContent = key;
                    headerRow.appendChild(th);
                });
                thead.appendChild(headerRow);
                table.appendChild(thead);

                const tbody = document.createElement('tbody');
                currentData.forEach(row => {
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
                renderChart(currentData, data.chart_type || 'none');
            } else {
                downloadCsvBtn.classList.add('hidden');
                if (myChart) myChart.destroy();
                chartWrapper.classList.add('hidden');
                tableContainer.innerHTML = `<p>${i18next.t('errors.emptyData')}</p>`;
            }
        } else {
            resultCard.classList.remove('hidden');
            document.getElementById('aiExplanation').innerHTML =
                `<span style="color: #e74c3c;">${i18next.t('errors.requestRejected')}</span>`;
            document.getElementById('sqlQuery').innerHTML =
                `<span style="color: #e74c3c;">${data.message}</span>`;
            document.getElementById('tableContainer').innerHTML = '';
            document.getElementById('chartWrapper').classList.add('hidden');
            document.getElementById('downloadCsvBtn').classList.add('hidden');
            if (myChart) myChart.destroy();
        }
    } catch (error) {
        skeletonCard.classList.add('hidden');
        statusText.textContent = i18next.t('errors.serverError');
    } finally {
        sendButton.disabled = false;
    }
});

textInput.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        sendButton.click();
    }
});

sqlEditor.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        runSqlBtn.click();
    }
});

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

runSqlBtn.addEventListener('click', async () => {
    const sql = sqlEditor.value.trim();
    if (!sql) return;

    runSqlBtn.disabled = true;
    runSqlBtn.textContent = i18next.t('ui.running');
    statusText.textContent = i18next.t('ui.statusProcessing');
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
        statusText.textContent = i18next.t('ui.statusDone');
        sqlEditorSection.classList.add('hidden');
        editSqlBtn.classList.remove('active');

        if (data.status === 'success') {
            resultCard.classList.remove('hidden');
            const sqlEl = document.getElementById('sqlQuery');
            sqlEl.innerHTML = highlightSQL(sql);
            sqlEl.dataset.raw = sql;

            currentData = data.data;
            const tableContainer = document.getElementById('tableContainer');
            tableContainer.innerHTML = '';
            if (currentData && currentData.length > 0) {
                downloadCsvBtn.classList.remove('hidden');
                const table = document.createElement('table');
                const thead = document.createElement('thead');
                const headerRow = document.createElement('tr');
                Object.keys(currentData[0]).forEach(key => {
                    const th = document.createElement('th');
                    th.textContent = key;
                    headerRow.appendChild(th);
                });
                thead.appendChild(headerRow);
                table.appendChild(thead);

                const tbody = document.createElement('tbody');
                currentData.forEach(row => {
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
                renderChart(currentData, 'none');
            } else {
                downloadCsvBtn.classList.add('hidden');
                if (myChart) myChart.destroy();
                chartWrapper.classList.add('hidden');
                tableContainer.innerHTML = '<p>' + i18next.t('errors.emptyData') + '</p>';
            }
        } else {
            resultCard.classList.remove('hidden');
            document.getElementById('aiExplanation').innerHTML =
                `<span style="color:#e74c3c">${i18next.t('errors.sqlError')}</span>`;
            document.getElementById('sqlQuery').innerHTML =
                `<span style="color:#e74c3c">${data.message}</span>`;
        }
    } catch (err) {
        skeletonCard.classList.add('hidden');
        statusText.textContent = i18next.t('errors.serverError');
    } finally {
        runSqlBtn.disabled = false;
        runSqlBtn.textContent = i18next.t('ui.runSql');
    }
});