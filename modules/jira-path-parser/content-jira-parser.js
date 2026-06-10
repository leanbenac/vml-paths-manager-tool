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

function scrapeSummary() {
  const summaryVal = document.getElementById('summary-val');
  if (summaryVal && summaryVal.textContent.trim()) {
    return summaryVal.textContent.trim();
  }
  const cloudTitle = document.querySelector('h1[data-test-id="issue.views.issue-base.foundation.summary.heading"]');
  if (cloudTitle && cloudTitle.textContent.trim()) {
    return cloudTitle.textContent.trim();
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
  const commentsList = [];
  const ids = [];

  // Query comment wrapper containers for Jira Server and Jira Cloud
  const containers = document.querySelectorAll('.activity-comment, .issue-data-block, [data-test-id^="issue.activity.comment"]');
  
  containers.forEach(container => {
    // Try to find numeric comment ID to determine chronological sort direction
    const idAttr = container.getAttribute('id') || '';
    let numericId = null;
    const match = idAttr.match(/comment-(\d+)/);
    if (match) {
      numericId = parseInt(match[1], 10);
    } else {
      const anchor = container.querySelector('a[href*="focusedCommentId="], a[id^="comment-"]');
      if (anchor) {
        const href = anchor.getAttribute('href') || '';
        const hrefMatch = href.match(/focusedCommentId=(\d+)/);
        if (hrefMatch) {
          numericId = parseInt(hrefMatch[1], 10);
        } else {
          const anchorId = anchor.getAttribute('id') || '';
          const anchorIdMatch = anchorId.match(/comment-(\d+)/);
          if (anchorIdMatch) {
            numericId = parseInt(anchorIdMatch[1], 10);
          }
        }
      }
    }
    
    // Retrieve the text body of this comment
    let bodyText = '';
    const serverBody = container.querySelector('.comment-body, .action-body');
    if (serverBody) {
      bodyText = serverBody.innerText.trim();
    } else {
      const cloudBody = container.querySelector('[data-test-id="issue-history.renderer.comment-body"], [data-testid="comment-body"], .ak-renderer-document');
      if (cloudBody) {
        bodyText = cloudBody.innerText.trim();
      } else {
        bodyText = container.innerText.trim();
      }
    }

    if (bodyText) {
      commentsList.push({
        text: bodyText,
        id: numericId
      });
      if (numericId) {
        ids.push(numericId);
      }
    }
  });

  // Determine if DOM order is descending (newest first)
  let isDescending = false;
  if (ids.length >= 2) {
    if (ids[0] > ids[ids.length - 1]) {
      isDescending = true;
    }
  }

  let finalComments = commentsList.map(c => c.text);

  // If descending, reverse to ascending (oldest first)
  if (isDescending) {
    console.log("[VML Paths Manager Assistant] Detected descending comment order in DOM. Reversing to ascending.");
    finalComments.reverse();
  }

  // Deduplicate comments
  const uniqueComments = [...new Set(finalComments.filter(Boolean))];

  return uniqueComments;
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
      const summary = scrapeSummary();
      const description = scrapeDescription();
      const commentsArray = scrapeComments();
      const linkedIssues = detectLinkedIssues();
      const subtasks = detectSubtasks();

      sendResponse({
        success: true,
        issueKey: issueKey,
        summary: summary,
        description: description,
        comments: commentsArray,
        linkedIssues: linkedIssues,
        subtasks: subtasks,
        fullText: `${description}\n\n=== COMMENTS ===\n\n${commentsArray.join('\n\n')}`
      });
    } catch (err) {
      console.error("[VML Paths Manager Assistant] Failed to scrape Jira ticket:", err);
      sendResponse({ success: false, error: err.message });
    }
  }
  return true; // Keep channel open
});
