/*
* Vieb - Vim Inspired Electron Browser
* Copyright (C) 2019-2021 Jelmer van Arnhem
*
* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU General Public License as published by
* the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU General Public License for more details.
*
* You should have received a copy of the GNU General Public License
* along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
/* global COMMAND COMMANDHISTORY CONTEXTMENU EXPLOREHISTORY FOLLOW MODES
 PAGELAYOUT SETTINGS SUGGEST TABS UTIL */
"use strict"

const {clipboard, ipcRenderer} = require("electron")

let currentSearch = ""

const emptySearch = () => {
    TABS.currentPage()?.stopFindInPage("clearSelection")
    currentSearch = ""
}

const clickOnSearch = () => {
    if (currentSearch) {
        TABS.currentPage()?.send("search-element-click")
    }
}

const increasePageNumber = () => new Promise(res => {
    TABS.currentPage()?.send("action",
        "increasePageNumber", TABS.currentPage().src)
    setTimeout(res, 100)
})

const previousTab = () => {
    TABS.switchToTab(TABS.listTabs().indexOf(TABS.currentTab()) - 1)
}

const closeTab = () => TABS.closeTab()

const toExploreMode = () => MODES.setMode("explore")

const startFollowCurrentTab = () => FOLLOW.startFollow(false)

const scrollTop = () => TABS.currentPage()?.send("action", "scrollTop")

const insertAtFirstInput = () => TABS.currentPage()?.send("focus-input")

const scrollLeft = () => TABS.currentPage()?.send("action", "scrollLeft")

const toInsertMode = () => MODES.setMode("insert")

const scrollDown = () => TABS.currentPage()?.send("action", "scrollDown")

const scrollUp = () => TABS.currentPage()?.send("action", "scrollUp")

const scrollRight = () => TABS.currentPage()?.send("action", "scrollRight")

const nextSearchMatch = () => {
    if (currentSearch) {
        TABS.currentPage()?.findInPage(currentSearch, {
            "findNext": true, "matchCase": !SETTINGS.get("ignorecase")
        })
    }
}

const reload = (customPage = null) => {
    const page = customPage || TABS.currentPage()
    if (page && !page.isCrashed() && !page.src.startsWith("devtools://")) {
        page.reload()
        TABS.resetTabInfo(page)
    }
}

const openNewTab = () => TABS.addTab()

const reopenTab = () => TABS.reopenTab()

const nextTab = () => {
    TABS.switchToTab(TABS.listTabs().indexOf(TABS.currentTab()) + 1)
}

const decreasePageNumber = () => new Promise(res => {
    TABS.currentPage()?.send("action",
        "decreasePageNumber", TABS.currentPage().src)
    setTimeout(res, 100)
})

const toSearchMode = () => {
    MODES.setMode("search")
    document.getElementById("url").value = currentSearch
    document.getElementById("url").select()
}

const startFollowNewTab = () => FOLLOW.startFollow(true)

const scrollBottom = () => TABS.currentPage()?.send("action", "scrollBottom")

const backInHistory = (customPage = null) => {
    const page = customPage || TABS.currentPage()
    if (page && !page.isCrashed()) {
        if (page?.canGoBack() && !page.src.startsWith("devtools://")) {
            TABS.tabOrPageMatching(page).querySelector("span").textContent = ""
            page.goBack()
            TABS.resetTabInfo(page)
        }
    }
}

const forwardInHistory = (customPage = null) => {
    const page = customPage || TABS.currentPage()
    if (page && !page.isCrashed()) {
        if (page?.canGoForward() && !page.src.startsWith("devtools://")) {
            TABS.tabOrPageMatching(page).querySelector("span").textContent = ""
            page.goForward()
            TABS.resetTabInfo(page)
        }
    }
}

const previousSearchMatch = () => {
    if (currentSearch) {
        TABS.currentPage()?.findInPage(currentSearch, {
            "forward": false,
            "findNext": true,
            "matchCase": !SETTINGS.get("ignorecase")
        })
    }
}

const reloadWithoutCache = () => {
    if (TABS.currentPage() && !TABS.currentPage().isCrashed()) {
        if (!TABS.currentPage().src.startsWith("devtools://")) {
            TABS.currentPage().reloadIgnoringCache()
            TABS.resetTabInfo(TABS.currentPage())
        }
    }
}

const openNewTabWithCurrentUrl = () => {
    const url = TABS.currentPage()?.src || ""
    TABS.addTab()
    MODES.setMode("explore")
    document.getElementById("url").value = UTIL.urlToString(url)
}

const scrollPageRight = () => {
    TABS.currentPage()?.send("action", "scrollPageRight")
}

const scrollPageLeft = () => {
    TABS.currentPage()?.send("action", "scrollPageLeft")
}

const toCommandMode = () => MODES.setMode("command")

const scrollPageUp = () => TABS.currentPage()?.send("action", "scrollPageUp")

const stopLoadingPage = () => TABS.currentPage()?.stop()

const scrollPageDownHalf = () => {
    TABS.currentPage()?.send("action", "scrollPageDownHalf")
}

const scrollPageDown = () => {
    TABS.currentPage()?.send("action", "scrollPageDown")
}

const moveTabForward = () => TABS.moveTabForward()

const moveTabBackward = () => TABS.moveTabBackward()

const scrollPageUpHalf = () => {
    TABS.currentPage()?.send("action", "scrollPageUpHalf")
}

const zoomReset = () => TABS.currentPage()?.setZoomLevel(0)

const zoomOut = () => {
    let level = TABS.currentPage().getZoomLevel() - 1
    if (level < -7) {
        level = -7
    }
    TABS.currentPage().setZoomLevel(level)
}

const zoomIn = () => {
    let level = TABS.currentPage().getZoomLevel() + 1
    if (level > 7) {
        level = 7
    }
    TABS.currentPage().setZoomLevel(level)
}

const toNormalMode = () => MODES.setMode("normal")

const stopFollowMode = () => {
    if (MODES.currentMode() === "follow") {
        MODES.setMode(FOLLOW.getModeBeforeFollow())
    } else {
        MODES.setMode("normal")
    }
}

const editWithVim = () => {
    const page = TABS.currentPage()
    if (!page) {
        return
    }
    const fileFolder = UTIL.joinPath(UTIL.appData(), "vimformedits")
    UTIL.makeDir(fileFolder)
    const tempFile = UTIL.joinPath(fileFolder, String(Number(new Date())))
    const success = UTIL.writeFile(tempFile, "")
    if (!success) {
        UTIL.notify("Could not start vim edit mode", "err")
        return
    }
    let command = null
    UTIL.watchFile(tempFile, {"interval": 500}, () => {
        if (command) {
            const contents = UTIL.readFile(tempFile)
            if (contents === null) {
                UTIL.notify("Failed to read temp file to fill form", "err")
            } else {
                page.send("action", "setInputFieldText", contents)
            }
        } else {
            const {exec} = require("child_process")
            command = exec(`${SETTINGS.get("vimcommand")} ${tempFile}`, err => {
                if (err) {
                    UTIL.notify("Command to edit files with vim failed, "
                        + "please update the 'vimcommand' setting", "err")
                }
            })
        }
    })
    page.send("action", "writeInputToFile", tempFile)
}

const openLinkExternal = (suppliedLink = null) => {
    const ext = SETTINGS.get("externalcommand")
    if (!ext.trim()) {
        UTIL.notify("No command set to open links externally, "
            + "please update the 'externalcommand' setting", "warn")
        return
    }
    const url = suppliedLink || document.getElementById("url-hover").textContent
        || UTIL.urlToString(TABS.currentPage()?.src)
    const {exec} = require("child_process")
    if (url) {
        exec(`${ext} ${url}`, err => {
            if (err) {
                UTIL.notify("Command to open links externally failed, "
                    + "please update the 'externalcommand' setting", "err")
            }
        })
    }
}
const nextSuggestion = () => {
    SUGGEST.nextSuggestion()
    setFocusCorrectly()
}

const prevSuggestion = () => {
    SUGGEST.prevSuggestion()
    setFocusCorrectly()
}

const commandHistoryPrevious = () => COMMANDHISTORY.previous()

const commandHistoryNext = () => COMMANDHISTORY.next()

const exploreHistoryPrevious = () => EXPLOREHISTORY.previous()

const exploreHistoryNext = () => EXPLOREHISTORY.next()

const rotateSplitWindow = () => PAGELAYOUT.rotate()

const leftHalfSplitWindow = () => PAGELAYOUT.toTop("left")

const bottomHalfSplitWindow = () => PAGELAYOUT.toTop("bottom")

const topHalfSplitWindow = () => PAGELAYOUT.toTop("top")

const rightHalfSplitWindow = () => PAGELAYOUT.toTop("right")

const toLeftSplitWindow = () => PAGELAYOUT.moveFocus("left")

const toBottomSplitWindow = () => PAGELAYOUT.moveFocus("bottom")

const toTopSplitWindow = () => PAGELAYOUT.moveFocus("top")

const toRightSplitWindow = () => PAGELAYOUT.moveFocus("right")

const increaseHeightSplitWindow = () => PAGELAYOUT.resize("ver", "grow")

const decreaseHeightSplitWindow = () => PAGELAYOUT.resize("ver", "shrink")

const increaseWidthSplitWindow = () => PAGELAYOUT.resize("hor", "grow")

const decreaseWidthSplitWindow = () => PAGELAYOUT.resize("hor", "shrink")

const distrubuteSpaceSplitWindow = () => PAGELAYOUT.resetResizing()

const toggleFullscreen = () => {
    ipcRenderer.invoke("toggle-fullscreen").then(SETTINGS.updateGuiVisibility)
}

const incrementalSearch = () => {
    currentSearch = document.getElementById("url").value
    if (TABS.currentPage() && currentSearch.trim()) {
        TABS.currentPage().stopFindInPage("clearSelection")
        TABS.currentPage().findInPage(currentSearch, {
            "matchCase": !SETTINGS.get("ignorecase")
        })
    } else {
        currentSearch = ""
        TABS.currentPage()?.stopFindInPage("clearSelection")
    }
}

const pageToClipboard = () => clipboard.writeText(
    UTIL.urlToString(TABS.currentPage()?.src))

const openFromClipboard = () => {
    if (clipboard.readText().trim()) {
        TABS.navigateTo(UTIL.stringToUrl(clipboard.readText()))
    }
}

const reorderFollowLinks = () => FOLLOW.reorderDisplayedLinks()

const menuUp = () => CONTEXTMENU.up()

const menuDown = () => CONTEXTMENU.down()

const menuSelect = () => CONTEXTMENU.select()

const menuClose = () => CONTEXTMENU.clear()

const useEnteredData = () => {
    if (MODES.currentMode() === "command") {
        const command = document.getElementById("url").value.trim()
        MODES.setMode("normal")
        COMMAND.execute(command)
    }
    if (MODES.currentMode() === "search") {
        incrementalSearch()
        MODES.setMode("normal")
    }
    if (MODES.currentMode() === "explore") {
        const urlElement = document.getElementById("url")
        let location = urlElement.value.trim()
        MODES.setMode("normal")
        if (location) {
            location = UTIL.searchword(location).url
            TABS.navigateTo(UTIL.stringToUrl(location))
            EXPLOREHISTORY.push(UTIL.stringToUrl(location))
        }
    }
}

const setFocusCorrectly = () => {
    const urlElement = document.getElementById("url")
    TABS.updateUrl(TABS.currentPage())
    if (MODES.currentMode() === "insert") {
        urlElement.blur()
        TABS.currentPage()?.focus()
        if (!document.getElementById("context-menu").innerText) {
            TABS.currentPage()?.click()
        }
    } else if (["search", "explore", "command"].includes(MODES.currentMode())) {
        if (document.activeElement !== urlElement) {
            window.focus()
            urlElement.focus()
        }
    } else {
        urlElement.blur()
        window.focus()
        if (!SETTINGS.get("mouse")) {
            document.getElementById("invisible-overlay").focus()
        }
    }
}

module.exports = {
    toCommandMode,
    toExploreMode,
    toInsertMode,
    toSearchMode,
    toNormalMode,
    startFollowCurrentTab,
    startFollowNewTab,
    stopFollowMode,
    scrollTop,
    scrollBottom,
    scrollUp,
    scrollDown,
    scrollLeft,
    scrollRight,
    scrollPageUp,
    scrollPageDown,
    scrollPageLeft,
    scrollPageRight,
    scrollPageUpHalf,
    scrollPageDownHalf,
    reload,
    reloadWithoutCache,
    stopLoadingPage,
    openNewTab,
    openNewTabWithCurrentUrl,
    closeTab,
    reopenTab,
    nextTab,
    previousTab,
    moveTabForward,
    moveTabBackward,
    backInHistory,
    forwardInHistory,
    zoomReset,
    zoomIn,
    zoomOut,
    rotateSplitWindow,
    leftHalfSplitWindow,
    bottomHalfSplitWindow,
    topHalfSplitWindow,
    rightHalfSplitWindow,
    toLeftSplitWindow,
    toBottomSplitWindow,
    toTopSplitWindow,
    toRightSplitWindow,
    increaseHeightSplitWindow,
    decreaseHeightSplitWindow,
    increaseWidthSplitWindow,
    decreaseWidthSplitWindow,
    distrubuteSpaceSplitWindow,
    emptySearch,
    incrementalSearch,
    clickOnSearch,
    nextSearchMatch,
    previousSearchMatch,
    increasePageNumber,
    decreasePageNumber,
    insertAtFirstInput,
    editWithVim,
    openLinkExternal,
    nextSuggestion,
    prevSuggestion,
    commandHistoryPrevious,
    commandHistoryNext,
    exploreHistoryPrevious,
    exploreHistoryNext,
    toggleFullscreen,
    pageToClipboard,
    openFromClipboard,
    reorderFollowLinks,
    menuUp,
    menuDown,
    menuSelect,
    menuClose,
    useEnteredData,
    setFocusCorrectly
}
