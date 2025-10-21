//Google analytics code - Updated for Manifest V3
var _gaCode = 'UA-41728018-1';

// Note: Google Analytics needs to be implemented differently in Manifest V3
// This is a simplified version that logs analytics events
function trackEvent(action, label) {
    console.log('Analytics Event:', action, label);
    // In a real implementation, you'd use the Measurement Protocol or gtag
}

// Track page view
trackEvent('pageview', 'options_page');


//Debugs for me
function message(msg) {
    var status = document.getElementById('status');
    status.textContent = msg;
    status.classList.add('show');
    setTimeout(function() {
        status.classList.remove('show');
    }, 2500);
}

//Gets version number
function getVersion() {
    var manifestData = chrome.runtime.getManifest();
    return manifestData.version;
}

// Adds a website filter
function addFilter() {
    var _url = document.getElementById('url').value;
    var _folder = document.getElementById('rename').value;
    console.log(_url);
    var data = {};
    data[_url] = _folder;
    if(document.getElementById('url').value==''){
        document.getElementById('url').style.backgroundColor = 'red';
        document.getElementById('url').style.opacity = '0.4';
        setTimeout(function() {
         document.getElementById('url').style.backgroundColor = '';
         document.getElementById('url').style.opacity = '1';
     }, 1750);
        document.getElementById('url').focus();
        return;
    }
    if(document.getElementById('rename').value==''){
        document.getElementById('rename').style.backgroundColor = 'red';
        document.getElementById('rename').style.opacity = '0.4';
        document.getElementById('rename').focus();
        setTimeout(function() {
         document.getElementById('rename').style.backgroundColor = '';
         document.getElementById('rename').style.opacity = '1';
     }, 1750);
        document.getElementById('rename').focus();
        return;
    }
    chrome.storage.local.set(data, function() {
                             // Notify that we saved.
                             message('Settings saved');
                             debugChanges(data, 'Set');
                         });
    
    document.getElementById('url').value='';
    document.getElementById('rename').value='';
    tableCreate();
    //saveStorage();
}

//Clear saved filters
function clearStorage() {
    //var data = new Array();
    if(document.getElementById('checkboxall').checked){
        chrome.storage.local.clear(function() {
                                   // Notify that we saved.
                                   message('Settings saved');
                                   debugChanges(data, 'Local Set');
                               });
        chrome.storage.sync.clear(function() {
                                  // Notify that we saved.
                                  message('Settings saved');
                                  debugChanges(data, 'Sync Set');
                              });
        document.getElementById('filtercheckbox.jpg').checked = false;
        document.getElementById('filtercheckbox.torrent').checked = false;
        document.getElementById('filtercheckbox.mp3').checked = false;
        document.getElementById('filtercheckbox.doc').checked = false;
        document.getElementById('filtercheckbox.arch').checked = false;
        return;
        
    }
    chrome.storage.local.get(null, function(items) {
       for(key in items) {
           if((key == 'torrents') || (key == 'images') || (key == 'music') || (key == 'docs') || (key == 'arch')) {
               continue;
           }
           if(document.getElementById('checkbox' + key).checked){
               chrome.storage.local.remove(key, function() {
                                                         //console.log('removed ' + key);
                                                         //tableCreate();
                                                     });
               
           }
       }
   });
    if (arguments[0] !== null){
        chrome.storage.local.remove(arguments[0], function() {
            console.log('removed ' + key);
                                //tableCreate();
                            });
    }
    //saveStorage();
}


//Catches enter in the second box
function enterPress(e) {
    if (e.keyCode == 13) {
        document.getElementById('url').focus();
        addFilter();
        return false;
    }
}

// Creates a table
function tableCreate(){
    chrome.storage.local.get(null, function(storage) {
       var tblbody = document.getElementById('table-body'); // Target tbody
       if (!tblbody) {
           console.error("Element with id 'table-body' not found!");
           return;
       }
       tblbody.innerHTML = ''; // Clear existing rows

       for(key in storage){
           if((key === 'torrents') || (key === 'images') || (key === 'music') || (key === 'docs') || (key === 'arch')) {
               continue;
           }
           var tr = tblbody.insertRow();
           
           // Checkbox cell
           var td_check = tr.insertCell();
           var checkbox = document.createElement('input');
           checkbox.type = "checkbox";
           checkbox.id = "checkbox" + key;
           td_check.appendChild(checkbox);

           // URL cell
           var td_url = tr.insertCell();
           td_url.textContent = key;

           // Folder cell
           var td_folder = tr.insertCell();
           td_folder.textContent = storage[key];
       }
    });
}

//sync back
function restoreStorage() {
    
    chrome.storage.sync.get(null, function(items) {
       chrome.storage.local.set(items, function() {
                                                      //console.log("synced");
                                                  });
       
   });
}

chrome.storage.onChanged.addListener(function(changes, namespace) {
   for(key in changes) {
       if(key == 'torrents') {
        document.getElementById('filtercheckbox.torrent').checked = changes['torrents'].newValue;
    }
    if(key == 'images') {
        document.getElementById('filtercheckbox.jpg').checked = changes['images'].newValue;
        
    }if(key == 'music') {
        document.getElementById('filtercheckbox.mp3').checked = changes['music'].newValue;
        
    }
    if(key == 'docs') {
        document.getElementById('filtercheckbox.doc').checked = changes['docs'].newValue;
        
    }
    if(key == 'arch') {
        document.getElementById('filtercheckbox.arch').checked = changes['arch'].newValue;
        
    }
    if((namespace == 'local') && (changes[key].newValue == null)) {
       localStorage.removeItem(key);
                                     //console.log("Removed " + key +':'+changes[key].oldValue + 'localstorage now ' + localStorage[key]);
                                     chrome.storage.sync.remove(key, function() {
                                                                 //console.log('removed ' + key);
                                                                 //tableCreate();
                                                             });                                     
                                 } else if((namespace == 'local') && (changes[key].newValue !== null)){
                                   var data = {};
                                   data[key] = changes[key].newValue;
                                   chrome.storage.sync.set(data , function() {
                                                                        // Notify that we saved.
                                                                        //message('Settings saved');
                                                                    });
                                   localStorage[key] = changes[key].newValue;
                                               //console.log("Added " + key +':'+changes[key].newValue + 'localstorage: ' + key + ' now ' + localStorage[key]);

                                           }
                                           else if((namespace == 'sync') && (changes[key].newValue == null)) {
                                               localStorage.removeItem(key);
                                     //console.log("Removed " + key +':'+changes[key].oldValue + 'localstorage now ' + localStorage[key]);
                                     chrome.storage.local.remove(key, function() {
                                                                //console.log('removed ' + key);
                                                                //tableCreate();
                                                            });                                     
                                 } else if((namespace == 'sync') && (changes[key].newValue !== null)){
                                   var data = {};
                                   data[key] = changes[key].newValue;
                                   chrome.storage.local.set(data , function() {
                                                              // Notify that we saved.
                                                              //message('Settings saved');
                                                          });
                                   localStorage[key] = changes[key].newValue;
                                     //console.log("Added " + key +':'+changes[key].newValue + 'localstorage now ' + localStorage[key]);
                                 }
                                 
                                 
                                     //valueChanged(changes["images"].newValue);
                                 }
                                 debugChanges(changes, 'onChanged ' + namespace);
                                 tableCreate();
                                     //updateCheckboxes();
                                     message("Filters Saved");
                                 });

// For debugging purposes:
function debugChanges(changes, namespace) {
    for (key in changes) {
        //console.log(namespace + ' Storage change: key='+key+' value='+JSON.stringify(changes[key]));
    }
}

//Sets filters based on checkboxes
function checkboxes() {
    var selectAll = document.getElementById('checkboxall').checked;
    chrome.storage.local.get(null, function(storage) {
        for(key in storage) {
            if((key === 'torrents') || (key === 'images') || (key === 'music') || (key === 'docs') || (key === 'arch')) {
                continue;
            }
            var checkbox = document.getElementById('checkbox' + key);
            if (checkbox) {
                checkbox.checked = selectAll;
            }
        }
    });

    // This part for file type filters seems separate from "select all" logic
    const settings = {
      'images': document.getElementById('filtercheckbox.jpg').checked,
      'torrents': document.getElementById('filtercheckbox.torrent').checked,
      'music': document.getElementById('filtercheckbox.mp3').checked,
      'docs': document.getElementById('filtercheckbox.doc').checked,
      'arch': document.getElementById('filtercheckbox.arch').checked
    };
    
    console.log("Saving filter settings:", settings);
    
    // Save all settings at once
    chrome.storage.local.set(settings, function() {
      console.log("Filter settings saved successfully");
      message('Filter settings saved');
    });
    //saveStorage();
    
}


// Restores table state to saved value from localStorage.
function restore_options() {
    tableCreate();
    restoreStorage();
    document.getElementById('version').innerHTML = "Version: " + getVersion();
    chrome.storage.local.get(null, function(items) { // Use local storage as source of truth
       document.getElementById('filtercheckbox.jpg').checked = items.images === true;
       document.getElementById('filtercheckbox.torrent').checked = items.torrents === true;
       document.getElementById('filtercheckbox.mp3').checked = items.music === true;
       document.getElementById('filtercheckbox.doc').checked = items.docs === true;
       document.getElementById('filtercheckbox.arch').checked = items.arch === true;
   });
}


// Export settings function - saves all settings to a JSON file
function exportSettings() {
    chrome.storage.local.get(null, function(data) {
        // Convert the data object to a JSON string
        const jsonData = JSON.stringify(data, null, 2);
        
        // Create a blob from the JSON data
        const blob = new Blob([jsonData], {type: 'application/json'});
        
        // Create a URL for the blob
        const url = URL.createObjectURL(blob);
        
        // Create a download link
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = 'maid_organizer_settings_' + new Date().toISOString().slice(0, 10) + '.json';
        
        // Append the link to the body
        document.body.appendChild(downloadLink);
        
        // Trigger the download
        downloadLink.click();
        
        // Clean up
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
        
        message('Settings exported successfully!');
    });
}

// Import settings function - loads settings from a JSON file
function importSettings() {
    const fileInput = document.getElementById('import-file');
    
    const file = fileInput.files[0];
    if (!file) {
        message('No file selected!');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const settings = JSON.parse(e.target.result);
            
            // Clear existing settings and load new ones
            chrome.storage.local.clear(function() {
                chrome.storage.local.set(settings, function() {
                    message('Settings imported successfully!');
                    
                    // Refresh the UI to show the imported settings
                    tableCreate();
                    
                    // Update checkboxes
                    document.getElementById('filtercheckbox.jpg').checked = settings.images === true;
                    document.getElementById('filtercheckbox.torrent').checked = settings.torrents === true;
                    document.getElementById('filtercheckbox.mp3').checked = settings.music === true;
                    document.getElementById('filtercheckbox.doc').checked = settings.docs === true;
                    document.getElementById('filtercheckbox.arch').checked = settings.arch === true;
                });
            });
        } catch (error) {
            message('Error importing settings: Invalid file format');
            console.error('Import error:', error);
        }
    };
    
    reader.readAsText(file);
}

// Show file selection dialog for import
function showImportDialog() {
    document.getElementById('import-file').click();
}

document.addEventListener('DOMContentLoaded', restore_options);
document.querySelector('#add').addEventListener('click', addFilter);
document.querySelector('#clear').addEventListener('click', clearStorage);
document.getElementById('rename').addEventListener('keyup', enterPress);
document.getElementById('url').addEventListener('keyup', enterPress);
document.getElementById('filtercheckbox.jpg').addEventListener('click', checkboxes);
document.getElementById('filtercheckbox.torrent').addEventListener('click', checkboxes);
document.getElementById('filtercheckbox.mp3').addEventListener('click', checkboxes);
document.getElementById('filtercheckbox.doc').addEventListener('click', checkboxes);
document.getElementById('filtercheckbox.arch').addEventListener('click', checkboxes);
document.getElementById('checkboxall').addEventListener('click', checkboxes);

// Theme switcher logic
const themeToggle = document.getElementById('theme-switch-checkbox');
// Default to dark theme if no preference stored
const currentTheme = localStorage.getItem('theme') || 'dark';
// Apply theme and set toggle state
document.documentElement.setAttribute('data-theme', currentTheme);
themeToggle.checked = (currentTheme === 'dark');
// Persist default if first load
localStorage.setItem('theme', currentTheme);

function switchTheme(e) {
    if (e.target.checked) {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
    }    
}

themeToggle.addEventListener('change', switchTheme, false);


// Function to open the test page
function openTestPage() {
    chrome.runtime.getBackgroundPage(function(backgroundPage) {
        if (backgroundPage && backgroundPage.openTestPage) {
            backgroundPage.openTestPage();
        } else {
            // Fallback if background page function isn't available
            chrome.tabs.create({url: chrome.runtime.getURL('test.html')});
        }
    });
}

// Add listeners for import/export buttons
document.getElementById('export-settings').addEventListener('click', exportSettings);
document.getElementById('import-settings').addEventListener('click', showImportDialog);
document.getElementById('import-file').addEventListener('change', importSettings);
document.getElementById('open-test-page').addEventListener('click', openTestPage);
