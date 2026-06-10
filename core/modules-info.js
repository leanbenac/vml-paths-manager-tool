// =======================================================
// VML Paths Manager Assistant — In-App Documentation Dictionary
// Centralized rules, descriptions, and validations (English)
// =======================================================

const MODULES_DOCUMENTATION = {
  publishPathGenerator: {
    title: "Publish Path Finder & Generator",
    description: "Generate formatted assets publish paths for AEM (Pages, Content Fragments, Experience Fragments, or VDM).",
    validations: [
      "Automatically scans the current page to detect active assets.",
      "Allows manual path entry if an asset is not automatically detected.",
      "Automatically copies the generated publish path to your clipboard upon creation."
    ]
  },
  jiraPathParser: {
    title: "Jira AEM Path Parser",
    description: "Extract AEM folder URLs and sub-items (starting with >) from Jira descriptions and comments.",
    validations: [
      "Press 'SCAN ACTIVE JIRA TICKET' when on a Jira ticket page to scrape automatically.",
      "Scans subtasks in batch mode when available.",
      "Constructs full JCR paths and generates direct editor links for nested components."
    ]
  },
  pathValidator: {
    title: "Path Validator",
    description: "Paste publish paths or load a TXT file to verify if they exist on the active AEM or VDM environment.",
    validations: [
      "Requires being on an active AEM Cloud or VDM page.",
      "Parses base paths and child elements (>>>) from raw text or loaded TXT files.",
      "Performs asynchronous JCR query requests to check existence and returns live validation status."
    ]
  }
};
