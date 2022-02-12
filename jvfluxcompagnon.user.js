// ==UserScript==
// @name        JvFlux Compagnon
// @namespace   jvflux
// @version     1.0.1
// @downloadURL https://github.com/Rand0max/jvflux/raw/master/jvfluxcompagnon.user.js
// @updateURL   https://github.com/Rand0max/jvflux/raw/master/jvfluxcompagnon.meta.js
// @author      Rand0max / JvFlux
// @description Intégration du wiki officiel JvFlux au sein des forums JVC
// @icon        https://jvflux.fr/skins/logo_wiki.png
// @match       http://www.jeuxvideo.com/forums/*
// @match       https://www.jeuxvideo.com/forums/*
// @connect     jvflux.fr
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_addStyle
// @grant       GM_deleteValue
// @grant       GM_listValues
// @grant       GM_getResourceText
// @resource    JVFLUX_CSS https://raw.githubusercontent.com/Rand0max/jvflux/master/jvfluxcompagnon.css
// @run-at      document-end
// ==/UserScript==


const jvfluxUrl = 'https://jvflux.fr';
const jvfluxPageListUrl = 'https://archives.jvflux.fr/noreferer/pages.json';

const jvfluxFullPreviewUrl = (page) => `${jvfluxUrl}/api.php?action=query&format=json&prop=info%7Cextracts%7Cpageimages%7Crevisions%7Cinfo&formatversion=2&redirects=true&exintro=true&exchars=525&explaintext=true&exsectionformat=plain&piprop=thumbnail&pithumbsize=480&pilicense=any&rvprop=timestamp&inprop=url&titles=${page}&smaxage=300&maxage=300&uselang=content&pithumbsize=600`;

const storage_init = 'jvfluxcompagnon_init', storage_init_default = false;
const storage_pageList = 'jvfluxcompagnon_pageList', storage_pageList_default = [];
const storage_pageListLastUpdate = 'jvfluxcompagnon_pageListLastUpdate', storage_pageListLastUpdate_default = new Date(0);

const pageListRefreshExpire = 12;

let pageList = [];
let pageListRegex = new RegExp();

const pageExclusions = ['rire', 'rires', 'jvc', 'pseudo', 'pseudos', 'musique', 'musiques', 'supprimer', 'topic', 'topics', 'forum', 'forums', 'forumeur', 'forumeurs', 'up', 'ahi', 'meme', 'même', 'mème', 'afk', 'aka', 'asap', 'btw', 'c/c', 'cad', 'càd', 'dl', 'dtc', 'fdp', 'ftg', 'ftw', 'gg', 'gl', 'hf', 'hs', 'ig', 'lel', 'lmao', 'lmfao', 'lol', 'maj', 'mdp', 'mdr', 'mmo', 'mmog', 'mmorpg', 'màj', 'nl', 'nsfw', 'omd', 'omfg', 'omg', 'over used', 'overused', 'pgm', 'pk', 'rofl', 'rpg', 'tg', 'vdm', 'wow', 'wtf', 'wth'];


String.prototype.escapeRegexPattern = function () {
    return this.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

String.prototype.normalizeDiacritic = function () {
    return this.normalize("NFD").replace(/\p{Diacritic}/gu, '');
}

String.prototype.removeDoubleSpaces = function () {
    return this.replaceAll(/ +(?= )/g, '');
}

String.prototype.capitalize = function () {
    if (this.length === 0) return this;
    const regex = new RegExp(/\p{L}/, 'u');
    const i = this.search(regex);
    if (i < 0) return this;
    return this.substring(0, i) + this.charAt(i).toUpperCase() + this.slice(i + 1);
}

Set.prototype.addArray = function (array) {
    array.forEach(this.add, this);
}


function buildPageListRegex() {
    // \b ne fonctionne pas avec les caractères spéciaux
    const bStart = '(?<=\\W|^)';
    const bEnd = '(?=\\W|$)';
    let regexMap = pageList.map((e) => e.escapeRegexPattern().normalizeDiacritic());
    pageListRegex = new RegExp(`${bStart}(${regexMap.join('|')})${bEnd}`, 'gi');
}

async function queryPageList() {
    let newPageList = await fetch(jvfluxPageListUrl)
        .then(function (response) {
            if (!response.ok) throw Error(response.statusText);
            return response.text();
        })
        .then(function (text) {
            return JSON.parse(text);
        })
        .catch(function (err) {
            console.warn(err);
            return undefined;
        });

    if (!newPageList) return;

    newPageList = newPageList.filter((page) => !pageExclusions.includes(page.toLowerCase()));

    pageList = [...new Set(newPageList)];

    GM_setValue(storage_pageList, JSON.stringify(pageList));
    GM_setValue(storage_pageListLastUpdate, Date.now());
}

function mustRefreshPageList() {
    let pageListLastUpdate = new Date(GM_getValue(storage_pageListLastUpdate, storage_pageListLastUpdate_default));
    let datenow = new Date();
    let dateOneDayOld = new Date(datenow.setHours(datenow.getHours() - pageListRefreshExpire));
    return pageListLastUpdate <= dateOneDayOld;
}

async function loadStorage() {
    pageList = JSON.parse(GM_getValue(storage_pageList, storage_pageList_default));
    if (!pageList?.length || mustRefreshPageList()) await queryPageList();
    buildPageListRegex();
}

async function initStorage() {
    let isInit = GM_getValue(storage_init, storage_init_default);
    if (isInit) {
        await loadStorage();
        return false;
    }
    else {
        await queryPageList();
        buildPageListRegex();
        GM_setValue(storage_init, true);
        return true;
    }
}

function addRightBlocMatches(matches) {
    if (matches?.size === 0) return;

    let html = '';
    html += '<div class="card card-jv-forum card-forum-margin">';
    html += `<div class="card-header">JV FLUX</div>`;
    html += '<div class="card-body">';
    html += '<div class="scrollable">';
    html += '<div class="scrollable-wrapper">';
    html += '<div id="jvflux-matches-content" class="scrollable-content bloc-info-forum">';

    function formatMatches(matches) {
        let formatMatch = (str) => str.removeDoubleSpaces().trim().capitalize();
        let matchesSorted = [...matches].map(formatMatch).sort();
        let matchesHtml = '';
        let index = 0;
        matchesSorted.forEach((match) => {
            const className = `jvflux-match${index < matchesSorted.length - 1 ? ' match-after' : ''}`;
            matchesHtml += buildArticleLink(match, className);
            index++;
        });
        return matchesHtml;
    }

    html += `<div id="jvflux-matches-wrapper">`;
    html += `<div id="jvflux-matched">${formatMatches(matches)}</div>`;
    html += '</div>';

    html += '</div>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
    html += '</div>';

    let matchesBloc = document.createElement('div');
    document.querySelector('#forum-right-col').append(matchesBloc);
    matchesBloc.outerHTML = html;
}

function buildArticleLink(match, className = 'jvflux-link') {
    const articleTitle = findArticleTitle(match);
    const url = `${jvfluxUrl}/${articleTitle.replaceAll(' ', '_')}`;
    return `<a href="${url}" target="_blank" class="xXx ${className}" pagetitle="${articleTitle}" title="Consulter la page &quot;${articleTitle}&quot; dans JV Flux">${match}</a>`;
}

function getAllMessages(doc) {
    let allMessages = doc.querySelectorAll('.conteneur-messages-pagi > div.bloc-message-forum');
    return [...allMessages];
}

function findArticleTitle(match) {
    let articleTitle = pageList.find(p => p.toLowerCase() === match.toLowerCase());
    if (articleTitle?.length > 0) return articleTitle;
    return pageList.find(p => p.toLowerCase().normalizeDiacritic() === match.toLowerCase().normalizeDiacritic());
}

function highlightTextMatches(element, matches) {
    let content = element.textContent;

    // reversed to simplify algo because we set 'content' at each iteration and move the cursor
    matches.reverse().every(match => {
        const normMatch = match[0];
        if (match.index <= -1) return false;
        const realMatchContent = content.slice(match.index, match.index + normMatch.length);
        const newMatchContent = buildArticleLink(realMatchContent);
        content = `${content.slice(0, match.index)}${newMatchContent}${content.slice(match.index + normMatch.length, content.length)}`;
        return true;
    });

    if (element.nodeType == Node.TEXT_NODE) {
        let newNode = document.createElement('a');
        element.parentElement.insertBefore(newNode, element);
        element.remove();
        newNode.outerHTML = content;
    }
    else {
        element.innerHTML = content;
    }
}

function handleMatches(textChild, highlightedMatches) {
    const normContent = textChild.textContent.normalizeDiacritic();
    const matches = [...normContent.matchAll(pageListRegex)];

    const filteredMatches = matches.filter(m => !highlightedMatches.has(m[0]));
    if (filteredMatches.length === 0) return undefined;

    highlightTextMatches(textChild, filteredMatches);

    return filteredMatches.map(m => m[0]);
}

function handleMessageChildren(element, highlightedMatches) {
    const allowedTags = ['P', 'STRONG', 'U', 'I', 'EM', 'B'];
    const getParagraphChildren = (elem) => [...elem.children].filter(c => allowedTags.includes(c.tagName) && c.textContent.trim() !== '');
    const getTextChildren = (elem) => [...elem.childNodes].filter(c => c.nodeType === Node.TEXT_NODE && c.textContent.trim() !== '');

    // Un message contient une balise p pour chaque ligne
    // Un p peut contenir du texte ou du html (img, a, etc ET strong, b, u, etc)

    let paragraphChildren = getParagraphChildren(element);
    paragraphChildren.forEach(paragraph => {
        const textChildren = getTextChildren(paragraph); // on ne s'intéresse qu'au texte
        textChildren.forEach(textChild => {
            // on traite le texte du noeud courant
            let matchesFound = handleMatches(textChild, highlightedMatches);
            if (matchesFound?.length) highlightedMatches.addArray(matchesFound);
        });
        // puis on traite ses enfants

        let subChildRes = handleMessageChildren(paragraph, highlightedMatches);
        if (subChildRes?.length) highlightedMatches.addArray(subChildRes);
    });
    return highlightedMatches;
}

function handleMessage(message) {
    let contentElement = message.querySelector('.txt-msg.text-enrichi-forum');
    if (!contentElement) return;
    return handleMessageChildren(contentElement, new Set());
}

async function previewArticleCallback(pagetitle) {
    const url = jvfluxFullPreviewUrl(pagetitle);

    let previewContent = await fetch(url)
        .then(function (response) {
            if (!response.ok) throw Error(response.statusText);
            return response.text();
        })
        .then(function (res) {
            return JSON.parse(res);
        })
        .catch(function (err) {
            console.warn(err);
            return undefined;
        });

    if (!previewContent) return undefined;

    const resPages = previewContent.query.pages;
    const rootPage = resPages[Object.keys(resPages)[0]];
    const extract = rootPage.extract?.trim();
    const thumbnail = rootPage.thumbnail?.source;

    return { extract: extract, thumbnail: thumbnail };
}

async function onPreviewHover(element) {
    if (!element.hasAttribute('pagetitle') || element.children.length > 0) return;
    const previewContent = await previewArticleCallback(element.getAttribute('pagetitle'));

    if (!previewContent?.extract) return;

    const mwPopupThumbnail = previewContent.thumbnail?.length > 0 ?
        `<a class="mwe-popups-discreet" href="${element.getAttribute('href')}"><img class="mwe-popups-thumbnail" src="${previewContent.thumbnail}"/></a>` : '';

    const mwPopupHtml =
        `<div class="mwe-popups mwe-popups-type-page mwe-popups-fade-in-up mwe-popups-no-image-pointer mwe-popups-is-tall" aria-hidden="">
        <div class="mwe-popups-container">
        ${mwPopupThumbnail}
        <a class="mwe-popups-extract">${previewContent.extract}</a>
        </div>
        </div>`;

    let popupContainer = document.createElement('div');
    element.appendChild(popupContainer);
    popupContainer.outerHTML = mwPopupHtml;
}

async function handleTopicMessages() {
    let allMessages = getAllMessages(document);
    let allMatches = new Set();
    allMessages.forEach((message) => {
        let messageMatches = handleMessage(message);
        messageMatches.forEach((m) => allMatches.add(m.trim().toLowerCase()));
    });
    let allLinks = document.querySelectorAll('.jvflux-link');
    allLinks.forEach(link => {
        link.onclick = () => onPreviewHover(link);
        link.onmouseover = () => onPreviewHover(link);
        link.ontouchstart = () => onPreviewHover(link);
    });
    addRightBlocMatches(allMatches);
}

async function init() {
    await initStorage();
    const jvfluxCss = GM_getResourceText('JVFLUX_CSS');
    GM_addStyle(jvfluxCss);
}

function getCurrentPageType(url) {
    let topicMessagesRegex = /^\/forums\/(42|1)-[0-9]+-[0-9]+-[0-9]+-0-1-0-.*\.htm$/i;
    if (url.match(topicMessagesRegex)) return 'topicmessages';
    return 'unknown';
}

async function entryPoint() {
    //let start = performance.now();
    const currentPageType = getCurrentPageType(`${window.location.pathname}${window.location.search}`);
    if (currentPageType === 'topicmessages') {
        await init();
        await handleTopicMessages();
    }
    //let end = performance.now();
    //console.log(`entryPoint total time = ${end - start} ms`);
}

entryPoint();
