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

  const promise = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const res = await fetch(fetchPath + '.1.json', {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        return { exists: true, data: data, status: res.status };
      } else {
        return { exists: false, status: res.status };
      }
    } catch (err) {
      clearTimeout(timeoutId);
      return { exists: false, error: err.message };
    }
  })();

  parentCache.set(parentPath, promise);
  return promise;
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

        // 3. Substring/fuzzy match (Crucial for JCR keys that are parts of the option title)
        if (!isMatch) {
          const keyAlpha = keyLower.replace(/[^a-z0-9]+/g, '');
          const searchAlpha = searchName.replace(/[^a-z0-9]+/g, '');
          if (keyAlpha.length >= 4) {
            const isSub = searchAlpha.includes(keyAlpha) || keyAlpha.includes(searchAlpha);
            if (isSub) {
              // Prevent singular/plural cross-matching if the ONLY difference is a trailing 's'
              const diffLength = Math.abs(keyAlpha.length - searchAlpha.length);
              if (diffLength === 1) {
                const longer = keyAlpha.length > searchAlpha.length ? keyAlpha : searchAlpha;
                const shorter = keyAlpha.length > searchAlpha.length ? searchAlpha : keyAlpha;
                if (longer.endsWith('s') && longer.substring(0, longer.length - 1) === shorter) {
                  isMatch = false;
                } else {
                  isMatch = true;
                }
              } else {
                isMatch = true;
              }
            }
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
    
    // If parent folder was successfully queried but child was not found, it is invalid
    return {
      ...pathObj,
      status: 'INVALID',
      httpStatus: parentResult.status || 404,
      errorMsg: `Element "${elementName}" not found in parent folder metadata`
    };
  }

  // FALLBACK: If parent folder is not queryable (exists is false),
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

  for (const key of guessedKeys) {
    if (!key) continue;
    const childJcrPath = `${parentPath}/${key}`;
    
    const checkResult = await checkPath({
      jcrPath: childJcrPath,
      isChild: false,
      type: pathObj.type,
      expectFolder: false
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

  // Fallback: Check one level up in the directory tree
  // This helps when scrapers mistakenly put a CF inside a subfolder (like /highlights) 
  // instead of the year folder (like /2026)
  if (!pathObj._hasCheckedUpOneLevel) {
    const pathSegments = parentPath.split('/').filter(Boolean);
    if (pathSegments.length > 2) {
      pathSegments.pop(); // Go up one level
      const upOneLevelPath = '/' + pathSegments.join('/');
      
      const upOneLevelResult = await checkChildPath({
        ...pathObj,
        parentPath: upOneLevelPath,
        _hasCheckedUpOneLevel: true // prevent infinite loops
      });
      
      if (upOneLevelResult.status === 'VALID' || upOneLevelResult.status === 'RESTRICTED') {
        return upOneLevelResult;
      }
    }
  }

  return {
    ...pathObj,
    status: 'INVALID',
    httpStatus: parentResult.status || 404,
    errorMsg: `Element "${elementName}" not found in folder or parent folder`
  };
}

function hasFileExtension(path) {
  const match = path.match(/\.([a-zA-Z0-9]+)$/);
  if (!match) return false;
  const ext = match[1].toLowerCase();
  return ext !== 'html' && ext !== 'json' && ext !== 'xml';
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

  // If the path has a file extension (e.g., .png, .tif), check it directly first
  // to avoid false positives from Sling suffix resolution on parent folders/assets
  if (hasFileExtension(fetchPath)) {
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
      } else if (directRes.status === 404) {
        return {
          ...pathObj,
          status: 'INVALID',
          httpStatus: directRes.status
        };
      } else if (directRes.status === 403) {
        return {
          ...pathObj,
          status: 'RESTRICTED',
          httpStatus: directRes.status
        };
      }
    } catch (err) {
      // Ignore and fallback
    }
  }

  let expectFolder = false;
  if (pathObj.expectFolder !== undefined) {
    expectFolder = pathObj.expectFolder;
  } else {
    const pathLower = fetchPath.toLowerCase();
    const isPossiblyFolder = fetchPath.endsWith('/') || 
                             (pathObj.type === 'VDM' && !pathLower.includes('/model')) ||
                             (pathObj.type === 'Assets' && !pathLower.split('/').pop().includes('.'));
    expectFolder = isPossiblyFolder;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  let slingSuffixFalsePositive = false;

  try {
    // Try fetching the .1.json metadata from AEM Sling GET servlet
    const res = await fetch(fetchPath + '.1.json', {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      try {
        const data = await res.json();
        const primaryType = data ? data["jcr:primaryType"] : null;
        const isFolderType = primaryType === "sling:Folder" || 
                              primaryType === "sling:OrderedFolder" || 
                              primaryType === "nt:folder";
        
        if (isFolderType && !expectFolder) {
          // Sling Suffix Resolution False Positive detected!
          // We expected a file/fragment/page but got folder metadata instead.
          slingSuffixFalsePositive = true;
        } else {
          return {
            ...pathObj,
            status: 'VALID',
            httpStatus: res.status
          };
        }
      } catch (jsonErr) {
        // If JSON parsing fails but response was ok, fallback to assuming it is valid
        return {
          ...pathObj,
          status: 'VALID',
          httpStatus: res.status
        };
      }
    }

    if (!res.ok || slingSuffixFalsePositive) {
      const status = res.status;
      if (status === 404 || slingSuffixFalsePositive) {
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
          httpStatus: slingSuffixFalsePositive ? 404 : status
        };
      } else if (status === 403) {
        return {
          ...pathObj,
          status: 'RESTRICTED',
          httpStatus: status
        };
      } else {
        return {
          ...pathObj,
          status: 'UNVERIFIED',
          httpStatus: status
        };
      }
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
