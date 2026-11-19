// ==UserScript==
// @name         TOPWC357+
// @version      0.3
// @author       cuberut
// @description  Wspomaganie głosowania w Topie Wszech Czasów - Pobieranie całości w jednym żądaniu
// @match        https://radio357.pl/top/glosowanie/*
// @updateURL    https://raw.githubusercontent.com/cuberut/topWC357plus/main/topWC357plus.js
// @downloadURL  https://raw.githubusercontent.com/cuberut/topWC357plus/main/topWC357plus.js
// @require      https://cdn.jsdelivr.net/chartist.js/latest/chartist.min.js
// @resource     REMOTE_CSS https://cdn.jsdelivr.net/chartist.js/latest/chartist.min.css
// @grant        GM_addStyle
// @grant        GM_getResourceText
// ==/UserScript==

// --- STYLOWANIE ---
GM_addStyle(GM_getResourceText("REMOTE_CSS"));
GM_addStyle(`
    div.ct-chart { background-color: white; opacity: 0.95; position: absolute; z-index: 1000; display: none; margin-left: -20px; }
    div.ct-chart.active { display: block; }
    div.ct-chart g.ct-grids line[y1='330'] { stroke-dasharray: 8; stroke-width: 2; }
    div.ct-chart g.ct-series-a .ct-line { stroke: #f95f1f }
    div.ct-chart g.ct-series-a .ct-point { stroke: #f95f1f; fill: #f95f1f; }
    span.tagLog { position: absolute; right: 0; top: 0; bottom: 0; align-items: center; display: flex; font-size: x-small; color: #6b7280; }
    div#extraTools { display: flex; flex-direction: column; gap: 6px; margin-top: 50px; margin-bottom: 0.5em; }
    div#extraTools > div { width: 100%; box-sizing: border-box; }
`);

// --- KONFIGURACJA API ---
const urlApi = 'https://cgudntoxuckknrtocdet.supabase.co/rest/v1/current_top_stats?select=*';
const publicKey = 'sb_publishable_gNicZcTRVPvCDeRQNDtpeQ_Pz__cyYq';
const listNo = 6;
const YEARS_LABELS = [...Array(listNo - 1).keys()].map(x => (x + 2021));

// --- GLOBALNY STAN ---
let extraTools, infoVisible, infoPercent;
let amountAll = 0;
let mainListItems = [];
const statsMap = new Map();
const yearDict = { "0": { list: new Set(), name: "NIEPRZYPISANE" } };
let singleChartInstance = null;

// --- FUNKCJE POBIERANIA DANYCH ---
const getList = async () => {
    try {
        // Jedno zapytanie pobierające całość (wymuszony wysoki limit, aby ominąć domyślne 1000 w PostgREST)
        const response = await fetch(`${urlApi}&limit=3000`, {
            method: 'GET',
            headers: {
                'apikey': publicKey,
                'Authorization': `Bearer ${publicKey}`
            }
        });
        
        const data = await response.json();
        
        // Zabezpieczenie: jeśli z jakiegoś powodu API zwróci błąd w formie obiektu, upewniamy się, że zwracamy tablicę
        return Array.isArray(data) ? data : [];
    } catch(e) {
        console.error("TOPWC357+: Błąd pobierania bazy:", e);
        return [];
    }
};

// --- KOMPONENTY UI ---
const renderInfoStatus = (amount) => `
    <p id="infoStatus">Liczba widocznych utworów:
        <strong><span id="infoVisible">${amount}</span>/<span>${amount}</span></strong>
        (<span id="infoPercent">100</span>%)
    </p>`;

const renderCheckbox = (id, label, amount) => `
    <div id="${id}Container">
        <input id="${id}" type="checkbox" class="custom-check custom-checkbox" ${amount ? '' : 'disabled'}>
        <label for="${id}"><span>${label} - ${amount} pozycji</span></label>
    </div>`;

const renderYearOptions = (dic) => Object.keys(dic)
    .filter(id => dic[id].list.size)
    .reduce((html, id) => `${html}<option value="${id}">${dic[id].name} (${dic[id].list.size})</option>`, "<option value=''>Wybierz...</option>");

const updateCounters = () => {
    let amountVisible = 0;
    for(const item of mainListItems) {
        if (!item.element.hidden) amountVisible++;
    }

    infoVisible.textContent = amountVisible;

    if (amountVisible === amountAll) {
        infoPercent.textContent = "100";
    } else if (amountVisible === 0) {
        infoPercent.textContent = "0";
    } else {
        infoPercent.textContent = Math.floor((amountVisible / amountAll) * 100);
    }
};

// --- LOGIKA FILTRÓW ---
const setupFilters = () => {
    const onlyIsNew = document.getElementById("onlyIsNew");
    const onlyChart = document.getElementById("onlyChart");
    const chooseByYears = document.getElementById("chooseByYears");

    const applyFilters = () => {
        const isNewChecked = onlyIsNew.checked;
        const isChartChecked = onlyChart.checked;
        const selectedYear = chooseByYears.value;

        for (const item of mainListItems) {
            const stats = statsMap.get(item.uuid);
            let shouldHide = false;

            if (isNewChecked && (!stats || !stats.isNew)) shouldHide = true;
            if (isChartChecked && (!stats || !stats._hasValidHistory)) shouldHide = true;
            if (selectedYear) {
                if (!yearDict[selectedYear].list.has(item.uuid)) shouldHide = true;
            }

            item.element.hidden = shouldHide;
        }
        updateCounters();
    };

    onlyIsNew.addEventListener('change', () => {
        if (onlyIsNew.checked) onlyChart.checked = false;
        applyFilters();
    });

    onlyChart.addEventListener('change', () => {
        if (onlyChart.checked) onlyIsNew.checked = false;
        applyFilters();
    });

    chooseByYears.addEventListener('change', applyFilters);
};

// --- GŁÓWNA INICJALIZACJA ---
const initializeApp = (apiData) => {
    const voteList = document.querySelector('.vote_patron');
    if(!voteList) return;

    const leftPanel = document.querySelector('#lp_info_content');
    const subheading = leftPanel.querySelector('.top-title');
    if(subheading) subheading.hidden = true;

    let countNew = 0;
    let countRanked = 0;

    for (const item of apiData) {
        let hasValidHistory = false;
        if (item.history && item.history !== ",,,,") {
            const positions = item.history.split(',').filter(x => x !== '');
            hasValidHistory = positions.some(x => parseInt(x, 10) <= 500);
        }
        
        item._hasValidHistory = hasValidHistory;
        statsMap.set(item.id, item);

        if (item.isNew) countNew++;
        if (item._hasValidHistory) countRanked++;

        if (item.years) {
            if (!yearDict[item.years]) {
                yearDict[item.years] = { list: new Set(), name: `${item.years}-${item.years.substring(0, 3)}9` };
            }
            yearDict[item.years].list.add(item.id);
        } else {
            yearDict["0"].list.add(item.id);
        }
    }

    const domItems = voteList.querySelectorAll("li");
    amountAll = domItems.length;

    domItems.forEach((li) => {
        const btn = li.querySelector('button');
        const uuid = li.querySelector('input')?.getAttribute('data-r357api-uuid') || btn?.getAttribute('data-r357api-id');

        if(!uuid) return;

        mainListItems.push({
            element: li,
            uuid: uuid
        });

        const stats = statsMap.get(uuid);
        if (stats && stats._hasValidHistory) {
            const itemText = li.querySelector('.lp-song-details');
            if (itemText) {
                itemText.style.position = "relative";
                if(stats.rank) {
                    const tagLog = `<span class="tagLog">ostatnia poz.: ${stats.rank}${stats.change ? ` (${stats.change})` : ''}</span>`;
                    itemText.insertAdjacentHTML('beforeend', tagLog);
                }
            }
        }
    });

    const toolsHtml = `
        <div id="extraTools">
            ${renderInfoStatus(amountAll)}
            ${renderCheckbox('onlyIsNew', 'Pokaż tylko nowości', countNew)}
            ${renderCheckbox('onlyChart', 'Pokaż tylko z historią', countRanked)}
            <div id="selectors">
                <label class="form-check-label">Pokaż tylko utwory z lat:</label>
                <select id="chooseByYears">${renderYearOptions(yearDict)}</select>
            </div>
        </div>
        <div id="masterChart" class="ct-chart"></div>
    `;
    subheading.insertAdjacentHTML('afterend', toolsHtml);

    extraTools = document.getElementById('extraTools');
    infoVisible = document.getElementById('infoVisible');
    infoPercent = document.getElementById('infoPercent');

    const masterChartEl = document.getElementById('masterChart');
    singleChartInstance = new window.Chartist.Line('#masterChart',
        { labels: YEARS_LABELS, series: [[]] },
        {
            height: '650px', width: '450px', fullWidth: false, fillHoles: false,
            axisY: { low: -500, high: -1, onlyInteger: true, labelInterpolationFnc: value => -value }
        }
    );

    setupFilters();

    voteList.addEventListener('mouseover', (e) => {
        const li = e.target.closest('li');
        if (!li) return;

        const match = mainListItems.find(item => item.element === li);
        if(!match) return;

        const stats = statsMap.get(match.uuid);
        if (stats && stats._hasValidHistory) {
            const seriesData = stats.history.split(",").map(x => (x ? -parseInt(x, 10) : null));
            singleChartInstance.update({ labels: YEARS_LABELS, series: [seriesData] });
            masterChartEl.classList.add('active');
        }
    });

    voteList.addEventListener('mouseout', (e) => {
        const li = e.target.closest('li');
        if (li) {
            masterChartEl.classList.remove('active');
        }
    });
};

const waitForElement = (selector) => {
    return new Promise(resolve => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver(mutations => {
            if (document.querySelector(selector)) {
                observer.disconnect(); 
                resolve(document.querySelector(selector));
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
};

// --- BOOTSTRAP ---
(async function() {
    try {
        const apiData = await getList();
        if(!apiData || !apiData.length) {
            console.error("TOPWC357+: Brak danych z bazy Supabase");
            return;
        }

        await waitForElement('[data-r357api-role="voting"]');
        initializeApp(apiData);

    } catch (e) {
        console.error("TOPWC357+: Błąd inicjalizacji", e);
    }
})();
