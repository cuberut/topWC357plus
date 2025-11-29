// ==UserScript==
// @name         TOPWC357+
// @version      0.1
// @author       cuberut
// @description  Wspomaganie głosowania w Topie Wszech Czasów
// @match        https://radio357.pl/top/
// @updateURL    https://raw.githubusercontent.com/cuberut/top357plus/main/top357plus.js
// @downloadURL  https://raw.githubusercontent.com/cuberut/top357plus/main/top357plus.js
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

const urlApi = 'https://opensheet.elk.sh/1QowctHMudG7aoB5v3FZcTR0nxadd9VRkci_CahGtIOA/';
const urlSettings = `${urlApi}/settings`;
const urlGroups = `${urlApi}/groups`;
const listNo = 5;

const getList = async (url) => {
    const response = await fetch(url);
    const myJson = await response.json();
    return await myJson;
}

const getTagLog = (rank, change) => {
    return rank ? `<span class="tagLog">ostatnia poz.: ${rank}` + (change ? ` (${change})` : '') + `</span>` : '';
};


let voteList, mainList, itemDict;

const addTags = (setList) => {
    voteList = document.querySelector('#top-patron');
    mainList = [...voteList.querySelectorAll("li > div")];
    itemDict = mainList.reduce((itemDict, item) => ({
        ...itemDict,
        [item.querySelector('input').value]: item
    }), []);

    const leftPanel = document.querySelector('#top-patron .top-block__panel');
    const patronStats = leftPanel.querySelector('.top-patron-stats-wrap');
    const patronLinks = leftPanel.querySelector('.top-patron-links');
    const block_media = leftPanel.querySelector('.top-block__media');

    const triggerStats = (chart, state) => {
        patronLinks.hidden = !state;
        block_media.hidden = !state;
        chart.hidden = state;
    }

    setList.forEach((item, i) => {
        const {key, isNew, rank, change, year, years, vote, history} = item;
        const element = itemDict[key];

        const itemText = element.querySelector('.top-vote-panel__item-text');
        itemText.style.position = "relative";

        const tagLog = getTagLog(rank, change);
        itemText.insertAdjacentHTML('beforeend', tagLog);

        if (vote) {
            element.querySelector('input')?.click();
        }

        if (change) {
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
}

(function() {
    getList(urlSettings).then(setList => {
        let voteList;
        let items = [];

        const interval = setInterval(() => {
            if (!voteList) {
                voteList = document.querySelector('.top-vote-panel');

            } else {
                clearInterval(interval);

                addTags(setList);
            }
        }, 25);
    });
})();
