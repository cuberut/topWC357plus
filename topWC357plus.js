// ==UserScript==
// @name         TOPWC357+
// @version      0.2
// @author       cuberut
// @description  Wspomaganie głosowania w Topie Wszech Czasów
// @match        https://radio357.pl/top/
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
GM_addStyle("div.ct-chart g.ct-grids line[y1='330'] { stroke-dasharray: 8; stroke-width: 2; }");
GM_addStyle("div.ct-chart g.ct-series-a .ct-line { stroke: #f95f1f }");
GM_addStyle("div.ct-chart g.ct-series-a .ct-point { stroke: #f95f1f; fill: #f95f1f; }");
GM_addStyle("span.tagLog { position: absolute; right: 0; top: 0; right: 0px; bottom: 0; align-items: center; display: flex; font-size: x-small; color: #6b7280; }");
GM_addStyle("div#extraTools { display: flex; flex-wrap: wrap; justify-content: space-between; margin-bottom: 0.5em }");
GM_addStyle("div#extraTools > p { width: 100% }");
GM_addStyle("div#extraTools > div { width: 50%; box-sizing: border-box; }");

const urlApi = 'https://opensheet.elk.sh/1QowctHMudG7aoB5v3FZcTR0nxadd9VRkci_CahGtIOA/';
const urlSettings = `${urlApi}/settings`;
const urlGroups = `${urlApi}/groups`;
const listNo = 5;

const getList = async (url) => {
    const response = await fetch(url);
    const myJson = await response.json();
    return await myJson;
}

const setInfoStatus = (amount) => `<p id="infoStatus">Liczba widocznych utworów: <strong><span id="infoVisible">${amount}</span>/<span>${amount}</span></strong> (<span id="infoPercent">100</span>%)`;

const setCheckOnlyIsNew = (amount) => `<input id="onlyIsNew" type="checkbox" class="custom-check custom-checkbox" ${amount || 'disabled'}><label for="onlyIsNew"><span>Pokaż tylko nowości - ${amount} pozycji</span></label>`;
const setCheckOnlyRanked = (amount) => `<input id="onlyRanked" type="checkbox" class="custom-check custom-checkbox" ${amount || 'disabled'}><label for="onlyRanked"><span>Pokaż tylko TOP357 - ${amount} pozycji</span></label>`;

let extraTools, amountAll, infoVisible, infoPercent;

const addInfoStatus = (container) => {
    container.hidden = true;
    container.insertAdjacentHTML('afterend', `<div id="extraTools"></div>`);
    extraTools = leftPanel.querySelector('#extraTools');

    amountAll = mainList.length;
    extraTools.insertAdjacentHTML('beforeend', setInfoStatus(amountAll));
    const infoStatus = extraTools.querySelector('#infoStatus');

    infoVisible = infoStatus.querySelector('#infoVisible');
    infoPercent = infoStatus.querySelector('#infoPercent');
}

const changeInfoStatus = () => {
    const amountVisible = voteList.querySelectorAll('.top-vote-panel__item-content:not([hidden])').length;
    infoVisible.innerText = amountVisible;

    if (amountVisible == amountAll) {
        infoPercent.innerText = 100;
    } else if (amountVisible == 0) {
        infoPercent.innerText = 0;
    } else {
        const amountPercent = amountVisible / amountAll * 100;
        infoPercent.innerText = Math.floor(amountPercent);
    }
}

const setCheckboxOnly = (element, rest, dic) => {
    element.onclick = (e) => {
        const checked = e.target.checked;

        Object.entries(itemDict).forEach(([key, item]) => {
            if (dic[key] === undefined) {
                const parentItem = item.closest('.top-vote-panel__artist-group');
                parentItem.hidden = checked;
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

    const checkboxes1 = leftPanel.querySelector("#chb1");
    const checkboxes2 = leftPanel.querySelector("#chb2");
    const checkboxes3 = leftPanel.querySelector("#chb3");

    const onlyNewLength = listIsNew.filter(item => item.state).length;
    const checkOnlyIsNew = setCheckOnlyIsNew(onlyNewLength);
    checkboxes1.insertAdjacentHTML('beforeend', checkOnlyIsNew);
    const onlyIsNew = checkboxes1.querySelector("#onlyIsNew");
    const dicIsNew = listIsNew.reduce((dic, item) => ({...dic, [item.key]: item.state }), {});

    const onlyRankedLength = listRanked.filter(item => item.state).length;
    const checkOnlyRanked = setCheckOnlyRanked(onlyRankedLength);
    checkboxes3.insertAdjacentHTML('beforeend', checkOnlyRanked);
    const onlyRanked = checkboxes3.querySelector("#onlyRanked");
    const dicRanked = listRanked.reduce((dic, item) => ({...dic, [item.key]: item.state }), {});

    setCheckboxOnly(onlyIsNew, [onlyRanked], dicIsNew);
    setCheckboxOnly(onlyRanked, [onlyIsNew], dicRanked);
}

const getTagLog = (rank, change) => {
    return rank ? `<span class="tagLog">ostatnia poz.: ${rank}` + (change ? ` (${change})` : '') + `</span>` : '';
};


let voteList, mainList, itemDict, leftPanel;
let listIsNew, listRanked;

const addTags = (setList) => {
    voteList = document.querySelector('.top-vote-panel__list-wrapper');
    mainList = [...voteList.querySelectorAll("li > div")];
    itemDict = mainList.reduce((itemDict, item) => ({
        ...itemDict,
        [item.querySelector('input').value]: item
    }), []);

    leftPanel = document.querySelector('#top-patron .top-block__panel');
    const subheading = leftPanel.querySelector('.top-block__subheading');
    const patronStats = leftPanel.querySelector('.top-patron-stats-wrap');
    const patronLinks = leftPanel.querySelector('.top-patron-links');
    const block_media = leftPanel.querySelector('.top-block__media');

    const triggerStats = (chart, state) => {
        patronLinks.hidden = !state;
        block_media.hidden = !state;
        chart.hidden = state;
    }

    listIsNew = setList.reduce((list, item) => item.newGroup ? [...list, { key: item.key, state: !!item.isNew }] : list, []);
    listRanked = setList.reduce((list, item) => item.histGroup ? [...list, { key: item.key, state: !!item.history }] : list, []);

    setList.forEach((item, i) => {
        const {key, isNew, rank, change, year, years, history} = item;
        const element = itemDict[key];

        const itemText = element.querySelector('.top-vote-panel__item-text');
        itemText.style.position = "relative";

        const tagLog = getTagLog(rank, change);
        itemText.insertAdjacentHTML('beforeend', tagLog);

        if (history) {
            patronStats.insertAdjacentHTML('afterend', `<div id="chart-${i}" class="ct-chart" hidden></div>`);
            const chart = leftPanel.querySelector(`#chart-${i}`);
            element.addEventListener('mouseover', (e) => { triggerStats(chart, false) });
            element.addEventListener('mouseout', (e) => { triggerStats(chart, true) });

            const labels = [...Array(listNo-1).keys()].map(x => (x + 2021));
            const series = history.split(",").map(x => -x || null);

            new window.Chartist.Line(chart, {
                labels: labels,
                series: [ series ]
            }, {
                height: '550px',
                width: '550px',
                fullWidth: false,
                fillHoles: false,
                axisY: {
                    low: -375,
                    high: -1,
                    onlyInteger: true,
                    labelInterpolationFnc: value => -value
                }
            });
        }
    });

    addInfoStatus(subheading);
    addCheckboxes(setList);
}

(function() {
    getList(urlSettings).then(setList => {
        let votePanel;
        let items = [];

        const interval = setInterval(() => {
            if (!votePanel) {
                votePanel = document.querySelector('.top-vote-panel');

            } else {
                clearInterval(interval);

                addTags(setList);
            }
        }, 25);
    });
})();
