/***
|Description|checks and reports updates of installed extensions on startup, introduces a macro/backstage button to explore, install and update extensions|
|Version    |0.6.1|
|Author     |Yakov Litvin|
|Source     |https://github.com/YakovL/TiddlyWiki_ExtensionsExplorerPlugin/blob/master/ExtensionsExplorerPlugin.js|
|License    |[[MIT|https://github.com/YakovL/TiddlyWiki_ExtensionsExplorerPlugin/blob/master/LICENSE]]|
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
		installButtonLabel: "install",
		installButtonPrompt: "get and install this extension",
		getFailedToLoadMsg: name => "failed to load " + name,
		getSucceededToLoadMsg: name => `loaded ${name}, about to import and install...`,
		noSourceUrlAvailable: "no source url",
		getEvalSuccessMsg: name => `Successfully installed ${name} (reload is not necessary)`,
		getEvalFailMsg: (name, error) => `${name} failed with error: ${error}`,
		getImportUpdateMsg: (name, isUpdated) => name + " was " + (isUpdated ? "updated" :
			isUpdated === false ? "imported" : "imported/updated"),

		updateButtonCheckLabel: "check",
		updateButtonCheckPrompt: "check for updates",
		updateButtonUpdateLabel: "update",
		updateButtonUpdatePrompt: "install avaialble update",
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
		getImportedUpdateMsg: (title, versionString) => "Imported " +
			(versionString ? title + " v" + versionString :
			 "the updated " + title),

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
			url: 'http://yakovl.bplaced.net/TW/Spreadsheets.html#HandsontablePlugin',
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
		const textPathMatch = /\/(\w+)\.(js|txt)$/.exec(urlParts[0])
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
		const match = /(\/\/{{{)\s+((?:.|\n)+)\s+(\/\/}}})$/.exec(text)
		if(match) try {
			return JSON.parse(match[2])
		} catch (e) {
			console.log(`problems with parsing ${centralSourcesListName}:`, e)
			return null
		}
	},
	//# use getAvailableRepositories to get lists of extensions
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

		//# move name normalizing to the reading method
		//  once we move the list of available extensions from hardcode
		for(const extension of availableExtensions) {
			extension.name = extension.name || this.guessNameByUrl(extension)
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
				tiddler.text = responseText
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
		if(!config.options.chkSkipExtensionsUpdatesCheckOnStartup)
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
			text: "explore extensions",
			tooltip: "see if there's any updates or install new ones",
			content: '<<extensionsExplorer>>',
		}
	},
	handler: function(place, macroName, params, wikifier, paramString) {
		const tableHeaderMarkup = "|name|description|version||h"
		// name is supposted to be a link to the repo; 3d row – for "install" button
		wikify(tableHeaderMarkup, place)
		const table = place.lastChild

		jQuery(table).attr({ refresh: 'macro', macroName: macroName })
			.addClass('extensionsExplorer').append('<tbody>')

		this.refresh(table)
	},
	// grabs list of available extensions and shows with buttons to install;
	// for each installed plugin, shows a button to check update or "no url" message,
	refresh: function(table) {
		const $tbody = jQuery(table).find('tbody')
			.empty()

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

			const actionsCell = createTiddlyElement(row, 'td')
			for(const e of cells.actionElements)
				actionsCell.appendChild(e)

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
		const availableExtensions = this.getAvailableExtensions()
		for(const extension of availableExtensions) {
			// skip installed
			if(installedExtensionsTiddlers.some(tid => tid.title === extension.name
				&& this.getSourceUrl(tid) === extension.url)) continue

			if(!extension.name && extension.sourceType == 'tw')
				extension.name = extension.url.split('#')[1]

			appendRow({
				name:		extension.name,
				url:		extension.url,
				description:	extension.description,
				version:	extension.version,
				actionElements: [
					createTiddlyButton(null,
						this.lingo.installButtonLabel,
						this.lingo.installButtonPrompt,
						() => this.grabAndInstall(extension) )
				]
			})
		}
		//# add link to open, update on the place of install – if installed

		// show installed ones.. # or only those having updates?
		$tbody.append(jQuery(`<tr><td colspan="4" style="text-align: center;">Installed</td></tr>`))
		for(const extensionTiddler of installedExtensionsTiddlers) {
			//# limit the width of the Description column/whole table
			const updateUrl = this.getSourceUrl(extensionTiddler)
				//# check also list of extensions to install
			const onUpdateCheckResponse = result => {
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
				displayMessage(this.lingo.getUpdateAvailableMsg(extensionTiddler.title), updateUrl)

				//# later: better than confirm? option for silent?
				if(confirm(this.lingo.getUpdateConfirmMsg(
					extensionTiddler.title,
					versionOfLoaded, versionOfPresent))
				) {
					this.updateExtension(result.tiddler, updateUrl)
					displayMessage(this.lingo.getImportedUpdateMsg(
						result.tiddler.title,
						this.getVersionString(result.tiddler)
					))
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
				() => onUpdateCheckResponse(cachedUpdate))

			appendRow({
				name: extensionTiddler.title,
				description: this.getDescription(extensionTiddler),
				version: this.getVersionString(extensionTiddler),
				actionElements: [
					!updateUrl ? document.createTextNode(this.lingo.noSourceUrlAvailable) :
					cachedUpdate ? installUpdateButton :
					checkUpdateButton
				]
			})
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
		displayMessage(this.lingo.getImportUpdateMsg(title))
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

config.shadowTiddlers[centralSourcesListName] = '//{{{\n' +
	JSON.stringify(config.macros.extensionsExplorer.defaultAvailableExtensions, null, 2) +
	'\n//}}}'
config.annotations[centralSourcesListName] =
	config.macros.extensionsExplorer.lingo.centralSourcesListAnnotation
//}}}