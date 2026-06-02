// ============================================
// VML Paths Manager Assistant — Popup: Jira Parser
// UI and Extraction handler for Jira AEM Path Parser
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  const btnParsePaste = document.getElementById('btnParsePaste');
  const btnScanJira = document.getElementById('btnScanJira');
  const btnCopyAllJcr = document.getElementById('btnCopyAllJcr');
  const btnCopyFormatted = document.getElementById('btnCopyFormatted');
  const jiraTextInput = document.getElementById('jiraTextInput');
  const jiraResultsContainer = document.getElementById('jiraResultsContainer');
  const jiraStatusEl = document.getElementById('jiraStatus');
  const activeTicketInfo = document.getElementById('activeTicketInfo');

  if (!btnParsePaste || !jiraTextInput || !jiraResultsContainer) return;

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
      else if (cleanLine.match(/^>{2,3}/) && currentGroup) {
        // Strip '>' and leading spaces
        const elementName = cleanLine.replace(/^>{2,3}\s*/, '');
        if (elementName) {
          const childJcrPath = `${currentGroup.folderJcrPath}/${elementName}`;
          
          // Deduplicate elements under the same folder
          const exists = currentGroup.elements.some(el => el.name === elementName);
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

  // --- 2. RENDER RESULTS ---
  function renderParsedResults(data) {
    currentParsedData = data;
    jiraResultsContainer.innerHTML = '';

    if (data.length === 0) {
      jiraResultsContainer.innerHTML = `
        <div style="color: var(--text-muted); font-size: 11px; text-align: center; padding: 20px; border: 1px dashed var(--border); border-radius: var(--radius-sm); width: 100%;">
          No AEM paths or elements detected. Make sure AEM URLs start with http/https and elements start with >> or >>>.
        </div>
      `;
      if (btnCopyAllJcr) btnCopyAllJcr.style.display = 'none';
      if (btnCopyFormatted) btnCopyFormatted.style.display = 'none';
      return;
    }

    if (btnCopyAllJcr) btnCopyAllJcr.style.display = 'block';
    if (btnCopyFormatted) btnCopyFormatted.style.display = 'block';

    data.forEach((group, groupIdx) => {
      const card = document.createElement('div');
      card.className = 'detected-folder-card';
      card.style.background = 'rgba(255, 255, 255, 0.02)';
      card.style.border = '1px solid var(--border)';
      card.style.borderRadius = 'var(--radius-sm)';
      card.style.padding = '10px';
      card.style.marginBottom = '10px';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.gap = '8px';

      // Folder Header
      const headerDiv = document.createElement('div');
      headerDiv.style.display = 'flex';
      headerDiv.style.alignItems = 'center';
      headerDiv.style.justifyContent = 'space-between';
      headerDiv.style.gap = '8px';

      const folderTitle = document.createElement('span');
      folderTitle.className = 'folder-title';
      folderTitle.textContent = group.folderJcrPath.split('/').pop() || 'AEM Folder';
      folderTitle.title = group.folderJcrPath;
      folderTitle.style.fontSize = '12px';
      folderTitle.style.fontWeight = '700';
      folderTitle.style.color = 'var(--accent-light)';
      folderTitle.style.overflow = 'hidden';
      folderTitle.style.textOverflow = 'ellipsis';
      folderTitle.style.whiteSpace = 'nowrap';

      const actionGroup = document.createElement('div');
      actionGroup.style.display = 'flex';
      actionGroup.style.gap = '4px';

      const openFolderBtn = document.createElement('button');
      openFolderBtn.className = 'btn-copy-asset';
      openFolderBtn.textContent = 'Open';
      openFolderBtn.addEventListener('click', () => {
        window.open(group.baseUrl, '_blank');
      });

      const copyFolderJcr = document.createElement('button');
      copyFolderJcr.className = 'btn-copy-asset';
      copyFolderJcr.textContent = 'Copy JCR';
      copyFolderJcr.addEventListener('click', () => {
        copyText(group.folderJcrPath, "Folder JCR Path copied!");
      });

      actionGroup.appendChild(openFolderBtn);
      actionGroup.appendChild(copyFolderJcr);
      headerDiv.appendChild(folderTitle);
      headerDiv.appendChild(actionGroup);
      card.appendChild(headerDiv);

      // Elements List
      if (group.elements.length > 0) {
        const elementsList = document.createElement('div');
        elementsList.style.display = 'flex';
        elementsList.style.flexDirection = 'column';
        elementsList.style.gap = '6px';
        elementsList.style.paddingLeft = '8px';
        elementsList.style.borderLeft = '2px solid rgba(45, 158, 158, 0.2)';

        group.elements.forEach(el => {
          const row = document.createElement('div');
          row.style.display = 'flex';
          row.style.alignItems = 'center';
          row.style.justifyContent = 'space-between';
          row.style.gap = '10px';

          const nameSpan = document.createElement('span');
          nameSpan.textContent = el.name;
          nameSpan.title = el.jcrPath;
          nameSpan.style.fontSize = '11px';
          nameSpan.style.color = 'var(--text-primary)';
          nameSpan.style.overflow = 'hidden';
          nameSpan.style.textOverflow = 'ellipsis';
          nameSpan.style.whiteSpace = 'nowrap';
          nameSpan.style.flex = '1';

          const rowActions = document.createElement('div');
          rowActions.style.display = 'flex';
          rowActions.style.gap = '4px';

          const openElBtn = document.createElement('button');
          openElBtn.className = 'btn-copy-asset';
          openElBtn.textContent = 'Edit';
          openElBtn.style.padding = '3px 6px';
          openElBtn.addEventListener('click', () => {
            window.open(el.editorUrl, '_blank');
          });

          const copyElJcr = document.createElement('button');
          copyElJcr.className = 'btn-copy-asset';
          copyElJcr.textContent = 'Copy JCR';
          copyElJcr.style.padding = '3px 6px';
          copyElJcr.addEventListener('click', () => {
            copyText(el.jcrPath, "Element JCR Path copied!");
          });

          rowActions.appendChild(openElBtn);
          rowActions.appendChild(copyElJcr);
          row.appendChild(nameSpan);
          row.appendChild(rowActions);
          elementsList.appendChild(row);
        });

        card.appendChild(elementsList);
      } else {
        const noEl = document.createElement('div');
        noEl.textContent = 'No nested elements found.';
        noEl.style.fontSize = '10px';
        noEl.style.color = 'var(--text-muted)';
        noEl.style.paddingLeft = '8px';
        card.appendChild(noEl);
      }

      jiraResultsContainer.appendChild(card);
    });
  }

  // --- 3. UI EVENTS ---

  // Button: Parse Paste Text
  btnParsePaste.addEventListener('click', () => {
    const txt = jiraTextInput.value.trim();
    if (!txt) {
      showJiraStatus("Please paste text first.", true);
      return;
    }
    clearJiraStatus();
    const data = extractAEMData(txt);
    renderParsedResults(data);
    showJiraStatus(`Extracted ${data.length} folders successfully!`);
  });

  // Button: Scan Active Jira Tab
  if (btnScanJira) {
    btnScanJira.addEventListener('click', async () => {
      try {
        btnScanJira.disabled = true;
        clearJiraStatus();
        if (activeTicketInfo) activeTicketInfo.textContent = "Scanning active tab...";

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
          showJiraStatus("Could not query active tab.", true);
          btnScanJira.disabled = false;
          return;
        }

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

          // Populate text area with full text for user review/editing
          jiraTextInput.value = response.fullText;

          // Parse and render
          const data = extractAEMData(response.fullText);
          renderParsedResults(data);

          // Update active ticket info badge
          if (activeTicketInfo && response.issueKey) {
            activeTicketInfo.textContent = `Ticket: ${response.issueKey}`;
            activeTicketInfo.style.display = 'inline-block';
          }

          showJiraStatus(`Scraped ticket ${response.issueKey} successfully!`);
        });

      } catch (err) {
        btnScanJira.disabled = false;
        showJiraStatus("An error occurred during scanning.", true);
        console.error(err);
      }
    });
  }

  // Button: Copy All JCR Paths
  if (btnCopyAllJcr) {
    btnCopyAllJcr.addEventListener('click', () => {
      if (currentParsedData.length === 0) return;

      const allPaths = [];
      currentParsedData.forEach(group => {
        // Add folder path
        allPaths.push(group.folderJcrPath);
        // Add all elements paths
        group.elements.forEach(el => {
          allPaths.push(el.jcrPath);
        });
      });

      copyText(allPaths.join('\n'), "All JCR Paths copied!");
    });
  }

  // Button: Copy Formatted Paths (Jira ticket template style)
  if (btnCopyFormatted) {
    btnCopyFormatted.addEventListener('click', () => {
      if (currentParsedData.length === 0) return;

      const formattedGroups = [];

      currentParsedData.forEach(group => {
        const groupLines = [
          "PUBLISHING PATH",
          "",
          group.baseUrl
        ];

        group.elements.forEach(el => {
          groupLines.push("");
          groupLines.push(`>>${el.name}`);
        });

        formattedGroups.push(groupLines.join('\n'));
      });

      copyText(formattedGroups.join('\n\n'), "Formatted publish paths copied!");
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
          btnScanJira.style.color = '#fff';
          btnScanJira.style.borderColor = 'var(--accent-light)';
        }
      }
    } catch (e) {
      console.warn("Failed to check active tab:", e);
    }
  }

  checkActiveTab();
});
