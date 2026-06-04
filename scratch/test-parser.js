const getPathType = (p) => {
  if (p.includes('/experience-fragments/')) return 'XF';
  if (p.includes('/vdm')) return 'VDM';
  if (p.includes('/content/dam/')) {
    if (p.includes('/cf/') || p.includes('/content-fragments/')) return 'CF';
    return 'Assets';
  }
  return 'Pages';
};

function parsePathsFromText(text) {
  const lines = text.split('\n');
  const groups = [];
  let currentParent = null;

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

      currentParent = {
        rawLine: line,
        jcrPath: rawPath,
        type: getPathType(rawPath),
        isChild: false,
        children: []
      };
      groups.push(currentParent);
    }
    // Check if line represents a nested child element (starts with >)
    else if (line.match(/^>+/) && currentParent) {
      const elementName = line.replace(/^[>\s]+/, '').trim();
      if (elementName) {
        const childJcrPath = `${currentParent.jcrPath}/${elementName}`;
        currentParent.children.push({
          rawLine: line,
          jcrPath: childJcrPath,
          type: getPathType(childJcrPath),
          isChild: true,
          parentPath: currentParent.jcrPath,
          elementName: elementName
        });
      }
    }
  }

  const paths = [];
  for (const group of groups) {
    if (group.children.length > 0) {
      paths.push(...group.children);
    } else {
      const { children, ...parentPathObj } = group;
      paths.push(parentPathObj);
    }
  }
  return paths;
}

const testText = `
https://author-p154363-e1620826.adobeaemcloud.com/assets.html/content/dam/na/cf/ford/en_ca/nameplate/mustang/2026
>>> Model Billboards
>>> faq-fragment
>>> faq_fragment
>>> Model Billboard
`;

const result = parsePathsFromText(testText);
console.log("Length:", result.length);
console.log(JSON.stringify(result, null, 2));
