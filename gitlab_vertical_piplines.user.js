// ==UserScript==
// @name        Gitlab Vertical Pipelines
// @match       *://gitlab.*/*/-/pipelines/*
// @match       *://gitlab.*.*/*/-/pipelines/*
// @grant       GM_addStyle
// @version     1.5
// @author      skinner927
// @description Show pipelines as a vertical list instead of having to scroll horizontally.
// @namespace   https://github.com/Skinner927/greasemonkey-scripts
// @homepageURL https://github.com/Skinner927/greasemonkey-scripts/blob/master/gitlab_vertical_piplines.user.js
// @downloadURL https://github.com/Skinner927/greasemonkey-scripts/raw/master/gitlab_vertical_piplines.user.js
// @updateURL   https://github.com/Skinner927/greasemonkey-scripts/raw/master/gitlab_vertical_piplines.user.js

// ==/UserScript==

/** Changelog
 * v1.5
 *   Fixes for v17.6.4-ee
 * v1.4:
 *   Use fixed width for buttons & remove flex. Using 33% was making super
 *   narrow buttons on small pipelines.
 * v1.3:
 *   Updated for GitLab 16.7.3
 *   Update URLs to use new 'gm.pages.generic'
 * v1.2:
 *   Update URL to pages URL
 * v1.1:
 *   Update match url for any protocol.
 * v1.0:
 *   Initial release.
 */

(function() {
  GM_addStyle(`
    /* outer container */
    .js-pipeline-graph div[pipeline-id][view-type='stage'] > div.gl-flex {
      flex-direction: column;
    }
    /* container that holds the job buttons */
    .js-pipeline-graph div[pipeline-id][view-type='stage'] > div.gl-flex > div.stage-column > .gl-flex.gl-flex-direction-column {
      flex-direction: row;
      flex-wrap: wrap;
    }

    /* every job button */
    .js-pipeline-graph div[pipeline-id][view-type='stage'] > div.gl-flex > div.stage-column > .gl-flex.gl-flex-direction-column > div {
      margin-right: 5px;
      width: 345px;
      flex-grow: 0;
      flex-shrink: 0;
      flex-basis: auto;
    }
    /* flex: grow shrink basis */
  `);
})();