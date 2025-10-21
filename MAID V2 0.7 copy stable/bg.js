// Service worker for MAID V2 - Manifest V3

console.log("MAID V2 service worker starting...");

// Open or focus options page function
function openOrFocusOptionsPage() {
	var optionsUrl = chrome.runtime.getURL('options.html');
	chrome.tabs.query({}, function(extensionTabs) {
		var found = false;
		for (var i=0; i < extensionTabs.length; i++) {
			if (optionsUrl == extensionTabs[i].url) {
				found = true;
			//console.log("tab id: " + extensionTabs[i].id);
			chrome.tabs.update(extensionTabs[i].id, {"active": true});
		}
	}
	if (found == false) {
		chrome.tabs.create({url: "options.html"});
	}
});
}

// Open test page function
function openTestPage() {
  const testUrl = chrome.runtime.getURL('test.html');
  chrome.tabs.create({url: testUrl});
}

// Event listener for incoming messages (from test page)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received:", request);
  
  if (request.action === "getStorage") {
    chrome.storage.local.get(null, (storage) => {
      console.log("Sending storage data:", storage);
      sendResponse({storage: storage});
    });
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === "checkStatus") {
    sendResponse({status: "Running and responding!"});
    return true;
  }
  
  if (request.action === "addFilter") {
    const data = {};
    data[request.pattern] = request.folder;
    
    chrome.storage.local.set(data, () => {
      console.log("Filter added:", request.pattern, "->", request.folder);
      sendResponse({success: true});
    });
    return true;
  }
});

// Regular extension listeners
chrome.runtime.onConnect.addListener(function(port) {
	var tab = port.sender.tab;
		// This will get called by the content script we execute in
		// the tab as a result of the user pressing the browser action.
		port.onMessage.addListener(function(info) {
			var max_length = 1024;
			if (info.selection.length > max_length)
				info.selection = info.selection.substring(0, max_length);
			openOrFocusOptionsPage();
		});
	});

// Called when the user clicks on the browser action icon.
chrome.action.onClicked.addListener(function(tab) {
	console.log("Action clicked - opening options page");
	openOrFocusOptionsPage();
  
  // For testing, uncomment this line to open test page directly
  // openTestPage();
});

// Handle service worker registration and keep-alive
self.addEventListener('install', (event) => {
  console.log('MAID V2 service worker installing...');
  self.skipWaiting(); // Forces service worker activation
});

self.addEventListener('activate', (event) => {
  console.log('MAID V2 service worker activated!');
  event.waitUntil(clients.claim()); // Take control immediately
});

// Keep service worker alive
setInterval(() => {
  console.log('Heartbeat - keeping service worker alive');
}, 20000);

// Main download interception logic - using return value pattern
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  console.log("MAID V2: Download intercepted!", item.filename, "from", item.url);
  
  const current = item.url;
  let ifilename = item.filename;
  const jfilename = item.filename;
  
  // IMPORTANT: We must return true to use the suggest callback asynchronously
  // This keeps the service worker alive while we process the download
  
  // Get all storage data
  chrome.storage.local.get(null, (storage) => {
    console.log("Storage data:", storage);
    
    // Check URL-based filters first
    for (const key in storage) {
      if((key === 'torrents') || (key === 'images') || (key === 'music') || (key === 'docs') || (key === 'arch')) {
        continue;
      }
      if (current.indexOf(key) !== -1){
        console.log("URL match found:", key, "->", storage[key]);
        ifilename = storage[key] + '/' + item.filename;
        break; // Use first match
      }
    }
    
    // Check file type filters
    if((storage.torrents === true || storage.torrents === 'true') && (jfilename.indexOf('.torrent') !== -1)) {
      console.log("Torrents folder applied");
      ifilename = 'Torrents/' + ifilename;
    }
    if((storage.music === true || storage.music === 'true') && ((jfilename.indexOf('.mp3') !== -1) || (jfilename.indexOf('.wav') !== -1))) {
      console.log("Music folder applied");
      ifilename = 'Music/' + ifilename;
    }
    if((storage.images === true || storage.images === 'true') && ((jfilename.indexOf('.jpg') !== -1) || (jfilename.indexOf('.png') !== -1) || (jfilename.indexOf('.jpeg') !== -1) || (jfilename.indexOf('.gif') !== -1) || (jfilename.indexOf('.bmp') !== -1) || (jfilename.indexOf('.webp') !== -1))) {
      console.log("Images folder applied");
      ifilename = 'Images/' + ifilename;
    }
    if((storage.docs === true || storage.docs === 'true') && ((jfilename.indexOf('.doc') !== -1) || (jfilename.indexOf('.ppt') !== -1) || (jfilename.indexOf('.rtf') !== -1) || (jfilename.indexOf('.xls') !== -1) || (jfilename.indexOf('.pdf') !== -1) || (jfilename.indexOf('.txt') !== -1) || (jfilename.indexOf('.docx') !== -1) || (jfilename.indexOf('.xlsx') !== -1) || (jfilename.indexOf('.pptx') !== -1))) {
      console.log("Documents folder applied");
      ifilename = 'Documents/' + ifilename;
    }
    if((storage.arch === true || storage.arch === 'true') && ((jfilename.indexOf('.zip') !== -1) || (jfilename.indexOf('.rar') !== -1) || (jfilename.indexOf('.dmg') !== -1) || (jfilename.indexOf('.7z') !== -1) || (jfilename.indexOf('.tar') !== -1) || (jfilename.indexOf('.gz') !== -1))) {
      console.log("Archives folder applied");
      ifilename = 'Archives/' + ifilename;
    }

    console.log("Final filename:", ifilename);
    console.log("File organized by MAID V2");
    
    // Call suggest with the final filename
    suggest({filename: ifilename, conflictAction: "uniquify"});
  });
  
  // Return true to indicate we'll call suggest asynchronously
  return true;
});

console.log("MAID V2 service worker loaded successfully!");
