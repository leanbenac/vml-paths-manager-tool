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

  // Show status messages
  function showJiraStatus(text, isError = false) {
    if (!jiraStatusEl) return;
    jiraStatusEl.textContent = text;
    jiraStatusEl.style.display = 'block';
    jiraStatusEl.className = 'autofill-status ' + (isError ? 'autofill-status--error' : 'autofill-status--success');
  }

  function clearJiraStatus() {
    if (jiraStatusEl) jiraStatusEl.style.display = 'none';
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
  function saveScanCache(url, issueKey, data, subtasks) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const cacheObj = {
        issueKey: issueKey,
        data: data,
        subtasks: subtasks || [],
        timestamp: Date.now()
      };
      chrome.storage.local.set({ [url]: cacheObj });
    }
  }

  function loadScanCache(url, callback) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([url], (result) => {
        callback(result[url]);
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
  let pmListArray = ["tony stark"]; // default lowercase fallback

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
          // Default seed
          listStr = "Tony Stark";
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
        inputPmList.value = "Tony Stark";
      }
      pmListArray = ["tony stark"];
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

    for (let line of lines) {
      let cleanLine = line.trim();

      // Find an AEM URL in this line
      const urlMatch = cleanLine.match(/https?:\/\/[^\s"'<>\(\)\[\]]+/);
      if (urlMatch) {
        const cleanUrl = urlMatch[0];
        const isAemUrl = cleanUrl.includes('/content/') || 
                         cleanUrl.includes('/ui#/aem/') || 
                         cleanUrl.includes('/assets.html/') || 
                         cleanUrl.includes('/editor.html/');

        if (isAemUrl) {
          try {
            const urlObj = new URL(cleanUrl);
            const origin = urlObj.origin;
            
            // Extract JCR path by splitting on '/content/'
            const parts = cleanUrl.split('/content/');
            if (parts.length >= 2) {
              // Clean up query parameters or hashes from JCR path
              const cleanPathPart = parts[1].split('?')[0].split('#')[0];
              const folderJcrPath = '/content/' + cleanPathPart;

              // Deduplicate: merge elements if this folder path was already seen
              let existingGroup = results.find(g => g.folderJcrPath === folderJcrPath);
              if (existingGroup) {
                currentGroup = existingGroup;
              } else {
                currentGroup = {
                  baseUrl: cleanUrl,
                  origin: origin,
                  folderJcrPath: folderJcrPath,
                  category: getCategory(folderJcrPath, cleanUrl),
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
      // Detect child elements starting with >> or >>>
      else if (cleanLine.match(/^>{2,}/) && currentGroup) {
        // Strip any sequence of leading '>' and spaces
        const elementName = cleanLine.replace(/^[>\s]+/, '');
        if (elementName) {
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

    return results.filter(group => group.elements.length > 0);
  }

  // --- 2. FORMAT AND EXPORT RESULTS ---

  // --- 3. UI EVENTS ---

  // Helper to format groups by category hierarchy
  function getFormattedText(data) {
    const categoriesOrder = ['Assets', 'VDM', 'CF', 'XF', 'Pages'];
    const formattedCategories = [];
    
    categoriesOrder.forEach(category => {
      const categoryGroups = data.filter(group => group.category === category);
      if (categoryGroups.length > 0) {
        const categoryLines = [
          `PUBLISHING PATH - ${category.toUpperCase()}`
        ];
        
        categoryGroups.forEach(group => {
          categoryLines.push("");
          categoryLines.push(group.baseUrl);
          group.elements.forEach(el => {
            categoryLines.push(`>>> ${el.name}`);
          });
        });
        
        formattedCategories.push(categoryLines.join('\n'));
      }
    });
    return formattedCategories.join('\n\n');
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
        const urlKey = getJiraKeyFromUrl(tab.url);
        if (activeTicketInfo && urlKey) {
          activeTicketInfo.textContent = `Ticket: ${urlKey}`;
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

        chrome.tabs.sendMessage(tab.id, { action: 'getJiraIssueDetails' }, (response) => {
          btnScanJira.disabled = false;

          if (chrome.runtime.lastError) {
            showJiraStatus("Error: Please reload the Jira tab and try again.", true);
            if (activeTicketInfo) activeTicketInfo.textContent = "";
            console.error(chrome.runtime.lastError);
            return;
          }

          if (!response || !response.success) {
            showJiraStatus(response?.error || "Failed to scrape ticket page.", true);
            if (activeTicketInfo) activeTicketInfo.textContent = "";
            return;
          }

          // Parse and process
          const data = extractAEMData(response.fullText);
          currentParsedData = data;

          // Resolve issue key safely
          let issueKey = response?.issueKey;
          if (!issueKey || issueKey.toLowerCase().includes('scanning')) {
            issueKey = getJiraKeyFromUrl(tab.url);
          }

          // Update active ticket info badge
          if (activeTicketInfo && issueKey) {
            activeTicketInfo.textContent = `Ticket: ${issueKey}`;
            activeTicketInfo.style.display = 'inline-block';
          }

          // Update subtask button details
          updateSubtasksButton(response.subtasks);

          if (data.length === 0) {
            showJiraStatus("No AEM paths detected.", true);
            if (scanActionButtons) scanActionButtons.style.display = 'none';
            return;
          }

          // Save to cache
          saveScanCache(tab.url, issueKey, data, response.subtasks);

          // Auto-copy to clipboard
          const text = getFormattedText(data);
          navigator.clipboard.writeText(text)
            .then(() => {
              showJiraStatus(`Scraped ticket ${response.issueKey || ""} & copied to clipboard!`);
            })
            .catch(err => {
              showJiraStatus("Scraped successfully, but failed to auto-copy.", true);
              console.error(err);
            });

          if (scanActionButtons) scanActionButtons.style.display = 'flex';
        });

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

        // Concurrency queue (batch size of 5)
        const batchSize = 5;
        for (let i = 0; i < keys.length; i += batchSize) {
          const batchKeys = keys.slice(i, i + batchSize);
          const promises = batchKeys.map(async (key) => {
            try {
              const res = await fetch(`${baseUrl}/rest/api/2/issue/${key}?fields=description,comment,status,assignee`);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const json = await res.json();
              
              // 1. Filter by Status (must be "In Progress" or "Open")
              const statusName = (json.fields?.status?.name || '').toLowerCase().trim();
              if (statusName !== 'in progress' && statusName !== 'open') {
                console.log(`Skipping subtask ${key} because status is "${statusName}" (not "In Progress" or "Open")`);
                return '';
              }

              // 2. Filter by Assignee (must be a configured PM)
              const assigneeName = json.fields?.assignee?.name || '';
              const assigneeDisplayName = json.fields?.assignee?.displayName || '';
              const isPM = pmListArray.includes(assigneeName.toLowerCase().trim()) || 
                           pmListArray.includes(assigneeDisplayName.toLowerCase().trim());
              
              if (!isPM) {
                console.log(`Skipping subtask ${key} because assignee "${assigneeDisplayName || assigneeName || 'Unassigned'}" is not in the PM list.`);
                return '';
              }

              const desc = json.fields?.description || '';
              const comments = (json.fields?.comment?.comments || []).map(c => c.body || '').join('\n\n');
              return `${desc}\n\n=== COMMENTS ===\n\n${comments}`;
            } catch (err) {
              console.warn(`Failed to fetch details for subtask ${key}:`, err);
              return '';
            }
          });

          const batchResults = await Promise.all(promises);
          fetchedTexts.push(...batchResults);
          
          const completedCount = Math.min(i + batchSize, keys.length);
          showJiraStatus(`Scanning subtasks (${completedCount}/${keys.length})...`);
        }

        const validResults = fetchedTexts.filter(Boolean);
        const consolidatedText = validResults.join('\n\n=== NEXT SUBTASK ===\n\n');

        // Parse and process
        const data = extractAEMData(consolidatedText);
        currentParsedData = data;

        if (data.length === 0) {
          showJiraStatus("No AEM paths detected in 'In Progress' or 'Open' PM subtasks.", true);
          if (scanActionButtons) scanActionButtons.style.display = 'none';
          return;
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
        saveScanCache(tab.url, issueKey, data, keys);

        // Auto-copy to clipboard
        const text = getFormattedText(data);
        navigator.clipboard.writeText(text)
          .then(() => {
            showJiraStatus(`Scraped ${validResults.length} active PM subtasks & copied to clipboard!`);
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
                saveScanCache(tab.url, issueKey, cached.data, cached.subtasks);
              }

              currentParsedData = cached.data;
              
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
