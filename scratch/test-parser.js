function htmlToPlainText(html) {
  if (!html.includes('<') && !html.includes('&')) {
    return html;
  }
  // Simple regex-based HTML stripping and entity unescaping for the node test environment
  let cleanHtml = html
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, '') // strip all tags
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return cleanHtml;
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
    // Detect child elements starting with >, >>, or >>>
    else if (cleanLine.match(/^>+/) && currentGroup) {
      // Strip '>' and leading spaces
      const elementName = cleanLine.replace(/^[>\s]+/, '');
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

// Mock text representing the exact parsed text of the HTML comment the user provided
const mockJiraText = `
Hi Team,

this issue has been fixed.

Verification Link:

https://author-p154363-e1620826.adobeaemcloud.com/content/na/ford/en_us/suvs/expedition/2026.html?wcmmode=disabled

Content Fragment:

https://author-p154363-e1620826.adobeaemcloud.com/ui#/aem/assets.html/content/dam/na/cf/ford/en_us/nameplate/expedition/2026/models/kingranchmax

>>settings

https://author-p154363-e1620826.adobeaemcloud.com/ui#/aem/assets.html/content/dam/na/cf/ford/en_us/nameplate/expedition/2026/models/kingranch

>>settings

https://author-p154363-e1620826.adobeaemcloud.com/ui#/aem/assets.html/content/dam/na/cf/ford/en_us/nameplate/expedition/2026/models/platinummax

>>settings

https://author-p154363-e1620826.adobeaemcloud.com/ui#/aem/assets.html/content/dam/na/cf/ford/en_us/nameplate/expedition/2026/models/platinum

>>settings

https://author-p154363-e1620826.adobeaemcloud.com/ui#/aem/assets.html/content/dam/na/cf/ford/en_us/nameplate/expedition/2026/models/tremor

>>settings

https://author-p154363-e1620826.adobeaemcloud.com/ui#/aem/assets.html/content/dam/na/cf/ford/en_us/nameplate/expedition/2026/models/activemax

>>settings

https://author-p154363-e1620826.adobeaemcloud.com/ui#/aem/assets.html/content/dam/na/cf/ford/en_us/nameplate/expedition/2026/models/active

>>settings

Pages:

https://author-p154363-e1620826.adobeaemcloud.com/ui#/aem/sites.html/content/na/ford/en_us/suvs/expedition

>>2026

Evidence:

Evidence7.mp4

Regards!
`;

const result = extractAEMData(mockJiraText);
console.log(JSON.stringify(result, null, 2));
