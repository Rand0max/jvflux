// ==UserScript==
// @name        JvFlux Compagnon
// @namespace   jvflux
// @version     0.0.2
// @downloadURL https://github.com/Rand0max/jvfluxcompagnon/raw/master/jvfluxcompagnon.user.js
// @updateURL   https://github.com/Rand0max/jvfluxcompagnon/raw/master/jvfluxcompagnon.meta.js
// @author      Rand0max / JvFlux
// @description Intégration du wiki officiel JvFlux au sein des forums JVC
// @icon        https://jvflux.fr/skins/logo_wiki.png
// @match       http://www.jeuxvideo.com/forums/*
// @match       https://www.jeuxvideo.com/forums/*
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_addStyle
// @grant       GM_deleteValue
// @grant       GM_listValues
// @grant       GM_getResourceText
// @resource    JVFLUX_CSS https://raw.githubusercontent.com/Rand0max/jvfluxcompagnon/master/jvfluxcompagnon.css
// @run-at      document-end
// ==/UserScript==


const jvfluxUrl = 'https://jvflux.fr';
const jvfluxPageListUrl = 'https://archives.jvflux.fr/noreferer/pages.json';

const storage_init = 'jvfluxcompagnon_init', storage_init_default = false;
const storage_pageList = 'jvfluxcompagnon_pageList', storage_pageList_default = [];
const storage_pageListLastUpdate = 'jvfluxcompagnon_pageListLastUpdate', storage_pageListLastUpdate_default = new Date(0);

let pageList = [];
let pageListRegex = new RegExp();

const pageExclusions = ['Pseudo', 'Pseudos', 'Musique', 'Musiques', 'Supprimer', 'Topic', 'Topics', 'Forum', 'Forums', 'Forumeur', 'Forumeurs', 'Up', 'Ahi', 'Meme', 'Même', 'Mème', 'Afk', 'Aka', 'Asap', 'Btw', 'C/C', 'Cad', 'Càd', 'Dl', 'Dtc', 'Fdp', 'Ftg', 'Ftw', 'Gg', 'Gl', 'Hf', 'Hs', 'Ig', 'Lel', 'Lmao', 'Lmfao', 'Lol', 'Maj', 'Mdp', 'Mdr', 'Mmo', 'Mmog', 'Mmorpg', 'Màj', 'Nl', 'Nsfw', 'Omd', 'Omfg', 'Omg', 'Over Used', 'Overused', 'Pgm', 'Pk', 'Rofl', 'Rpg', 'Tg', 'Vdm', 'Wow', 'Wtf', 'Wth'];


String.prototype.escapeRegexPattern = function () {
    return this.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

String.prototype.normalizeDiacritic = function () {
    return this.normalize("NFD").replace(/\p{Diacritic}/gu, '');
}

Set.prototype.addArray = function (array) {
    array.forEach(this.add, this);
}

String.prototype.toTitleCase = function () {
    if (this.length === 0) return this;
    const regex = new RegExp(/\p{L}/, 'u');
    const i = this.search(regex);
    if (i < 0) return this;
    return this.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.substring(1)).join(' ');
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

    newPageList = newPageList.filter((el) => !pageExclusions.includes(el));

    pageList = [...new Set(newPageList)];

    GM_setValue(storage_pageList, JSON.stringify(pageList));
    GM_setValue(storage_pageListLastUpdate, Date.now());
}

function mustRefreshPageList() {
    let pageListLastUpdate = new Date(GM_getValue(storage_pageListLastUpdate, storage_pageListLastUpdate_default));
    let datenow = new Date();
    let dateOneDayOld = new Date(datenow.setHours(datenow.getHours() - 24));
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

function getAllMessages(doc) {
    let allMessages = doc.querySelectorAll('.conteneur-messages-pagi > div.bloc-message-forum');
    return [...allMessages];
}

function highlightTextMatches(element, matches) {
    let content = element.textContent;

    // reversed to simplify algo because we set 'content' at each iteration and move the cursor
    matches.reverse().every(match => {
        const normMatch = match[0];
        if (match.index <= -1) return false;
        const realMatchContent = content.slice(match.index, match.index + normMatch.length);
        const url = `${jvfluxUrl}/${realMatchContent.toTitleCase().replaceAll(' ', '_')}`;
        const newMatchContent = `<a href="${url}" target="_blank" class="xXx jvflux-link" title="Consulter la page &quot;${realMatchContent}&quot; dans JvFlux">${realMatchContent}</a>`;
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
    if (!filteredMatches?.length) return undefined;

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
    handleMessageChildren(contentElement, new Set());
}

async function handleTopicMessages() {
    let allMessages = getAllMessages(document);
    allMessages.forEach(function (message) {
        handleMessage(message);
    });
}

async function init() {
    await initStorage();
    const jvfluxCss = GM_getResourceText('JVFLUX_CSS');
    GM_addStyle(jvfluxCss ?? '.jvflux-link {color: #fe9f10;}');
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