// ============================================
// VML Paths Manager Assistant — Popup: Jira Parser
// UI and Extraction handler for Jira AEM Path Parser
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  const btnScanJira = document.getElementById('btnScanJira');
  const btnCopyFormatted = document.getElementById('btnCopyFormatted');
  const scanActionButtons = document.getElementById('scanActionButtons');
  const jiraStatusEl = document.getElementById('jiraStatus');
  const activeTicketInfo = document.getElementById('activeTicketInfo');
  const btnScanSubtasks = document.getElementById('btnScanSubtasks');
  const subtasksScanContainer = document.getElementById('subtasksScanContainer');
  const btnDownloadTxt = document.getElementById('btnDownloadTxt');
  const btnToggleSettings = document.getElementById('btnToggleSettings');
  const pmSettingsPanel = document.getElementById('pmSettingsPanel');
  const inputPmList = document.getElementById('inputPmList');
  const btnSaveSettings = document.getElementById('btnSaveSettings');

  if (!btnScanJira) return;

  let currentParsedData = [];
  let autoFixLog = [];

  // Show status messages
  function showJiraStatus(text, isError = false) {
    if (!jiraStatusEl) return;
    jiraStatusEl.textContent = text;
    jiraStatusEl.style.display = 'block';
    jiraStatusEl.className = 'autofill-status ' + (isError ? 'autofill-status--error' : 'autofill-status--success');
  }

  function showJiraStatusBold(text, isError = false) {
    if (!jiraStatusEl) return;
    jiraStatusEl.textContent = '';
    const strong = document.createElement('strong');
    strong.textContent = text;
    jiraStatusEl.appendChild(strong);
    jiraStatusEl.style.display = 'block';
    jiraStatusEl.className = 'autofill-status ' + (isError ? 'autofill-status--error' : 'autofill-status--success');
  }

  const autoFixLogContainer = document.getElementById('autoFixLogContainer');
  const autoFixPillsWrapper = document.getElementById('autoFixPillsWrapper');

  function showVmlConfirm(title, message, confirmText = "OK", cancelText = "CANCEL") {
    return new Promise((resolve) => {
      const modal = document.getElementById('vmlModal');
      const titleEl = document.getElementById('vmlModalTitle');
      const textEl = document.getElementById('vmlModalText');
      const okBtn = document.getElementById('vmlModalOkBtn');
      const cancelBtn = document.getElementById('vmlModalCancelBtn');
      const closeBtn = document.getElementById('vmlModalClose');
      const listEl = document.getElementById('vmlModalList');

      if (!modal) {
        resolve(confirm(title + '\n\n' + message));
        return;
      }

      titleEl.textContent = title;
      textEl.textContent = message;
      if (listEl) listEl.textContent = '';
      if (okBtn) okBtn.textContent = confirmText;
      
      if (cancelBtn) {
        cancelBtn.style.display = 'block';
        cancelBtn.textContent = cancelText;
      }

      modal.style.display = 'flex';

      function cleanup() {
        modal.style.display = 'none';
        if (okBtn) okBtn.removeEventListener('click', onOk);
        if (cancelBtn) cancelBtn.removeEventListener('click', onCancel);
        if (closeBtn) closeBtn.removeEventListener('click', onCancel);
      }

      function onOk() {
        cleanup();
        resolve(true);
      }

      function onCancel() {
        cleanup();
        resolve(false);
      }

      if (okBtn) okBtn.addEventListener('click', onOk);
      if (cancelBtn) cancelBtn.addEventListener('click', onCancel);
      if (closeBtn) closeBtn.addEventListener('click', onCancel);
    });
  }

  function renderAutoFixPills(logs, origin) {
    if (!autoFixLogContainer || !autoFixPillsWrapper) return;
    if (!logs || logs.length === 0) {
      autoFixLogContainer.style.display = 'none';
      return;
    }

    const groupedLogs = {};
    for (const log of logs) {
      const key = log.key || 'UNKNOWN';
      if (!groupedLogs[key]) {
        groupedLogs[key] = { types: new Set(), rawTypes: [] };
      }
      
      let shortType = log.type;
      if (log.type.includes('Locale Fixed')) {
        const locale = log.type.split('to ')[1];
        shortType = `Locale \u2192 ${locale}`;
      } else if (log.type === 'Editor URL Converted') {
        shortType = 'Editor URL';
      } else if (log.type === 'Item URL Fixed' || log.type === 'Item URL Unified') {
        shortType = 'Item URL Unified';
      } else if (log.type === 'Direct Item Extracted') {
        shortType = 'Item Extracted';
      } else if (log.type === 'Editor URL Ignored') {
        shortType = 'Editor Ignored';
      }
      
      if (!groupedLogs[key].types.has(shortType)) {
        groupedLogs[key].types.add(shortType);
        groupedLogs[key].rawTypes.push(log.type);
      }
    }

    autoFixPillsWrapper.textContent = '';
    for (const [key, group] of Object.entries(groupedLogs)) {
      const typesStr = Array.from(group.types).join(' \u2022 ');
      const tooltip = `Auto Fixes Applied:\n- ${group.rawTypes.join('\n- ')}`;
      
      if (key !== 'UNKNOWN' && origin) {
          const a = document.createElement('a');
          a.href = `${origin}/browse/${key}`;
          a.target = '_blank';
          a.title = tooltip;
          a.className = 'autofix-pill-link';
          a.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; background: rgba(255, 171, 0, 0.1); border-radius: 4px; color: #ffab00; text-decoration: none; border: 1px solid rgba(255, 171, 0, 0.3); font-size: 10px; transition: background 0.2s;';
          
          const s1 = document.createElement('span');
          s1.style.fontWeight = '700';
          s1.textContent = key;
          
          const s2 = document.createElement('span');
          s2.style.cssText = 'opacity:0.7; font-size: 9px; text-transform: uppercase;';
          s2.textContent = typesStr;
          
          a.appendChild(s1);
          a.appendChild(s2);
          autoFixPillsWrapper.appendChild(a);
      } else {
          const s = document.createElement('span');
          s.title = tooltip;
          s.style.cssText = 'display: inline-flex; align-items: center; padding: 4px 8px; background: rgba(255, 171, 0, 0.1); border-radius: 4px; color: #ffab00; font-size: 10px; border: 1px solid rgba(255, 171, 0, 0.3);';
          s.textContent = typesStr;
          autoFixPillsWrapper.appendChild(s);
      }
    }
    
    autoFixLogContainer.style.display = 'flex';
  }

  function clearJiraStatus() {
    if (jiraStatusEl) jiraStatusEl.style.display = 'none';
    if (autoFixLogContainer) autoFixLogContainer.style.display = 'none';
  }

  function updateSubtasksButton(subtasks) {
    if (!btnScanSubtasks) return;
    const count = (subtasks && subtasks.length) || 0;
    btnScanSubtasks.textContent = `SCAN ALL SUB-TASKS (${count})`;
    if (count > 0) {
      btnScanSubtasks.disabled = false;
      btnScanSubtasks.dataset.subtasks = subtasks.join(',');
    } else {
      btnScanSubtasks.disabled = true;
      btnScanSubtasks.removeAttribute('data-subtasks');
    }
  }

  // Initialize subtasks button state
  updateSubtasksButton([]);

  // --- CACHE MANAGEMENT ---
  function saveScanCache(url, issueKey, data, subtasks, fixLog) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const cacheObj = {
        issueKey: issueKey,
        data: data,
        subtasks: subtasks || [],
        autoFixLog: fixLog || [],
        timestamp: Date.now()
      };
      const storageKey = issueKey ? `jira_cache_${issueKey}` : `jira_cache_${url}`;
      chrome.storage.local.set({ [storageKey]: cacheObj });
    }
  }

  function loadScanCache(url, callback) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const issueKey = getJiraKeyFromUrl(url);
      const storageKey = issueKey ? `jira_cache_${issueKey}` : `jira_cache_${url}`;
      chrome.storage.local.get([storageKey], (result) => {
        callback(result[storageKey]);
      });
    } else {
      callback(null);
    }
  }

  function getJiraKeyFromUrl(url) {
    if (!url) return '';
    try {
      const urlObj = new URL(url);
      const browseMatch = urlObj.pathname.match(/\/browse\/([A-Z0-9]+-[0-9]+)/i);
      if (browseMatch) return browseMatch[1].toUpperCase();

      const selectedIssue = urlObj.searchParams.get('selectedIssue');
      if (selectedIssue && selectedIssue.match(/^[A-Z0-9]+-[0-9]+$/i)) {
        return selectedIssue.toUpperCase();
      }

      const genericMatch = url.match(/([A-Z0-9]+-[0-9]+)/i);
      if (genericMatch) return genericMatch[1].toUpperCase();
    } catch (e) {
      console.warn("Error parsing URL to get Jira key:", e);
    }
    return '';
  }

  // --- PM CONFIGURATION MANAGEMENT ---
  let pmListArray = []; // empty by default (no filter)

  function formatPmListNames(str) {
    if (!str) return '';
    return str.split(',')
      .map(name => {
        return name.trim()
          .split(/\s+/)
          .map(word => {
            if (!word) return '';
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
          })
          .join(' ');
      })
      .filter(Boolean)
      .join(', ');
  }

  function loadPmSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['pmList'], (result) => {
        let listStr = result.pmList;
        if (listStr === undefined) {
          // Keep empty by default so it shows the placeholder
          listStr = "";
          chrome.storage.local.set({ pmList: listStr });
        } else {
          listStr = formatPmListNames(listStr);
        }
        if (inputPmList) {
          inputPmList.value = listStr;
        }
        // Update local array (lowercase, trimmed)
        pmListArray = listStr.split(',').map(name => name.trim().toLowerCase()).filter(Boolean);
      });
    } else {
      if (inputPmList) {
        inputPmList.value = "";
      }
      pmListArray = [];
    }
  }

  loadPmSettings();

  if (btnToggleSettings && pmSettingsPanel) {
    btnToggleSettings.addEventListener('click', () => {
      const isHidden = pmSettingsPanel.style.display === 'none';
      pmSettingsPanel.style.display = isHidden ? 'block' : 'none';
    });
  }

  if (inputPmList) {
    inputPmList.addEventListener('blur', () => {
      inputPmList.value = formatPmListNames(inputPmList.value);
    });
  }

  if (btnSaveSettings && inputPmList) {
    btnSaveSettings.addEventListener('click', () => {
      const rawStr = inputPmList.value || '';
      const listStr = formatPmListNames(rawStr);
      if (inputPmList) {
        inputPmList.value = listStr;
      }
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ pmList: listStr }, () => {
          showJiraStatus("Configuration saved successfully!");
          pmListArray = listStr.split(',').map(name => name.trim().toLowerCase()).filter(Boolean);
          if (pmSettingsPanel) {
            pmSettingsPanel.style.display = 'none';
          }
        });
      } else {
        pmListArray = listStr.split(',').map(name => name.trim().toLowerCase()).filter(Boolean);
        showJiraStatus("Configuration updated!");
        if (pmSettingsPanel) {
          pmSettingsPanel.style.display = 'none';
        }
      }
    });
  }

  // Common copy helper
  function copyText(text, successMsg = "Copied!") {
    navigator.clipboard.writeText(text)
      .then(() => showJiraStatus(successMsg))
      .catch(err => {
        showJiraStatus("Failed to copy", true);
        console.error(err);
      });
  }

  // --- 1. CORE EXTRACTION ALGORITHM ---
  function detectLocaleFromSummary(summary) {
    if (!summary) return null;
    const s = summary.toUpperCase();
    const hasCA = /\bCA\b/.test(s);
    const hasUS = /\bUS\b/.test(s);
    if (hasCA && !hasUS) return 'en_ca';
    if (hasUS && !hasCA) return 'en_us';
    return null;
  }
  function htmlToPlainText(html) {
    if (!html.includes('<') && !html.includes('&')) {
      return html;
    }
    try {
      let cleanHtml = html
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<\/tr>/gi, '\n');
      const doc = new DOMParser().parseFromString(cleanHtml, 'text/html');
      return doc.body.textContent || doc.body.innerText || html;
    } catch (e) {
      console.error("DOMParser error:", e);
      return html;
    }
  }

  function hasAemUrls(text) {
    if (!text) return false;
    const matches = text.match(/https?:\/\/[^\s"'<>\(\)\[\]\|]+/g) || [];
    return matches.some(url => {
      if (url.includes('wcmmode=')) return false;
      return url.includes('/content/') || 
             url.includes('/ui#/aem/') || 
             url.includes('/assets.html/') || 
             url.includes('/editor.html/');
    });
  }

  function getCategory(jcrPath, url) {
    const pathLower = jcrPath.toLowerCase();
    const urlLower = url.toLowerCase();
    
    if (pathLower.includes('/experience-fragments/')) {
      return 'XF';
    }
    if (urlLower.includes('/vdm') || pathLower.includes('/vdm')) {
      return 'VDM';
    }
    if (pathLower.includes('/content/dam/')) {
      if (pathLower.includes('/cf/') || pathLower.includes('/content-fragments/')) {
        return 'CF';
      } else {
        return 'Assets';
      }
    }
    if (pathLower.startsWith('/content/')) {
      return 'Pages';
    }
    return 'Pages';
  }

  function extractAEMData(jiraText) {
    const plainText = htmlToPlainText(jiraText);
    const lines = plainText.split('\n');
    const results = [];
    let currentGroup = null;
    let currentTicketKey = '';
    let currentTicketLocale = null;
    let currentMode = 'publish';

    for (let line of lines) {
      if (line.startsWith('[TICKET_KEY:')) {
        currentTicketKey = line.substring(12, line.lastIndexOf(']'));
        currentTicketLocale = null; // Reset locale for each new ticket
        currentMode = 'publish'; // Reset mode for each new ticket
        currentGroup = null; // Prevent bleeding across tickets
        continue;
      }
      if (line.startsWith('[TICKET_LOCALE:')) {
        currentTicketLocale = line.substring(15, line.lastIndexOf(']'));
        continue;
      }
      let cleanLine = line.trim();

      // State Machine for Publish vs Deactivate modes
      const upperLine = cleanLine.toUpperCase();
      if (upperLine.includes('DEACTIVATE')) {
        if (currentMode !== 'deactivate') {
          currentMode = 'deactivate';
          currentGroup = null;
        }
      } else if (upperLine.includes('PUBLISH') || upperLine.includes('PUBLISHING PATH')) {
        if (currentMode !== 'publish') {
          currentMode = 'publish';
          currentGroup = null;
        }
      }

      // Find an AEM URL in this line
      const urlMatch = cleanLine.match(/https?:\/\/[^\s"'<>\(\)\[\]\|]+/);
      if (urlMatch) {
        let cleanUrl = urlMatch[0];
        const isAemUrl = !cleanUrl.includes('wcmmode=') && (
                          cleanUrl.includes('/content/') || 
                          cleanUrl.includes('/ui#/aem/') || 
                          cleanUrl.includes('/assets.html/') || 
                          cleanUrl.includes('/editor.html/'));

        if (isAemUrl) {
          if (currentTicketLocale) {
            const localeMatch = cleanUrl.match(/\/(en_us|en_ca|fr_ca|es_us)\//i);
            if (localeMatch) {
              const urlLocale = localeMatch[1].toLowerCase();
              if (urlLocale === 'en_us' && currentTicketLocale === 'en_ca') {
                cleanUrl = cleanUrl.replace(/\/(en_us)\//i, '/en_ca/');
                if (currentTicketKey) autoFixLog.push({ key: currentTicketKey, type: 'Locale Fixed to en_ca' });
                else autoFixLog.push({ key: null, type: 'Locale Fixed to en_ca' });
              } else if (urlLocale === 'en_ca' && currentTicketLocale === 'en_us') {
                cleanUrl = cleanUrl.replace(/\/(en_ca)\//i, '/en_us/');
                if (currentTicketKey) autoFixLog.push({ key: currentTicketKey, type: 'Locale Fixed to en_us' });
                else autoFixLog.push({ key: null, type: 'Locale Fixed to en_us' });
              }
            }
          }
          try {
            const urlObj = new URL(cleanUrl);
            const origin = urlObj.origin;
            
            // Extract JCR path by splitting on '/content/'
            const parts = cleanUrl.split('/content/');
            if (parts.length >= 2) {
              // Clean up query parameters or hashes from JCR path
              let cleanPathPart = parts[1].split('?')[0].split('#')[0];
              let folderJcrPath = '/content/' + cleanPathPart;

              let implicitItem = null;
              if (folderJcrPath.endsWith('.html')) {
                folderJcrPath = folderJcrPath.substring(0, folderJcrPath.length - 5);
                const lastSlashIdx = folderJcrPath.lastIndexOf('/');
                if (lastSlashIdx !== -1) {
                  implicitItem = folderJcrPath.substring(lastSlashIdx + 1);
                  folderJcrPath = folderJcrPath.substring(0, lastSlashIdx);
                  
                  if (currentTicketKey) autoFixLog.push({ key: currentTicketKey, type: 'Direct Item Extracted' });
                  else autoFixLog.push({ key: null, type: 'Direct Item Extracted' });
                }
              }

              let normalizedBaseUrl = cleanUrl;

              if (cleanUrl.includes('editor.html')) {
                if (currentTicketKey) autoFixLog.push({ key: currentTicketKey, type: 'Editor URL Converted' });
                else autoFixLog.push({ key: null, type: 'Editor URL Converted' });
                
                if (folderJcrPath.includes('/content/experience-fragments/')) {
                  normalizedBaseUrl = `${origin}/aem/experience-fragments.html${folderJcrPath}`;
                } else if (folderJcrPath.includes('/content/dam/')) {
                  normalizedBaseUrl = `${origin}/assets.html${folderJcrPath}`;
                } else if (folderJcrPath.startsWith('/content/')) {
                  normalizedBaseUrl = `${origin}/sites.html${folderJcrPath}`;
                }
              }

              // Strip /ui#/aem/ from URLs to keep them clean and short for Jira
              if (normalizedBaseUrl.includes('/ui#/aem/')) {
                normalizedBaseUrl = normalizedBaseUrl.replace('/ui#/aem/', '/');
              }

              // Deduplicate: merge elements if this folder path was already seen in the same mode
              let existingGroup = results.find(g => g.folderJcrPath === folderJcrPath && g.mode === currentMode);
              if (existingGroup) {
                currentGroup = existingGroup;
              } else {
                currentGroup = {
                  baseUrl: normalizedBaseUrl,
                  origin: origin,
                  folderJcrPath: folderJcrPath,
                  category: getCategory(folderJcrPath, cleanUrl),
                  ticketKey: currentTicketKey,
                  mode: currentMode,
                  elements: []
                };
                results.push(currentGroup);
              }
            }
          } catch (e) {
            console.error("Failed to parse AEM URL:", cleanUrl, e);
          }
        }
      }
      // Detect child elements starting with >, >>, or >>>
      else if (cleanLine.match(/^>+/) && currentGroup) {
        // Strip any sequence of leading '>' and spaces
        const elementName = cleanLine.replace(/^[>\s]+/, '');
        if (elementName) {
          // SMART FIX: If the folder path already ends with the element name, 
          // the publisher pasted the direct URL to the item instead of the parent folder.
          if (currentGroup.folderJcrPath.toLowerCase().endsWith('/' + elementName.toLowerCase().trim())) {
            currentGroup.folderJcrPath = currentGroup.folderJcrPath.substring(0, currentGroup.folderJcrPath.lastIndexOf('/'));
            const lastSlashIdx = currentGroup.baseUrl.lastIndexOf('/');
            if (lastSlashIdx !== -1) {
              currentGroup.baseUrl = currentGroup.baseUrl.substring(0, lastSlashIdx);
            }
            if (currentTicketKey) autoFixLog.push({ key: currentTicketKey, type: 'Item URL Fixed' });
            else autoFixLog.push({ key: null, type: 'Item URL Fixed' });

            const existingMatch = results.find(g => g !== currentGroup && g.folderJcrPath === currentGroup.folderJcrPath && g.mode === currentGroup.mode);
            if (existingMatch) {
              existingMatch.elements.push(...currentGroup.elements);
              const idx = results.indexOf(currentGroup);
              if (idx !== -1) results.splice(idx, 1);
              currentGroup = existingMatch;
            }
          }

          const childJcrPath = `${currentGroup.folderJcrPath}/${elementName}`;
          
          // Deduplicate elements under the same folder case-insensitively
          const exists = currentGroup.elements.some(el => el.name.toLowerCase().trim() === elementName.toLowerCase().trim());
          if (!exists) {
            const isCfOrXfOrPage = childJcrPath.includes('/content/dam/') || 
                                   childJcrPath.includes('/content/experience-fragments/') || 
                                   (!childJcrPath.includes('/content/dam/') && childJcrPath.startsWith('/content/'));
            
            let editorUrl = `${currentGroup.origin}/editor.html${childJcrPath}`;
            if (isCfOrXfOrPage && !childJcrPath.endsWith('.html')) {
              editorUrl += '.html';
            }

            currentGroup.elements.push({
              name: elementName,
              jcrPath: childJcrPath,
              editorUrl: editorUrl
            });
          }
        }
      }
    }

    // Post-processing: Merge item URL groups into parent groups
    // Handles case where a user pastes .../models/tremor.html and then sibling elements like >>> active
    for (let i = results.length - 1; i >= 0; i--) {
      const childGroup = results[i];
      const lastSlashIdx = childGroup.folderJcrPath.lastIndexOf('/');
      if (lastSlashIdx !== -1) {
        const parentPath = childGroup.folderJcrPath.substring(0, lastSlashIdx);
        const itemName = childGroup.folderJcrPath.substring(lastSlashIdx + 1);
        
        const parentGroup = results.find((g, idx) => idx !== i && g.folderJcrPath === parentPath && g.mode === childGroup.mode && g.elements.some(e => e.name.toLowerCase() === itemName.toLowerCase()));
        if (parentGroup) {
          // Merge elements from child to parent
          childGroup.elements.forEach(el => {
            if (!parentGroup.elements.some(e => e.name.toLowerCase() === el.name.toLowerCase())) {
              parentGroup.elements.push(el);
            }
          });
          
          if (childGroup.ticketKey) autoFixLog.push({ key: childGroup.ticketKey, type: 'Item URL Unified' });
          else autoFixLog.push({ key: null, type: 'Item URL Unified' });
          
          results.splice(i, 1); // Remove the child group since it was merged
        }
      }
    }

    // Cross-mode deduplication: If an item exists in DEACTIVATE, remove it from PUBLISH
    const deactivateGroups = results.filter(g => g.mode === 'deactivate');
    const publishGroups = results.filter(g => g.mode === 'publish');

    for (const dGroup of deactivateGroups) {
      const pGroup = publishGroups.find(p => p.folderJcrPath === dGroup.folderJcrPath);
      if (pGroup) {
        dGroup.elements.forEach(dItem => {
          const pItemIndex = pGroup.elements.findIndex(pItem => pItem.name.toLowerCase() === dItem.name.toLowerCase());
          if (pItemIndex !== -1) {
            // Keep the item in both lists, but show a warning pill so the user can verify with the PM
            if (pGroup.ticketKey) autoFixLog.push({ key: pGroup.ticketKey, type: '⚠️ Conflict: Item in both Publish and Deactivate' });
            else autoFixLog.push({ key: null, type: '⚠️ Conflict: Item in both Publish and Deactivate' });
          }
        });
      }
    }

    // Remove empty groups (those that have no extracted items underneath them)
    return results.filter(r => r.elements.length > 0);
  }

  // --- 2. FORMAT AND EXPORT RESULTS ---

  // --- 3. UI EVENTS ---

  // Helper to format groups by category hierarchy
  function getFormattedText(data) {
    const mainLines = ["Publishing Paths\n"];
    
    const categoriesOrder = [
      { key: 'Assets', label: 'Assets:' },
      { key: 'VDM', label: 'VDM Resources:' },
      { key: 'CF', label: 'CFs:' },
      { key: 'XF', label: 'XFs:' },
      { key: 'Pages', label: 'Pages:' }
    ];
    
    // Process Publish Groups
    const publishGroupsData = data.filter(group => group.mode === 'publish');
    categoriesOrder.forEach(cat => {
      const categoryGroups = publishGroupsData.filter(group => group.category === cat.key);
      if (categoryGroups.length > 0) {
        mainLines.push(cat.label);
        categoryGroups.forEach(group => {
          mainLines.push(group.baseUrl);
          group.elements.forEach(el => {
            mainLines.push(`>>> ${el.name}`);
          });
          mainLines.push(""); // empty line after each group
        });
      }
    });

    // Process Deactivate Groups
    const deactivateGroupsData = data.filter(group => group.mode === 'deactivate');
    
    if (deactivateGroupsData.length > 0) {
      mainLines.push("DEACTIVATE\n");
      categoriesOrder.forEach(cat => {
        const categoryGroups = deactivateGroupsData.filter(group => group.category === cat.key);
        if (categoryGroups.length > 0) {
          mainLines.push(cat.label);
          categoryGroups.forEach(group => {
            mainLines.push(group.baseUrl);
            group.elements.forEach(el => {
              mainLines.push(`>>> ${el.name}`);
            });
            mainLines.push(""); // empty line after each group
          });
        }
      });
    }

    return mainLines.join('\n').trim();
  }

  // Button: Scan Active Jira Tab
  if (btnScanJira) {
    btnScanJira.addEventListener('click', async () => {
      try {
        btnScanJira.disabled = true;
        clearJiraStatus();

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
          showJiraStatus("Could not query active tab.", true);
          btnScanJira.disabled = false;
          return;
        }

        // Keep key badge showing the issue key immediately from the URL
        const issueKey = getJiraKeyFromUrl(tab.url);
        if (activeTicketInfo && issueKey) {
          activeTicketInfo.textContent = `Ticket: ${issueKey}`;
          activeTicketInfo.style.display = 'inline-block';
        }
        showJiraStatus("Scanning active tab...");

        // Verify if it's a Jira page
        const isJira = tab.url.includes('jira.uhub.biz') || tab.url.includes('atlassian.net') || tab.url.includes('/browse/');
        if (!isJira) {
          showJiraStatus("Please open a Jira ticket page first.", true);
          if (activeTicketInfo) activeTicketInfo.textContent = "";
          btnScanJira.disabled = false;
          return;
        }

        const baseUrl = new URL(tab.url).origin;
        let responseData = null;
        let subtasksList = [];

        // 1. Try to fetch details via Jira REST API first
        try {
          const res = await fetch(`${baseUrl}/rest/api/2/issue/${issueKey}?fields=summary,description,comment,subtasks,parent&_=${Date.now()}`, { cache: 'no-store' });
          if (res.ok) {
            const json = await res.json();
            const desc = json.fields?.description || '';
            let summary = json.fields?.summary || '';
            
            if (json.fields?.parent?.key) {
               try {
                 const pRes = await fetch(`${baseUrl}/rest/api/2/issue/${json.fields.parent.key}?fields=summary&_=${Date.now()}`, { cache: 'no-store' });
                 if (pRes.ok) {
                   const pJson = await pRes.json();
                   if (pJson.fields?.summary) summary += ' ' + pJson.fields.summary;
                 }
               } catch(e) {}
            }
            
            const commentsList = (json.fields?.comment?.comments || []).map(c => c.body || '');
            subtasksList = (json.fields?.subtasks || []).map(s => s.key).filter(Boolean);
            
            responseData = {
              success: true,
              issueKey: issueKey,
              summary: summary,
              description: desc,
              comments: commentsList,
              subtasks: subtasksList
            };
            console.log("Successfully scanned active ticket via REST API.");
          }
        } catch (apiErr) {
          console.warn("Failed to scan active ticket via REST API, falling back to DOM scraping:", apiErr);
        }

        // 2. Fallback to DOM scraping if API failed
        if (!responseData) {
          await new Promise((resolve) => {
            chrome.tabs.sendMessage(tab.id, { action: 'getJiraIssueDetails' }, (domResponse) => {
              if (chrome.runtime.lastError || !domResponse || !domResponse.success) {
                resolve();
                return;
              }
              responseData = {
                success: true,
                issueKey: domResponse.issueKey || issueKey,
                summary: domResponse.summary || '',
                description: domResponse.description || '',
                comments: domResponse.comments || [],
                subtasks: domResponse.subtasks || []
              };
              resolve();
            });
          });
        }

        btnScanJira.disabled = false;

        if (!responseData) {
          showJiraStatus("Error: Could not retrieve ticket details. Please reload the tab.", true);
          if (activeTicketInfo) activeTicketInfo.textContent = "";
          return;
        }

        // Resolve which text to parse: last comment with publish paths, or description
        const desc = responseData.description || '';
        const commentsList = responseData.comments || [];
        let chosenText = '';
        for (let idx = commentsList.length - 1; idx >= 0; idx--) {
          const commentBody = commentsList[idx] || '';
          if (hasAemUrls(commentBody)) {
            chosenText = commentBody;
            console.log(`Active Jira Ticket: Found publish paths in comment at index ${idx}. Only scanning this comment.`);
            break;
          }
        }
        const summaryStr = responseData.summary || '';
        if (!chosenText) {
          chosenText = summaryStr + '\n' + desc;
          console.log(`Active Jira Ticket: No comments with publish paths found. Scanning the description.`);
        } else {
          chosenText = summaryStr + '\n' + chosenText;
        }
        // Resolve issue key safely
        const finalIssueKey = responseData.issueKey || issueKey;
        const locale = detectLocaleFromSummary(summaryStr);

        // Parse and process
        autoFixLog = [];
        let prependStr = `[TICKET_KEY:${finalIssueKey}]\n`;
        if (locale) prependStr += `[TICKET_LOCALE:${locale}]\n`;
        const data = extractAEMData(prependStr + chosenText);
        currentParsedData = data;

        // Update active ticket info badge
        if (activeTicketInfo && finalIssueKey) {
          activeTicketInfo.textContent = `Ticket: ${finalIssueKey}`;
          activeTicketInfo.style.display = 'inline-block';
        }

        // Update subtask button details
        updateSubtasksButton(responseData.subtasks);

        if (data.length === 0) {
          showJiraStatus("No AEM paths detected.", true);
          if (scanActionButtons) scanActionButtons.style.display = 'none';
          return;
        }

        // Save last detected origin to storage
        if (data && data[0] && data[0].origin) {
          chrome.storage.local.set({ 'last_detected_aem_origin': data[0].origin });
        }

        // Save to cache
        saveScanCache(tab.url, finalIssueKey, data, responseData.subtasks, autoFixLog);

        // Auto-copy to clipboard
        const text = getFormattedText(data);
        navigator.clipboard.writeText(text)
          .then(() => {
            const origin = tab && tab.url ? new URL(tab.url).origin : '';
            renderAutoFixPills(autoFixLog, origin);
            if (autoFixLog.length > 0) {
              showJiraStatusBold("Copied to clipboard!", false);
            } else {
              showJiraStatus(`Scraped ticket ${finalIssueKey} & copied to clipboard!`);
            }
          })
          .catch(err => {
            showJiraStatus("Scraped successfully, but failed to auto-copy.", true);
            console.error(err);
          });

        if (scanActionButtons) scanActionButtons.style.display = 'flex';

      } catch (err) {
        btnScanJira.disabled = false;
        showJiraStatus("An error occurred during scanning.", true);
        console.error(err);
      }
    });
  }

  // Button: Scan All Sub-tasks
  if (btnScanSubtasks) {
    btnScanSubtasks.addEventListener('click', async () => {
      const keysStr = btnScanSubtasks.dataset.subtasks;
      if (!keysStr) return;
      const keys = keysStr.split(',').filter(Boolean);
      if (keys.length === 0) return;

      if (pmListArray.length === 0) {
        const proceed = await showVmlConfirm(
          "NO PM CONFIGURED", 
          "You haven't configured any Project Manager names to filter by. Are you sure you want to scan ALL comments across ALL sub-tasks?",
          "SCAN ALL",
          "CANCEL"
        );
        if (!proceed) return;
      }

      try {
        btnScanSubtasks.disabled = true;
        if (btnScanJira) btnScanJira.disabled = true;
        clearJiraStatus();
        showJiraStatus(`Scanning subtasks (0/${keys.length})...`);

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
          showJiraStatus("Could not query active tab.", true);
          btnScanSubtasks.disabled = false;
          if (btnScanJira) btnScanJira.disabled = false;
          return;
        }

        const baseUrl = new URL(tab.url).origin;
        const fetchedTexts = [];
        
        // Fetch parent ticket summary to inherit locale if subtasks don't have it
        let parentLocale = null;
        try {
          const parentKey = getJiraKeyFromUrl(tab.url);
          if (parentKey) {
            const parentRes = await fetch(`${baseUrl}/rest/api/2/issue/${parentKey}?fields=summary&_=${Date.now()}`, { cache: 'no-store' });
            if (parentRes.ok) {
              const pJson = await parentRes.json();
              parentLocale = detectLocaleFromSummary(pJson.fields?.summary || '');
            }
          }
        } catch (e) {
          console.warn("Could not fetch parent summary", e);
        }

        // Concurrency queue (batch size of 5)
        const batchSize = 5;
        for (let i = 0; i < keys.length; i += batchSize) {
          const batchKeys = keys.slice(i, i + batchSize);
          const promises = batchKeys.map(async (key) => {
            try {
              const res = await fetch(`${baseUrl}/rest/api/2/issue/${key}?fields=summary,description,comment,status,assignee&_=${Date.now()}`, { cache: 'no-store' });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const json = await res.json();
              
              // 1. Filter by Status (skip completed/closed tickets)
              const statusName = (json.fields?.status?.name || '').toLowerCase().trim();
              const skipStatuses = ['done', 'closed', 'resolved', 'canceled', 'cancelled', 'rechazado'];
              if (skipStatuses.includes(statusName)) {
                console.log(`Skipping subtask ${key} because status is "${statusName}"`);
                return '';
              }

              // 2. Filter by Assignee (must be a configured PM, if any PMs are configured)
              let isPM = true;
              const assigneeName = json.fields?.assignee?.name || '';
              const assigneeDisplayName = json.fields?.assignee?.displayName || '';
              if (pmListArray.length > 0) {
                isPM = pmListArray.includes(assigneeName.toLowerCase().trim()) || 
                       pmListArray.includes(assigneeDisplayName.toLowerCase().trim());
              }
              
              if (!isPM) {
                console.log(`Skipping subtask ${key} because assignee "${assigneeDisplayName || assigneeName || 'Unassigned'}" is not in the PM list.`);
                return '';
              }

              const desc = json.fields?.description || '';
              const commentsList = (json.fields?.comment?.comments || []).map(c => c.body || '');
              let chosenText = '';
              for (let idx = commentsList.length - 1; idx >= 0; idx--) {
                const commentBody = commentsList[idx] || '';
                if (hasAemUrls(commentBody)) {
                  chosenText = commentBody;
                  console.log(`Subtask ${key}: Found publish paths in comment at index ${idx}. Only scanning this comment.`);
                  break;
                }
              }
              const summary = json.fields?.summary || '';
              if (!chosenText) {
                chosenText = summary + '\n' + desc;
                console.log(`Subtask ${key}: No comments with publish paths found. Scanning the description.`);
              } else {
                chosenText = summary + '\n' + chosenText;
              }
              const locale = detectLocaleFromSummary(summary) || parentLocale;
              return { key: key, text: chosenText, locale: locale };
            } catch (err) {
              console.warn(`Failed to fetch details for subtask ${key}:`, err);
              return null;
            }
          });

          const batchResults = await Promise.all(promises);
          fetchedTexts.push(...batchResults);
          
          const completedCount = Math.min(i + batchSize, keys.length);
          showJiraStatus(`Scanning subtasks (${completedCount}/${keys.length})...`);
        }

        const validResults = fetchedTexts.filter(r => r && r.text && r.text.trim().length > 0);
        
        // Pre-warm the cache for each individual subtask so they load instantly if the user opens them
        const backupLog = [...autoFixLog];
        for (const res of validResults) {
          autoFixLog = []; // clear to prevent polluting the main log with duplicates
          let prependStr = `[TICKET_KEY:${res.key}]\n`;
          if (res.locale) prependStr += `[TICKET_LOCALE:${res.locale}]\n`;
          const singleData = extractAEMData(prependStr + res.text);
          if (singleData.length > 0) {
            saveScanCache(tab.url, res.key, singleData, [], autoFixLog);
          }
        }
        autoFixLog = backupLog; // restore

        const consolidatedText = validResults.map(r => {
           let header = `[TICKET_KEY:${r.key}]\n`;
           if (r.locale) header += `[TICKET_LOCALE:${r.locale}]\n`;
           return header + r.text;
        }).join('\n\n');

        // Parse and process
        autoFixLog = [];
        const data = extractAEMData(consolidatedText);
        currentParsedData = data;

        if (data.length === 0) {
          showJiraStatus("No AEM paths detected in 'In Progress' or 'Open' PM subtasks.", true);
          if (scanActionButtons) scanActionButtons.style.display = 'none';
          return;
        }

        // Save last detected origin to storage
        if (data && data[0] && data[0].origin) {
          chrome.storage.local.set({ 'last_detected_aem_origin': data[0].origin });
        }

        // Resolve issue key safely
        let issueKey = '';
        if (activeTicketInfo) {
          const badgeText = activeTicketInfo.textContent || '';
          if (badgeText.startsWith('Ticket:') && !badgeText.toLowerCase().includes('scanning')) {
            issueKey = badgeText.replace('Ticket: ', '').trim();
          }
        }
        if (!issueKey) {
          issueKey = getJiraKeyFromUrl(tab.url);
        }

        // Update badge if resolved now
        if (activeTicketInfo && issueKey) {
          activeTicketInfo.textContent = `Ticket: ${issueKey}`;
          activeTicketInfo.style.display = 'inline-block';
        }

        // Save to cache
        saveScanCache(tab.url, issueKey, data, keys, autoFixLog);

        // Auto-copy to clipboard
        const text = getFormattedText(data);
        navigator.clipboard.writeText(text)
          .then(() => {
            const origin = tab && tab.url ? new URL(tab.url).origin : '';
            renderAutoFixPills(autoFixLog, origin);
            if (autoFixLog.length > 0) {
              showJiraStatusBold(`Scraped ${validResults.length} tasks & copied!`, false);
            } else {
              showJiraStatus(`Scraped ${validResults.length} active PM subtasks & copied to clipboard!`);
            }
          })
          .catch(err => {
            showJiraStatus("Scraped subtasks successfully, but failed to auto-copy.", true);
            console.error(err);
          });

        if (scanActionButtons) scanActionButtons.style.display = 'flex';
      } catch (err) {
        showJiraStatus("An error occurred during subtask scanning.", true);
        console.error(err);
      } finally {
        btnScanSubtasks.disabled = false;
        if (btnScanJira) btnScanJira.disabled = false;
      }
    });
  }

  // Button: Copy Formatted Paths (Jira ticket template style)
  if (btnCopyFormatted) {
    btnCopyFormatted.addEventListener('click', () => {
      if (currentParsedData.length === 0) return;
      const text = getFormattedText(currentParsedData);
      
      navigator.clipboard.writeText(text)
        .then(() => {
          showJiraStatus("Formatted publish paths copied!");
          
          // Visual Feedback Animation
          const originalText = btnCopyFormatted.textContent;
          const originalBackground = btnCopyFormatted.style.background;
          const originalColor = btnCopyFormatted.style.color;
          const originalBorder = btnCopyFormatted.style.borderColor;
          
          btnCopyFormatted.textContent = "COPIED! ✔️";
          btnCopyFormatted.style.background = "rgba(74, 222, 128, 0.15)";
          btnCopyFormatted.style.color = "var(--accent-green)";
          btnCopyFormatted.style.borderColor = "rgba(74, 222, 128, 0.4)";
          
          setTimeout(() => {
            btnCopyFormatted.textContent = originalText;
            btnCopyFormatted.style.background = originalBackground;
            btnCopyFormatted.style.color = originalColor;
            btnCopyFormatted.style.borderColor = originalBorder;
          }, 1500);
        })
        .catch(err => {
          showJiraStatus("Failed to copy", true);
          console.error(err);
        });
    });
  }

  // Button: Download TXT File
  if (btnDownloadTxt) {
    btnDownloadTxt.addEventListener('click', () => {
      if (currentParsedData.length === 0) return;

      const text = getFormattedText(currentParsedData);
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      const ticketInfo = activeTicketInfo.textContent || 'subtasks';
      let cleanKey = ticketInfo.replace('Ticket: ', '').trim();
      if (cleanKey.toLowerCase().includes('scanning')) {
        cleanKey = 'export';
      }
      const filename = `publish-paths-${cleanKey || 'export'}.txt`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showJiraStatus("Downloaded TXT File!");
    });
  }

  // Check if we are currently on a Jira tab to enable/highlight the Scan button
  async function checkActiveTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        const isJira = tab.url.includes('jira.uhub.biz') || tab.url.includes('atlassian.net') || tab.url.includes('/browse/');
        if (isJira) {
          btnScanJira.style.background = 'linear-gradient(135deg, var(--accent), var(--accent-light))';
          btnScanJira.style.color = '#051515';
          btnScanJira.style.borderColor = 'var(--accent-light)';
          btnScanJira.style.boxShadow = '0 0 15px var(--accent-glow)';

          // Pre-resolve and display the ticket key immediately from the URL
          const urlKey = getJiraKeyFromUrl(tab.url);
          if (activeTicketInfo && urlKey) {
            activeTicketInfo.textContent = `Ticket: ${urlKey}`;
            activeTicketInfo.style.display = 'inline-block';
          }

          // 1. Try to load cached data for this page first
          loadScanCache(tab.url, (cached) => {
            if (cached) {
              let issueKey = cached.issueKey;
              // Self-healing check to correct any existing corrupt cache
              if (!issueKey || issueKey.toLowerCase().includes('scanning')) {
                issueKey = getJiraKeyFromUrl(tab.url);
                // Save healed cache back to storage
                saveScanCache(tab.url, issueKey, cached.data, cached.subtasks, cached.autoFixLog);
              }

              currentParsedData = cached.data;
              
              // Restore UI pills if there were fixes
              if (cached.autoFixLog && cached.autoFixLog.length > 0) {
                 const origin = tab && tab.url ? new URL(tab.url).origin : '';
                 renderAutoFixPills(cached.autoFixLog, origin);
              } else {
                 if (autoFixLogContainer) autoFixLogContainer.style.display = 'none';
              }
              
              // Restore active ticket info badge
              if (activeTicketInfo && issueKey) {
                activeTicketInfo.textContent = `Ticket: ${issueKey}`;
                activeTicketInfo.style.display = 'inline-block';
              }
              
              // Restore subtask button state
              updateSubtasksButton(cached.subtasks);
              
              // Restore action buttons container
              if (scanActionButtons && cached.data.length > 0) {
                scanActionButtons.style.display = 'flex';
                
                // Save last detected origin to storage from cache
                if (cached.data[0] && cached.data[0].origin) {
                  chrome.storage.local.set({ 'last_detected_aem_origin': cached.data[0].origin });
                }
              }
              
              showJiraStatus(`Restored cached results for ticket ${issueKey || ""}.`);
            } else {
              // 2. If no cache, query if there are subtasks on the page immediately
              chrome.tabs.sendMessage(tab.id, { action: 'checkSubtasks' }, (response) => {
                if (chrome.runtime.lastError) {
                  console.warn("checkSubtasks error (normal if content script not loaded yet):", chrome.runtime.lastError);
                  updateSubtasksButton([]);
                  return;
                }
                updateSubtasksButton(response?.subtasks);
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn("Failed to check active tab:", e);
    }
  }

  checkActiveTab();
});
