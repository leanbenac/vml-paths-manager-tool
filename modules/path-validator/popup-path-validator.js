// ============================================
// VML Paths Manager Assistant — Popup: Path Validator
// UI and Controller for the Path Validator module
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  const validatorInput = document.getElementById('validatorInput');
  const btnLoadValidatorTxt = document.getElementById('btnLoadValidatorTxt');
  const validatorFileInput = document.getElementById('validatorFileInput');
  const btnClearValidator = document.getElementById('btnClearValidator');
  const validatorEnvStatus = document.getElementById('validatorEnvStatus');
  const btnValidatePaths = document.getElementById('btnValidatePaths');
  const validatorStatus = document.getElementById('validatorStatus');
  const validatorResultsContainer = document.getElementById('validatorResultsContainer');
  const validatorResultsSummary = document.getElementById('validatorResultsSummary');
  const validatorResultsList = document.getElementById('validatorResultsList');

  if (!validatorInput || !btnValidatePaths) return;

  let activeTab = null;
  let activeTabOrigin = '';

  // Helpers to show status messages
  function showStatus(text, type = 'info') {
    validatorStatus.textContent = text;
    validatorStatus.style.display = 'block';
    
    let stateClass = 'autofill-status--info';
    if (type === 'success') stateClass = 'autofill-status--success';
    if (type === 'error') stateClass = 'autofill-status--error';
    
    validatorStatus.className = 'autofill-status ' + stateClass;
  }

  function clearStatus() {
    validatorStatus.style.display = 'none';
  }

  // Determine path category/type
  function getPathType(jcrPath) {
    const pathLower = jcrPath.toLowerCase();
    if (pathLower.includes('/experience-fragments/')) {
      return 'XF';
    }
    if (pathLower.includes('/vdm')) {
      return 'VDM';
    }
    if (pathLower.includes('/content/dam/')) {
      if (pathLower.includes('/cf/') || pathLower.includes('/content-fragments/')) {
        return 'CF';
      }
      return 'Assets';
    }
    return 'Pages';
  }

  // Get corresponding Editor/Console URL
  function getEditorUrl(jcrPath, origin, type) {
    let cleanPath = jcrPath.startsWith('/') ? jcrPath : '/' + jcrPath;
    if (cleanPath.endsWith('.html')) {
      cleanPath = cleanPath.substring(0, cleanPath.length - 5);
    }
    
    if (type === 'Pages') {
      return `${origin}/editor.html${cleanPath}.html`;
    } else if (type === 'CF') {
      return `${origin}/ui#/aem/editor.html${cleanPath}`;
    } else if (type === 'Assets') {
      return `${origin}/ui#/aem/assets.html${cleanPath}`;
    } else if (type === 'XF') {
      return `${origin}/aem/experience-fragments.html${cleanPath}`;
    } else if (type === 'VDM') {
      return `${origin}/ui#/aem/vdm.html/browse${cleanPath}`;
    }
    return `${origin}/editor.html${cleanPath}.html`;
  }

  // Check active tab environment and configure validation button
  async function checkEnvironment() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) {
        setInactiveEnvironment("No active tab detected");
        return;
      }

      const url = tab.url;
      const isAemOrVdm = url.includes('adobeaemcloud.com') ||
                         url.includes('/aem/') ||
                         url.includes('/editor.html/') ||
                         url.includes('/assets.html/') ||
                         url.includes('/sites.html/') ||
                         url.includes('/content/');

        if (isAemOrVdm) {
          activeTab = tab;
          activeTabOrigin = new URL(url).origin;
          const hostname = new URL(url).hostname;
          
          validatorEnvStatus.textContent = hostname;
          validatorEnvStatus.className = 'asset-status-badge status-detected'; // Use a purple/active status badge style
          
          const btnOpenAemHost = document.getElementById('btnOpenAemHost');
          if (btnOpenAemHost) {
            btnOpenAemHost.style.display = 'none';
          }
          
          updateValidateButtonState();
      } else {
        setInactiveEnvironment("Not on AEM/VDM");
      }
    } catch (e) {
      console.warn("Failed to check active tab for validator:", e);
      setInactiveEnvironment("Error checking tab");
    }
  }

  function setInactiveEnvironment(message) {
    activeTab = null;
    activeTabOrigin = '';
    validatorEnvStatus.textContent = message;
    validatorEnvStatus.className = 'asset-status-badge status-empty';
    btnValidatePaths.disabled = true;

    // Show AEM shortcut button if there is a known origin
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['last_detected_aem_origin'], (res) => {
        const origin = res.last_detected_aem_origin || 'https://author-p154363-e1620826.adobeaemcloud.com';
        const btnOpenAemHost = document.getElementById('btnOpenAemHost');
        if (btnOpenAemHost) {
          btnOpenAemHost.style.display = 'inline-block';
          btnOpenAemHost.dataset.origin = origin;
        }
      });
    } else {
      const btnOpenAemHost = document.getElementById('btnOpenAemHost');
      if (btnOpenAemHost) {
        btnOpenAemHost.style.display = 'inline-block';
        btnOpenAemHost.dataset.origin = 'https://author-p154363-e1620826.adobeaemcloud.com';
      }
    }
  }

  function updateValidateButtonState() {
    if (activeTab && validatorInput.value.trim().length > 0) {
      btnValidatePaths.disabled = false;
    } else {
      btnValidatePaths.disabled = true;
    }
  }

  // Save cache helper
  function saveValidatorCache(inputText, results) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        'validator_cache': {
          inputText: inputText,
          results: results,
          timestamp: Date.now()
        }
      });
    }
  }

  // Load cache helper
  function loadValidatorCache() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['validator_cache'], (result) => {
        if (result && result.validator_cache) {
          const cache = result.validator_cache;
          if (cache.inputText) {
            validatorInput.value = cache.inputText;
            updateValidateButtonState();
          }
          if (Array.isArray(cache.results) && cache.results.length > 0) {
            renderResults(cache.results);
          }
        }
      });
    }
  }

  // Monitor textarea input
  validatorInput.addEventListener('input', () => {
    updateValidateButtonState();
    saveValidatorCache(validatorInput.value, null);
  });

  // Clear validator elements
  btnClearValidator.addEventListener('click', () => {
    validatorInput.value = '';
    validatorFileInput.value = '';
    validatorResultsContainer.style.display = 'none';
    validatorResultsList.innerHTML = '';
    updateValidateButtonState();
    clearStatus();
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove('validator_cache');
    }
  });

  // Load TXT File
  btnLoadValidatorTxt.addEventListener('click', () => {
    validatorFileInput.click();
  });

  validatorFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      validatorInput.value = event.target.result;
      updateValidateButtonState();
      saveValidatorCache(event.target.result, null);
      
      // Attempt preliminary path counting
      const parsed = parsePathsFromText(event.target.result);
      if (parsed.length > 0) {
        showStatus(`Loaded file successfully! Detected ${parsed.length} potential paths.`, 'info');
      } else {
        showStatus("Loaded file successfully, but no valid JCR paths were detected.", 'error');
      }
      
      // Reset input value to allow uploading same file again
      validatorFileInput.value = '';
    };
    reader.onerror = () => {
      showStatus("Failed to read the selected file.", 'error');
      validatorFileInput.value = '';
    };
    reader.readAsText(file);
  });

  // Parse path strings and sub-elements from raw text
  function parsePathsFromText(text) {
    const lines = text.split('\n');
    const paths = [];
    let currentBasePath = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Check if line contains a JCR path or URL
      const contentIdx = line.indexOf('/content/');
      if (contentIdx !== -1) {
        let rawPath = line.substring(contentIdx);
        // Clean trailing whitespaces and parameters
        rawPath = rawPath.split(/\s+/)[0];
        rawPath = rawPath.split('?')[0].split('#')[0];
        
        // Strip trailing common punctuation or Markdown artifacts
        rawPath = rawPath.replace(/[)"'\]\>\s]+$/, '');

        if (rawPath.endsWith('.html')) {
          rawPath = rawPath.substring(0, rawPath.length - 5);
        }

        currentBasePath = rawPath;
        paths.push({
          rawLine: line,
          jcrPath: rawPath,
          type: getPathType(rawPath),
          isChild: false
        });
      }
      // Check if line represents a nested child element (starts with >)
      else if (line.match(/^>+/) && currentBasePath) {
        const elementName = line.replace(/^[>\s]+/, '').trim();
        if (elementName) {
          const childJcrPath = `${currentBasePath}/${elementName}`;
          paths.push({
            rawLine: line,
            jcrPath: childJcrPath,
            type: getPathType(childJcrPath),
            isChild: true,
            parentPath: currentBasePath,
            elementName: elementName
          });
        }
      }
    }
    return paths;
  }

  // Render list of results securely without innerHTML
  function renderResults(results) {
    validatorResultsList.innerHTML = '';
    
    let validCount = 0;
    results.forEach(res => {
      if (res.status === 'VALID') validCount++;

      const row = document.createElement('div');
      row.className = 'detected-asset-row';
      
      // Left Section
      const leftDiv = document.createElement('div');
      leftDiv.className = 'detected-asset-left';
      
      // Icon
      const iconSpan = document.createElement('span');
      iconSpan.className = 'detected-asset-icon';
      iconSpan.appendChild(getCategorySvgIcon(res.type));
      
      // Name
      const nameSpan = document.createElement('span');
      nameSpan.className = 'detected-asset-name';
      
      if (res.isChild) {
        nameSpan.textContent = `>>> ${res.elementName}`;
        nameSpan.title = `Child Element JCR path:\n${res.jcrPath}`;
        nameSpan.style.paddingLeft = '8px';
        nameSpan.style.color = 'var(--text-secondary)';
      } else {
        const segments = res.jcrPath.split('/').filter(Boolean);
        nameSpan.textContent = segments.pop() || res.jcrPath;
        nameSpan.title = `JCR Path: ${res.jcrPath}`;
      }
      
      // Type Badge
      const typeBadge = document.createElement('span');
      typeBadge.className = 'row-auto-badge';
      typeBadge.textContent = res.type;
      
      // Apply different colors for category badges
      if (res.type === 'Pages') typeBadge.style.color = 'var(--accent-light)';
      if (res.type === 'CF') typeBadge.style.color = '#c084fc';
      if (res.type === 'XF') typeBadge.style.color = '#e879f9';
      if (res.type === 'VDM') typeBadge.style.color = 'var(--gold-light)';
      if (res.type === 'Assets') typeBadge.style.color = 'var(--accent-green)';
      
      leftDiv.appendChild(iconSpan);
      leftDiv.appendChild(nameSpan);
      leftDiv.appendChild(typeBadge);
      
      // Right Section: Status Badge + Action button
      const rightDiv = document.createElement('div');
      rightDiv.style.display = 'flex';
      rightDiv.style.gap = '6px';
      rightDiv.style.alignItems = 'center';
      
      // Status Badge
      const statusBadge = document.createElement('span');
      statusBadge.className = 'asset-status-badge';
      
      if (res.status === 'VALID') {
        statusBadge.textContent = 'VALID';
        statusBadge.classList.add('status-valid');
      } else if (res.status === 'INVALID') {
        statusBadge.textContent = 'INVALID';
        statusBadge.classList.add('status-invalid');
      } else if (res.status === 'RESTRICTED') {
        statusBadge.textContent = 'RESTRICTED';
        statusBadge.classList.add('status-scanning'); // Use amber color
      } else {
        statusBadge.textContent = 'ERROR';
        statusBadge.classList.add('status-empty'); // Use red color
      }
      
      rightDiv.appendChild(statusBadge);
      
      // Navigation Action Button (only if valid or restricted)
      if (res.status === 'VALID' || res.status === 'RESTRICTED') {
        const openBtn = document.createElement('button');
        openBtn.className = 'btn-copy-asset';
        openBtn.textContent = 'Open';
        
        openBtn.addEventListener('click', () => {
          const editorUrl = getEditorUrl(res.jcrPath, activeTabOrigin, res.type);
          chrome.tabs.create({ url: editorUrl });
        });
        
        rightDiv.appendChild(openBtn);
      }
      
      row.appendChild(leftDiv);
      row.appendChild(rightDiv);
      validatorResultsList.appendChild(row);
    });

    validatorResultsSummary.textContent = `${validCount}/${results.length} Valid`;
    validatorResultsContainer.style.display = 'block';
  }

  // Create SVGs dynamically for categories
  function getCategorySvgIcon(type) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.style.width = '14px';
    svg.style.height = '14px';

    if (type === 'Assets') {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', '3');
      rect.setAttribute('y', '3');
      rect.setAttribute('width', '18');
      rect.setAttribute('height', '18');
      rect.setAttribute('rx', '2');
      rect.setAttribute('ry', '2');
      
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '8.5');
      circle.setAttribute('cy', '8.5');
      circle.setAttribute('r', '1.5');
      
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      poly.setAttribute('points', '21 15 16 10 5 21');

      svg.appendChild(rect);
      svg.appendChild(circle);
      svg.appendChild(poly);
    } else if (type === 'CF') {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z');
      
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      poly.setAttribute('points', '3.27 6.96 12 12.01 20.73 6.96');
      
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', '12');
      line.setAttribute('y1', '22.08');
      line.setAttribute('x2', '12');
      line.setAttribute('y2', '12');

      svg.appendChild(path);
      svg.appendChild(poly);
      svg.appendChild(line);
    } else if (type === 'XF') {
      const p1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p1.setAttribute('d', 'M12 2L2 7l10 5 10-5-10-5z');
      
      const p2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p2.setAttribute('d', 'M2 17l10 5 10-5');
      
      const p3 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p3.setAttribute('d', 'M2 12l10 5 10-5');

      svg.appendChild(p1);
      svg.appendChild(p2);
      svg.appendChild(p3);
    } else if (type === 'VDM') {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', '2');
      rect.setAttribute('y', '3');
      rect.setAttribute('width', '20');
      rect.setAttribute('height', '14');
      rect.setAttribute('rx', '2');
      rect.setAttribute('ry', '2');
      
      const l1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l1.setAttribute('x1', '8');
      l1.setAttribute('y1', '21');
      l1.setAttribute('x2', '16');
      l1.setAttribute('y2', '21');
      
      const l2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l2.setAttribute('x1', '12');
      l2.setAttribute('y1', '17');
      l2.setAttribute('x2', '12');
      l2.setAttribute('y2', '21');

      svg.appendChild(rect);
      svg.appendChild(l1);
      svg.appendChild(l2);
    } else {
      // Pages (Document icon)
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z');
      
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      poly.setAttribute('points', '14 2 14 8 20 8');
      
      const l1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l1.setAttribute('x1', '16');
      l1.setAttribute('y1', '13');
      l1.setAttribute('x2', '8');
      l1.setAttribute('y2', '13');
      
      const l2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l2.setAttribute('x1', '16');
      l2.setAttribute('y1', '17');
      l2.setAttribute('x2', '8');
      l2.setAttribute('y2', '17');

      svg.appendChild(path);
      svg.appendChild(poly);
      svg.appendChild(l1);
      svg.appendChild(l2);
    }
    return svg;
  }

  // Button Action: Validate Paths
  btnValidatePaths.addEventListener('click', async () => {
    const rawText = validatorInput.value.trim();
    if (!rawText) return;

    if (!activeTab || !activeTab.id) {
      showStatus("Please make sure you are on an active AEM tab first.", 'error');
      return;
    }

    const pathsToValidate = parsePathsFromText(rawText);
    if (pathsToValidate.length === 0) {
      showStatus("No publish paths detected in input. Ensure they contain '/content/'.", 'error');
      return;
    }

    try {
      btnValidatePaths.disabled = true;
      showStatus(`Validating ${pathsToValidate.length} paths...`, 'info');
      validatorResultsContainer.style.display = 'none';

      chrome.tabs.sendMessage(activeTab.id, { action: 'validatePaths', paths: pathsToValidate }, (response) => {
        btnValidatePaths.disabled = false;

        if (chrome.runtime.lastError) {
          showStatus("Error: Please reload the active tab and try again.", 'error');
          console.error("Communication error with content script:", chrome.runtime.lastError);
          return;
        }

        if (response && response.success && Array.isArray(response.results)) {
          clearStatus();
          renderResults(response.results);
          saveValidatorCache(rawText, response.results);
        } else {
          showStatus(response?.error || "Validation failed to run.", 'error');
        }
      });
    } catch (err) {
      btnValidatePaths.disabled = false;
      showStatus("An unexpected error occurred during validation: " + err.message, 'error');
      console.error("Validation error:", err);
    }
  });

  // Open AEM Host Button Click Handler
  const btnOpenAemHost = document.getElementById('btnOpenAemHost');
  if (btnOpenAemHost) {
    btnOpenAemHost.addEventListener('click', () => {
      const origin = btnOpenAemHost.dataset.origin || 'https://author-p154363-e1620826.adobeaemcloud.com';
      const startUrl = `${origin}/ui#/aem/aem/start.html`;
      chrome.tabs.create({ url: startUrl });
    });
  }

  // Listen for progress updates from the content script
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request) => {
      if (request.action === 'validationProgress') {
        showStatus(`Validating paths (${request.current}/${request.total})...`, 'info');
      }
    });
  }

  // Run initial environment check
  checkEnvironment();
  loadValidatorCache();
});
