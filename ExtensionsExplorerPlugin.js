/***
|Description|checks and reports updates of installed extensions on startup, introduces a macro/backstage button to explore, install and update extensions|
|Version|0.3.8|
|Author|Yakov Litvin|
|Source|https://raw.githubusercontent.com/YakovL/TiddlyWiki_ExtensionsExplorerPlugin/master/ExtensionsExplorerPlugin.js|
|License|MIT|
***/
//{{{
// Returns the slice value if it is present or defaultText otherwise
//
Tiddler.prototype.getSlice = Tiddler.prototype.getSlice || function(sliceName, defaultText) {
	var re = TiddlyWiki.prototype.slicesRE, m;
	re.lastIndex = 0;
	while(m = re.exec(this.text)) {
		if(m[2]) {
			if(m[2] == sliceName) return m[3];
		} else {
			if(m[5] == sliceName) return m[6];
		}
	}
	return defaultText;
};

var centralSourcesListName = "AvailableExtensions";

config.macros.extensionsExlorer = {
	lingo: {
		installButtonLabel: "install",
		installButtonPrompt: "get and install this extension",
		getFailedToLoadMsg: name => "failed to load " + name,
		getSucceededToLoadMsg: name => "loaded " + name + ", about to install and import...",
		noSourceUrlAvailable: "no source url",
		
		updateButtonCheckLabel: "check",
		updateButtonCheckPrompt: "check for updates",
		getUpdateAvailableMsg: name => "update of "+ name +" is available!",
		updateNotAvailable: "update is not available",
		getUpdateConfirmMsg: function(title, loadedVersion, presentVersion) {
			const loadedVersionString = loadedVersion ? formatVersion(loadedVersion) : '';
			const presentVersionString = presentVersion ? formatVersion(presentVersion) : '';
			return "Would you like to update "+ title +
				" (new version: "+ (loadedVersionString || "unknown") +
			 	", current version: "+ (presentVersionString || "unknown") +")?";
		},
		getImportedUpdateMsg: (title, versionString) => "Imported "+
			(versionString ? title + " v" + versionString :
			 "the updated "+ title),
		
		centralSourcesListAnnotation: 'The JSON here describes extensions so that ExtensionsExplorerPlugin can install them'
	},
	
	// helpers specific to tiddler format
	guessExtensionType: function(tiddler) {
		if(tiddler.tags.contains('systemConfig') ||
		   tiddler.getSlice('Type', '').toLowerCase() == 'plugin' ||
		   /Plugin$/.exec(tiddler.title)
		)
			return 'plugin';
	},
	//# should we use 'server.host' field instead? see core (import, loadMissingTiddler etc) for the exact semantics
	sourceUrlField: 'sourceUrl',
	getSourceUrl: function(tiddler) {
		return tiddler.fields[this.sourceUrlField] ||
			tiddler.getSlice('Source');
		//# try also the field set by import (figure the name by experiment)
	},
	setSourceUrl: function(tiddler, url) {
		//# simple implementation, not sure if setValue should be used instead
		tiddler.fields[this.sourceUrlField] = url;
	},
	getDescription: tiddler => tiddler.getSlice('Description', ''),
	getVersionString: tiddler => tiddler.getSlice('Version', ''),
	getVersion: function(tiddler) {
		const versionString = this.getVersionString(tiddler);
		//# should use a helper from core instead
		const parts = /(\d+)\.(\d+)(?:\.(\d+))?/.exec(versionString);
		return parts ? {
			major: parts[1],
			minor: parts[2],
			revision: parts[3] || '0'
		} : {};
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
	availableExtensions: [
		{
			// js file @ github - worked /# simplify url to be inserted?
			name: 'ShowUnsavedPlugin',
			sourceType: 'txt',
			url: 'https://raw.githubusercontent.com/YakovL/TiddlyWiki_ShowUnsavedPlugin/master/ShowUnsavedPlugin.js',
			description: 'highlights saving button (bold red by default) and the document title (adds a leading "*") when there are unsaved changes',
			type: 'plugin',
			text: ''
		},
		{
			// txt file @ remote without CORS – worked with _
			url: 'http://yakovl.bplaced.net/TW/Spreadsheets.html#HandsontablePlugin',
			description: 'a test plugin on a site without CORS'
		},
		{
			// in TW @ remote (CORS-enabled) – worked
			name: 'FieldsEditorPlugin',
			sourceType: 'tw',
			url: 'https://yakovl.github.io/VisualTW2/VisualTW2.html#FieldsEditorPlugin',
			description: '',
			type: 'plugin'
		},
		{
			url: 'https://github.com/tobibeer/TiddlyWikiPlugins/blob/master/plugins/ListFiltrPlugin.js'
		}
	],
	guessNameByUrl: function(extension) {
		if(!extension.url) return undefined;
		const urlParts = extension.url.split('#');
		// site.domain/path/tw.html#TiddlerName
		if(urlParts.length > 1 && /\.html$/.exec(urlParts[0]))
			return urlParts[1];
		// <url part>/TiddlerName.txt or <url part>/TiddlerName.js
		const textPathMatch = /\/(\w+)\.(js|txt)$/.exec(urlParts[0])
		if(textPathMatch)
			return textPathMatch[1];
		return undefined;
	},
	//# use getAvailableRepositories to get lists of extensions
	getAvailableExtensions: function() {
		const listText = store.getTiddlerText(centralSourcesListName);
		let availableExtensions;
		if(listText) {
			/*
			expected format:
			... (here we can have some slices like |Source||)
			//{{{
			[ ... ]
			//}}}
			*/
			const match = /(\/\/{{{)\s+((?:.|\n)+)\s+(\/\/}}})$/
				.exec(listText);
			if(match) try {
				availableExtensions = JSON.parse(match[2]);
			} catch (e) {
				console.log('problems with parsing '+ centralSourcesListName +':', e);
			}
		}
		if(!availableExtensions)
			availableExtensions = this.availableExtensions;

		//# move name normalizing to the reading method
		//  once we move the list of available extensions from hardcode
		for(let extension of availableExtensions) {
			extension.name = extension.name ||
				this.guessNameByUrl(extension);
		}
		return availableExtensions
	},
	availableUpdates: [], //# of extensions? extension tiddlers?
	addAvailableUpdate: function(/*tiddler/title, loadedTiddler*/) {
		//# this.availableUpdates.push(...)
	},
	// github urls like https://github.com/tobibeer/TiddlyWikiPlugins/blob/master/plugins/FiltrPlugin.js
	// are urls of user interface; to get raw code, we use the official githubusercontent.com service
	// also, we change the old urls https://raw.github.com/tobibeer/TiddlyWikiPlugins/master/plugins/FiltrPlugin.js
	getUrlOfRawIfGithub: function(url) {
		const ghUrlRE = /^https:\/\/github\.com\/(\w+?)\/(\w+?)\/blob\/(.+)$/;
		const oldGhRawUrlRE = /^https:\/\/raw.github.com\/(\w+?)\/(\w+?)\/(.+)$/;
//# test
		const match = ghUrlRE.exec(url) || oldGhRawUrlRE.exec(url);
		if(match) return 'https://raw.githubusercontent.com/' + match[1] + // username
			'/' + match[2] + // repository name
			'/' + match[3]; // path
		return url;
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
		sourceType = sourceType || this.guessSourceType(url);
		//# if sourceType is uknown, we can load file and guess afterwards
		if(sourceType == 'tw') {
			const tiddlerName = url.split('#')[1] || title;
			const requestUrl = url.split('#')[0];
			const cache = this.twsCache;
			const onTwLoad = function(success, params, responseText, url, xhr) {
				if(!success)
					return callback(null); //# pass more info? outside: warn?
				if(!useCache) cache[requestUrl] = responseText;
				const externalTW = new TiddlyWiki();
				let result = externalTW.importTiddlyWiki(responseText);
				if(!result)
					return callback(null); //# pass more info? outside: warn?
				const tiddler = externalTW.fetchTiddler(tiddlerName);
				tiddler.title = title;
				callback(tiddler);
				
				// above is a simple "from scratch" implementation
				//# should we reuse existing core code? (see import)
				//  currently, this only loads and passes tiddler,
				//  actual import is done in 
				const context = {
					adaptor: {},
					complete: function() {}
				};
//				FileAdaptor.loadTiddlyWikiSuccess(context, );
				//# import, see ...
				//# tiddler.title = title;
				//# callback(tiddler);
			};
			if(useCache && cache[requestUrl])
				onTwLoad(true, null, cache[requestUrl]);
			else
				httpReq('GET', requestUrl, onTwLoad);
		} else {
			url = this.getUrlOfRawIfGithub(url);
			httpReq('GET', url, function(success, params, responseText, url, xhr) {
				if(!success)
					return callback(null); //# pass more info? outside: warn?
				const tiddler = new Tiddler(title);
				tiddler.text = responseText;
				tiddler.generatedByTextOnly = true;
				callback(tiddler);
			});
		}
	},

	getInstalledExtensions: function() {
		//# instead of returning tiddlers, create extension objects,
		//  those should have ~isInstalled, ~isEnabled, ~hasUpdates flags
		//  (and change refresh accordingly)
		return store.filterTiddlers('[tag[systemConfig]] [['+ centralSourcesListName +']]');
		//# implement others: themes, transclusions
	},
	// for each installed extension, check for update and reports (now: displays message)
	init: function() {
		//# set delegated handlers of install, update buttons
		const extensionTiddlers = this.getInstalledExtensions();
		if(!config.options.chkSkipExtensionsUpdatesCheckOnStartup)
			for(const eTiddler of extensionTiddlers) {
				const url = this.getSourceUrl(eTiddler);
				if(!url) continue;
				const getAvailableUpdateMessage = newTiddler =>
				    'update of '+ eTiddler.title +' is available '+
				    '(current version: '+ this.getVersionString(eTiddler) +
				    ', available version: '+ this.getVersionString(newTiddler);
				this.checkForUpdate(url, eTiddler, result => {
		console.log('checkForUpdate for ' + url +
			',', eTiddler, 'result is:', result)
					if(result.tiddler && !result.noUpdateMessage)
						displayMessage(getAvailableUpdateMessage(result.tiddler));
					//# either report each one at once,
					//   (see onUpdateCheckResponse)
					//  create summary and report,
					//   (use availableUpdates)
					//  create summary and just show "+4" or alike (better something diminishing),
					//  or even update (some of) ext-s silently
					//# start with creating summary
				});
			}
		
		const taskName = "explorePlugins";
		config.backstageTasks.push(taskName);
		config.tasks[taskName] = {
			text: "explore extensions",
			tooltip: "see if there's any updates or install new ones",
			content: '<<extensionsExlorer>>',
		};
	},
	handler: function(place, macroName, params, wikifier, paramString) {
		const tableHeaderMarkup = "|name|description|version||h";
		// name is supposted to be a link to the repo; 3d row – for "install" button
		wikify(tableHeaderMarkup, place);
		const table = place.lastChild;

		jQuery(table).attr({ refresh: 'macro', macroName: macroName })
			.addClass('extensionsExlorer').append('<tbody>');
		
		this.refresh(table);
	},
	// grabs list of available extensions and shows with buttons to install;
	// for each installed plugin, shows a button to check update or "no url" message,
	refresh: function(table) {
		let $tbody = jQuery(table).find('tbody')
			.empty();

		// safe method (no wikification, innerHTML etc)
		const appendRow = function(cells) {
			let row = document.createElement('tr');
			let nameCell = createTiddlyElement(row, 'td');
			if(cells.url)
				createExternalLink(nameCell, cells.url, cells.name);
			else
				createTiddlyLink(nameCell, cells.name, true);

			createTiddlyElement(row, 'td', null, null, cells.description);

			createTiddlyElement(row, 'td', null, null, cells.version);

			let actionsCell = createTiddlyElement(row, 'td');
			for(let e of cells.actionElements)
				actionsCell.appendChild(e);
			
			$tbody.append(row);
		}

		//# when implemented: load list of available extensions (now hardcoded)

		// show extensions available to install # will it omit if installed?
		const availableExtensions = this.getAvailableExtensions();
		for(const extension of availableExtensions) {
			if(!extension.name && extension.sourceType == 'tw')
				extension.name = extension.url.split('#')[1];
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
			});
		}
		//# add link to open, update on the place of install – if installed

		// show installed ones.. # or only those having updates?
		$tbody.append(jQuery(`<tr><td colspan="4" style="text-align: center;">Installed</td></tr>`));
		const installedExtensions = this.getInstalledExtensions()
			.sort((e1, e2) => {
				if(!this.getSourceUrl(e1)) return +1;
				if(!this.getSourceUrl(e2)) return -1;
				return 0;
			});
		for(let extensionTiddler of installedExtensions) {
			//# limit the width of the Description column/whole table
			let updateUrl = this.getSourceUrl(extensionTiddler);
				//# check also list of extensions to install
			let onUpdateCheckResponse = result => {
				if(!result.tiddler) {
					displayMessage(this.lingo.updateNotAvailable);
					//# use result.error
					return;
				}
				const versionOfLoaded = this.getVersion(result.tiddler);
				const versionOfPresent = this.getVersion(extensionTiddler);
				if(compareVersions(versionOfLoaded, versionOfPresent) >= 0) {
					displayMessage(this.lingo.updateNotAvailable);
					//# use result.error
					return;
				}
				displayMessage(this.lingo.getUpdateAvailableMsg(extensionTiddler.title), updateUrl);

				//# later: better than confirm? option for silent?
				if(confirm(this.lingo.getUpdateConfirmMsg(
					extensionTiddler.title,
					versionOfLoaded, versionOfPresent))
				) {
					this.updateExtension(result.tiddler);
					displayMessage(this.lingo.getImportedUpdateMsg(
						result.tiddler.title,
						this.getVersionString(result.tiddler)
					));
				}
			}
			let checkUpdateButton = createTiddlyButton(null,
				this.lingo.updateButtonCheckLabel,
				this.lingo.updateButtonCheckPrompt,
				() => this.checkForUpdate(updateUrl, extensionTiddler,
							onUpdateCheckResponse))
			appendRow({
				name: extensionTiddler.title,
				description: this.getDescription(extensionTiddler),
				version: this.getVersionString(extensionTiddler),
				actionElements: [
					updateUrl ? checkUpdateButton :
					document.createTextNode(this.lingo.noSourceUrlAvailable)
				]
			});
		}
	},
	grabAndInstall: function(extension) {
		if(!extension) return;
		if(extension.text) {
			let extensionTiddler = new Tiddler(extension.name);
			extensionTiddler.text = extension.text;
			extensionTiddler.generatedByTextOnly = true;
			//# share 3 ↑ lines as ~internalize helper (with loadExternalTiddler)
			this.install(extensionTiddler, extension.type);
			return;
		}
		this.loadExternalTiddler(
			extension.sourceType,
			extension.url,
			extension.name, tiddler => {
				if(!tiddler) {
					displayMessage(this.lingo.getFailedToLoadMsg(extension.name));
					return;
				}
				displayMessage(this.lingo.getSucceededToLoadMsg(tiddler.title));
				this.install(tiddler, extension.type ||
					this.guessExtensionType(tiddler));
			}
		);
	},
	// evaluate if a plugin, import
	//# simple unsafe version, no dependency handling, registering as installed,
	//  _install-only-once check_, result reporting, refreshing/notifying, ..
	install: function(extensionTiddler, extensionType) {
		if(!extensionTiddler) return;

		if(extensionType == 'plugin') {
			// enable at once
			try {
				eval(extensionTiddler.text);
				//# displayMessage ..installed
			} catch(e) {
				//# displayMessage ..failed to install
				//  don't import?
			}
			// plugin-specific import preparation
			extensionTiddler.tags.pushUnique('systemConfig');
		} else {
			//# add _ tag for themes? 
		}
		
		// actually import etc
		this.updateExtension(extensionTiddler);
		//# what if exists already? (by the same name; other name)
	},
	updateExtension: function(extensionTiddler) {
		// import
		var existingTiddler = store.fetchTiddler(extensionTiddler.title);
		if(extensionTiddler.generatedByTextOnly && existingTiddler) {
			existingTiddler.text = extensionTiddler.text;
			//# update also modified? modifier? changecount?
		} else {
			store.addTiddler(extensionTiddler);
		}
		store.setDirty(true);
		//# store url for updating if slice is not present?
		//# notify? refresh? depends on extension type?
		//# .oO reloading, hot reinstalling
	},
	guessSourceType: function(url) {
		if(/\.(txt|js)$/.exec(url.split('#')[0]))
			return 'txt';
		return 'tw'; //# guess by url instead, fall back to 'txt'
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
		if(!url) return;
		const title = extensionTiddler.title;
		this.loadExternalTiddler(null, url, title, loadedTiddler => {
			if(!loadedTiddler)
				return callback({
					tiddler: null,
					error: "" //# specify
				});
			if(compareVersions(this.getVersion(loadedTiddler),
					   this.getVersion(extensionTiddler)
					  ) >= 0)
				//# also get and compare modified dates?
			{
				//# what about undefined?
				console.log('loaded is not newer');
				callback({
					tiddler: loadedTiddler,
					noUpdateMessage: "current version is up-to-date"
				});
			} else
				callback({ tiddler: loadedTiddler });
		});
	}
};

config.shadowTiddlers[centralSourcesListName] = '//{{{\n' +
	JSON.stringify(config.macros.extensionsExlorer.availableExtensions, null, 2) +
	'\n//}}}';
config.annotations[centralSourcesListName] =
	config.macros.extensionsExlorer.lingo.centralSourcesListAnnotation;
//}}}