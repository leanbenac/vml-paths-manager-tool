// ============================================
// VML Paths Manager Assistant — Content: Jira Parser
// Scrapes active Jira ticket descriptions, comments, and linked issues.
// ============================================

function getJiraKey() {
  // Try to find the ticket key from common Jira Server/Cloud elements
  const keyValEl = document.getElementById('key-val');
  if (keyValEl && keyValEl.textContent.trim()) {
    return keyValEl.textContent.trim();
  }

  const breadcrumbKeyEl = document.querySelector('a.issue-link[data-issue-key]');
  if (breadcrumbKeyEl && breadcrumbKeyEl.dataset.issueKey) {
    return breadcrumbKeyEl.dataset.issueKey;
  }

  // Fallback to parsing from URL
  const match = window.location.pathname.match(/\/browse\/([A-Z]+-[0-9]+)/);
  if (match && match[1]) {
    return match[1];
  }

  return '';
}

function scrapeDescription() {
  let texts = [];

  // Jira Server / Data Center Description Selectors
  const serverDesc = document.querySelector('#description-val .user-content-block');
  if (serverDesc && serverDesc.innerText.trim()) {
    texts.push(serverDesc.innerText.trim());
  } else {
    const serverDescFallback = document.getElementById('description-val');
    if (serverDescFallback && serverDescFallback.innerText.trim()) {
      texts.push(serverDescFallback.innerText.trim());
    }
  }

  // Jira Cloud Description Selectors
  const cloudDesc = document.querySelector('[data-test-id="issue.views.field.rich-text.description"]');
  if (cloudDesc && cloudDesc.innerText.trim()) {
    texts.push(cloudDesc.innerText.trim());
  }

  const cloudDescAlt = document.querySelector('.ak-renderer-document');
  if (cloudDescAlt && cloudDescAlt.innerText.trim()) {
    texts.push(cloudDescAlt.innerText.trim());
  }

  return texts.join('\n');
}

function scrapeComments() {
  const comments = [];

  // Jira Server / Data Center Comments
  const serverComments = document.querySelectorAll('.comment-body, .action-body.floated, .action-body.flooded, .activity-comment .action-body');
  serverComments.forEach(el => {
    const txt = el.innerText.trim();
    if (txt && !comments.includes(txt)) {
      comments.push(txt);
    }
  });

  // Jira Cloud Comments
  const cloudComments = document.querySelectorAll('[data-test-id^="issue.activity.comment"] div, div[id^="comment-"]');
  cloudComments.forEach(el => {
    const txt = el.innerText.trim();
    if (txt && !comments.includes(txt)) {
      comments.push(txt);
    }
  });

  return comments.join('\n\n');
}

function detectLinkedIssues() {
  const keys = new Set();
  const currentKey = getJiraKey();

  // Find all elements containing issue links
  const links = document.querySelectorAll('a.issue-link, [data-test-id*="issue-link"], td.nav-key a, #internal-issue_table a');
  
  links.forEach(link => {
    // Check if the link has a data-issue-key attribute
    if (link.dataset.issueKey) {
      keys.add(link.dataset.issueKey);
    } else if (link.getAttribute('data-issue-key')) {
      keys.add(link.getAttribute('data-issue-key'));
    } else {
      // Check href or text for issue key pattern (e.g. GTBNAPX-255504)
      const href = link.getAttribute('href') || '';
      const text = link.textContent?.trim() || '';
      
      const keyRegex = /([A-Z]+-[0-9]+)/;
      const hrefMatch = href.match(keyRegex);
      if (hrefMatch) {
        keys.add(hrefMatch[1]);
      } else {
        const textMatch = text.match(keyRegex);
        if (textMatch) {
          keys.add(textMatch[1]);
        }
      }
    }
  });

  // Remove the current issue key from list of links
  if (currentKey) {
    keys.delete(currentKey);
  }

  return Array.from(keys);
}

function detectSubtasks() {
  const keys = new Set();
  
  // 1. Classic view: issue table rows
  const subtaskRows = document.querySelectorAll('#issuetable tr.issuerow[data-issuekey]');
  subtaskRows.forEach(row => {
    const key = row.getAttribute('data-issuekey');
    if (key) keys.add(key.trim());
  });

  // 2. Element attributes (anywhere in child issues panel or subtasks container)
  const subtaskContainers = document.querySelectorAll('#subtasks, #child-issues-panel, .subtask-list, [data-test-id*="child-issues-panel"], #parent_issue_summary, #subtasks_set');
  subtaskContainers.forEach(container => {
    // Find all links with issue keys inside the subtasks container
    const links = container.querySelectorAll('a.issue-link, a[href*="/browse/"]');
    links.forEach(link => {
      // Extract key from data attribute
      if (link.dataset.issueKey) {
        keys.add(link.dataset.issueKey.trim());
      } else if (link.getAttribute('data-issue-key')) {
        keys.add(link.getAttribute('data-issue-key').trim());
      } else {
        // Extract key from href
        const href = link.getAttribute('href') || '';
        const match = href.match(/\/browse\/([A-Z0-9]+-[0-9]+)/i);
        if (match) {
          keys.add(match[1].toUpperCase());
        }
      }
    });
    
    // Also check elements with data-issuekey directly inside the container
    container.querySelectorAll('[data-issuekey], [data-issue-key]').forEach(el => {
      const key = el.getAttribute('data-issuekey') || el.getAttribute('data-issue-key');
      if (key) keys.add(key.trim());
    });
  });

  // 3. Fallback: scan for any elements in the main subtasks list (e.g. Jira Server New Issue View)
  const subtaskLinks = document.querySelectorAll('.subtask-list a.issue-link, .subtasks-list-container a.issue-link, #subtasks-list a.issue-link');
  subtaskLinks.forEach(link => {
    const match = link.textContent.match(/([A-Z0-9]+-[0-9]+)/);
    if (match) {
      keys.add(match[1]);
    }
  });

  // Remove the current issue key just in case it got matched
  const currentKey = getJiraKey();
  if (currentKey) {
    keys.delete(currentKey);
  }

  return Array.from(keys);
}

// Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkSubtasks') {
    try {
      const subtasks = detectSubtasks();
      sendResponse({ subtasks: subtasks });
    } catch (err) {
      sendResponse({ subtasks: [] });
    }
    return true;
  }

  if (request.action === 'getJiraIssueDetails') {
    try {
      const issueKey = getJiraKey();
      const description = scrapeDescription();
      const comments = scrapeComments();
      const linkedIssues = detectLinkedIssues();
      const subtasks = detectSubtasks();

      sendResponse({
        success: true,
        issueKey: issueKey,
        description: description,
        comments: comments,
        linkedIssues: linkedIssues,
        subtasks: subtasks,
        fullText: `${description}\n\n=== COMMENTS ===\n\n${comments}`
      });
    } catch (err) {
      console.error("[VML Paths Manager Assistant] Failed to scrape Jira ticket:", err);
      sendResponse({ success: false, error: err.message });
    }
  }
  return true; // Keep channel open
});
