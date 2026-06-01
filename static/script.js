const i18n = {
    ru: {
        title: "🎙️ Voice-to-SQL Assistant",
        schemaBtnShow: "Показать структуру БД",
        schemaBtnHide: "Скрыть структуру БД",
        uploadBtn: "📁 Загрузить свою БД",
        recordBtnStart: "🔴 Начать запись",
        recordBtnStop: "⬛ Остановить запись",
        sendBtn: "🚀 Отправить запрос",
        downloadCsvBtn: "📥 Скачать CSV",
        placeholder: "Здесь появится ваш текст...",
        statusReady: "Готов к работе.",
        statusRecognizing: "Распознавание...",
        statusProcessing: "Генерация SQL и поиск данных...",
        statusDone: "Готово!",
        emptyData: "База данных вернула пустой результат.",
        selectDbTitle: "Доступные базы данных:",
        desc_chinook: "Музыкальный магазин: треки, альбомы, артисты, покупки.",
        desc_northwind: "Торговая компания: товары, логистика, поставщики, заказы.",
        desc_f1: "Статистика Формулы-1: гонки, пилоты, времена кругов.",
        desc_custom: "Загрузить собственный .sqlite или .db файл с компьютера.",
        desc_default: "Наведите на базу для описания..."
    },
    en: {
        title: "🎙️ Voice-to-SQL Assistant",
        schemaBtnShow: "Show DB Schema",
        schemaBtnHide: "Hide DB Schema",
        uploadBtn: "📁 Upload Custom DB",
        recordBtnStart: "🔴 Start Recording",
        recordBtnStop: "⬛ Stop Recording",
        sendBtn: "🚀 Send Request",
        downloadCsvBtn: "📥 Download CSV",
        placeholder: "Your text will appear here...",
        statusReady: "Ready.",
        statusRecognizing: "Recognizing...",
        statusProcessing: "Generating SQL and searching...",
        statusDone: "Done!",
        emptyData: "Database returned empty result.",
        selectDbTitle: "Available Databases:",
        desc_chinook: "Music store: tracks, albums, artists, invoices.",
        desc_northwind: "Trading company: products, logistics, suppliers, orders.",
        desc_f1: "Formula 1 statistics: races, drivers, lap times.",
        desc_custom: "Upload your own .sqlite or .db file.",
        desc_default: "Hover over a database for description..."
    },
    sk: {
        title: "🎙️ Voice-to-SQL Asistent",
        schemaBtnShow: "Zobraziť štruktúru DB",
        schemaBtnHide: "Skryť štruktúru DB",
        uploadBtn: "📁 Nahrať vlastnú DB",
        recordBtnStart: "🔴 Začať nahrávanie",
        recordBtnStop: "⬛ Zastaviť nahrávanie",
        sendBtn: "🚀 Odoslať požiadavku",
        downloadCsvBtn: "📥 Stiahnuť CSV",
        placeholder: "Váš text sa zobrazí tu...",
        statusReady: "Pripravený.",
        statusRecognizing: "Rozpoznávanie...",
        statusProcessing: "Generovanie SQL a hľadanie...",
        statusDone: "Hotovo!",
        emptyData: "Databáza vrátila prázdny výsledok.",
        selectDbTitle: "Dostupné databázy:",
        desc_chinook: "Hudobný obchod: skladby, albumy, umelci, faktúry.",
        desc_northwind: "Obchodná spoločnosť: produkty, logistika, dodávatelia, objednávky.",
        desc_f1: "Štatistiky Formuly 1: preteky, jazdci, časy kôl.",
        desc_custom: "Nahrať vlastný .sqlite alebo .db súbor.",
        desc_default: "Prejdite myšou na databázu pre popis..."
    }
};

let currentLang = 'ru';
let isSchemaVisible = false;
let myChart = null;
let currentData = null;

// Элементы DOM
const schemaButton = document.getElementById('schemaButton');
const schemaContainer = document.getElementById('schemaContainer');
const visualSchema = document.getElementById('visualSchema');
const uploadDbBtn = document.getElementById('uploadDbBtn');
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

function updateUI() {
    document.getElementById('mainTitle').textContent = i18n[currentLang].title;
    schemaButton.textContent = isSchemaVisible ? i18n[currentLang].schemaBtnHide : i18n[currentLang].schemaBtnShow;
    uploadDbBtn.textContent = i18n[currentLang].uploadBtn;
    sendButton.textContent = i18n[currentLang].sendBtn;
    downloadCsvBtn.textContent = i18n[currentLang].downloadCsvBtn;
    textInput.placeholder = i18n[currentLang].placeholder;

    if (!mediaRecorder || mediaRecorder.state !== 'recording') {
        recordButton.textContent = i18n[currentLang].recordBtnStart;
    }
}

document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentLang = e.target.getAttribute('data-lang');
        updateUI();
    });
});

function highlightSQL(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/("[^"]*"|'[^']*')/g, '<span class=str>$1</span>')
        .replace(/\b(SELECT|FROM|WHERE|JOIN|ON|GROUP BY|ORDER BY|LIMIT|UNION|ALL|AS|IN|AND|OR|NOT|DESC|ASC|IS|NULL)\b/gi, '<span class=kw>$1</span>')
        .replace(/\n/g, '<br>');
}

// Загрузка схемы БД
async function loadSchema() {
    try {
        const response = await fetch('/schema');
        const data = await response.json();

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
        visualSchema.innerHTML = "Ошибка загрузки схемы / Schema load error";
    }
}

schemaButton.addEventListener('click', () => {
    isSchemaVisible = !isSchemaVisible;
    if (isSchemaVisible) {
        schemaContainer.classList.remove('hidden');
        loadSchema();
    } else {
        schemaContainer.classList.add('hidden');
    }
    updateUI();
});

// Загрузка кастомной БД
uploadDbBtn.addEventListener('click', () => dbFileInput.click());

dbFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    uploadDbBtn.textContent = '⏳ ...';
    try {
        const res = await fetch('/upload-db', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.status === 'success') {
            alert('База данных успешно обновлена! / Database updated!');
            if (isSchemaVisible) loadSchema();
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('Ошибка при загрузке БД / Upload error');
    } finally {
        updateUI();
        dbFileInput.value = '';
    }
});

// Скачивание CSV
downloadCsvBtn.addEventListener('click', () => {
    if (!currentData || currentData.length === 0) return;
    const headers = Object.keys(currentData[0]).join(',');
    const rows = currentData.map(row => Object.values(row).map(val => {
        let strVal = String(val).replace(/"/g, '""');
        return `"${strVal}"`;
    }).join(',')).join('\n');

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers + '\n' + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "voice_sql_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// Отрисовка графиков
function renderChart(data, chartType) {
    const ctx = document.getElementById('resultChart').getContext('2d');

    if (myChart) myChart.destroy();

    if (chartType === 'none' || !data || data.length === 0 || Object.keys(data[0]).length < 2) {
        chartWrapper.classList.add('hidden');
        return;
    }

    chartWrapper.classList.remove('hidden');
    const keys = Object.keys(data[0]);
    let labelKey = keys[0];
    let valueKey = keys[1];

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

// Работа с аудио и микрофоном
let mediaRecorder;
let audioChunks = [];

recordButton.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        recordButton.textContent = i18n[currentLang].recordBtnStart;
        recordButton.classList.remove('recording');
        statusText.textContent = i18n[currentLang].statusRecognizing;
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

            try {
                const response = await fetch('/transcribe', { method: 'POST', body: formData });
                const data = await response.json();
                textInput.value = data.text;
                editorSection.classList.remove('hidden');
                statusText.textContent = i18n[currentLang].statusReady;
            } catch (error) {
                statusText.textContent = "Error";
            }
        };

        mediaRecorder.start();
        editorSection.classList.add('hidden');
        resultCard.classList.add('hidden');
        skeletonCard.classList.add('hidden');
        recordButton.textContent = i18n[currentLang].recordBtnStop;
        recordButton.classList.add('recording');
        statusText.textContent = "...";
    } catch (err) {
        alert('Microphone access denied.');
    }
});

// Отправка текстового SQL запроса с анимацией загрузки
sendButton.addEventListener('click', async () => {
    const textToProcess = textInput.value.trim();
    if (!textToProcess) return;

    // Показываем Скелетон
    sendButton.disabled = true;
    statusText.textContent = i18n[currentLang].statusProcessing;
    resultCard.classList.add('hidden');
    skeletonCard.classList.remove('hidden');

    try {
        const response = await fetch('/execute-sql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: textToProcess, lang: currentLang })
        });
        const data = await response.json();

        // Убираем Скелетон
        skeletonCard.classList.add('hidden');
        statusText.textContent = i18n[currentLang].statusDone;

        if (data.status === 'success') {
            resultCard.classList.remove('hidden');

            document.getElementById('aiExplanation').textContent = data.explanation || "Processed";
            document.getElementById('sqlQuery').innerHTML = data.sql ? highlightSQL(data.sql) : "No SQL";
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
                tableContainer.innerHTML = `<p>${i18n[currentLang].emptyData}</p>`;
            }
        } else {
            // Вместо уродливого алерта показываем стильную ошибку прямо в карточке
            resultCard.classList.remove('hidden');

            document.getElementById('aiExplanation').innerHTML = `<span style="color: #e74c3c;">⚠️ Запрос отклонен / Request Rejected</span>`;
            document.getElementById('sqlQuery').innerHTML = `<span style="color: #e74c3c;">${data.message}</span>`;

            // Очищаем и прячем всё лишнее (таблицы, графики, кнопки)
            document.getElementById('tableContainer').innerHTML = '';
            document.getElementById('chartWrapper').classList.add('hidden');
            document.getElementById('downloadCsvBtn').classList.add('hidden');
            if (myChart) myChart.destroy();
        }
    } catch (error) {
        skeletonCard.classList.add('hidden');
        statusText.textContent = "Server Error";
    } finally {
        sendButton.disabled = false;
    }
});

// Инициализация при старте
updateUI();