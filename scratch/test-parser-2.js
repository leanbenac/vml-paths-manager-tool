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
          
          const parts = cleanUrl.split('/content/');
          if (parts.length >= 2) {
            if (cleanUrl.includes('editor.html')) {
              currentGroup = null;
              continue;
            }
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
    // Detect child elements starting with >> or >>>
    else if (cleanLine.match(/^>{2,3}/) && currentGroup) {
      // Strip '>' and leading spaces
      const elementName = cleanLine.replace(/^>{2,3}\s*/, '');
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

const mockJiraHtml = `
<div class="issuePanelWrapper">
        <div class="issuePanelProgress"></div>
        <div class="issuePanelContainer" id="issue_actions_container">
            <div class="issuePanelHeaderContainer" id="issue_actions_header_container">
                


    <jira-comment-pins-discovery resolved=""><div class="aui-message aui-message-change"><p>You can now pin up to five comments to highlight important information. Pinned comments will appear above all other comments, so they're easy to find.</p><button type="button" class="css-1xjowgn"><span class="css-j8fq0c"><span class="css-eaycls">Got it</span></span></button><span class="sc-bxivhb kmERCb"></span><a href="https://docs.atlassian.com/jira/jsw-docs-0912/Editing+and+collaborating+on+issues#pin-comment" type="button" class="css-twjd0o"><span class="css-j8fq0c"><span class="css-eaycls">Learn more about pinned comments</span></span></a></div></jira-comment-pins-discovery>


            </div>
                                                



<div id="comment-25540057" class="issue-data-block activity-comment twixi-block  expanded ">
    <div class="twixi-wrap verbose actionContainer">
        <div class="action-head">
            <h3>
                <button class="twixi icon-default aui-icon aui-icon-small aui-iconfont-expanded">
                    Collapse comment:         
    
    
    
    
                            Solana Tarantola added a comment - 21/May/26 8:13 PM     
                </button>
            </h3>
            <div class="action-details">        
    
    
    
    
                            



    <a class="user-hover user-avatar" rel="solana.tarantola@vml.com" id="commentauthor_25540057_verbose" href="/secure/ViewProfile.jspa?name=solana.tarantola%40vml.com"><span class="aui-avatar aui-avatar-xsmall"><span class="aui-avatar-inner"><img src="https://jira.uhub.biz/secure/useravatar?size=xsmall&amp;avatarId=14120" loading="lazy"></span></span> Solana Tarantola</a>
 added a comment  - <a href="/browse/GTBNAPX-255784?focusedId=25540057&amp;page=com.atlassian.jira.plugin.system.issuetabpanels:comment-tabpanel#comment-25540057" class="commentdate_25540057_verbose subText comment-created-date-link"><span class="date user-tz" title="21/May/26 8:13 PM"><span class="explicit explicit-time">21/May/26 8:13 PM</span><time class="livestamp" datetime="2026-05-21T20:13:58+0000" style="display: none;">21/May/26 8:13 PM</time><span class="relative">, </span><span class="relative">12 days ago</span></span></a>       </div>
        </div>
        <div class="action-body flooded"><p>Verified in Prod Preview</p>

<p><a href="https://wwwac.preview.brandus.ford.com/suvs/expedition/2027/?brand=false" class="external-link" target="_blank" rel="nofollow noopener">https://wwwac.preview.brandus.ford.com/suvs/expedition/2027/?brand=false</a>&nbsp;</p>

<p>Device(s): Desktop<br>
OS(s): Windows 10<br>
Browser(s): Google Chrome v112</p>

<p>Evidence:</p>

<p><span class="nobr"><a href="/secure/attachment/12372672/12372672_2026-05-21_GTBNAPX-255784.mp4" title="2026-05-21_GTBNAPX-255784.mp4 attached to GTBNAPX-255784" target="_blank" rel="noopener">2026-05-21_GTBNAPX-255784.mp4<sup><img class="rendericon" src="/images/icons/link_attachment_7.gif" height="7" width="7" align="absmiddle" alt="" border="0"></sup></a></span></p>

<p>This ticket will be closed.<br>
Thanks</p> </div>
    </div>
</div>
                                     



<div id="comment-25538277" class="issue-data-block activity-comment twixi-block  expanded ">
    <div class="twixi-wrap verbose actionContainer">
        <div class="action-head">
            <h3>
                <button class="twixi icon-default aui-icon aui-icon-small aui-iconfont-expanded">
                    Collapse comment:         
    
    
    
    
                            Sol Cardin added a comment - 21/May/26 5:57 PM     
                </button>
            </h3>
            <div class="action-details">        
    
    
    
    
                            



    <a class="user-hover user-avatar" rel="sol.cardin@vml.com" id="commentauthor_25538277_verbose" href="/secure/ViewProfile.jspa?name=sol.cardin%40vml.com"><span class="aui-avatar aui-avatar-xsmall"><span class="aui-avatar-inner"><img src="https://jira.uhub.biz/secure/useravatar?size=xsmall&amp;ownerId=sol.cardin%40wunderman.com&amp;avatarId=32924" loading="lazy"></span></span> Sol Cardin</a>
 added a comment  - <a href="/browse/GTBNAPX-255784?focusedId=25538277&amp;page=com.atlassian.jira.plugin.system.issuetabpanels:comment-tabpanel#comment-25538277" class="commentdate_25538277_verbose subText comment-created-date-link"><span class="date user-tz" title="21/May/26 5:57 PM"><span class="explicit explicit-time">21/May/26 5:57 PM</span><time class="livestamp" datetime="2026-05-21T17:57:40+0000" style="display: none;">21/May/26 5:57 PM</time><span class="relative">, </span><span class="relative">12 days ago</span></span></a>       </div>
        </div>
        <div class="action-body flooded"><p>Hi! This has been published to Prod Preview. Please restest. Thanks!</p> </div>
    </div>
</div>
                                     



<div id="comment-25536296" class="issue-data-block activity-comment twixi-block  expanded ">
    <div class="twixi-wrap verbose actionContainer">
        <div class="action-head">
            <h3>
                <button class="twixi icon-default aui-icon aui-icon-small aui-iconfont-expanded">
                    Collapse comment:         
    
    
    
    
                            Yanina Onzari added a comment - 21/May/26 3:00 PM     
                </button>
            </h3>
            <div class="action-details">        
    
    
    
    
                            



    <a class="user-hover user-avatar" rel="yanina.onzari@vml.com" id="commentauthor_25536296_verbose" href="/secure/ViewProfile.jspa?name=yanina.onzari%40vml.com"><span class="aui-avatar aui-avatar-xsmall"><span class="aui-avatar-inner"><img src="https://jira.uhub.biz/secure/useravatar?size=xsmall&amp;ownerId=uhub.bot%40uhub.biz&amp;avatarId=103766" loading="lazy"></span></span> Yanina Onzari</a>
 added a comment  - <a href="/browse/GTBNAPX-255784?focusedId=25536296&amp;page=com.atlassian.jira.plugin.system.issuetabpanels:comment-tabpanel#comment-25536296" class="commentdate_25536296_verbose subText comment-created-date-link"><span class="date user-tz" title="21/May/26 3:00 PM"><span class="explicit explicit-time">21/May/26 3:00 PM</span><time class="livestamp" datetime="2026-05-21T15:00:21+0000" style="display: none;">21/May/26 3:00 PM</time><span class="relative">, </span><span class="relative">12 days ago</span></span></a>       </div>
        </div>
        <div class="action-body flooded"><p>Hi Team,</p>

<p>The issue has been fixed.</p>

<p><b>Verification Link:</b></p>

<p><a href="https://author-p154363-e1620826.adobeaemcloud.com/content/na/ford/en_us/suvs/expedition/2027.html?wcmmode=disabled" class="external-link" target="_blank" rel="nofollow noopener">https://author-p154363-e1620826.adobeaemcloud.com/content/na/ford/en_us/suvs/expedition/2027.html?wcmmode=disabled</a></p>

<p><b>Content Fragment:</b></p>

<p><a href="https://author-p154363-e1620826.adobeaemcloud.com/assets.html/content/dam/na/cf/ford/en_us/nameplate/expedition/2027/features" class="external-link" target="_blank" rel="nofollow noopener">https://author-p154363-e1620826.adobeaemcloud.com/assets.html/content/dam/na/cf/ford/en_us/nameplate/expedition/2027/features</a></p>

<p>&gt;&gt;Drivers Package</p>

<p><a href="https://author-p154363-e1620826.adobeaemcloud.com/ui#/aem/assets.html/content/dam/na/cf/ford/en_us/common/disclosures/inline-disclosures" class="external-link" target="_blank" rel="nofollow noopener">https://author-p154363-e1620826.adobeaemcloud.com/ui#/aem/assets.html/content/dam/na/cf/ford/en_us/common/disclosures/inline-disclosures</a></p>

<p>&gt;&gt;standard-30th-anniversary-2027-expedition</p>

<p><b>Evidence:</b></p>

<p><span class="image-wrap" style=""><img src="/secure/attachment/12370634/12370634_Evidence99.png" height="124" width="216" style="border: 0px solid black"></span></p>

<p>Regards!</p> </div>
    </div>
</div>
                                     



<div id="comment-25528296" class="issue-data-block activity-comment twixi-block  expanded ">
    <div class="twixi-wrap verbose actionContainer">
        <div class="action-head">
            <h3>
                <button class="twixi icon-default aui-icon aui-icon-small aui-iconfont-expanded">
                    Collapse comment:         
    
    
    
    
                            Solana Tarantola added a comment - 20/May/26 8:29 PM     
                </button>
            </h3>
            <div class="action-details">        
    
    
    
    
                            



    <a class="user-hover user-avatar" rel="solana.tarantola@vml.com" id="commentauthor_25528296_verbose" href="/secure/ViewProfile.jspa?name=solana.tarantola%40vml.com"><span class="aui-avatar aui-avatar-xsmall"><span class="aui-avatar-inner"><img src="https://jira.uhub.biz/secure/useravatar?size=xsmall&amp;avatarId=14120" loading="lazy"></span></span> Solana Tarantola</a>
 added a comment  - <a href="/browse/GTBNAPX-255784?focusedId=25528296&amp;page=com.atlassian.jira.plugin.system.issuetabpanels:comment-tabpanel#comment-25528296" class="commentdate_25528296_verbose subText comment-created-date-link"><span class="date user-tz" title="20/May/26 8:29 PM"><span class="explicit explicit-time">20/May/26 8:29 PM</span><time class="livestamp" datetime="2026-05-20T20:29:06+0000" style="display: none;">20/May/26 8:29 PM</time><span class="relative">, </span><span class="relative">13 days ago</span></span></a>       </div>
        </div>
        <div class="action-body flooded"><p>Fail in Prod Author/ Fail in Prod Preview</p>

<p><a href="https://author-p154363-e1620826.adobeaemcloud.com/content/na/ford/en_us/suvs/expedition/2027/.html?wcmmode=disabled" class="external-link" target="_blank" rel="nofollow noopener">https://author-p154363-e1620826.adobeaemcloud.com/content/na/ford/en_us/suvs/expedition/2027/.html?wcmmode=disabled</a>&nbsp;</p>

<p><a href="https://wwwac.preview.brandus.ford.com/suvs/expedition/2027/360/" class="external-link" target="_blank" rel="nofollow noopener">https://wwwac.preview.brandus.ford.com/suvs/expedition/2027/360/</a></p>

<p>Device(s): Desktop<br>
OS(s): Windows 10<br>
Browser(s): Google Chrome v112</p>

<p><b>Slide 5</b></p>

<p>The copy should be:&nbsp;</p>

<p>Available on the 2027 Expedition Platinum and Tremor® models* and standard on the Expedition King Ranch® model:&nbsp;</p>

<p>The Copy is:&nbsp;</p>

<p>Available on the 2027 Expedition Platinum model<sup>*</sup>&nbsp;and standard on the Expedition King Ranch® model:</p>

<p>The Disclaimer should be:&nbsp;</p>

<p>†Standard on 30th Anniversary Appearance Package, so it's not included in Driver's Package for that combination. Not included in Driver's Package for Expedition® Tremor, as it is already standard.</p>

<p>The Disclaimer is:&nbsp;</p>

<p>†Standard on 30th Anniversary Appearance Package, so it's not included in Driver's Package for that combination.</p>

<p>Evidence:</p>

<p><span class="nobr"><a href="/secure/attachment/12365897/12365897_2026-05-20_GTBNAPX-255784+PPC+FAILS.mp4" title="2026-05-20_GTBNAPX-255784 PPC FAILS.mp4 attached to GTBNAPX-255784" target="_blank" rel="noopener">2026-05-20_GTBNAPX-255784 PPC FAILS.mp4<sup><img class="rendericon" src="/images/icons/link_attachment_7.gif" height="7" width="7" align="absmiddle" alt="" border="0"></sup></a></span></p>

<p><span class="nobr"><a href="/secure/attachment/12365898/12365898_2026-05-20_GTBNAPX-255784+BSR+fails.mp4" title="2026-05-20_GTBNAPX-255784 BSR fails.mp4 attached to GTBNAPX-255784" target="_blank" rel="noopener">2026-05-20_GTBNAPX-255784 BSR fails.mp4<sup><img class="rendericon" src="/images/icons/link_attachment_7.gif" height="7" width="7" align="absmiddle" alt="" border="0"></sup></a></span></p>

<p>&nbsp;</p>

<p>---------------------------------------------------------------------------------------------</p>

<p>The rest was Verified in Prod Preview:</p>

<p><a href="https://wwwac.preview.brandus.ford.com/suvs/expedition/2027/360/" class="external-link" target="_blank" rel="nofollow noopener">https://wwwac.preview.brandus.ford.com/suvs/expedition/2027/360/</a>&nbsp;</p>

<p>Device(s): Desktop<br>
OS(s): Windows 10<br>
Browser(s): Google Chrome v112</p>

<p>Evidence:</p>

<p><span class="nobr"><a href="/secure/attachment/12365906/12365906_2026-05-20_GTBNAPX-255784.mp4" title="2026-05-20_GTBNAPX-255784.mp4 attached to GTBNAPX-255784" target="_blank" rel="noopener">2026-05-20_GTBNAPX-255784.mp4<sup><img class="rendericon" src="/images/icons/link_attachment_7.gif" height="7" width="7" align="absmiddle" alt="" border="0"></sup></a></span></p> </div>
    </div>
</div>
                                     



<div id="comment-25528045" class="issue-data-block activity-comment twixi-block  expanded ">
    <div class="twixi-wrap verbose actionContainer">
        <div class="action-head">
            <h3>
                <button class="twixi icon-default aui-icon aui-icon-small aui-iconfont-expanded">
                    Collapse comment:         
    
    
    
    
                            Solana Tarantola added a comment - 20/May/26 7:58 PM     
                </button>
            </h3>
            <div class="action-details">        
    
    
    
    
                            



    <a class="user-hover user-avatar" rel="solana.tarantola@vml.com" id="commentauthor_25528045_verbose" href="/secure/ViewProfile.jspa?name=solana.tarantola%40vml.com"><span class="aui-avatar aui-avatar-xsmall"><span class="aui-avatar-inner"><img src="https://jira.uhub.biz/secure/useravatar?size=xsmall&amp;avatarId=14120" loading="lazy"></span></span> Solana Tarantola</a>
 added a comment  - <a href="/browse/GTBNAPX-255784?focusedId=25528045&amp;page=com.atlassian.jira.plugin.system.issuetabpanels:comment-tabpanel#comment-25528045" class="commentdate_25528045_verbose subText comment-created-date-link"><span class="date user-tz" title="20/May/26 7:58 PM"><span class="explicit explicit-time">20/May/26 7:58 PM</span><time class="livestamp" datetime="2026-05-20T19:58:56+0000" style="display: none;">20/May/26 7:58 PM</time><span class="relative">, </span><span class="relative">13 days ago</span></span></a>       </div>
        </div>
        <div class="action-body flooded"><p><img class="emoticon" src="/images/icons/emoticons/check.png" height="16" width="16" align="absmiddle" alt="" border="0"> Test Case Update Complete: Requested updates were successfully implemented in the Test Cases. Moving forward with testing phase. Thanks!</p> </div>
    </div>
</div>
                                     



<div id="comment-25527314" class="issue-data-block activity-comment twixi-block  expanded ">
    <div class="twixi-wrap verbose actionContainer">
        <div class="action-head">
            <h3>
                <button class="twixi icon-default aui-icon aui-icon-small aui-iconfont-expanded">
                    Collapse comment:         
    
    
    
    
                            Sol Cardin added a comment - 20/May/26 6:54 PM     
                </button>
            </h3>
            <div class="action-details">        
    
    
    
    
                            



    <a class="user-hover user-avatar" rel="sol.cardin@vml.com" id="commentauthor_25527314_verbose" href="/secure/ViewProfile.jspa?name=sol.cardin%40vml.com"><span class="aui-avatar aui-avatar-xsmall"><span class="aui-avatar-inner"><img src="https://jira.uhub.biz/secure/useravatar?size=xsmall&amp;ownerId=sol.cardin%40wunderman.com&amp;avatarId=32924" loading="lazy"></span></span> Sol Cardin</a>
 added a comment  - <a href="/browse/GTBNAPX-255784?focusedId=25527314&amp;page=com.atlassian.jira.plugin.system.issuetabpanels:comment-tabpanel#comment-25527314" class="commentdate_25527314_verbose subText comment-created-date-link"><span class="date user-tz" title="20/May/26 6:54 PM"><span class="explicit explicit-time">20/May/26 6:54 PM</span><time class="livestamp" datetime="2026-05-20T18:54:51+0000" style="display: none;">20/May/26 6:54 PM</time><span class="relative">, </span><span class="relative">13 days ago</span></span></a>       </div>
        </div>
        <div class="action-body flooded"><p>Hi, Team! This has been published to Preview. Please check changes: <span class="nobr"><a href="/secure/attachment/12343003/12343003_27MY+Expedition_Internal+QA_Modals+Packages%2C+Exterior%2C+Performance%2C+Gallery++.pptx" title="27MY Expedition_Internal QA_Modals Packages, Exterior, Performance, Gallery  .pptx attached to GTBNAPX-255784" target="_blank" rel="noopener">27MY Expedition_Internal QA_Modals Packages, Exterior, Performance, Gallery  .pptx<sup><img class="rendericon" src="/images/icons/link_attachment_7.gif" height="7" width="7" align="absmiddle" alt="" border="0"></sup></a></span></p>

<p>See Content's comments.&nbsp;</p>

<p>Thanks!</p> </div>
    </div>
</div>
                                     



<div id="comment-25523947" class="issue-data-block activity-comment twixi-block  expanded ">
    <div class="twixi-wrap verbose actionContainer">
        <div class="action-head">
            <h3>
                <button class="twixi icon-default aui-icon aui-icon-small aui-iconfont-expanded">
                    Collapse comment:         
    
    
    
    
                            Yanina Onzari added a comment - 20/May/26 2:33 PM     
                </button>
            </h3>
            <div class="action-details">        
    
    
    
    
                            



    <a class="user-hover user-avatar" rel="yanina.onzari@vml.com" id="commentauthor_25523947_verbose" href="/secure/ViewProfile.jspa?name=yanina.onzari%40vml.com"><span class="aui-avatar aui-avatar-xsmall"><span class="aui-avatar-inner"><img src="https://jira.uhub.biz/secure/useravatar?size=xsmall&amp;ownerId=uhub.bot%40uhub.biz&amp;avatarId=103766" loading="lazy"></span></span> Yanina Onzari</a>
 added a comment  - <a href="/browse/GTBNAPX-255784?focusedId=25523947&amp;page=com.atlassian.jira.plugin.system.issuetabpanels:comment-tabpanel#comment-25523947" class="commentdate_25523947_verbose subText comment-created-date-link"><span class="date user-tz" title="20/May/26 2:33 PM"><span class="explicit explicit-time">20/May/26 2:33 PM</span><time class="livestamp" datetime="2026-05-20T14:33:07+0000" style="display: none;">20/May/26 2:33 PM</time><span class="relative">, </span><span class="relative">13 days ago</span></span></a>       </div>
        </div>
        <div class="action-body flooded"><p>Hi Team!</p>

<p>These updates have been authored. Please see the PM’s comments below regarding the resolution for the Exterior Modal.</p>

<p>Please also note that the request related to the top-left headline cannot be applied, as we do not have the ability to style it. We only have access to the headline and eyebrow fields. I’ve attached evidence98 as a reference.</p>

<p>CC. <a href="https://jira.uhub.biz/secure/ViewProfile.jspa?name=alison.zora%40vml.com" class="user-hover" rel="alison.zora@vml.com">Alison Zora</a>&nbsp;</p>

<p>___________</p>

<p><b>Verification Link:</b></p>

<p><a href="https://author-p154363-e1620826.adobeaemcloud.com/content/na/ford/en_us/suvs/expedition/2027.html?wcmmode=disabled" class="external-link" target="_blank" rel="nofollow noopener">https://author-p154363-e1620826.adobeaemcloud.com/content/na/ford/en_us/suvs/expedition/2027.html?wcmmode=disabled</a></p>

<p><b>Assets:</b></p>

<p><a href="https://author-p154363-e1620826.adobeaemcloud.com/ui#/aem/assets.html/content/dam/na/ford/en_us/images/expedition/2027/dm" class="external-link" target="_blank" rel="nofollow noopener">https://author-p154363-e1620826.adobeaemcloud.com/ui#/aem/assets.html/content/dam/na/ford/en_us/images/expedition/2027/dm</a></p>

<p>&gt;&gt;27_17A4537_1g_V3_v2.tif<br>
&gt;&gt;27_FRD_EPD_A001C0024_PULT_NOCB_v2.tif<br>
&gt;&gt;27_FRD_EPD_64H_A01_v2.tif<br>
&gt;&gt;27_FRD_EPD_PLT_STEL_PRF_PKG_S5A4184_v2.tif<br>
&gt;&gt;27_FRD_EPD_PULT_NOCB_64309_v2.tif<br>
&gt;&gt;27_FRD_EPD_PLT_STEL_PRF_PKG_S5A4184_v2.tif</p>

<p><b>Content Fragment:</b></p>

<p><a href="https://author-p154363-e1620826.adobeaemcloud.com/assets.html/content/dam/na/cf/ford/en_us/nameplate/expedition/exterior" class="external-link" target="_blank" rel="nofollow noopener">https://author-p154363-e1620826.adobeaemcloud.com/assets.html/content/dam/na/cf/ford/en_us/nameplate/expedition/exterior</a></p>

<p>&gt;&gt;360-Degree Zone Lighting<br>
&gt;&gt;18 x 85 Dark Alloy Painted Aluminum Wheels</p>

<p><a href="https://author-p154363-e1620826.adobeaemcloud.com/assets.html/content/dam/na/cf/ford/en_us/nameplate/expedition/performance" class="external-link" target="_blank" rel="nofollow noopener">https://author-p154363-e1620826.adobeaemcloud.com/assets.html/content/dam/na/cf/ford/en_us/nameplate/expedition/performance</a></p>

<p>&gt;&gt;Stealth Performance Package<br>
&gt;&gt;latinum Ultimate Package</p>

<p><a href="https://author-p154363-e1620826.adobeaemcloud.com/assets.html/content/dam/na/cf/ford/en_us/nameplate/expedition/2027/features" class="external-link" target="_blank" rel="nofollow noopener">https://author-p154363-e1620826.adobeaemcloud.com/assets.html/content/dam/na/cf/ford/en_us/nameplate/expedition/2027/features</a></p>

<p>&gt;&gt;Make a Bold Statement<br>
&gt;&gt;Packages image only<br>
&gt;&gt;Drivers Package</p>

<p><a href="https://author-p154363-e1620826.adobeaemcloud.com/assets.html/content/dam/na/cf/ford/en_us/nameplate/expedition/2027/gallery" class="external-link" target="_blank" rel="nofollow noopener">https://author-p154363-e1620826.adobeaemcloud.com/assets.html/content/dam/na/cf/ford/en_us/nameplate/expedition/2027/gallery</a></p>

<p>&gt;&gt;Gallery Modal - Image 9</p>

<p><a href="https://author-p154363-e1620826.adobeaemcloud.com/ui#/aem/assets.html/content/dam/na/cf/ford/en_us/common/disclosures/inline-disclosures" class="external-link" target="_blank" rel="nofollow noopener">https://author-p154363-e1620826.adobeaemcloud.com/ui#/aem/assets.html/content/dam/na/cf/ford/en_us/common/disclosures/inline-disclosures</a></p>

<p>&gt;&gt;Available-on-2027-expedition-platinum<br>
&gt;&gt;Included-with-the-platinum-ultimate-package-expedition-2027<br>
&gt;&gt;standard-30th-anniversary-2027-expedition</p>

<p><b>Experience Fragment:</b></p>

<p><a href="https://author-p154363-e1620826.adobeaemcloud.com/ui#/aem/aem/experience-fragments.html/content/experience-fragments/na/ford/en_us/nameplate/expedition/2027/exterior-modal" class="external-link" target="_blank" rel="nofollow noopener">https://author-p154363-e1620826.adobeaemcloud.com/ui#/aem/aem/experience-fragments.html/content/experience-fragments/na/ford/en_us/nameplate/expedition/2027/exterior-modal</a></p>

<p>&gt;&gt;Exterior Modal<br>
&gt;&gt;Performance Modal<br>
&gt;&gt;Technology Modal</p>

<p><b>Pages:</b></p>

<p><a href="https://author-p154363-e1620826.adobeaemcloud.com/ui#/aem/sites.html/content/na/ford/en_us/suvs/expedition" class="external-link" target="_blank" rel="nofollow noopener">https://author-p154363-e1620826.adobeaemcloud.com/ui#/aem/sites.html/content/na/ford/en_us/suvs/expedition</a></p>

<p>&gt;&gt;2027</p>

<p><b>Evidence:</b></p>

<p><span class="nobr"><a href="/secure/attachment/12363091/12363091_Evidence-GTBNAPX-255784.zip" title="Evidence-GTBNAPX-255784.zip attached to GTBNAPX-255784" target="_blank" rel="noopener">Evidence-GTBNAPX-255784.zip<sup><img class="rendericon" src="/images/icons/link_attachment_7.gif" height="7" width="7" align="absmiddle" alt="" border="0"></sup></a></span></p>

<p><span class="image-wrap" style=""><img src="/secure/attachment/12363092/12363092_Evidence98.png" height="155" width="227" style="border: 0px solid black"></span></p>

<p>Regards!</p> </div>
    </div>
</div>
        </div>
</div>
`;

const result = extractAEMData(mockJiraHtml);
console.log(JSON.stringify(result, null, 2));
