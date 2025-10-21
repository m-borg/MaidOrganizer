// MAID V2 - Options Page Script

// Global state
let currentSort = localStorage.getItem('filterSort') || 'date-added';
let filterTimestamps = {};
let justSelectedFolder = false; // Track if we just selected from dropdown
let justSelectedURL = false; // Track if we just selected a URL from dropdown

// Pagination state
let currentPage = 1;
let itemsPerPage = localStorage.getItem('itemsPerPage') || '10';
if (itemsPerPage !== 'all') {
    itemsPerPage = parseInt(itemsPerPage);
}
let searchQuery = '';
let selectedFolder = ''; // For folder filtering

// Advanced settings
let minDownloadThreshold = parseInt(localStorage.getItem('minDownloadThreshold')) || 10;
let historyTimeframe = localStorage.getItem('historyTimeframe') || '6'; // months, or 'all'

// Get favicon URL for a domain
function getFaviconURL(urlString) {
    try {
        // Try to extract domain from URL string
        let domain = urlString;
        
        // If it looks like a full URL, parse it
        if (urlString.includes('://')) {
            const url = new URL(urlString);
            domain = url.hostname;
        } else if (urlString.includes('.')) {
            // It's likely a domain or partial domain
            domain = urlString.split('/')[0];
        }
        
        // Use Google's favicon service as primary, with fallback
        return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
    } catch (e) {
        // If all else fails, return a default icon
        return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="gray" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>';
    }
}

// Load timestamps from storage
function loadTimestamps() {
    const stored = localStorage.getItem('filterTimestamps');
    if (stored) {
        try {
            filterTimestamps = JSON.parse(stored);
        } catch (e) {
            filterTimestamps = {};
        }
    }
}

// Save timestamps to storage
function saveTimestamps() {
    localStorage.setItem('filterTimestamps', JSON.stringify(filterTimestamps));
}

// Toast notification system
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    // Use textContent for safety - prevents any HTML injection
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Show confirmation modal
function showConfirmModal(message, filterCount, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    const countElement = document.getElementById('filter-count-modal');
    const confirmBtn = document.getElementById('modal-confirm');
    const cancelBtn = document.getElementById('modal-cancel');
    const overlay = modal.querySelector('.modal-overlay');
    
    countElement.textContent = filterCount;
    modal.classList.add('show');
    
    // Focus the cancel button for accessibility
    setTimeout(() => cancelBtn.focus(), 100);
    
    // Remove old listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    const newOverlay = overlay.cloneNode(true);
    
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    overlay.parentNode.replaceChild(newOverlay, overlay);
    
    // Add new listeners
    newConfirmBtn.addEventListener('click', () => {
        modal.classList.remove('show');
        onConfirm();
    });
    
    newCancelBtn.addEventListener('click', () => {
        modal.classList.remove('show');
    });
    
    newOverlay.addEventListener('click', () => {
        modal.classList.remove('show');
    });
    
    // ESC key to close
    const escHandler = (e) => {
        if (e.key === 'Escape' && modal.classList.contains('show')) {
            modal.classList.remove('show');
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

// Get version number
function getVersion() {
    const manifestData = chrome.runtime.getManifest();
    return manifestData.version;
}

// Update filter count
function updateFilterCount() {
    chrome.storage.local.get(null, (storage) => {
        let count = 0;
        for (const key in storage) {
            if (!['torrents', 'images', 'music', 'docs', 'arch'].includes(key)) {
                count++;
            }
        }
        document.getElementById('filter-count').textContent = count;
    });
}

// Get existing folders with counts
function getExistingFolders(callback) {
    chrome.storage.local.get(null, (storage) => {
        const folderCounts = {};
        
        for (const key in storage) {
            if (!['torrents', 'images', 'music', 'docs', 'arch'].includes(key)) {
                const folder = storage[key];
                folderCounts[folder] = (folderCounts[folder] || 0) + 1;
            }
        }
        
        // Convert to array and sort by count (most used first)
        const folders = Object.entries(folderCounts)
            .map(([folder, count]) => ({ folder, count }))
            .sort((a, b) => b.count - a.count);
        
        callback(folders);
    });
}

// Populate folder filter dropdown
function populateFolderFilter() {
    getExistingFolders((folders) => {
        const folderSelect = document.getElementById('folder-filter-select');
        const renameFolderBtn = document.getElementById('rename-folder-btn');
        
        // Keep "All Folders" option and add folders
        const options = ['<option value="">All Folders</option>'];
        folders.forEach(({ folder, count }) => {
            options.push(`<option value="${escapeHtml(folder)}">${escapeHtml(folder)} (${count})</option>`);
        });
        
        folderSelect.innerHTML = options.join('');
        
        // Show/hide rename button based on selection
        if (selectedFolder) {
            folderSelect.value = selectedFolder;
            renameFolderBtn.style.display = 'flex';
        } else {
            renameFolderBtn.style.display = 'none';
        }
    });
}

// Rename folder
function renameFolder(oldName, newName) {
    if (!newName || !newName.trim()) {
        showToast('Please enter a new folder name', 'error');
        return;
    }
    
    if (oldName === newName) {
        showToast('New name is the same as the old name', 'error');
        return;
    }
    
    chrome.storage.local.get(null, (storage) => {
        const updates = {};
        let count = 0;
        
        // Find all filters with the old folder name
        for (const key in storage) {
            if (!['torrents', 'images', 'music', 'docs', 'arch'].includes(key)) {
                if (storage[key] === oldName) {
                    updates[key] = newName.trim();
                    count++;
                }
            }
        }
        
        if (count === 0) {
            showToast('No filters found with that folder name', 'error');
            return;
        }
        
        // Save all updates
        chrome.storage.local.set(updates, () => {
            showToast(`Renamed folder "${oldName}" to "${newName}" (${count} filter${count > 1 ? 's' : ''} updated)`, 'success');
            selectedFolder = newName; // Update selected folder to new name
            renderFilters();
            populateFolderFilter();
        });
    });
}

// Show folder suggestions
function showFolderSuggestions(inputValue) {
    const suggestionsDiv = document.getElementById('folder-suggestions');
    
    getExistingFolders((folders) => {
        if (folders.length === 0) {
            suggestionsDiv.classList.remove('show');
            return;
        }
        
        // Filter folders based on input
        let filtered = folders;
        if (inputValue) {
            filtered = folders.filter(f => 
                f.folder.toLowerCase().includes(inputValue.toLowerCase())
            );
        }
        
        if (filtered.length === 0) {
            suggestionsDiv.classList.remove('show');
            return;
        }
        
        // Limit to top 5
        filtered = filtered.slice(0, 5);
        
        suggestionsDiv.innerHTML = filtered.map(f => `
            <div class="folder-suggestion-item" data-folder="${escapeHtml(f.folder)}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                ${escapeHtml(f.folder)}
                <span class="folder-suggestion-count">${f.count}</span>
            </div>
        `).join('');
        
        suggestionsDiv.classList.add('show');
        
        // Add click handlers
        suggestionsDiv.querySelectorAll('.folder-suggestion-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent document click handler
                const folder = item.getAttribute('data-folder');
                const folderInput = document.getElementById('folder-input');
                
                folderInput.value = folder;
                suggestionsDiv.classList.remove('show');
                suggestionsDiv.innerHTML = ''; // Clear suggestions
                
                // Set flag to prevent re-showing on focus
                justSelectedFolder = true;
                folderInput.focus();
                
                // Reset flag after a short delay
                setTimeout(() => {
                    justSelectedFolder = false;
                }, 200);
            });
        });
    });
}

// Hide suggestions when clicking outside
function hideFolderSuggestions(e) {
    const suggestionsDiv = document.getElementById('folder-suggestions');
    const folderInput = document.getElementById('folder-input');
    const autocompleteWrapper = document.querySelector('.autocomplete-wrapper');
    
    if (!autocompleteWrapper || !autocompleteWrapper.contains(e.target)) {
        suggestionsDiv.classList.remove('show');
    }
}

// Get popular download URLs from history
function getPopularDownloadURLs(callback) {
    // Calculate start date based on timeframe setting
    let searchOptions = {
        limit: 10000  // Increased limit to get more history
    };
    
    if (historyTimeframe !== 'all') {
        const startDate = new Date();
        const months = parseInt(historyTimeframe);
        startDate.setMonth(startDate.getMonth() - months);
        searchOptions.startedAfter = startDate.toISOString();
    }
    
    chrome.downloads.search(searchOptions, (downloads) => {
        const urlCount = {};
        
        downloads.forEach(download => {
            if (download.url) {
                try {
                    const url = new URL(download.url);
                    const domain = url.hostname;
                    
                    // Skip empty or invalid domains
                    if (domain && domain.trim() !== '') {
                        // Count full domains
                        urlCount[domain] = (urlCount[domain] || 0) + 1;
                    }
                } catch (e) {
                    // Invalid URL, skip
                }
            }
        });
        
        // Convert to array, filter by min threshold and non-empty URLs, then sort by count
        const sorted = Object.entries(urlCount)
            .map(([url, count]) => ({ url, count }))
            .filter(item => item.count >= minDownloadThreshold && item.url && item.url.trim() !== '')  // Use dynamic threshold
            .sort((a, b) => b.count - a.count);
        
        callback(sorted);
    });
}

// Show URL suggestions from download history
function showURLSuggestions(inputValue) {
    const suggestionsDiv = document.getElementById('url-suggestions');
    
    // Get existing filters to exclude them from suggestions
    chrome.storage.local.get(null, (storage) => {
        const existingURLs = [];
        for (const key in storage) {
            if (!['torrents', 'images', 'music', 'docs', 'arch'].includes(key)) {
                existingURLs.push(key.toLowerCase());
            }
        }
        
        getPopularDownloadURLs((urls) => {
            if (urls.length === 0) {
                suggestionsDiv.classList.remove('show');
                return;
            }
            
            // Filter out URLs that are already in filters
            let filtered = urls.filter(u => {
                // Check if URL is already added as a filter
                const isAlreadyAdded = existingURLs.some(existingURL => 
                    existingURL.includes(u.url.toLowerCase()) || u.url.toLowerCase().includes(existingURL)
                );
                return !isAlreadyAdded;
            });
            
            // Filter URLs based on input
            if (inputValue) {
                filtered = filtered.filter(u => 
                    u.url.toLowerCase().includes(inputValue.toLowerCase())
                );
            }
            
            if (filtered.length === 0) {
                suggestionsDiv.classList.remove('show');
                return;
            }
            
            // Show all results (scrollable) - no limit
            
            suggestionsDiv.innerHTML = filtered.map(u => `
                <div class="url-suggestion-item" data-url="${escapeHtml(u.url)}">
                    <img class="suggestion-favicon" src="${getFaviconURL(u.url)}" onerror="this.style.display='none'">
                    <span class="suggestion-url-text">${escapeHtml(u.url)}</span>
                    <span class="url-suggestion-count">${u.count} downloads</span>
                </div>
            `).join('');
            
            suggestionsDiv.classList.add('show');
            
            // Add click handlers
            suggestionsDiv.querySelectorAll('.url-suggestion-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const url = item.getAttribute('data-url');
                    const urlInput = document.getElementById('url-input');
                    
                    urlInput.value = url;
                    suggestionsDiv.classList.remove('show');
                    suggestionsDiv.innerHTML = '';
                    
                    // Set flag to prevent re-showing on focus
                    justSelectedURL = true;
                    urlInput.focus();
                    
                    // Reset flag after a short delay
                    setTimeout(() => {
                        justSelectedURL = false;
                    }, 200);
                });
            });
        });
    });
}

// Hide URL suggestions when clicking outside
function hideURLSuggestions(e) {
    const suggestionsDiv = document.getElementById('url-suggestions');
    const urlInput = document.getElementById('url-input');
    const urlInputGroup = urlInput.closest('.input-group');
    
    if (!urlInputGroup || !urlInputGroup.contains(e.target)) {
        suggestionsDiv.classList.remove('show');
    }
}

// Add a new URL filter
function addFilter() {
    const urlInput = document.getElementById('url-input');
    const folderInput = document.getElementById('folder-input');
    const url = urlInput.value.trim();
    const folder = folderInput.value.trim();
    
    if (!url) {
        urlInput.style.borderColor = 'var(--danger)';
        setTimeout(() => {
            urlInput.style.borderColor = '';
        }, 2000);
        urlInput.focus();
        showToast('Please enter a URL pattern', 'error');
        return;
    }
    
    if (!folder) {
        folderInput.style.borderColor = 'var(--danger)';
        setTimeout(() => {
            folderInput.style.borderColor = '';
        }, 2000);
        folderInput.focus();
        showToast('Please enter a folder name', 'error');
        return;
    }
    
    const data = {};
    data[url] = folder;
    
    chrome.storage.local.set(data, () => {
        // Add timestamp for this filter
        filterTimestamps[url] = Date.now();
        saveTimestamps();
        
        showToast(`Filter added: ${url} → ${folder}`, 'success');
        urlInput.value = '';
        folderInput.value = '';
        currentPage = 1; // Reset to first page when adding filter
        renderFilters();
        updateFilterCount();
        populateFolderFilter();
    });
}

// Delete a single filter
function deleteFilter(key) {
    chrome.storage.local.remove(key, () => {
        // Remove timestamp
        delete filterTimestamps[key];
        saveTimestamps();
        
        showToast('Filter removed', 'success');
        renderFilters();
        updateFilterCount();
        populateFolderFilter();
    });
}

// Edit a filter (inline editing)
function editFilter(oldUrl, field, newValue) {
    chrome.storage.local.get(oldUrl, (storage) => {
        const oldFolder = storage[oldUrl];
        
        if (field === 'url') {
            // Editing URL - need to remove old and add new
            if (!newValue || newValue.trim() === '') {
                showToast('URL cannot be empty', 'error');
                renderFilters();
                return;
            }
            
            const trimmedUrl = newValue.trim();
            if (trimmedUrl === oldUrl) {
                renderFilters(); // No change
                return;
            }
            
            // Check if new URL already exists
            chrome.storage.local.get(trimmedUrl, (check) => {
                if (check[trimmedUrl]) {
                    showToast('A filter with this URL already exists', 'error');
                    renderFilters();
                    return;
                }
                
                // Remove old, add new
                chrome.storage.local.remove(oldUrl, () => {
                    const data = {};
                    data[trimmedUrl] = oldFolder;
                    chrome.storage.local.set(data, () => {
                        // Update timestamp
                        const timestamp = filterTimestamps[oldUrl] || Date.now();
                        delete filterTimestamps[oldUrl];
                        filterTimestamps[trimmedUrl] = timestamp;
                        saveTimestamps();
                        
                        showToast('Filter updated', 'success');
                        renderFilters();
                        updateFilterCount();
                    });
                });
            });
        } else {
            // Editing folder
            if (!newValue || newValue.trim() === '') {
                showToast('Folder cannot be empty', 'error');
                renderFilters();
                return;
            }
            
            const trimmedFolder = newValue.trim();
            if (trimmedFolder === oldFolder) {
                renderFilters(); // No change
                return;
            }
            
            const data = {};
            data[oldUrl] = trimmedFolder;
            chrome.storage.local.set(data, () => {
                showToast('Filter updated', 'success');
                renderFilters();
                populateFolderFilter();
            });
        }
    });
}

// Sort filters
function sortFilters(filters) {
    const sorted = [...filters];
    
    switch (currentSort) {
        case 'date-added':
            // Newest first
            sorted.sort((a, b) => {
                const timeA = filterTimestamps[a.url] || 0;
                const timeB = filterTimestamps[b.url] || 0;
                return timeB - timeA;
            });
            break;
        case 'date-added-old':
            // Oldest first
            sorted.sort((a, b) => {
                const timeA = filterTimestamps[a.url] || 0;
                const timeB = filterTimestamps[b.url] || 0;
                return timeA - timeB;
            });
            break;
        case 'url-asc':
            sorted.sort((a, b) => a.url.localeCompare(b.url));
            break;
        case 'url-desc':
            sorted.sort((a, b) => b.url.localeCompare(a.url));
            break;
        case 'folder-asc':
            sorted.sort((a, b) => a.folder.localeCompare(b.folder));
            break;
        case 'folder-desc':
            sorted.sort((a, b) => b.folder.localeCompare(a.folder));
            break;
    }
    
    return sorted;
}

// Clear all filters
function clearAllFilters() {
    chrome.storage.local.get(null, function(storage) {
        // Get all filter keys (exclude file type settings)
        const filterKeys = [];
        for (const key in storage) {
            if (!['torrents', 'images', 'music', 'docs', 'arch'].includes(key)) {
                filterKeys.push(key);
            }
        }
        
        const filterCount = filterKeys.length;
        
        if (filterCount === 0) {
            showToast('No filters to clear', 'info');
            return;
        }
        
        showConfirmModal(
            'Are you sure you want to clear all URL filters?',
            filterCount,
            () => {
                chrome.storage.local.remove(filterKeys, function() {
                    // Clear all timestamps
                    filterTimestamps = {};
                    saveTimestamps();
                    
                    showToast(`All ${filterCount} filters cleared successfully!`, 'success');
                    renderFilters();
                    updateStats();
                });
            }
        );
    });
}

// Render the filters list
function renderFilters() {
    chrome.storage.local.get(null, (storage) => {
        const container = document.getElementById('filters-container');
        const paginationControls = document.getElementById('pagination-controls');
        const filters = [];
        
        for (const key in storage) {
            if (!['torrents', 'images', 'music', 'docs', 'arch'].includes(key)) {
                filters.push({ url: key, folder: storage[key] });
                // Initialize timestamp if not exists
                if (!filterTimestamps[key]) {
                    filterTimestamps[key] = Date.now();
                }
            }
        }
        
        if (filters.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <p>No URL filters yet</p>
                    <span>Add your first filter above to get started</span>
                </div>
            `;
            paginationControls.style.display = 'none';
            return;
        }
        
        // Sort filters
        const sortedFilters = sortFilters(filters);
        
        // Apply folder filter
        let filteredFilters = sortedFilters;
        if (selectedFolder) {
            filteredFilters = sortedFilters.filter(filter => filter.folder === selectedFolder);
        }
        
        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filteredFilters = filteredFilters.filter(filter => 
                filter.url.toLowerCase().includes(query) || 
                filter.folder.toLowerCase().includes(query)
            );
            
            // Show no results state if search returns nothing
            if (filteredFilters.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <circle cx="11" cy="11" r="8"></circle>
                            <path d="m21 21-4.35-4.35"></path>
                        </svg>
                        <p>No filters found</p>
                        <span>No filters match "${escapeHtml(searchQuery)}"</span>
                    </div>
                `;
                paginationControls.style.display = 'flex';
                document.getElementById('prev-page').style.display = 'none';
                document.getElementById('next-page').style.display = 'none';
                document.getElementById('page-numbers').style.display = 'none';
                return;
            }
        }
        
        // Calculate pagination
        const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(filteredFilters.length / itemsPerPage);
        
        // Adjust current page if it's out of bounds
        if (currentPage > totalPages) {
            currentPage = totalPages;
        }
        if (currentPage < 1) {
            currentPage = 1;
        }
        
        // Get filters for current page
        let displayFilters;
        if (itemsPerPage === 'all') {
            displayFilters = filteredFilters;
            // Hide pagination buttons but keep the per-page selector visible
            document.getElementById('prev-page').style.display = 'none';
            document.getElementById('next-page').style.display = 'none';
            document.getElementById('page-numbers').style.display = 'none';
            paginationControls.style.display = 'flex';
        } else {
            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            displayFilters = filteredFilters.slice(startIndex, endIndex);
            // Show pagination buttons
            document.getElementById('prev-page').style.display = 'flex';
            document.getElementById('next-page').style.display = 'flex';
            document.getElementById('page-numbers').style.display = 'flex';
            paginationControls.style.display = 'flex';
        }
        
        container.innerHTML = displayFilters.map(filter => `
            <div class="filter-item">
                <div class="filter-item-content">
                    <div class="filter-url editable" data-field="url" data-key="${escapeHtml(filter.url)}" title="Click to edit">
                        <img class="url-favicon" src="${getFaviconURL(filter.url)}" alt="" onerror="this.style.display='none'">
                        <span class="url-text">${escapeHtml(filter.url)}</span>
                    </div>
                    <div class="filter-arrow">→</div>
                    <div class="filter-folder editable" data-field="folder" data-key="${escapeHtml(filter.url)}" title="Click to edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        </svg>
                        <span class="folder-text">${escapeHtml(filter.folder)}</span>
                    </div>
                </div>
                <button class="btn-delete" data-filter="${escapeHtml(filter.url)}" title="Delete filter">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        `).join('');
        
        // Update pagination controls
        if (itemsPerPage !== 'all' && totalPages > 1) {
            updatePaginationControls(totalPages);
        }
        
        // Add delete button listeners
        container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filterKey = e.currentTarget.getAttribute('data-filter');
                deleteFilter(filterKey);
            });
        });
        
        // Add edit listeners
        container.querySelectorAll('.editable').forEach(elem => {
            elem.addEventListener('click', (e) => {
                startEditing(e.currentTarget);
            });
        });
        
        saveTimestamps();
    });
}

// Update pagination controls
function updatePaginationControls(totalPages) {
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const pageNumbers = document.getElementById('page-numbers');
    
    // Update prev/next button states
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
    
    // Generate page numbers
    const pageNumbersHTML = [];
    const maxVisiblePages = 7;
    
    if (totalPages <= maxVisiblePages) {
        // Show all pages
        for (let i = 1; i <= totalPages; i++) {
            pageNumbersHTML.push(`
                <button class="page-number ${i === currentPage ? 'active' : ''}" data-page="${i}">
                    ${i}
                </button>
            `);
        }
    } else {
        // Show first page
        pageNumbersHTML.push(`
            <button class="page-number ${currentPage === 1 ? 'active' : ''}" data-page="1">1</button>
        `);
        
        // Show ellipsis or pages around current
        if (currentPage <= 3) {
            // Near start
            for (let i = 2; i <= 5; i++) {
                pageNumbersHTML.push(`
                    <button class="page-number ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>
                `);
            }
            pageNumbersHTML.push(`<span class="page-number ellipsis">...</span>`);
        } else if (currentPage >= totalPages - 2) {
            // Near end
            pageNumbersHTML.push(`<span class="page-number ellipsis">...</span>`);
            for (let i = totalPages - 4; i < totalPages; i++) {
                pageNumbersHTML.push(`
                    <button class="page-number ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>
                `);
            }
        } else {
            // Middle
            pageNumbersHTML.push(`<span class="page-number ellipsis">...</span>`);
            for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                pageNumbersHTML.push(`
                    <button class="page-number ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>
                `);
            }
            pageNumbersHTML.push(`<span class="page-number ellipsis">...</span>`);
        }
        
        // Show last page
        pageNumbersHTML.push(`
            <button class="page-number ${currentPage === totalPages ? 'active' : ''}" data-page="${totalPages}">
                ${totalPages}
            </button>
        `);
    }
    
    pageNumbers.innerHTML = pageNumbersHTML.join('');
    
    // Add click listeners to page numbers
    pageNumbers.querySelectorAll('.page-number:not(.ellipsis)').forEach(btn => {
        btn.addEventListener('click', () => {
            currentPage = parseInt(btn.getAttribute('data-page'));
            renderFilters();
        });
    });
}

// Start editing an element
function startEditing(element) {
    // Check if already editing
    if (element.querySelector('.edit-input')) {
        return;
    }
    
    const field = element.getAttribute('data-field');
    const key = element.getAttribute('data-key');
    let currentValue;
    
    if (field === 'url') {
        // For URL field, get the text from the span
        const urlTextSpan = element.querySelector('.url-text');
        currentValue = urlTextSpan ? urlTextSpan.textContent : key;
    } else {
        currentValue = element.querySelector('.folder-text').textContent;
    }
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'edit-input';
    input.value = currentValue;
    
    // Replace content with input
    if (field === 'url') {
        // Save the favicon for later
        const favicon = element.querySelector('.url-favicon');
        const faviconHTML = favicon ? favicon.outerHTML : '';
        
        element.innerHTML = faviconHTML;
        element.appendChild(input);
    } else {
        const folderText = element.querySelector('.folder-text');
        folderText.textContent = '';
        folderText.appendChild(input);
    }
    
    input.focus();
    input.select();
    
    // Prevent blur on input click
    input.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });
    
    input.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // Save on blur, but only if we're actually blurring (not clicking on the input itself)
    input.addEventListener('blur', (e) => {
        // Small delay to ensure we're not just refocusing
        setTimeout(() => {
            if (document.activeElement !== input) {
                const newValue = input.value.trim();
                editFilter(key, field, newValue);
            }
        }, 100);
    });
    
    // Save on Enter
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        }
    });
    
    // Cancel on Escape
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            renderFilters();
        }
    });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Update file type filter checkboxes
function updateFileTypeToggles() {
    chrome.storage.local.get(['images', 'torrents', 'music', 'docs', 'arch'], (storage) => {
        document.getElementById('filter-images').checked = storage.images === true;
        document.getElementById('filter-torrents').checked = storage.torrents === true;
        document.getElementById('filter-music').checked = storage.music === true;
        document.getElementById('filter-docs').checked = storage.docs === true;
        document.getElementById('filter-archives').checked = storage.arch === true;
    });
}

// Save file type filter
function saveFileTypeFilter(type, enabled) {
    const data = {};
    data[type] = enabled;
    
    chrome.storage.local.set(data, () => {
        const typeNames = {
            'images': 'Images',
            'torrents': 'Torrents',
            'music': 'Music',
            'docs': 'Documents',
            'arch': 'Archives'
        };
        showToast(`${typeNames[type]} filter ${enabled ? 'enabled' : 'disabled'}`, 'success');
    });
}

// Export settings
function exportSettings() {
    chrome.storage.local.get(null, (data) => {
        const jsonData = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `maid_v2_settings_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
        showToast('Settings exported successfully', 'success');
    });
}

// Import settings
function importSettings(file) {
    if (!file) {
        showToast('No file selected', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const settings = JSON.parse(e.target.result);
            chrome.storage.local.clear(() => {
                chrome.storage.local.set(settings, () => {
                    showToast('Settings imported successfully', 'success');
                    renderFilters();
                    updateFilterCount();
                    updateFileTypeToggles();
                });
            });
        } catch (error) {
            showToast('Invalid settings file', 'error');
            console.error('Import error:', error);
        }
    };
    reader.readAsText(file);
}

// Theme toggle
function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const currentTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    themeToggle.checked = currentTheme === 'dark';
    
    themeToggle.addEventListener('change', (e) => {
        const theme = e.target.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    });
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    // Load timestamps
    loadTimestamps();
    
    // Set version
    document.getElementById('version').textContent = `Version ${getVersion()}`;
    
    // Initialize theme
    initTheme();
    
    // Set sort dropdown
    const sortSelect = document.getElementById('sort-select');
    sortSelect.value = currentSort;
    
    // Render initial state
    renderFilters();
    updateFilterCount();
    updateFileTypeToggles();
    populateFolderFilter();
    
    // URL info toggle
    const toggleInfoBtn = document.getElementById('toggle-url-info');
    const infoBox = document.getElementById('url-info-box');
    
    toggleInfoBtn.addEventListener('click', () => {
        if (infoBox.style.display === 'none') {
            infoBox.style.display = 'flex';
            toggleInfoBtn.classList.add('active');
            toggleInfoBtn.title = 'Hide help';
        } else {
            infoBox.style.display = 'none';
            toggleInfoBtn.classList.remove('active');
            toggleInfoBtn.title = 'Show help';
        }
    });
    
    // Add filter button
    document.getElementById('add-filter-btn').addEventListener('click', addFilter);
    
    // Clear all button
    document.getElementById('clear-all-btn').addEventListener('click', clearAllFilters);
    
    // Sort dropdown
    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        localStorage.setItem('filterSort', currentSort);
        currentPage = 1; // Reset to first page when sorting changes
        renderFilters();
    });
    
    // Folder filter dropdown
    const folderFilterSelect = document.getElementById('folder-filter-select');
    folderFilterSelect.addEventListener('change', (e) => {
        selectedFolder = e.target.value;
        currentPage = 1; // Reset to first page when folder changes
        
        // Show/hide rename button
        const renameFolderBtn = document.getElementById('rename-folder-btn');
        if (selectedFolder) {
            renameFolderBtn.style.display = 'flex';
        } else {
            renameFolderBtn.style.display = 'none';
        }
        
        renderFilters();
    });
    
    // Rename folder button
    document.getElementById('rename-folder-btn').addEventListener('click', () => {
        if (!selectedFolder) return;
        
        // Get count of filters in this folder
        chrome.storage.local.get(null, (storage) => {
            let count = 0;
            for (const key in storage) {
                if (!['torrents', 'images', 'music', 'docs', 'arch'].includes(key)) {
                    if (storage[key] === selectedFolder) {
                        count++;
                    }
                }
            }
            
            // Show rename modal
            const modal = document.getElementById('rename-folder-modal');
            document.getElementById('old-folder-name').textContent = selectedFolder;
            document.getElementById('folder-filter-count').textContent = count;
            document.getElementById('new-folder-name').value = selectedFolder;
            modal.classList.add('show');
            
            // Focus input and select text
            setTimeout(() => {
                const input = document.getElementById('new-folder-name');
                input.focus();
                input.select();
            }, 100);
        });
    });
    
    // Rename modal handlers
    document.getElementById('rename-modal-cancel').addEventListener('click', () => {
        document.getElementById('rename-folder-modal').classList.remove('show');
    });
    
    document.getElementById('rename-modal-confirm').addEventListener('click', () => {
        const newName = document.getElementById('new-folder-name').value.trim();
        if (newName) {
            renameFolder(selectedFolder, newName);
            document.getElementById('rename-folder-modal').classList.remove('show');
        }
    });
    
    // Enter key in rename input
    document.getElementById('new-folder-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('rename-modal-confirm').click();
        }
    });
    
    // Close rename modal on overlay click
    document.querySelector('#rename-folder-modal .modal-overlay').addEventListener('click', () => {
        document.getElementById('rename-folder-modal').classList.remove('show');
    });
    
    // Items per page selector
    const perPageSelect = document.getElementById('per-page-select');
    perPageSelect.value = itemsPerPage === 'all' ? 'all' : itemsPerPage.toString();
    
    perPageSelect.addEventListener('change', (e) => {
        const value = e.target.value;
        itemsPerPage = value === 'all' ? 'all' : parseInt(value);
        localStorage.setItem('itemsPerPage', itemsPerPage);
        currentPage = 1; // Reset to first page when items per page changes
        renderFilters();
    });
    
    // Pagination buttons
    document.getElementById('prev-page').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderFilters();
        }
    });
    
    document.getElementById('next-page').addEventListener('click', () => {
        currentPage++;
        renderFilters();
    });
    
    // Search functionality
    const filterSearch = document.getElementById('filter-search');
    const clearSearchBtn = document.getElementById('clear-search');
    const searchToggleBtn = document.getElementById('search-toggle-btn');
    
    // Toggle search input visibility
    searchToggleBtn.addEventListener('click', () => {
        if (filterSearch.classList.contains('search-input-visible')) {
            // Hide search
            filterSearch.classList.remove('search-input-visible');
            filterSearch.value = '';
            searchQuery = '';
            clearSearchBtn.style.display = 'none';
            currentPage = 1;
            renderFilters();
        } else {
            // Show search
            filterSearch.classList.add('search-input-visible');
            setTimeout(() => filterSearch.focus(), 300);
        }
    });
    
    filterSearch.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        currentPage = 1; // Reset to first page when searching
        
        // Show/hide clear button
        if (searchQuery.trim()) {
            clearSearchBtn.style.display = 'flex';
        } else {
            clearSearchBtn.style.display = 'none';
        }
        
        renderFilters();
    });
    
    clearSearchBtn.addEventListener('click', () => {
        filterSearch.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        currentPage = 1;
        renderFilters();
        filterSearch.focus();
    });
    
    // Close search on Escape key
    filterSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchToggleBtn.click();
        }
    });
    
    // Enter key support for inputs
    document.getElementById('url-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('folder-input').focus();
        }
    });
    
    document.getElementById('folder-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addFilter();
        }
    });
    
    // Folder autocomplete
    const folderInput = document.getElementById('folder-input');
    
    folderInput.addEventListener('focus', () => {
        // Don't show if we just selected a folder
        if (!justSelectedFolder) {
            showFolderSuggestions(folderInput.value);
        }
    });
    
    folderInput.addEventListener('input', (e) => {
        // Don't show if we just selected a folder
        if (!justSelectedFolder) {
            showFolderSuggestions(e.target.value);
        }
    });
    
    folderInput.addEventListener('keydown', (e) => {
        const suggestionsDiv = document.getElementById('folder-suggestions');
        if (e.key === 'Escape' && suggestionsDiv.classList.contains('show')) {
            suggestionsDiv.classList.remove('show');
            e.preventDefault();
        }
    });
    
    // Hide suggestions when clicking outside
    document.addEventListener('click', hideFolderSuggestions);
    
    // URL autocomplete from download history
    const urlInput = document.getElementById('url-input');
    
    urlInput.addEventListener('focus', () => {
        // Don't show if we just selected a URL
        if (!justSelectedURL) {
            showURLSuggestions(urlInput.value);
        }
    });
    
    urlInput.addEventListener('input', (e) => {
        // Don't show if we just selected a URL
        if (!justSelectedURL) {
            showURLSuggestions(e.target.value);
        }
    });
    
    urlInput.addEventListener('keydown', (e) => {
        const suggestionsDiv = document.getElementById('url-suggestions');
        if (e.key === 'Escape' && suggestionsDiv.classList.contains('show')) {
            suggestionsDiv.classList.remove('show');
            e.preventDefault();
        }
    });
    
    // Hide URL suggestions when clicking outside
    document.addEventListener('click', hideURLSuggestions);
    
    // File type toggles
    document.getElementById('filter-images').addEventListener('change', (e) => {
        saveFileTypeFilter('images', e.target.checked);
    });
    
    document.getElementById('filter-torrents').addEventListener('change', (e) => {
        saveFileTypeFilter('torrents', e.target.checked);
    });
    
    document.getElementById('filter-music').addEventListener('change', (e) => {
        saveFileTypeFilter('music', e.target.checked);
    });
    
    document.getElementById('filter-docs').addEventListener('change', (e) => {
        saveFileTypeFilter('docs', e.target.checked);
    });
    
    document.getElementById('filter-archives').addEventListener('change', (e) => {
        saveFileTypeFilter('arch', e.target.checked);
    });
    
    // Export/Import buttons
    document.getElementById('export-btn').addEventListener('click', exportSettings);
    
    document.getElementById('import-btn').addEventListener('click', () => {
        document.getElementById('import-file').click();
    });
    
    document.getElementById('import-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            importSettings(file);
        }
        // Reset the input so the same file can be selected again
        e.target.value = '';
    });
    
    // Drag and drop for import
    const dropZone = document.getElementById('import-drop-zone');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('drag-over');
        });
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('drag-over');
        });
    });
    
    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type === 'application/json' || file.name.endsWith('.json')) {
                importSettings(file);
            } else {
                showToast('Please drop a JSON file', 'error');
            }
        }
    });
    
    // Advanced Settings Toggle
    const advancedToggleBtn = document.getElementById('advanced-toggle-btn');
    const advancedSettingsContent = document.getElementById('advanced-settings-content');
    const advancedSettingsHeader = document.getElementById('advanced-settings-header');
    
    advancedSettingsHeader.addEventListener('click', () => {
        const isExpanded = advancedSettingsContent.classList.contains('expanded');
        
        if (isExpanded) {
            advancedSettingsContent.classList.remove('expanded');
            advancedSettingsContent.style.display = 'none';
            advancedToggleBtn.classList.remove('expanded');
        } else {
            advancedSettingsContent.style.display = 'block';
            // Trigger reflow
            advancedSettingsContent.offsetHeight;
            advancedSettingsContent.classList.add('expanded');
            advancedToggleBtn.classList.add('expanded');
        }
    });
    
    // Advanced Settings - Download Threshold
    const thresholdSlider = document.getElementById('min-download-threshold');
    const thresholdValue = document.getElementById('threshold-value');
    
    // Set initial value
    thresholdSlider.value = minDownloadThreshold;
    thresholdValue.textContent = minDownloadThreshold;
    
    thresholdSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        thresholdValue.textContent = value;
        minDownloadThreshold = value;
        localStorage.setItem('minDownloadThreshold', value);
        
        // Update URL suggestions if the input is focused
        const urlInput = document.getElementById('url-input');
        if (document.activeElement === urlInput) {
            showURLSuggestions(urlInput.value);
        }
    });
    
    // Advanced Settings - History Timeframe
    const timeframeSelect = document.getElementById('history-timeframe');
    const timeframeValue = document.getElementById('timeframe-value');
    
    // Helper function to get timeframe display text
    function getTimeframeText(value) {
        const options = {
            '1': 'Last Month',
            '3': 'Last 3 Months',
            '6': 'Last 6 Months',
            '12': 'Last Year',
            '24': 'Last 2 Years',
            'all': 'All Time'
        };
        return options[value] || 'Last 6 Months';
    }
    
    // Set initial value
    timeframeSelect.value = historyTimeframe;
    timeframeValue.textContent = getTimeframeText(historyTimeframe);
    
    timeframeSelect.addEventListener('change', (e) => {
        const value = e.target.value;
        historyTimeframe = value;
        timeframeValue.textContent = getTimeframeText(value);
        localStorage.setItem('historyTimeframe', value);
        
        // Update URL suggestions if the input is focused
        const urlInput = document.getElementById('url-input');
        if (document.activeElement === urlInput) {
            showURLSuggestions(urlInput.value);
        }
    });
    
    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            renderFilters();
            updateFilterCount();
            updateFileTypeToggles();
        }
    });
});
