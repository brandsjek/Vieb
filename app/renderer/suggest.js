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
/* global COMMAND CONTEXTMENU HISTORY INPUT MODES SETTINGS TABS UTIL */
"use strict"

const {ipcRenderer} = require("electron")

let suggestions = []
let originalValue = ""

const setUrlValue = url => {
    if (MODES.currentMode() === "explore") {
        document.getElementById("url").value = UTIL.urlToString(url)
    } else {
        document.getElementById("url").value = url
    }
    updateColors()
}

const prevSuggestion = () => {
    const list = [...document.querySelectorAll("#suggest-dropdown div")]
    if (list.length === 0) {
        return
    }
    const selected = list.find(s => s.classList.contains("selected"))
    let id = list.indexOf(selected)
    if (!selected) {
        originalValue = document.getElementById("url").value
        id = list.length
    }
    list.forEach(l => {
        l.className = ""
    })
    if (id === 0) {
        setUrlValue(originalValue)
        return
    }
    list[id - 1].className = "selected"
    list[id - 1].scrollIntoView({"block": "center"})
    setUrlValue(suggestions[id - 1])
}

const nextSuggestion = () => {
    const list = [...document.querySelectorAll("#suggest-dropdown div")]
    if (list.length === 0) {
        return
    }
    const selected = list.find(s => s.classList.contains("selected"))
    let id = list.indexOf(selected)
    if (!selected) {
        originalValue = document.getElementById("url").value
        id = -1
    }
    list.forEach(l => {
        l.className = ""
    })
    if (id === list.length - 1) {
        setUrlValue(originalValue)
        return
    }
    list[id + 1].className = "selected"
    list[id + 1].scrollIntoView({"block": "center"})
    setUrlValue(suggestions[id + 1])
}

const emptySuggestions = () => {
    document.getElementById("suggest-dropdown").scrollTo(0, 0)
    document.getElementById("suggest-dropdown").textContent = ""
    document.getElementById("url").className = ""
    suggestions = []
}

const locationToSuggestion = (base, location) => {
    let absPath = UTIL.joinPath(base, location)
    let fullPath = UTIL.stringToUrl(absPath)
    if (UTIL.isDir(absPath)) {
        fullPath += "/"
        location += "/"
        absPath += "/"
    }
    if (absPath.includes(" ")) {
        absPath = `"${absPath}"`
    }
    return {"url": fullPath, "title": location, "path": absPath}
}

const suggestFiles = location => {
    location = UTIL.expandPath(location.replace(/file:\/*/, "/"))
    if (UTIL.isAbsolutePath(location)) {
        let matching = []
        if (UTIL.dirname(location) !== location) {
            UTIL.listDir(UTIL.dirname(location))?.map(
                p => locationToSuggestion(UTIL.dirname(location), p)) || []
            matching = matching.filter(p => {
                if (!UTIL.basePath(p.url).startsWith(UTIL.basePath(location))) {
                    return false
                }
                return UTIL.basePath(p.url) !== UTIL.basePath(location)
            })
        }
        const inDir = UTIL.listDir(location)?.map(
            p => locationToSuggestion(location, p)) || []
        return [...matching, ...inDir]
    }
    return []
}

const updateColors = search => {
    const urlElement = document.getElementById("url")
    search = search || urlElement.value
    if (MODES.currentMode() === "explore") {
        const local = UTIL.expandPath(search)
        if (search.trim() === "") {
            urlElement.className = ""
        } else if (document.querySelector("#suggest-dropdown div.selected")) {
            urlElement.className = "suggest"
        } else if (search.startsWith("file://")) {
            urlElement.className = "file"
        } else if (UTIL.isUrl(search.trim())) {
            urlElement.className = "url"
        } else if (UTIL.isAbsolutePath(local) && UTIL.pathExists(local)) {
            urlElement.className = "file"
        } else if (UTIL.searchword(search.trim()).word) {
            urlElement.className = "searchwords"
        } else {
            urlElement.className = "search"
        }
    }
}

const suggestExplore = search => {
    emptySuggestions()
    updateColors(search)
    if (!SETTINGS.get("suggestexplore") || !search.trim()) {
        // Don't suggest if the limit is set to zero or if the search is empty
        return
    }
    if (["all", "explore"].includes(SETTINGS.get("suggestfiles"))) {
        if (SETTINGS.get("suggestfilesfirst")) {
            suggestFiles(search).forEach(f => addExplore(f))
        }
        HISTORY.suggestHist(search)
        if (!SETTINGS.get("suggestfilesfirst")) {
            suggestFiles(search).forEach(f => addExplore(f))
        }
    } else {
        HISTORY.suggestHist(search)
    }
}

const addExplore = explore => {
    if (suggestions.length + 1 > SETTINGS.get("suggestexplore")) {
        return
    }
    if (suggestions.includes(explore.url)) {
        return
    }
    suggestions.push(explore.url)
    const element = document.createElement("div")
    element.className = "no-focus-reset"
    element.addEventListener("mouseup", e => {
        if (e.button === 2) {
            CONTEXTMENU.linkMenu({"x": e.x, "y": e.y, "link": explore.url})
        } else {
            MODES.setMode("normal")
            CONTEXTMENU.clear()
        }
        if (e.button === 0) {
            TABS.navigateTo(explore.url)
        }
        if (e.button === 1) {
            TABS.addTab({"url": explore.url})
        }
        e.preventDefault()
    })
    if (explore.icon && SETTINGS.get("favicons") !== "disabled") {
        const thumbnail = document.createElement("img")
        thumbnail.className = "icon"
        thumbnail.src = explore.icon
        element.appendChild(thumbnail)
    }
    const title = document.createElement("span")
    title.className = "title"
    title.textContent = explore.title
    element.appendChild(title)
    const url = document.createElement("span")
    url.className = "url"
    if (explore.url.startsWith("file://")) {
        url.className = "file"
    }
    url.textContent = UTIL.urlToString(explore.url)
    element.appendChild(url)
    document.getElementById("suggest-dropdown").appendChild(element)
    setTimeout(() => {
        element.style.pointerEvents = "auto"
    }, 100)
}

const suggestCommand = search => {
    emptySuggestions()
    // Remove all redundant spaces
    // Allow commands prefixed with :
    search = search.replace(/^[\s|:]*/, "").replace(/ +/g, " ")
    const {valid, confirm, command, args} = COMMAND.parseAndValidateArgs(search)
    const urlElement = document.getElementById("url")
    if (valid) {
        urlElement.className = ""
    } else {
        urlElement.className = "invalid"
    }
    if (!SETTINGS.get("suggestcommands") || !search) {
        // Don't suggest when it's disabled or the search is empty
        return
    }
    // List all commands unconditionally
    COMMAND.commandList().filter(
        c => c.startsWith(search)).forEach(c => addCommand(c))
    // Command: set
    if ("set".startsWith(command) && !confirm) {
        if (args.length) {
            SETTINGS.suggestionList()
                .filter(s => s.startsWith(args[args.length - 1]))
                .map(s => `${command} ${args.slice(0, -1).join(" ")} ${s}`
                    .replace(/ +/g, " "))
                .forEach(c => addCommand(c))
        } else {
            SETTINGS.suggestionList().map(s => `${command} ${s}`)
                .forEach(c => addCommand(c))
        }
    }
    // Command: write
    if ("write".startsWith(command) && !confirm && args.length < 2) {
        let location = UTIL.expandPath(args[0]?.replace(/w[a-z]* ?/, "") || "")
        if (!location) {
            addCommand("write ~")
            addCommand("write /")
            addCommand(`write ${SETTINGS.get("downloadpath")}`)
        }
        if (!UTIL.isAbsolutePath(location)) {
            location = UTIL.joinPath(SETTINGS.get("downloadpath"), location)
        }
        suggestFiles(location).forEach(l => addCommand(`write ${l.path}`))
    }
    // Command: mkviebrc
    if ("mkviebrc full".startsWith(search)) {
        addCommand("mkviebrc full")
    }
    // Command: extensions
    if ("extensions".startsWith(command) && !confirm && args.length < 3) {
        if (args.length < 2) {
            for (const action of ["install", "list", "remove"]) {
                if (action.startsWith(args[0] || "") && action !== args[0]) {
                    addCommand(`extensions ${action}`)
                }
            }
        }
        if (args.length >= 1) {
            ipcRenderer.sendSync("list-extensions").forEach(e => {
                const id = e.path.replace(/\/$/g, "").replace(/^.*\//g, "")
                if (`remove ${id}`.startsWith(args.join(" "))) {
                    addCommand(`extensions remove ${id}`,
                        `${e.name}: ${e.version}`)
                }
            })
        }
    }
    // Command: call
    if ("call".startsWith(command) && !confirm) {
        INPUT.listSupportedActions().filter(
            action => `${command} ${action.replace(/(^<|>$)/g, "")}`.startsWith(
                `${command} ${args.join(" ")}`.trim()))
            .forEach(action => addCommand(`call ${action}`))
    }
    // Command: devtools
    if ("devtools".startsWith(command) && !confirm && args.length < 2) {
        const options = ["window", "split", "vsplit", "tab"]
        options.forEach(option => {
            if (!args[0] || option.startsWith(args[0])) {
                addCommand(`devtools ${option}`)
            }
        })
    }
    // Command: colorscheme
    if ("colorscheme".startsWith(command)) {
        if (args.length > 1 || confirm) {
            return
        }
        const themes = {}
        UTIL.listDir(UTIL.joinPath(__dirname, "../colors/"))?.forEach(p => {
            themes[p.replace(/\.css$/g, "")] = "built-in"
        })
        const customDirs = [
            UTIL.joinPath(UTIL.appData(), "colors"),
            UTIL.expandPath("~/.vieb/colors")
        ]
        customDirs.forEach(dir => {
            UTIL.listDir(dir)?.filter(p => p.endsWith(".css")).forEach(p => {
                const location = UTIL.joinPath(dir, p)
                if (p === "default.css" || !UTIL.readFile(location)) {
                    return
                }
                themes[p.replace(/\.css$/g, "")] = location
            })
        })
        Object.keys(themes).forEach(t => {
            if (t.startsWith(args[0] || "")) {
                addCommand(`colorscheme ${t}`, themes[t])
            }
        })
    }
    // Command: delcommand
    if ("delcommand".startsWith(command)) {
        if (args.length > 1 || confirm) {
            return
        }
        COMMAND.customCommandsAsCommandList().split("\n")
            .filter(cmd => cmd.split(" ")[0] === "command")
            .map(cmd => cmd.split(" ")[1])
            .filter(cmd => !args[0] || cmd.startsWith(args[0]))
            .forEach(cmd => addCommand(`delcommand ${cmd}`))
    }
    // Command: help
    if ("help".startsWith(command) && !confirm) {
        [
            "intro",
            "commands",
            "settings",
            "actions",
            "settingcommands",
            "specialpages",
            "mappings",
            "key-codes",
            "<>",
            "customcommands",
            "splits",
            "viebrc",
            "datafolder",
            "erwic",
            "modes",
            "scrolling",
            "navigation",
            "splitting",
            "pointer",
            "menu",
            "license",
            "mentions",
            ...COMMAND.commandList().map(c => `:${c}`),
            ...INPUT.listSupportedActions(),
            ...Object.values(SETTINGS.settingsWithDefaults()).map(s => s.name),
            ...COMMAND.commandList()
        ].filter(section => `${command} ${section}`.startsWith(
            `${command} ${args.join(" ")}`.trim())
        ).forEach(section => addCommand(`help ${section}`))
    }
    // Command: buffer, hide, Vexplore, Sexplore, split, vsplit etc.
    const bufferCommand = [
        "buffer",
        "hide",
        "mute",
        "pin",
        "Vexplore",
        "Sexplore",
        "split",
        "suspend",
        "vsplit",
        "close"
    ].find(b => b.startsWith(command))
    if (bufferCommand && !confirm) {
        const simpleSearch = args.join("").replace(/\W/g, "").toLowerCase()
        TABS.listTabs().filter(tab => {
            if (["close", "buffer", "mute", "pin"].includes(bufferCommand)) {
                return true
            }
            if (bufferCommand === "hide") {
                return tab.classList.contains("visible-tab")
            }
            return !tab.classList.contains("visible-tab")
        }).map(t => ({
            "command": `${bufferCommand} ${TABS.listTabs().indexOf(t)}`,
            "subtext": `${t.querySelector("span").textContent}`,
            "url": TABS.tabOrPageMatching(t).src
        })).filter((t, i) => {
            if (t.command.startsWith(search) || String(i) === simpleSearch) {
                return true
            }
            const simpleTabUrl = t.url.replace(/\W/g, "").toLowerCase()
            if (simpleTabUrl.includes(simpleSearch)) {
                return true
            }
            const simpleTabTitle = t.subtext.replace(/\W/g, "").toLowerCase()
            return simpleTabTitle.includes(simpleSearch)
        }).forEach(t => addCommand(t.command, t.subtext))
    }
}

const addCommand = (command, subtext) => {
    if (suggestions.length + 1 > SETTINGS.get("suggestcommands")) {
        return
    }
    if (suggestions.includes(command)) {
        return
    }
    suggestions.push(command)
    const element = document.createElement("div")
    element.className = "no-focus-reset"
    element.addEventListener("mouseup", e => {
        if (e.button === 2) {
            CONTEXTMENU.commandMenu({"x": e.x, "y": e.y, "command": command})
        } else {
            MODES.setMode("normal")
            COMMAND.execute(command)
            CONTEXTMENU.clear()
        }
        e.preventDefault()
    })
    const commandElement = document.createElement("span")
    commandElement.textContent = command
    element.appendChild(commandElement)
    const subtextElement = document.createElement("span")
    subtextElement.textContent = subtext
    subtextElement.className = "file"
    element.appendChild(subtextElement)
    document.getElementById("suggest-dropdown").appendChild(element)
    setTimeout(() => {
        element.style.pointerEvents = "auto"
    }, 100)
}

module.exports = {
    prevSuggestion,
    nextSuggestion,
    emptySuggestions,
    addExplore,
    suggestExplore,
    suggestCommand
}
