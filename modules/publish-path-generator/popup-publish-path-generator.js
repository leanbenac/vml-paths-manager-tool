// ============================================
// VML Content Tool v2.0 — Popup: Publish Path Generator
// Módulo de UI para copiar el path de publicación formateado (Pages/CFs/XFs/Assets)
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  const btnGenerate = document.getElementById('btnGeneratePublishPath');
  const statusEl = document.getElementById('publishPathStatus');
  const btnGenerateAsset = document.getElementById('btnGenerateAssetPublishPath');
  const manualAssetInput = document.getElementById('manualAssetInput');
  const detectedAssetsContainer = document.getElementById('detectedAssetsContainer');
  const detectedAssetsList = document.getElementById('detectedAssetsList');
  const assetStatusBadge = document.getElementById('assetDetectionStatus');

  if (!btnGenerate || !statusEl) return;

  // Mostrar mensajes de estado en el popup
  function showMessage(text, isError = false) {
    statusEl.textContent = text;
    statusEl.style.display = 'block';
    statusEl.className = 'autofill-status ' + (isError ? 'autofill-status--error' : 'autofill-status--success');
  }

  // Función común para copiar al portapapeles
  function copyToClipboard(publishUrl, labelText) {
    const textToCopy = labelText ? `${publishUrl}\n>>> ${labelText}` : publishUrl;
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        showMessage("Copied to clipboard successfully!");
      })
      .catch(err => {
        showMessage("Failed to copy to clipboard.", true);
        console.error(err);
      });
  }

  // Actualizar el badge de estado de la detección de assets
  function updateAssetStatus(stateClass, text) {
    if (assetStatusBadge) {
      assetStatusBadge.textContent = text;
      assetStatusBadge.className = 'asset-status-badge ' + stateClass;
    }
  }

  // Mostrar estado de no assets en el popup
  function showNoAssetsPlaceholder() {
    updateAssetStatus('status-empty', 'Not Detected');
    detectedAssetsList.innerHTML = '';
  }

  // Mostrar estado de escaneo en el popup
  function showScanningPlaceholder() {
    updateAssetStatus('status-scanning', 'Scanning...');
    detectedAssetsList.innerHTML = `
      <div class="no-assets-placeholder" style="display: flex; align-items: center; justify-content: center; gap: 10px; padding: 16px 12px; border: 1px dashed var(--border-accent); border-radius: var(--radius-sm); background: rgba(45, 158, 158, 0.02); text-align: center; width: 100%;">
        <span class="scanning-spinner" style="display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(255, 255, 255, 0.1); border-top-color: var(--accent-light); border-radius: 50%; animation: spin 0.8s linear infinite;"></span>
        <span style="color: var(--accent-light); font-size: 11px; font-weight: 500; letter-spacing: 0.5px;">Scanning page assets...</span>
      </div>
    `;
  }

  // --- 1. GENERAR PATH DE PUBLICACIÓN PRINCIPAL (Pages, CFs y XFs) ---
  btnGenerate.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) {
        showMessage("Could not obtain current URL.", true);
        return;
      }

      // Validar si es una URL de AEM editor de Content Fragments, Experience Fragments, Pages o VDM Author o una carpeta de AEM (Folder)
      const isContentFragment = tab.url.includes('/editor.html/content/dam/');
      const isExperienceFragment = tab.url.includes('/editor.html/content/experience-fragments/');
      const isVdm = tab.url.includes('/aem/vdm.html/edit/content/');
      const isFolder = tab.url.includes('/content/') && !tab.url.includes('/editor.html/') && !tab.url.includes('/aem/vdm.html/edit/');
      const isPage = tab.url.includes('/editor.html/content/') && !isContentFragment && !isExperienceFragment;

      if (!isContentFragment && !isExperienceFragment && !isPage && !isVdm && !isFolder) {
        showMessage("Please open an AEM Content Fragment, Experience Fragment, Page, VDM page, or an AEM Folder page first.", true);
        return;
      }

      // Deshabilitar botón durante el proceso
      btnGenerate.disabled = true;

      if (isPage) {
        // Para Pages, extraemos el 'name' directamente de la URL sin requerir el content script
        showMessage("Processing page details...", false);
        try {
          const origin = new URL(tab.url).origin;
          const u = tab.url.split("/content/");
          if (u.length < 2) {
            showMessage("Invalid Page URL structure.", true);
            btnGenerate.disabled = false;
            return;
          }

          const pathPart = u[1].split('?')[0];
          const segments = pathPart.split('/').filter(Boolean);
          if (segments.length === 0) {
            showMessage("Invalid Page URL structure.", true);
            btnGenerate.disabled = false;
            return;
          }

          const lastSegment = segments[segments.length - 1];
          let name = lastSegment;
          if (name.endsWith('.html')) {
            name = name.substring(0, name.length - 5);
          }

          // Eliminar el último segmento (la página en sí) para obtener la carpeta contenedora
          segments.pop();

          const publishUrl = `${origin}/sites.html/content/${segments.join('/')}`;
          
          copyToClipboard(publishUrl, name);
          btnGenerate.disabled = false;

        } catch (urlErr) {
          showMessage("Failed to parse URL structure.", true);
          console.error(urlErr);
          btnGenerate.disabled = false;
        }
      } else if (isFolder) {
        showMessage("Extracting folder items...", false);
        chrome.tabs.sendMessage(tab.id, { action: 'getFolderPublishPathDetails' }, (response) => {
          btnGenerate.disabled = false;

          if (chrome.runtime.lastError) {
            showMessage("Error: Please reload the active AEM tab and try again.", true);
            console.error(chrome.runtime.lastError);
            return;
          }

          if (response?.error) {
            showMessage(response.error, true);
            return;
          }

          const items = response?.items || [];

          if (items.length === 0) {
            showMessage("No elements found in this folder.", true);
            return;
          }

          try {
            // Clean the folder URL (remove query parameters)
            const publishUrl = tab.url.split('?')[0];
            
            // Format output: Folder URL followed by child titles
            const formattedText = [
              publishUrl,
              ...items.map(title => `>>> ${title}`)
            ].join('\n');
            
            navigator.clipboard.writeText(formattedText)
              .then(() => {
                showMessage("Folder path & elements copied!");
              })
              .catch(err => {
                showMessage("Failed to copy to clipboard.", true);
                console.error(err);
              });

          } catch (urlErr) {
            showMessage("Failed to parse folder URL structure.", true);
            console.error(urlErr);
          }
        });
      } else {
        // Para CFs, XFs y VDM, consultamos al content script para extraer el título de la UI
        showMessage("Extracting details...", false);
        chrome.tabs.sendMessage(tab.id, { action: 'getPublishPathDetails' }, (response) => {
          btnGenerate.disabled = false;

          if (chrome.runtime.lastError) {
            showMessage("Error: Please reload the active AEM tab and try again.", true);
            console.error(chrome.runtime.lastError);
            return;
          }

          let title = response?.title || '';
          if (!title && isVdm) {
            try {
              const urlParts = tab.url.split('/');
              const lastPart = urlParts[urlParts.length - 1].split('?')[0].split('#')[0];
              if (lastPart) {
                title = lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
              }
            } catch (fallbackErr) {
              console.warn("Failed VDM title fallback:", fallbackErr);
            }
          }

          if (!title) {
            showMessage("Warning: Title element not found. Generating URL only.", true);
          }

          // Realizar la conversión de la URL
          try {
            const origin = new URL(tab.url).origin;
            let publishUrl = '';

            if (isContentFragment) {
              const u = tab.url.split("/content/dam/");
              if (u.length < 2) {
                showMessage("Invalid Content Fragment URL structure.", true);
                return;
              }

              const pathPart = u[1].split('?')[0];
              const segments = pathPart.split('/').filter(Boolean);
              if (segments.length > 0) {
                segments.pop(); // Eliminar el Content Fragment en sí
              }
              publishUrl = `${origin}/ui#/aem/assets.html/content/dam/${segments.join('/')}`;
            } else if (isExperienceFragment) {
              const u = tab.url.split("/content/experience-fragments/");
              if (u.length < 2) {
                showMessage("Invalid Experience Fragment URL structure.", true);
                return;
              }

              const pathPart = u[1].split('?')[0];
              const segments = pathPart.split('/').filter(Boolean);
              if (segments.length > 0) {
                segments.pop(); // Eliminar la variación (ej. master.html)
              }
              publishUrl = `${origin}/aem/experience-fragments.html/content/experience-fragments/${segments.join('/')}`;
            } else if (isVdm) {
              const u = tab.url.split("/edit/content/");
              if (u.length < 2) {
                showMessage("Invalid VDM URL structure.", true);
                return;
              }

              const pathPart = u[1].split('?')[0];
              const segments = pathPart.split('/').filter(Boolean);
              if (segments.length > 0) {
                segments.pop(); // Eliminar la última sección (ej. options)
              }
              publishUrl = `${origin}/ui#/aem/vdm.html/browse/content/${segments.join('/')}`;
            }
            
            copyToClipboard(publishUrl, title);

          } catch (urlErr) {
            showMessage("Failed to parse URL structure.", true);
            console.error(urlErr);
          }
        });
      }

    } catch (err) {
      btnGenerate.disabled = false;
      showMessage("An error occurred during path generation.", true);
      console.error(err);
    }
  });

  // --- 2. DETECCIÓN AUTOMÁTICA DE ASSETS EN LA PÁGINA ---
  async function triggerAssetDetection() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id || !tab.url) {
        showNoAssetsPlaceholder();
        return;
      }

      // Solo escanear si estamos en una página de edición de AEM o VDM
      const isAemEditor = tab.url.includes('/editor.html/content/') || tab.url.includes('/aem/vdm.html/edit/content/');
      if (!isAemEditor) {
        showNoAssetsPlaceholder();
        return;
      }

      showScanningPlaceholder();

      chrome.tabs.sendMessage(tab.id, { action: 'detectAssets' }, (response) => {
        if (chrome.runtime.lastError || !response || !response.assets || response.assets.length === 0) {
          showNoAssetsPlaceholder();
          return;
        }

        renderDetectedAssets(response.assets, tab.url);
      });
    } catch (e) {
      console.error("Asset auto-detection error:", e);
      showNoAssetsPlaceholder();
    }
  }

  function renderDetectedAssets(assets, tabUrl) {
    updateAssetStatus('status-detected', 'Auto-Detected');
    detectedAssetsList.innerHTML = '';
    detectedAssetsContainer.style.display = 'block';

    const origin = new URL(tabUrl).origin;

    assets.forEach(assetPath => {
      const row = document.createElement('div');
      row.className = 'detected-asset-row';

      const leftDiv = document.createElement('div');
      leftDiv.className = 'detected-asset-left';

      // Icono SVG
      const iconSpan = document.createElement('span');
      iconSpan.className = 'detected-asset-icon';
      iconSpan.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      `;

      const filename = assetPath.split('/').pop();
      const nameSpan = document.createElement('span');
      nameSpan.className = 'detected-asset-name';
      nameSpan.textContent = filename;
      nameSpan.title = assetPath; // Tooltip con path completo

      // Auto Badge
      const autoBadge = document.createElement('span');
      autoBadge.className = 'row-auto-badge';
      autoBadge.textContent = 'Auto';

      leftDiv.appendChild(iconSpan);
      leftDiv.appendChild(nameSpan);
      leftDiv.appendChild(autoBadge);

      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn-copy-asset';
      copyBtn.textContent = 'Copy';
      
      copyBtn.addEventListener('click', () => {
        const segments = assetPath.split('/').filter(Boolean);
        const assetName = segments.pop();
        const publishUrl = `${origin}/ui#/aem/assets.html/${segments.join('/')}`;

        copyToClipboard(publishUrl, assetName);
      });

      row.appendChild(leftDiv);
      row.appendChild(copyBtn);
      detectedAssetsList.appendChild(row);
    });
  }

  // --- 3. COPIA MANUAL DE PATH DE ASSETS ---
  if (btnGenerateAsset && manualAssetInput) {
    btnGenerateAsset.addEventListener('click', async () => {
      const rawInput = manualAssetInput.value.trim();
      if (!rawInput) {
        showMessage("Please paste an asset path first.", true);
        return;
      }

      // Asegurarse de que empiece con /content/
      if (!rawInput.startsWith('/content/')) {
        showMessage("Asset path must start with '/content/'.", true);
        return;
      }

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const origin = tab?.url ? new URL(tab.url).origin : "https://author-p154363-e1620826.adobeaemcloud.com";

        const segments = rawInput.split('/').filter(Boolean);
        if (segments.length < 2) {
          showMessage("Invalid path structure.", true);
          return;
        }

        const assetName = segments.pop();
        const publishUrl = `${origin}/ui#/aem/assets.html/${segments.join('/')}`;

        copyToClipboard(publishUrl, assetName);
        manualAssetInput.value = ''; // Limpiar input

      } catch (err) {
        showMessage("Failed to generate asset publish path.", true);
        console.error(err);
      }
    });
  }

  // Inicializar detección automática al abrir el popup
  triggerAssetDetection();
});
