// ============================================
// VML Paths Manager Assistant — Content: Path Validator
// Validates target publish paths inside AEM Cloud/VDM tab origin
// ============================================

const parentCache = new Map();

async function getParentData(parentPath) {
  if (parentCache.has(parentPath)) {
    return parentCache.get(parentPath);
  }

  let fetchPath = parentPath.startsWith('/') ? parentPath : '/' + parentPath;
  if (fetchPath.endsWith('.html')) {
    fetchPath = fetchPath.substring(0, fetchPath.length - 5);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(fetchPath + '.2.json', {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const result = { exists: true, data: data, status: res.status };
      parentCache.set(parentPath, result);
      return result;
    } else {
      const result = { exists: false, status: res.status };
      parentCache.set(parentPath, result);
      return result;
    }
  } catch (err) {
    clearTimeout(timeoutId);
    const result = { exists: false, error: err.message };
    parentCache.set(parentPath, result);
    return result;
  }
}

async function checkChildPath(pathObj) {
  const parentPath = pathObj.parentPath;
  const elementName = pathObj.elementName;
  
  const parentResult = await getParentData(parentPath);
  if (parentResult.exists) {
    const json = parentResult.data;
    const searchName = elementName.toLowerCase().trim();

    for (const key in json) {
      if (json[key] && typeof json[key] === 'object' && !Array.isArray(json[key]) && key !== 'jcr:content') {
        const child = json[key];
        
        // 1. Match JCR key directly (e.g. "model-billboards" or "dual_zone_electronic")
        const keyLower = key.toLowerCase().trim();
        
        // 2. Extract title from dc:title, jcr:title, custom title/label fields
        let title = "";
        const dcTitle = child["jcr:content"]?.["metadata"]?.["dc:title"];
        if (dcTitle) {
          title = Array.isArray(dcTitle) ? dcTitle[0] : dcTitle;
        }
        if (!title && child["jcr:content"]?.["jcr:title"]) {
          title = child["jcr:content"]["jcr:title"];
        }
        if (!title && child["jcr:title"]) {
          title = child["jcr:title"];
        }
        if (!title && child["title"]) {
          title = child["title"];
        }
        if (!title && child["label"]) {
          title = child["label"];
        }
        if (!title && child["description"]) {
          title = child["description"];
        }
        if (!title && child["name"]) {
          title = child["name"];
        }
        if (!title && child["headline"]) {
          title = child["headline"];
        }
        
        const titleLower = title ? title.toLowerCase().trim() : "";

        // Match key or title or clean kebab-case match (converts spaces/punctuation to dashes)
        const cleanKeyMatch = keyLower.replace(/[^a-z0-9]+/g, '-');
        const cleanSearchMatch = searchName.replace(/[^a-z0-9]+/g, '-');
        
        let isMatch = (keyLower === searchName) || 
                      (titleLower === searchName) || 
                      (cleanKeyMatch === cleanSearchMatch) ||
                      (cleanKeyMatch.replace(/^-+|-+$/g, '') === cleanSearchMatch.replace(/^-+|-+$/g, ''));

        // 3. Substring/fuzzy match (Crucial for JCR keys that are parts of the option title, e.g. "darkhorsepremium" in "2026 Mustang® Dark Horse® Premium")
        if (!isMatch) {
          const keyAlpha = keyLower.replace(/[^a-z0-9]+/g, '');
          const searchAlpha = searchName.replace(/[^a-z0-9]+/g, '');
          if (keyAlpha.length >= 4) {
            isMatch = searchAlpha.includes(keyAlpha) || keyAlpha.includes(searchAlpha);
          }
        }

        if (isMatch) {
          // Match found! Resolve true JCR path
          const resolvedJcrPath = `${parentPath}/${key}`;
          return {
            ...pathObj,
            jcrPath: resolvedJcrPath,
            status: 'VALID',
            httpStatus: parentResult.status
          };
        }
      }
    }
  }

  // FALLBACK: If parent folder is not queryable OR the child wasn't found in the parent metadata list,
  // try direct validation of guessed child keys as a last resort.
  const guessedKeys = new Set();
  // 1. Direct name
  guessedKeys.add(elementName.trim());
  // 2. Lowercase direct name
  guessedKeys.add(elementName.toLowerCase().trim());
  // 3. Kebab-case (spaces/caps/punctuation to dashes)
  guessedKeys.add(elementName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));
  // 4. Snake-case (spaces/punctuation to underscores)
  guessedKeys.add(elementName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''));
  // 5. Lowercase alphanumeric-only (no separators)
  guessedKeys.add(elementName.toLowerCase().trim().replace(/[^a-z0-9]+/g, ''));

  // 6. Deduce keys by filtering out year numbers and words already present in the parent path.
  // This helps match model keys like "darkhorsepremium" under ".../mustang/2026/model"
  try {
    const parentWords = new Set(
      parentPath.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2)
    );
    const elementClean = elementName.replace(/[^a-zA-Z0-9\s-_]+/g, '');
    const elementWordsRaw = elementClean
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // split camelCase
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);

    const filteredWords = elementWordsRaw.filter(word => {
      // Remove years or numbers
      if (/^\d+$/.test(word)) return false;
      // Remove words that exist in the parent path
      if (parentWords.has(word)) return false;
      return true;
    });

    if (filteredWords.length > 0 && filteredWords.length < elementWordsRaw.length) {
      guessedKeys.add(filteredWords.join(''));
      guessedKeys.add(filteredWords.join('-'));
      guessedKeys.add(filteredWords.join('_'));
    }
  } catch (err) {
    console.warn("Failed to deduce parent-filtered keys:", err);
  }

  // Add singular/plural variations to expand coverage (e.g. "model-billboard" vs "model-billboards")
  const expandedKeys = new Set(guessedKeys);
  for (const key of guessedKeys) {
    if (!key) continue;
    if (key.endsWith('s')) {
      const singular = key.substring(0, key.length - 1);
      if (singular) expandedKeys.add(singular);
    } else {
      expandedKeys.add(key + 's');
    }
  }

  for (const key of expandedKeys) {
    if (!key) continue;
    const childJcrPath = `${parentPath}/${key}`;
    
    const checkResult = await checkPath({
      jcrPath: childJcrPath,
      isChild: false,
      type: pathObj.type
    });

    if (checkResult.status === 'VALID' || checkResult.status === 'RESTRICTED') {
      return {
        ...pathObj,
        jcrPath: childJcrPath,
        status: checkResult.status,
        httpStatus: checkResult.httpStatus
      };
    }
  }

  return {
    ...pathObj,
    status: 'INVALID',
    httpStatus: parentResult.status || 404,
    errorMsg: `Element "${elementName}" not found or verified in parent folder`
  };
}

async function checkPath(pathObj) {
  if (pathObj.isChild) {
    return checkChildPath(pathObj);
  }

  // For base paths, check if we already fetched parent details
  if (parentCache.has(pathObj.jcrPath)) {
    const parentResult = parentCache.get(pathObj.jcrPath);
    if (parentResult.exists) {
      return {
        ...pathObj,
        status: 'VALID',
        httpStatus: parentResult.status
      };
    } else {
      return {
        ...pathObj,
        status: 'INVALID',
        httpStatus: parentResult.status || 404,
        errorMsg: parentResult.error
      };
    }
  }

  const jcrPath = pathObj.jcrPath;
  let fetchPath = jcrPath.startsWith('/') ? jcrPath : '/' + jcrPath;

  // Clean HTML extensions if present on page paths
  if (fetchPath.endsWith('.html')) {
    fetchPath = fetchPath.substring(0, fetchPath.length - 5);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    // Try fetching the .1.json metadata from AEM Sling GET servlet
    const res = await fetch(fetchPath + '.1.json', {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      return {
        ...pathObj,
        status: 'VALID',
        httpStatus: res.status
      };
    } else if (res.status === 404) {
      // Fallback: Try checking the direct resource path via HEAD (handles assets with extensions, and Content Fragments/folders without extensions)
      try {
        const directController = new AbortController();
        const directTimeoutId = setTimeout(() => directController.abort(), 5000);
        const directRes = await fetch(fetchPath, {
          method: 'HEAD',
          signal: directController.signal
        });
        clearTimeout(directTimeoutId);

        if (directRes.ok) {
          return {
            ...pathObj,
            status: 'VALID',
            httpStatus: directRes.status
          };
        }
      } catch (directErr) {
        // Fallback failed, continue
      }

      // Additional Fallback for DAM assets and Content Fragments:
      // Try resolving via .model.json (standard AEM Content Fragment headless exporter)
      // or via standard .json (in case Sling GET servlet restricts .1.json but allows .json)
      if (fetchPath.includes('/content/dam/')) {
        try {
          const modelController = new AbortController();
          const modelTimeoutId = setTimeout(() => modelController.abort(), 5000);
          const modelRes = await fetch(fetchPath + '.model.json', {
            method: 'HEAD',
            signal: modelController.signal
          });
          clearTimeout(modelTimeoutId);

          if (modelRes.ok) {
            return {
              ...pathObj,
              status: 'VALID',
              httpStatus: modelRes.status
            };
          }
        } catch (modelErr) {
          // Fallback failed, continue
        }

        try {
          const jsonController = new AbortController();
          const jsonTimeoutId = setTimeout(() => jsonController.abort(), 5000);
          const jsonRes = await fetch(fetchPath + '.json', {
            method: 'HEAD',
            signal: jsonController.signal
          });
          clearTimeout(jsonTimeoutId);

          if (jsonRes.ok) {
            return {
              ...pathObj,
              status: 'VALID',
              httpStatus: jsonRes.status
            };
          }
        } catch (jsonErr) {
          // Fallback failed, continue
        }
      }

      return {
        ...pathObj,
        status: 'INVALID',
        httpStatus: res.status
      };
    } else if (res.status === 403) {
      return {
        ...pathObj,
        status: 'RESTRICTED',
        httpStatus: res.status
      };
    } else {
      return {
        ...pathObj,
        status: 'UNVERIFIED',
        httpStatus: res.status
      };
    }
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      ...pathObj,
      status: 'ERROR',
      errorMsg: err.message || 'Network timeout or CORS error'
    };
  }
}

async function runValidation(paths) {
  parentCache.clear(); // Clear cache for new validation run
  
  const results = [];
  const batchSize = 4; // Fetch 4 paths concurrently
  for (let i = 0; i < paths.length; i += batchSize) {
    const batch = paths.slice(i, i + batchSize);
    const promises = batch.map(pathObj => checkPath(pathObj));
    const batchResults = await Promise.all(promises);
    results.push(...batchResults);

    // Send real-time progress updates back to the popup
    const progressCount = Math.min(i + batchSize, paths.length);
    try {
      chrome.runtime.sendMessage({
        action: 'validationProgress',
        current: progressCount,
        total: paths.length
      });
    } catch (err) {
      // Ignore if popup is closed or channel is unavailable
    }
  }
  return results;
}

// Listen for messages from the popup script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'validatePaths') {
    runValidation(request.paths || [])
      .then(results => {
        sendResponse({ success: true, results: results });
      })
      .catch(err => {
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep message channel open for async response
  }
});
