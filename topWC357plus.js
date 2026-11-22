// ==UserScript==
// @name         TOPWC357+
// @version      0.4.2
// @author       cuberut
// @description  Wspomaganie głosowania w Topie Wszech Czasów
// @match        https://radio357.pl/top/glosowanie/*
// @updateURL    https://raw.githubusercontent.com/cuberut/topWC357plus/main/topWC357plus.js
// @downloadURL  https://raw.githubusercontent.com/cuberut/topWC357plus/main/topWC357plus.js
// @require      https://cdn.jsdelivr.net/chartist.js/latest/chartist.min.js
// @resource     REMOTE_CSS https://cdn.jsdelivr.net/chartist.js/latest/chartist.min.css
// @grant        GM_addStyle
// @grant        GM_getResourceText
// ==/UserScript==

const myCss = GM_getResourceText("REMOTE_CSS");
GM_addStyle(myCss);
GM_addStyle("div.ct-chart { background-color: white; opacity: 95% }");

// Seria A to właściwy wykres utworu
GM_addStyle("div.ct-chart g.ct-series-a .ct-line { stroke: #f95f1f; stroke-width: 3px; }");
GM_addStyle("div.ct-chart g.ct-series-a .ct-point { stroke: #f95f1f; fill: #f95f1f; }");

// Seria B i C to dynamiczne przerywane linie progów Top 357 i Top 777
GM_addStyle("div.ct-chart g.ct-series-b .ct-line, div.ct-chart g.ct-series-c .ct-line { stroke: #6b7280; stroke-dasharray: 8; stroke-width: 2px; opacity: 0.7; }");
GM_addStyle("div.ct-chart g.ct-series-b .ct-point, div.ct-chart g.ct-series-c .ct-point { display: none; }");

GM_addStyle("span.tagLog { position: absolute; right: 0; top: 0; right: 0px; bottom: 0; align-items: center; display: flex; font-size: x-small; color: #6b7280; }");

GM_addStyle(`
    .top-vote-panel__artist-group h3 {
        transition: transform 0.25s ease-out, opacity 0.25s ease-out !important;
        transform-origin: left center;
        will-change: transform, opacity;
    }

    .top-vote-panel__artist-group.is-empty h3 {
        transform: scale(0.75) !important;
        opacity: 0.4 !important;
    }
`);

GM_addStyle(`
    span#infoVisible { display: inline-block; text-align: right; width: 40px; }
    div#extraTools { margin: 3rem 0 1rem; }
    div#extraTools div, div#extraTools select { display: inline-block; }
`);

GM_addStyle("section.custom-lp .container-xxxl { position: static !important; }");
GM_addStyle("section.custom-lp .container-xxxl .left { z-index: 999; }");

const urlApi = 'https://cgudntoxuckknrtocdet.supabase.co/rest/v1/current_top_stats?select=*';
const publicKey = 'sb_publishable_gNicZcTRVPvCDeRQNDtpeQ_Pz__cyYq';
const listNo = 6;

const getList = async () => {
    const response = await fetch(urlApi, {
        method: 'GET',
        headers: {
            'apikey': publicKey,
            'Authorization': `Bearer ${publicKey}`
        }
    });
    const data = await response.json();
    return data;
}

const setInfoStatus = (amount) => `<p id="infoStatus">Liczba widocznych utworów: <strong><span id="infoVisible">${amount}</span>/<span>${amount}</span></strong> (<span id="infoPercent">100</span>%)`;

const setCheckOnlyIsNew = (amount) => `<input id="onlyIsNew" type="checkbox" class="custom-check custom-checkbox" ${amount || 'disabled'}><label for="onlyIsNew"><span>Pokaż tylko nowości - ${amount} pozycji</span></label>`;
const setCheckOnlyChart = (amount) => `<input id="onlyChart" type="checkbox" class="custom-check custom-checkbox" ${amount || 'disabled'}><label for="onlyChart"><span>Pokaż tylko z historią - ${amount} pozycji</span></label>`;
const setCheckOnlyBDNT = (amount) => `<input id="onlyBDNT" type="checkbox" class="custom-check custom-checkbox" ${amount || 'disabled'}><label for="onlyBDNT"><span>Pokaż tylko utwory BDNT - ${amount} pozycji</span></label>`;

const setSelectByYears = () => `<label class="form-check-label" style="margin-top: 8px;">Pokaż tylko utwory z lat:</label>&#11;<select id="chooseByYears"></select>`;

let extraTools, historyCharts;

const setWebsite = () => {
    const topPartners = document.querySelector('section.top-partners');

    if (topPartners) {
        topPartners.remove();
    }

    const customLp = document.querySelector('section.custom-lp');
    const votingWrapper = document.querySelector('.container-xxxl');
    const leftPanel = votingWrapper.querySelector('.left');

    const topTile = leftPanel.querySelector('.top-title');
    topTile.hidden = true;

    leftPanel.insertAdjacentHTML('beforeend', `
        <div id="infoBox">
          <div id="extraTools"></div>
          <div id="historyCharts"></div>
        </div>
    `);
    extraTools = leftPanel.querySelector('#extraTools');
    historyCharts = leftPanel.querySelector('#historyCharts');
}

let amountAll, infoVisible, infoPercent;

const addInfoStatus = () => {
    amountAll = mainList.length;
    extraTools.insertAdjacentHTML('beforeend', setInfoStatus(amountAll));

    infoVisible = extraTools.querySelector('#infoVisible');
    infoPercent = extraTools.querySelector('#infoPercent');
}

const changeInfoStatus = () => {
    const amountVisible = document.querySelectorAll('.vote_patron ul.lp-song-list .lp-song-item:not([hidden])').length;
    infoVisible.innerText = amountVisible;

    if (amountVisible == amountAll) {
        infoPercent.innerText = 100;
    } else if (amountVisible == 0) {
        infoPercent.innerText = 0;
    } else {
        const amountPercent = amountVisible / amountAll * 100;
        infoPercent.innerText = Math.floor(amountPercent);
    }

    document.querySelectorAll('.top-vote-panel__artist-group').forEach(group => {
        const hasVisible = group.querySelector('.lp-song-item:not([hidden])');
        group.classList.toggle('is-empty', !hasVisible);
    });
}

const setCheckboxOnly = (element, rest, dic) => {
    element.onclick = (e) => {
        const checked = e.target.checked;

        Object.entries(itemDict).forEach(([key, item]) => {
            if (dic[key] === undefined) {
                item.hidden = checked;
            } else {
                item.hidden = !dic[key] && checked;
            }
        });

        rest.forEach(x => { x.checked = false });
        changeInfoStatus();
    }
}

const addCheckboxes = (setList) => {
    extraTools.insertAdjacentHTML('beforeend', `<div id="chb1"></div>`);
    extraTools.insertAdjacentHTML('beforeend', `<div id="chb2"></div>`);
    extraTools.insertAdjacentHTML('beforeend', `<div id="chb3"></div>`);

    const checkboxes1 = extraTools.querySelector("#chb1");
    const checkboxes2 = extraTools.querySelector("#chb2");
    const checkboxes3 = extraTools.querySelector("#chb3");

    const onlyNewLength = listIsNew.filter(item => item.state).length;
    const checkOnlyIsNew = setCheckOnlyIsNew(onlyNewLength);
    checkboxes1.insertAdjacentHTML('beforeend', checkOnlyIsNew);
    const onlyIsNew = checkboxes1.querySelector("#onlyIsNew");
    const dicIsNew = listIsNew.reduce((dic, item) => ({...dic, [item.id]: item.state }), {});

    const onlyBDNTLength = listBDNT.filter(item => item.state).length;
    const checkOnlyBDNT = setCheckOnlyBDNT(onlyBDNTLength);
    checkboxes2.insertAdjacentHTML('beforeend', checkOnlyBDNT);
    const onlyBDNT = checkboxes2.querySelector("#onlyBDNT");
    const dicBDNT = listBDNT.reduce((dic, item) => ({...dic, [item.id]: item.state }), {});

    const onlyRankedLength = listChart.filter(item => item.state).length;
    const checkOnlyChart = setCheckOnlyChart(onlyRankedLength);
    checkboxes3.insertAdjacentHTML('beforeend', checkOnlyChart);
    const onlyChart = checkboxes3.querySelector("#onlyChart");
    const dicChart = listChart.reduce((dic, item) => ({...dic, [item.id]: item.state }), {});

    setCheckboxOnly(onlyIsNew, [onlyChart, onlyBDNT], dicIsNew);
    setCheckboxOnly(onlyBDNT, [onlyIsNew, onlyChart], dicBDNT);
    setCheckboxOnly(onlyChart, [onlyIsNew, onlyBDNT], dicChart);
}

const yearDict = { "0": {list:[], name: "NIEPRZYPISANE"} }
const setOptions = (dic) => Object.keys(dic)
    .filter(id => dic[id].list.length)
    .reduce((options, id) => `${options}<option value=${id}>${dic[id].name} (${dic[id].list.length})</option>`, "<option value=''>Wybierz...</option>");

const setSelector = (element, keys) => {
    element.onchange = (e) => {
        const value = e.target.value;
        mainList.forEach((item, i) => { item.hidden = keys[value] ? !keys[value].list.includes(item.querySelector('input').getAttribute('data-r357api-uuid')) : false });
        changeInfoStatus();
    }
}

let selectors;

const addSelectors = (setList) => {
    extraTools.insertAdjacentHTML('beforeend', `<div id="selectors"></div>`);
    selectors = extraTools.querySelector("#selectors");

    selectors.insertAdjacentHTML('beforeend', setSelectByYears());
    const chooseByYears = selectors.querySelector("#chooseByYears");
    chooseByYears.insertAdjacentHTML('beforeend', setOptions(yearDict));

    setSelector(chooseByYears, yearDict);
}

const resetSelectors = () => selectors.querySelectorAll('select').forEach(select => { select.value = "" });

const getTagLog = (rank, change) => {
    return rank ? `<span class="tagLog">ostatnia poz.: ${rank}` + (change ? ` (${change})` : '') + `</span>` : '';
};


let voteList, mainList, itemDict, leftPanel;
let listIsNew, listChart, listBDNT;
let dicYear = {}, dicGroup = {}, dicGroupSong = {};

const addTags = (votePanel, setList) => {
    mainList = [...votePanel.querySelectorAll("li")];
    itemDict = mainList.reduce((itemDict, item) => ({
        ...itemDict,
        [item.querySelector('button').getAttribute('data-r357api-id')]: item
    }), []);

    const hasValidHistory = (historyStr) => {
        if (!historyStr) return false;
        const values = String(historyStr).split(',');
        return values.some(pos => {
            const val = parseInt(pos.trim(), 10);
            return !isNaN(val) && val > 0 && val <= 777;
        });
    };

    const triggerStats = (chart, state) => {
        chart.hidden = state;
    }

    listIsNew = setList.reduce((list, item) => item.isNew ? [...list, { id: item.id, state: !!item.isNew }] : list, []);
    listChart = setList.reduce((list, item) => hasValidHistory(item.history) ? [...list, { id: item.id, state: true }] : list, []);
    listBDNT = setList.reduce((list, item) => item.isBDNT ? [...list, { id: item.id, state: !!item.isBDNT }] : list, []);

    dicYear = setList.reduce((dic, item) => ({
        ...dic,
        [item.id]: +item.year
    }), []);

    setList.forEach((item, i) => {
        const {id, isNew, rank, change, year, years, history} = item;

        if (!hasValidHistory(history)) {
            return;
        }

        const element = itemDict[id];
        if (!element) {
            return;
        }

        const itemText = element.querySelector('.lp-song-details');
        itemText.style.position = "relative";

        const tagLog = getTagLog(rank, change);
        itemText.insertAdjacentHTML('beforeend', tagLog);

        historyCharts.insertAdjacentHTML('beforeend', `<div id="chart-${i}" class="ct-chart" hidden></div>`);
        const chart = historyCharts.querySelector(`#chart-${i}`);

        let isChartRendered = false;

        element.addEventListener('mouseover', (e) => {
            if (!isChartRendered) {
                const labels = [...Array(listNo-1).keys()].map(x => (x + 2021));

                const seriesData = String(history).split(",").map(x => {
                    const val = parseInt(x.trim(), 10);
                    return (!isNaN(val) && val > 0) ? -val : null;
                });

                const validValues = seriesData.filter(x => x !== null);
                let minSeriesValue = -357;
                let maxSeriesValue = -1;

                if (validValues.length > 0) {
                    minSeriesValue = Math.min(...validValues);
                    maxSeriesValue = Math.max(...validValues);
                }

                let dynamicYLow = Math.floor((minSeriesValue - 10) / 10) * 10;
                let dynamicYHigh = Math.ceil((maxSeriesValue + 10) / 10) * 10;

                if (dynamicYHigh > -1) {
                    dynamicYHigh = -1;
                }

                if (Math.abs(dynamicYHigh - dynamicYLow) < 20) {
                    dynamicYLow -= 10;
                    if (dynamicYHigh < -1) {
                        dynamicYHigh = Math.min(dynamicYHigh + 10, -1);
                    }
                }

                const seriesToRender = [ seriesData ];

                if (dynamicYLow <= -357 && dynamicYHigh >= -357) {
                    seriesToRender.push(labels.map(() => -357));
                }

                if (dynamicYLow <= -777 && dynamicYHigh >= -777) {
                    seriesToRender.push(labels.map(() => -777));
                }

                new window.Chartist.Line(chart, {
                    labels: labels,
                    series: seriesToRender
                }, {
                    height: '450px',
                    width: '450px',
                    fullWidth: false,
                    fillHoles: false,
                    axisY: {
                        low: dynamicYLow,
                        high: dynamicYHigh,
                        onlyInteger: true,
                        labelInterpolationFnc: value => -value
                    }
                });

                isChartRendered = true;
            }

            triggerStats(chart, false);
        });

        element.addEventListener('mouseout', (e) => { triggerStats(chart, true) });
    });

    setList.forEach((item, i) => {
        if (!item.years) {
            yearDict["0"].list.push(item.id);
            return;
        }

        const yearsKeys = Object.keys(yearDict);
        const isYearsKey = yearsKeys.includes(item.years);

        if (!isYearsKey) {
            yearDict[item.years] = { list: [item.id], name: item.years + "-" + item.years.substr(0, 3) + "9" };
        } else {
            yearDict[item.years].list.push(item.id);
        }
    });

    setWebsite();
    addInfoStatus();
    addCheckboxes(setList);
    addSelectors(setList);
}

(function init() {
    getList().then(setList => {
        const checkForElement = () => {
          const votePanel = document.querySelector('[data-r357api-role="voting"]');

            if (!votePanel) {
                requestAnimationFrame(checkForElement);
                return;
            }

            setWebsite();
            addTags(votePanel, setList);
        };

        requestAnimationFrame(checkForElement);
    });
})();
