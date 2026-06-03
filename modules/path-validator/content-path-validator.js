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
  if (!parentResult.exists) {
    return {
      ...pathObj,
      status: 'INVALID',
      httpStatus: parentResult.status || 404,
      errorMsg: parentResult.error || 'Parent path not found'
    };
  }

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

      // 3. Prefix/fuzzy match (Crucial for VDM JCR keys that are underscore-separated truncated prefixes of the option title)
      if (!isMatch) {
        const keyAlpha = keyLower.replace(/[^a-z0-9]+/g, '');
        const searchAlpha = searchName.replace(/[^a-z0-9]+/g, '');
        if (keyAlpha.length >= 4) {
          isMatch = searchAlpha.startsWith(keyAlpha) || keyAlpha.startsWith(searchAlpha);
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

  // Element not found in parent folder
  return {
    ...pathObj,
    status: 'INVALID',
    httpStatus: 404,
    errorMsg: `Element "${elementName}" not found in parent folder`
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
      // Fallback: If it looks like an asset file, try checking the direct resource path via HEAD
      const filename = fetchPath.split('/').pop();
      if (filename && filename.includes('.') && !filename.endsWith('.json')) {
        try {
          const assetController = new AbortController();
          const assetTimeoutId = setTimeout(() => assetController.abort(), 5000);
          const assetRes = await fetch(fetchPath, {
            method: 'HEAD',
            signal: assetController.signal
          });
          clearTimeout(assetTimeoutId);

          if (assetRes.ok) {
            return {
              ...pathObj,
              status: 'VALID',
              httpStatus: assetRes.status
            };
          }
        } catch (assetErr) {
          // Fallback failed, continue with original 404 status
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
