/***
|Description|checks and reports updates of installed extensions on startup, introduces a macro/backstage button to explore, install and update extensions|
|Version    |0.7.0|
|Author     |Yakov Litvin|
|Source     |https://github.com/YakovL/TiddlyWiki_ExtensionsExplorerPlugin/blob/master/ExtensionsExplorerPlugin.js|
|License    |[[MIT|https://github.com/YakovL/TiddlyWiki_YL_ExtensionsCollection/blob/master/Common%20License%20(MIT)]]|
!!!Installation & configuration
Installation of the plugin is as usual: import the tiddler or copy and tag it with {{{systemConfig}}}; reload TW.

!!!What EEP does, how to use it
Once you install this plugin, on startup, it will try to check if installed extensions have any updates available and report if it finds any. An update of a particular extension is looked up by the url in the Source slice (see this tiddler for example). EEP will recognize an "update" if it finds the content by that url, and that content has a Version slice and the version is higher than the installed one (like: 0.4.2 is higher than 0.3.9; 0.0.1 is also higher than none).

It also adds "explore extensions" in the backstage (and the {{{<<extensionsExplorer>>}}} macro with the same interface) that shows some extensions available for installation and the list of installed plugins with buttons to check for updates.

Note: With some TW savers/servers, loading an extension may fail if its author hasn't enabled CORS on the server pointed by Source.

!!!For extension authors: how to prepare extensions and repositories
To make EEP find updates for your extensions, you have to
# put it somewhere in the internet:
** the server should have CORS enabled (~GitHub is fine);
** the extension should be in either form: "plain text" (.js or .txt file extension) or a tiddler in a TW (.html extension);
# ensure that the extension has a Source slice with a url that points to itself (i.e. where to look for the latest version):
** for plain text, one can use a direct url, like: https://raw.githubusercontent.com/YakovL/TiddlyWiki_ShowUnsavedPlugin/master/ShowUnsavedPlugin.js;
** for ~GitHub, one can also use the url of the UI page (i.e. navigate to it via ~GitHub UI and copy the address): https://github.com/YakovL/TiddlyWiki_ShowUnsavedPlugin/blob/master/ShowUnsavedPlugin.js;
** for a tiddler inside a TW, use a permalink, like: https://TiddlyTools.com/Classic/#NestedSlidersPlugin (note that the Source slice in this plugin is in fact outdated: http://www.TiddlyTools.com/#NestedSlidersPlugin – you should avoid that as this will break the updating flow);
** for a tiddler inside a TW on ~GitHub, use ~GitHub Pages (this is in fact how ~TiddlyTools is served, they just use a custom domain; an example of an "ordinary" url: https://yakovl.github.io/TiddlyWiki_ExtraFilters/#ExtraFiltersPlugin);
** for your dev flow, it may be useful to put the plugin to ~GitHub as a .js file and load it into the demo TW via [[TiddlerInFilePlugin|https://github.com/YakovL/TiddlyWiki_TiddlerInFilePlugin]]. An example of such setup can be found [[here|https://github.com/YakovL/TiddlyWiki_FromPlaceToPlacePlugin]].

***/
//{{{
// Returns the slice value if it is present or defaultText otherwise
//
Tiddler.prototype.getSlice = Tiddler.prototype.getSlice || function(sliceName, defaultText) {
	let re = TiddlyWiki.prototype.slicesRE, m
	re.lastIndex = 0
	while(m = re.exec(this.text)) {
		if(m[2]) {
			if(m[2] == sliceName) return m[3]
		} else {
			if(m[5] == sliceName) return m[6]
		}
	}
	return defaultText
}

const centralSourcesListName = "AvailableExtensions"

config.macros.extensionsExplorer = {
	lingo: {
		backstageButtonLabel: "explore extensions",
		backstageButtonTooltip: "See if there are any updates or install new ones",
		installButtonLabel: "install",
		installButtonPrompt: "get and install this extension",
		otherActionsPrompt: "show other actions",
		getFailedToLoadMsg: name => "failed to load " + name,
		getSucceededToLoadMsg: name => `loaded ${name}, about to import and install...`,
		noSourceUrlAvailable: "no source url",
		getEvalSuccessMsg: name => `Successfully installed ${name} (reload is not necessary)`,
		getEvalFailMsg: (name, error) => `${name} failed with error: ${error}`,
		getImportSuccessMsg: (title, versionString, isUpdated) => isUpdated ?
			`Updated ${title}${versionString ? " to " + versionString : ""}` :
			`Imported ${title}${versionString ? " v" + versionString : ""}`,

		updateButtonCheckLabel: "check",
		updateButtonCheckPrompt: "check for updates",
		updateButtonUpdateLabel: "update",
		updateButtonUpdatePrompt: "install available update",
		getUpdateAvailableMsg: name => `update of ${name} is available!`,
		getUpdateAvailableAndVersionsMsg: (existingTiddler, newTiddler) => {
			const getVersionString = config.macros.extensionsExplorer.getVersionString
			return `update of ${existingTiddler.title} is available ` +
				"(current version: " + getVersionString(existingTiddler) +
				", available version: " + getVersionString(newTiddler) + ")"
		},
		updateNotAvailable: "update is not available",
		getUpdateConfirmMsg: (title, loadedVersion, presentVersion) => {
			const loadedVersionString = loadedVersion ? formatVersion(loadedVersion) : ""
			const presentVersionString = presentVersion ? formatVersion(presentVersion) : ""
			return `Would you like to update ${title}` +
				` (new version: ${loadedVersionString || "unknown"}, ` +
			 	`current version: ${presentVersionString || "unknown"})?`
		},

		centralSourcesListAnnotation: "The JSON here describes extensions so that ExtensionsExplorerPlugin can install them"
	},

	// helpers specific to tiddler format
	guessExtensionType: function(tiddler) {
		if(tiddler.tags.contains('systemConfig') ||
		   tiddler.getSlice('Type', '').toLowerCase() == 'plugin' ||
		   /Plugin$/.exec(tiddler.title)
		)
			return 'plugin'
	},
	// We use the server.host field a bit different than the core does (see importing):
	// we keep #TiddlerName part which won't hurt except for the plugin https://github.com/TiddlyWiki/tiddlywiki/blob/master/plugins/Sync.js (which we kinda substitute anyway),
	// we also don't set server.type and server.page.revision fields yet (unlike import); see also server.workspace, wikiformat fields.
	sourceUrlField: 'server.host',
	getSourceUrl: function(tiddler) {
		return tiddler.fields[this.sourceUrlField] || tiddler.getSlice('Source')
		//# try also the field set by import (figure the name by experiment)
	},
	setSourceUrl: function(tiddler, url) {
		//# simple implementation, not sure if setValue should be used instead
		tiddler.fields[this.sourceUrlField] = url
	},
	getDescription: tiddler => tiddler.getSlice('Description', ''),
	getVersionString: tiddler => tiddler.getSlice('Version', ''),
	getVersion: function(tiddler) {
		const versionString = this.getVersionString(tiddler)
		//# should use a helper from core instead
		const parts = /(\d+)\.(\d+)(?:\.(\d+))?/.exec(versionString)
		return parts ? {
			major: parseInt(parts[1]),
			minor: parseInt(parts[2]),
			revision: parseInt(parts[3] || '0')
		} : {}
	},

	// helpers to get stuff from external repos
	//# start from hardcoding 1 (.oO data sctructures needed
	//  for getAvailableExtensions and various user scenarios),
	//  then several (TW/JSON, local/remote)
	availableRepositories: [],
	getAvailableRepositories: function() {
		return this.availableRepositories
	},
	// fallback used when AvailableExtensions is empty
	defaultAvailableExtensions: [
		{
			url: 'https://github.com/YakovL/TiddlyWiki_ExtensionsExplorerPlugin/blob/master/ExtensionsCollection.txt',
			description: 'A central extensions collection for ExtensionsExplorerPlugin meant to both gather collections of existing extensions and help new authors make their work more explorable',
			type: 'collection'
		},
		{
			// js file @ github - worked /# simplify url to be inserted?
			name: 'ShowUnsavedPlugin',
			sourceType: 'txt',
			url: 'https://github.com/YakovL/TiddlyWiki_ShowUnsavedPlugin/blob/master/ShowUnsavedPlugin.js',
			description: 'highlights saving button (bold red by default) and the document title (adds a leading "*") when there are unsaved changes',
			type: 'plugin',
			text: ''
		},
		{
			url: 'https://github.com/YakovL/TiddlyWiki_DarkModePlugin/blob/master/DarkModePlugin.js',
			description: 'This plugin introduces "dark mode" (changes styles) and switching it by the {{{darkMode}}} macro and operating system settings'
		},
		{
			// in TW @ remote (CORS-enabled) – worked
			name: 'FieldsEditorPlugin',
			sourceType: 'tw',
			url: 'https://yakovl.github.io/VisualTW2/VisualTW2.html#FieldsEditorPlugin',
			description: 'adds controls (create/edit/rename/delete) to the "fields" toolbar dropdown',
			type: 'plugin'
		},
		{
			// txt file @ remote without CORS – worked with _
			url: 'http://yakovlitvin.pro/TW/pre-releases/Spreadsheets.html#HandsontablePlugin',
			description: 'a test plugin on a site without CORS'
		},
		{
			url: 'https://github.com/tobibeer/TiddlyWikiPlugins/blob/master/plugins/ListFiltrPlugin.js'
		}
	],
	guessNameByUrl: function(extension) {
		if(!extension.url) return undefined
		const urlParts = extension.url.split('#')

		// site.domain/path/tw.html#TiddlerName  or  site.domain/path/#TiddlerName
		if(urlParts.length > 1 && /(\.html|\/)$/.exec(urlParts[0])) return urlParts[1]

		// <url part>/TiddlerName.txt or <url part>/TiddlerName.js
		const textPathMatch = /\/([^\/]+)\.(js|txt)$/.exec(urlParts[0])
		return textPathMatch ? textPathMatch[1] : undefined
	},
	collectionTag: 'systemExtensionsCollection',
	parseCollection: function(text) {
		/* expected format:

		< additional info, like |Source|...| and other metadata >
		//{{{
		< extensions as JSON >
		//}}}

		*/
		const match = /(\/\/{{{)\s+((?:.|\n)+)\s+(\/\/}}})\s*$/.exec(text)
		if(match) try {
			const list = JSON.parse(match[2])
			return list.map(extension => ({
				name: extension.name || this.guessNameByUrl(extension),
				...extension
			}))
		} catch (e) {
			console.log(`problems with parsing ${centralSourcesListName}:`, e)
			return null
		}
	},
	// reads .centralSourcesListName, .defaultAvailableExtensions, collections
	getAvailableExtensions: function() {
		const listText = store.getTiddlerText(centralSourcesListName)
		const availableExtensions = this.parseCollection(listText)
			|| this.defaultAvailableExtensions

		const otherCollections = store.filterTiddlers("[tag[" + this.collectionTag + "]]")
		for(const collectionTiddler of otherCollections) {
			const extensions = this.parseCollection(collectionTiddler.text)
			// for now, just merge
			if(extensions) for(const extension of extensions) {
				availableExtensions.push(extension)
			}
		}

		return availableExtensions
	},
	availableUpdatesCache: {},
	cacheAvailableUpdate: function(sourceUrl, tiddler) {
		this.availableUpdatesCache[sourceUrl] = { tiddler: tiddler }
	},
	// github urls like https://github.com/tobibeer/TiddlyWikiPlugins/blob/master/plugins/FiltrPlugin.js
	// are urls of user interface; to get raw code, we use the official githubusercontent.com service
	// also, we change the old urls https://raw.github.com/tobibeer/TiddlyWikiPlugins/master/plugins/FiltrPlugin.js
	getUrlOfRawIfGithub: function(url) {
		const ghUrlRE = /^https:\/\/github\.com\/(\w+?)\/(\w+?)\/blob\/(.+)$/
		const oldGhRawUrlRE = /^https:\/\/raw.github.com\/(\w+?)\/(\w+?)\/(.+)$/
//# test
		const match = ghUrlRE.exec(url) || oldGhRawUrlRE.exec(url)
		if(match) return 'https://raw.githubusercontent.com/' + match[1] + // username
			'/' + match[2] + // repository name
			'/' + match[3] // path
		return url
	},
	twsCache: {}, // map of strings
	/*
	@param sourceType: 'tw' | string | fasly (default = 'txt') -
	 of the tiddler source (a TW or a text file)
	@param url: string - either url of the text file or url#TiddlerName
	 for a TW (TiddlerName defines the title of the tiddler to load)
	@param title: string - is assigned to the loaded tiddler
	@param callback: tiddler | null => void
	 support second param of callback? (error/xhr)
	*/
	loadExternalTiddler: function(sourceType, url, title, callback, useCache) {
		sourceType = sourceType || this.guessSourceType(url)
		//# if sourceType is uknown, we can load file and guess afterwards
		if(sourceType == 'tw') {
			const tiddlerName = url.split('#')[1] || title
			const requestUrl = url.split('#')[0]
			const cache = this.twsCache
			const onTwLoad = function(success, params, responseText, url, xhr) {
				//# pass more info? outside: warn?
				if(!success) return callback(null)
				if(!useCache) cache[requestUrl] = responseText

				const externalTW = new TiddlyWiki()
				const result = externalTW.importTiddlyWiki(responseText)
				//# pass more info? outside: warn?
				if(!result) return callback(null)

				const tiddler = externalTW.fetchTiddler(tiddlerName)
				tiddler.title = title
				callback(tiddler)

				// above is a simple "from scratch" implementation
				//# should we reuse existing core code? (see import)
				//  currently, this only loads and passes tiddler,
				//  actual import is done in 
				const context = {
					adaptor: {},
					complete: function() {}
				}
//				FileAdaptor.loadTiddlyWikiSuccess(context, );
				//# import, see ...
				//# tiddler.title = title;
				//# callback(tiddler);
			}
			if(useCache && cache[requestUrl])
				onTwLoad(true, null, cache[requestUrl])
			else
				httpReq('GET', requestUrl, onTwLoad)
		} else {
			url = this.getUrlOfRawIfGithub(url)
			httpReq('GET', url, function(success, params, responseText, url, xhr) {
				//# pass more info? outside: warn?
				if(!success) return callback(null)

				const tiddler = new Tiddler(title)
				// remove \r originating from Windows
				tiddler.text = responseText.replace(/\r\n/g, '\n')
				tiddler.generatedByTextOnly = true
				callback(tiddler)
			})
		}
	},

	getInstalledExtensions: function() {
		//# instead of returning tiddlers, create extension objects,
		//  those should have ~isInstalled, ~isEnabled, ~hasUpdates flags
		//  (and change refresh accordingly)
		return store.filterTiddlers(`[tag[systemConfig]] ` +
			`[tag[${this.collectionTag}]] [[${centralSourcesListName}]]`)
		//# implement others: themes, transclusions
	},
	// for each installed extension, check for update and reports (now: displays message)
	init: function() {
		//# set delegated handlers of install, update buttons
		const extensionTiddlers = this.getInstalledExtensions()
		if(!config.options.chkSkipExtensionsUpdatesCheckOnStartup && !readOnly)
			for(const eTiddler of extensionTiddlers) {
				const url = this.getSourceUrl(eTiddler)
				if(!url) continue
				this.checkForUpdate(url, eTiddler, result => {
		console.log('checkForUpdate for ' + url +
			',', eTiddler, 'result is:', result)
					if(result.tiddler && !result.noUpdateMessage) {
						displayMessage(this.lingo.getUpdateAvailableAndVersionsMsg(eTiddler, result.tiddler))
					}
					//# either report each one at once,
					//   (see onUpdateCheckResponse)
					//  create summary and report,
					//   (use availableUpdates)
					//  create summary and just show "+4" or alike (better something diminishing),
					//  or even update (some of) ext-s silently
					//# start with creating summary
				})
			}

		const taskName = "explorePlugins"
		config.backstageTasks.push(taskName)
		config.tasks[taskName] = {
			text: this.lingo.backstageButtonLabel,
			tooltip: this.lingo.backstageButtonTooltip,
			content: '<<tiddler ExtensionsInBackstage>>',
		}
	},
	handler: function(place, macroName, params, wikifier, paramString) {
		// parse param "[type:installed|available]"
		const pParams = paramString.parseParams("type", null, true, false, true)
		const type = getParam(pParams, "type", "")

		const tableHeaderMarkup = "|name|description|version||h"
		// name is supposted to be a link to the repo; 3d row – for "install" button
		wikify(tableHeaderMarkup, place)
		const table = place.lastChild

		jQuery(table).attr({ refresh: 'macro', macroName: macroName })
			.addClass('extensionsExplorer').append('<tbody>')
			.attr({ 'data-eep-type': type })

		this.refresh(table)
	},
	// grabs list of available extensions and shows with buttons to install;
	// for each installed plugin, shows a button to check update or "no url" message,
	refresh: function(table) {
		const $tbody = jQuery(table).find('tbody')
			.empty()
		const type = jQuery(table).attr('data-eep-type')

		// safe method (no wikification, innerHTML etc)
		const appendRow = function(cells) {
			const row = document.createElement('tr')
			const nameCell = createTiddlyElement(row, 'td')
			if(cells.url)
				createExternalLink(nameCell, cells.url, cells.name)
			else
				createTiddlyLink(nameCell, cells.name, true)

			createTiddlyElement(row, 'td', null, null, cells.description)

			createTiddlyElement(row, 'td', null, null, cells.version)

			const actionsCell = createTiddlyElement(row, 'td', null, 'actionsCell')
			const actionsWrapper = createTiddlyElement(actionsCell, 'div', null, 'actionsWrapper')
			if(cells.actionElements.length > 0) {
				actionsWrapper.appendChild(cells.actionElements[0])
				actionsWrapper.firstChild.classList.add('mainButton')
			}
			if(cells.actionElements.length > 1) {
				const { lingo } = config.macros.extensionsExplorer
				const otherActionEls = cells.actionElements.slice(1)
				createTiddlyButton(actionsWrapper, '▾',
					lingo.otherActionsPrompt,
					function(event) {
						const popup = Popup.create(actionsWrapper)
						for(const e of otherActionEls) {
							const li = createTiddlyElement(popup, 'li')
							li.appendChild(e)
						}
						popup.style.minWidth = actionsWrapper.offsetWidth + 'px'
						Popup.show()
						event.stopPropagation()
						return false
					},
					'button otherActionsButton')
			}

			$tbody.append(row)
		}

		//# when implemented: load list of available extensions (now hardcoded)

		const installedExtensionsTiddlers = this.getInstalledExtensions()
			.sort((e1, e2) => {
				const up1 = this.availableUpdatesCache[this.getSourceUrl(e1)]
				const up2 = this.availableUpdatesCache[this.getSourceUrl(e2)]
				return	up1 && up2 ? 0 :
					up1 && !up2 ? -1 :
					up2 && !up1 ? +1 :
					!this.getSourceUrl(e1) ? +1 :
					!this.getSourceUrl(e2) ? -1 : 0
			})

		// show extensions available to install
		if(!type || type == 'available') {
			const availableExtensions = this.getAvailableExtensions()

			for(const extension of availableExtensions) {
				// skip installed
				if(installedExtensionsTiddlers.some(tid =>
					tid.title === extension.name
					&& this.getSourceUrl(tid) === extension.url)
				) continue

				if(!extension.name && extension.sourceType == 'tw')
					extension.name = extension.url.split('#')[1]

				appendRow({
					name:        extension.name,
					url:         extension.url,
					description: extension.description,
					version:     extension.version,
					actionElements: [
						createTiddlyButton(null,
							this.lingo.installButtonLabel,
							this.lingo.installButtonPrompt,
							() => this.grabAndInstall(extension) )
					]
				})
			}
		}
		//# add link to open, update on the place of install – if installed

		// show installed ones.. # or only those having updates?
		if(!type) $tbody.append(jQuery(
			`<tr><td colspan="4" style="text-align: center;">Installed</td></tr>`))
		if(!type || type == 'installed') {
			for(const extensionTiddler of installedExtensionsTiddlers) {
				//# limit the width of the table|Description column
				const updateUrl = this.getSourceUrl(extensionTiddler)
					//# check also list of extensions to install
				const onUpdateCheckResponse = (result, isAlreadyReported) => {
					if(!result.tiddler) {
						displayMessage(this.lingo.updateNotAvailable)
						//# use result.error
						return
					}
					const versionOfLoaded = this.getVersion(result.tiddler)
					const versionOfPresent = this.getVersion(extensionTiddler)

					if(compareVersions(versionOfLoaded, versionOfPresent) >= 0) {
						displayMessage(this.lingo.updateNotAvailable)
						//# use result.error
						return
					}
					if(!isAlreadyReported) displayMessage(this.lingo.getUpdateAvailableMsg(extensionTiddler.title), updateUrl)

					//# later: better than confirm? option for silent?
					if(confirm(this.lingo.getUpdateConfirmMsg(
						extensionTiddler.title,
						versionOfLoaded, versionOfPresent))
					) {
						this.updateExtension(result.tiddler, updateUrl)
					}
				}

				const checkUpdateButton = createTiddlyButton(null,
					this.lingo.updateButtonCheckLabel,
					this.lingo.updateButtonCheckPrompt,
					() => this.checkForUpdate(updateUrl, extensionTiddler,
						onUpdateCheckResponse))

				const cachedUpdate = this.availableUpdatesCache[updateUrl]
				const installUpdateButton = createTiddlyButton(null,
					this.lingo.updateButtonUpdateLabel,
					this.lingo.updateButtonUpdatePrompt,
					() => onUpdateCheckResponse(cachedUpdate, true))

				appendRow({
					name: extensionTiddler.title,
					description: this.getDescription(extensionTiddler),
					version: this.getVersionString(extensionTiddler),
					actionElements: [
						!updateUrl ? createTiddlyElement(null, 'div', null, 'actionsLabel', this.lingo.noSourceUrlAvailable) :
						cachedUpdate ? installUpdateButton :
						checkUpdateButton
					]
				})
			}
		}
	},
	grabAndInstall: function(extension) {
		if(!extension) return
		if(extension.text) {
			const extensionTiddler = new Tiddler(extension.name)
			extensionTiddler.text = extension.text
			extensionTiddler.generatedByTextOnly = true
			//# share 3 ↑ lines as ~internalize helper (with loadExternalTiddler)
			this.install(extensionTiddler, extension.type, extension.url)
			return
		}
		this.loadExternalTiddler(
			extension.sourceType,
			extension.url,
			extension.name,
			tiddler => {
				if(!tiddler) {
					displayMessage(this.lingo.getFailedToLoadMsg(extension.name))
					return
				}
				displayMessage(this.lingo.getSucceededToLoadMsg(tiddler.title))
				this.install(tiddler, extension.type ||
					this.guessExtensionType(tiddler), extension.url)
			}
		)
	},
	// evaluate if a plugin, import
	//# simple unsafe version, no dependency handling, registering as installed,
	//  _install-only-once check_, result reporting, refreshing/notifying, ..
	install: function(extensionTiddler, extensionType, sourceUrl) {
		if(!extensionTiddler) return

		const { text, title } = extensionTiddler
		switch(extensionType) {
			case 'plugin':
				// enable at once
				try {
					eval(text)
					displayMessage(this.lingo.getEvalSuccessMsg(title))
				} catch(e) {
					displayMessage(this.lingo.getEvalFailMsg(title, e))
					//# don't import? only on confirm?
				}
				// import preparation
				extensionTiddler.tags.pushUnique('systemConfig')
			break;

			case 'collection':
				extensionTiddler.tags.pushUnique(this.collectionTag)
			break;

			//# add _ tag for themes?
		}

		// actually import etc
		this.updateExtension(extensionTiddler, sourceUrl)
		//# what if exists already? (by the same name; other name)
	},
	updateExtension: function(extensionTiddler, sourceUrl) {
		// import
		var existingTiddler = store.fetchTiddler(extensionTiddler.title)
		if(extensionTiddler.generatedByTextOnly && existingTiddler) {
			existingTiddler.text = extensionTiddler.text
			existingTiddler.modified = new Date()
			//# update also modifier? changecount?
		} else {
			store.addTiddler(extensionTiddler)
		}
		if(sourceUrl && this.getSourceUrl(extensionTiddler) !== sourceUrl) {
			this.setSourceUrl(extensionTiddler, sourceUrl)
		}

		delete this.availableUpdatesCache[sourceUrl]
		store.setDirty(true)
		//# store url for updating if slice is not present?
		// make explorer and other stuff refresh
		store.notify(extensionTiddler.title, true)
		//# .oO reloading, hot reinstalling
		displayMessage(this.lingo.getImportSuccessMsg(extensionTiddler.title,
			this.getVersionString(extensionTiddler), !!existingTiddler))
	},
	guessSourceType: function(url) {
		if(/\.(txt|js)$/.exec(url.split('#')[0])) return 'txt'
		//# guess by url instead, fall back to 'txt'
		return 'tw'
	},
//# careful: extension keyword is overloaded (extension object/tiddler)
	/*
	  tries to load update for tiddler, if succeeds calls callback with
	   argument depending on whether it has newer version than the existing one
	  @param url: _
	  @param extensionTiddler: _
	  @param callback: is called [not always yet..] with argument
		{ tiddler: Tiddler | null, error?: string, noUpdateMessage?: string }
		if update is found and it has version newer than extensionTiddler,
		it is called with { tiddler: Tiddler }
	*/
	checkForUpdate: function(url, extensionTiddler, callback) {
		if(!url) return
		const title = extensionTiddler.title
		this.loadExternalTiddler(null, url, title, loadedTiddler => {
			if(!loadedTiddler) return callback({
				tiddler: null,
				error: "" //# specify
			})
			if(compareVersions(this.getVersion(loadedTiddler),
					   this.getVersion(extensionTiddler)
					  ) >= 0)
			//# also get and compare modified dates?
			{
				//# what about undefined?
				console.log('loaded is not newer')
				callback({
					tiddler: loadedTiddler,
					noUpdateMessage: "current version is up-to-date"
				})
			} else {
				this.cacheAvailableUpdate(url, loadedTiddler)
				callback({ tiddler: loadedTiddler })
			}
		})
	}
}

config.shadowTiddlers.ExtensionsInBackstage = `<<tabs txtTabExtensionsExplorer
	"check and update" "" ExtensionsExplorer
	"explore and install" "" ExtensionsOutThere
	contribute "" ContributeToExtensionsEcosystem
>>`

config.shadowTiddlers.ExtensionsExplorer = `<<extensionsExplorer type:installed>>`

config.shadowTiddlers.ExtensionsOutThere = `<<extensionsExplorer type:available>>

Some repositories not yet indexed by EEP that may be worth checking:
|[[TiddlyTools|https://tiddlytools.com/Classic]]|The largest extensions repository created mostly by a single developer, Eric Shulman. Source slice is currently outdated in all the extensions, be sure to change it to the up-to-date urls|
||..more repositories will be added, check the "contribute" tab for more|

Old indexes of existing extensions (EEP is meant to eventually substitute them):
|[[Customize|https://yakovlitvin.pro/TW/TS_backups/customize.tiddlyspace.com%20(24.02.2016).html]]|archive of the big index created by Tobias Beer and contributors|`

config.shadowTiddlers.ContributeToExtensionsEcosystem = `Indexing estensions and repositories for EEP is work in progress. You can suggest changes in [[Github|https://github.com/YakovL/TiddlyWiki_ExtensionsExplorerPlugin]] (via issues or ~PRs) or in the [[Google Group|https://groups.google.com/g/tiddlywikiclassic]].

Things that we encourage you to do include:
* Reporting missing repos for the "explore and install" tab (repositories not yet indexed by EEP);
* Creating collections and indexing existing extensions (either yours or created by others);
* Asking questions about contributing and making it as simple as possible for others.`

config.shadowTiddlers[centralSourcesListName] = '//{{{\n' +
	JSON.stringify(config.macros.extensionsExplorer.defaultAvailableExtensions, null, 2) +
	'\n//}}}'
config.annotations[centralSourcesListName] =
	config.macros.extensionsExplorer.lingo.centralSourcesListAnnotation

// Add styles
const css = `
.actionsLabel, .actionsCell .button {
	padding: 0.2em;
	display: inline-block;
	border: none;
	white-space: normal;
}
td.actionsCell {
	padding: 0;
}

.actionsWrapper {
	white-space: nowrap;
}
.button.mainButton {
	padding-left: 0.7em;
}`

const shadowName = 'ExtensionsExplorerStyles'
if(!config.shadowTiddlers[shadowName]) {
	config.shadowTiddlers[shadowName] = css
	store.addNotification(shadowName, refreshStyles)
	store.addNotification("ColorPalette", function(_, doc) { refreshStyles(shadowName, doc) })
}
//}}}