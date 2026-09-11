// ==UserScript==
// @name        Gitlab MR Pipeline Controls
// @include     /^[^:]*?:\/\/gitlab\.[^\/]*?\/.*?\/-\/merge_requests.*?$/
// @grant       none
// @version     1.3
// @author      skinner927
// @description One click cancel and retry for merge request pipelines, and it repaints the status icon afterwards instead of leaving it stale.
// @namespace   https://github.com/Skinner927/greasemonkey-scripts
// @homepageURL https://github.com/Skinner927/greasemonkey-scripts/blob/master/gitlab_mr_pipeline_controls.user.js
// @downloadURL https://github.com/Skinner927/greasemonkey-scripts/raw/master/gitlab_mr_pipeline_controls.user.js
// @updateURL   https://github.com/Skinner927/greasemonkey-scripts/raw/master/gitlab_mr_pipeline_controls.user.js
// ==/UserScript==

/** Changelog
 * v1.3:
 *   Repaint the status icon after cancelling or retrying, instead of
 *   leaving it stale until the page is reloaded. Track the pipeline for up
 *   to 2 minutes, then park a "?" next to the icon if it is still moving.
 * v1.2:
 *   Watch the list with a MutationObserver instead of polling it every
 *   second. Chrome throttles timers in a background tab to about once a
 *   minute, so polling left the buttons missing after GitLab re-rendered.
 * v1.1:
 *   Add retry for failed and canceled pipelines.
 * v1.0:
 *   Initial release.
 */

/* Notes to future me:
 * - @include, not @match, because Violentmonkey rejects a "*" top level domain
 *   ("gitlab.*"). The one regex covers gitlab.com and self hosted alike, since
 *   [^/]*? happily eats the dots in gitlab.example.com.
 * - @grant MUST stay none. We need the page's own same-origin fetch so the
 *   session cookie rides along; a granted script gets sandboxed and the
 *   request stops being same-origin. That's also why the style is injected
 *   by hand instead of using GM_addStyle.
 * - Both actions go through the same GraphQL mutations the GitLab UI itself
 *   uses, so they die with the UI rather than with some deprecated REST route.
 * - Don't go back to setInterval for watching the DOM. See queueScan. The
 *   timers in trackPipeline are a different thing: polling something remote
 *   on a cadence is what timers are for, and its deadline is wall clock.
 */

/* global module:writable */
// Hand rolled to work with node require and run in the browser
(function (factory) {
  function isObj(val) {
    return val === "object";
  }

  if (
    isObj(typeof exports) &&
    isObj(typeof module) &&
    isObj(typeof module.exports)
  ) {
    module.exports = exports = function factoryWrapper(theWindow, theDocument) {
      theWindow = isObj(typeof theWindow)
        ? theWindow
        : isObj(typeof window)
        ? window
        : isObj(typeof globalThis)
        ? globalThis
        : { document: {} };

      return factory(theWindow, theDocument || theWindow.document || {}, true);
    };
  } else {
    // Hopefully in a browser
    factory(window, document, false);
  }
})(function factory(window, document, returnExports) {
  "use strict";

  var ID = "gm_gitlab_mr_pipeline_controls";
  var BTN_CLASS = ID + "_btn";
  var MARK_CLASS = ID + "_stale";

  // How often, and for how long, we chase a pipeline we just acted on.
  var TRACK_INTERVAL = 3000;
  var TRACK_LIMIT_MS = 2 * 60 * 1000;
  // Pipeline ids currently being chased, so a second click cannot double up.
  var TRACKING = {};

  var XLINK_NS = "http://www.w3.org/1999/xlink";

  var STATUS_QUERY =
    "query($project: ID!, $id: CiPipelineID!) {" +
    "  project(fullPath: $project) {" +
    "    pipeline(id: $id) { detailedStatus { icon text group } }" +
    "  }" +
    "}";

  // Server rendered, so it is already there when we start, and it survives
  // GitLab's client side navigation within a project.
  var ROOT_SELECTOR = "#content-body";
  // Rows on the merge request list page.
  var ROW_SELECTOR = 'li[data-testid="issuable-container"]';
  // The pipeline status icon inside a row. Its href carries the pipeline id.
  var CI_ICON_SELECTOR = 'a[data-testid="ci-icon"]';
  // The svg inside the status icon, e.g. status_running_borderless-icon.
  var STATUS_ICON_SELECTOR = '[data-testid$="-icon"]';

  // What we offer for a pipeline, keyed by the status it applies to. A
  // pipeline is never both, so a row only ever gets one button.
  var ACTIONS = {
    cancel: {
      statuses: [
        "running",
        "pending",
        "created",
        "preparing",
        "waiting_for_resource",
        "scheduled",
      ],
      field: "pipelineCancel",
      glyph: "✕", // multiplication x
      verb: "Cancel",
      gerund: "Canceling",
      past: "Canceled",
    },
    retry: {
      // Retries the failed and canceled jobs inside the same pipeline, which
      // is what GitLab's own Retry button does. It does not start a new one.
      statuses: ["failed", "canceled"],
      field: "pipelineRetry",
      glyph: "↻", // clockwise open circle arrow
      verb: "Retry",
      gerund: "Retrying",
      past: "Retried",
    },
  };

  // The icon title says "Passed", the API calls it "success".
  var TITLE_ALIASES = {
    passed: "success",
  };

  // Every status GitLab can report. A title only beats the test id when it
  // lands in here, so a GitLab running in another language quietly falls
  // back to the test id instead of inventing a status.
  var KNOWN_STATUSES = [
    "created",
    "waiting_for_resource",
    "preparing",
    "pending",
    "running",
    "success",
    "failed",
    "canceling",
    "canceled",
    "skipped",
    "manual",
    "scheduled",
  ];

  /**
   * Pull the project path and pipeline id out of a pipeline link.
   * @param {string} href e.g. /group/proj/-/pipelines/123
   * @returns {?{projectPath: string, pipelineId: string}}
   */
  function parsePipelineHref(href) {
    if (typeof href !== "string" || !href) {
      return null;
    }
    var match = href.match(
      /^(?:https?:\/\/[^/]+)?\/(.+?)\/-\/pipelines\/(\d+)(?:[?#]|$)/
    );
    if (!match) {
      return null;
    }
    return { projectPath: match[1], pipelineId: match[2] };
  }

  /**
   * Work out the pipeline status from the link title, falling back to the
   * status icon's test id.
   *
   * The title leads because GitLab draws a canceling pipeline with the very
   * same status_canceled icon as a canceled one, and those two want opposite
   * treatment: a canceling pipeline is mid-cancel and must be left alone.
   * The test id is the safety net, since it survives translation.
   *
   * @param {?string} iconTestId e.g. status_running_borderless-icon
   * @param {?string} title e.g. "Status: Running"
   * @returns {?string} snake_case status, or null if neither is usable
   */
  function normalizeStatus(iconTestId, title) {
    if (typeof title === "string") {
      var raw = title.replace(/^\s*status:\s*/i, "").trim().toLowerCase();
      var fromTitle = TITLE_ALIASES[raw] || raw.replace(/\s+/g, "_");
      if (KNOWN_STATUSES.indexOf(fromTitle) !== -1) {
        return fromTitle;
      }
    }
    if (typeof iconTestId === "string") {
      var match = iconTestId.match(/^status_(.+?)(?:_borderless)?-icon$/);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  /**
   * Decide what, if anything, we can offer for a pipeline in this state.
   * @param {?string} status
   * @returns {?string} "cancel", "retry", or null to show no button
   */
  function actionForStatus(status) {
    var kinds = Object.keys(ACTIONS);
    for (var i = 0; i < kinds.length; i++) {
      if (ACTIONS[kinds[i]].statuses.indexOf(status) !== -1) {
        return kinds[i];
      }
    }
    return null;
  }

  /**
   * @param {string} kind "cancel" or "retry"
   * @returns {?string} the GraphQL mutation, or null for an unknown kind
   */
  function buildMutation(kind) {
    var action = ACTIONS[kind];
    if (!action) {
      return null;
    }
    return (
      "mutation($id: CiPipelineID!) {" +
      "  " +
      action.field +
      "(input: {id: $id}) { errors }" +
      "}"
    );
  }

  /**
   * @param {string} pipelineId
   * @returns {string} the GraphQL global id for a pipeline
   */
  function pipelineGid(pipelineId) {
    return "gid://gitlab/Ci::Pipeline/" + pipelineId;
  }

  /**
   * detailedStatus.icon names the sprite GitLab draws, minus the suffix the
   * borderless list variant uses.
   * @param {?string} detailedIcon e.g. status_running
   * @returns {?string} e.g. status_running_borderless
   */
  function iconFragment(detailedIcon) {
    if (typeof detailedIcon !== "string" || !detailedIcon) {
      return null;
    }
    return detailedIcon + "_borderless";
  }

  /**
   * @param {?string} detailedIcon e.g. status_running
   * @returns {?string} e.g. status_running_borderless-icon
   */
  function iconTestId(detailedIcon) {
    var fragment = iconFragment(detailedIcon);
    return fragment ? fragment + "-icon" : null;
  }

  /**
   * @param {?string} text detailedStatus.text, e.g. "Running"
   * @returns {?string} the title GitLab would write, e.g. "Status: Running"
   */
  function statusTitle(text) {
    if (typeof text !== "string" || !text) {
      return null;
    }
    return "Status: " + text;
  }

  // How detailedStatus.group colours the icon. success/running/failed and
  // canceled were read off the live page; the rest follow GitLab's palette.
  // Getting one wrong only picks the wrong colour, and GitLab paints over us
  // on its next render, so anything unknown just stays grey.
  var GROUP_VARIANTS = {
    success: "success",
    "success-with-warnings": "warning",
    running: "info",
    pending: "warning",
    failed: "danger",
  };

  /**
   * @param {?string} group detailedStatus.group
   * @returns {string} the ci-icon-variant-* suffix
   */
  function variantForGroup(group) {
    if (typeof group !== "string") {
      return "neutral";
    }
    return GROUP_VARIANTS[group] || "neutral";
  }

  // Nothing more will happen to a pipeline in one of these, so stop looking.
  var SETTLED_STATUSES = [
    "success",
    "success_with_warnings",
    "failed",
    "canceled",
    "skipped",
    "manual",
  ];

  /**
   * @param {?string} status a status or group, in any case, either spelling
   * @returns {boolean} true once the pipeline has finished moving
   */
  function isSettledStatus(status) {
    if (typeof status !== "string" || !status) {
      return false;
    }
    var key = status.toLowerCase().replace(/-/g, "_");
    return SETTLED_STATUSES.indexOf(key) !== -1;
  }

  /**
   * The "?" says nobody has confirmed this status since we stopped tracking.
   * A different status on the icon means somebody has.
   * @param {?string} markedStatus what the icon read when we gave up
   * @param {?string} currentStatus what it reads now
   * @returns {boolean} true to drop the mark
   */
  function shouldClearStaleMark(markedStatus, currentStatus) {
    if (typeof markedStatus !== "string" || typeof currentStatus !== "string") {
      return false;
    }
    return markedStatus !== currentStatus;
  }

  // Everything below here needs a browser.
  if (returnExports) {
    return {
      parsePipelineHref: parsePipelineHref,
      normalizeStatus: normalizeStatus,
      actionForStatus: actionForStatus,
      buildMutation: buildMutation,
      pipelineGid: pipelineGid,
      iconFragment: iconFragment,
      iconTestId: iconTestId,
      statusTitle: statusTitle,
      variantForGroup: variantForGroup,
      isSettledStatus: isSettledStatus,
      shouldClearStaleMark: shouldClearStaleMark,
    };
  }

  function addStyle() {
    var style = document.createElement("style");
    style.id = ID + "_style";
    style.textContent = [
      "." + BTN_CLASS + " {",
      "  display: inline-flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "  width: 1.25rem;",
      "  height: 1.25rem;",
      "  margin-left: 0.25rem;",
      "  padding: 0;",
      "  border: 0;",
      "  border-radius: 0.25rem;",
      "  background: transparent;",
      "  font-size: 0.75rem;",
      "  line-height: 1;",
      "  cursor: pointer;",
      "}",
      "." + BTN_CLASS + '[data-gm-kind="cancel"] {',
      "  color: var(--red-500, #dd2b0e);",
      "}",
      "." + BTN_CLASS + '[data-gm-kind="cancel"]:hover:not(:disabled) {',
      "  background: var(--red-100, #fdd4cd);",
      "}",
      "." + BTN_CLASS + '[data-gm-kind="retry"] {',
      "  color: var(--blue-500, #1f75cb);",
      "  font-size: 0.875rem;",
      "}",
      "." + BTN_CLASS + '[data-gm-kind="retry"]:hover:not(:disabled) {',
      "  background: var(--blue-100, #cbe2f9);",
      "}",
      "." + BTN_CLASS + ":disabled {",
      "  color: var(--gray-500, #868686);",
      "  cursor: default;",
      "}",
      "." + BTN_CLASS + '[data-gm-state="failed"] {',
      "  color: var(--red-700, #ae1800);",
      "}",
      "." + MARK_CLASS + " {",
      "  margin-left: 0.25rem;",
      "  color: var(--gray-500, #868686);",
      "  font-size: 0.75rem;",
      "  font-weight: 600;",
      "  cursor: help;",
      "}",
    ].join("\n");
    document.head.appendChild(style);
  }

  /**
   * @param {string} query
   * @param {Object} variables
   * @returns {Promise<Object>} the data block, rejecting on any error
   */
  function graphql(query, variables) {
    var meta = document.querySelector('meta[name="csrf-token"]');
    if (!meta || !meta.content) {
      return Promise.reject(new Error("No CSRF token on the page"));
    }

    return window
      .fetch("/api/graphql", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": meta.content,
        },
        body: JSON.stringify({ query: query, variables: variables }),
      })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }
        return response.json();
      })
      .then(function (body) {
        var errors = (body && body.errors) || [];
        if (errors.length) {
          throw new Error(
            errors
              .map(function (e) {
                return e.message || e;
              })
              .join("; ")
          );
        }
        return (body && body.data) || {};
      });
  }

  /**
   * Act on the whole pipeline using the same mutations the GitLab UI uses.
   * @param {string} kind "cancel" or "retry"
   * @param {string} pipelineId
   * @returns {Promise<void>} rejects with a human readable reason
   */
  function runAction(kind, pipelineId) {
    var action = ACTIONS[kind];
    var query = buildMutation(kind);
    if (!action || !query) {
      return Promise.reject(new Error("Unknown action " + kind));
    }

    return graphql(query, { id: pipelineGid(pipelineId) }).then(function (
      data
    ) {
      // Schema and permission problems already threw. The mutation's own
      // complaints come back in the payload.
      var errors = (data[action.field] && data[action.field].errors) || [];
      if (errors.length) {
        throw new Error(errors.join("; "));
      }
    });
  }

  /**
   * @param {string} projectPath
   * @param {string} pipelineId
   * @returns {Promise<?{icon: string, text: string, group: string}>}
   */
  function fetchDetailedStatus(projectPath, pipelineId) {
    return graphql(STATUS_QUERY, {
      project: projectPath,
      id: pipelineGid(pipelineId),
    }).then(function (data) {
      var pipeline = data.project && data.project.pipeline;
      return (pipeline && pipeline.detailedStatus) || null;
    });
  }

  /**
   * Rows get recycled, so never hold on to an element between ticks.
   * @param {string} pipelineId
   * @returns {?Element} the status icon link for that pipeline
   */
  function findIcon(pipelineId) {
    var $icons = document.querySelectorAll(CI_ICON_SELECTOR);
    for (var i = 0; i < $icons.length; i++) {
      var pipeline = parsePipelineHref($icons[i].getAttribute("href"));
      if (pipeline && pipeline.pipelineId === pipelineId) {
        return $icons[i];
      }
    }
    return null;
  }

  /**
   * Redraw a status icon the way GitLab would have. Writing the title and
   * the test id also feeds syncRow through the observer, so the button
   * swaps itself over with no extra wiring.
   * @returns {?string} the status the icon now reads, as syncRow will see it
   */
  function paintIcon($icon, detailed) {
    var title = statusTitle(detailed && detailed.text);
    var testId = iconTestId(detailed && detailed.icon);
    var fragment = iconFragment(detailed && detailed.icon);
    if (!title || !testId) {
      return null;
    }

    $icon.setAttribute("title", title);
    $icon.setAttribute("aria-label", title);

    var variantClass = "ci-icon-variant-" + variantForGroup(detailed.group);
    if (/ci-icon-variant-\S+/.test($icon.className)) {
      $icon.className = $icon.className.replace(
        /ci-icon-variant-\S+/,
        variantClass
      );
    } else {
      $icon.className += " " + variantClass;
    }

    var $statusIcon = $icon.querySelector(STATUS_ICON_SELECTOR);
    if ($statusIcon) {
      $statusIcon.setAttribute("data-testid", testId);
    }

    var $use = $icon.querySelector("use");
    if ($use) {
      var href =
        $use.getAttribute("href") || $use.getAttribute("xlink:href") || "";
      var swapped = href.replace(/#.*$/, "#" + fragment);
      $use.setAttribute("href", swapped);
      if ($use.hasAttribute("xlink:href")) {
        $use.setAttributeNS(XLINK_NS, "xlink:href", swapped);
      }
    }

    return normalizeStatus(testId, title);
  }

  /**
   * Park a "?" next to the icon to say we have stopped looking and nobody
   * else has confirmed this status since.
   */
  function markStale($icon, pipelineId, status) {
    var $parent = $icon.parentElement;
    if (!$parent || !status || $parent.querySelector("." + MARK_CLASS)) {
      return;
    }
    var $mark = document.createElement("span");
    $mark.className = MARK_CLASS;
    $mark.textContent = "?";
    $mark.dataset.gmPipelineId = pipelineId;
    $mark.dataset.gmMarkedStatus = status;
    $mark.title =
      "Status may be out of date: stopped tracking pipeline #" +
      pipelineId +
      " after " +
      Math.round(TRACK_LIMIT_MS / 60000) +
      " minutes, and GitLab has not refreshed it since.";
    $parent.insertBefore($mark, $icon.nextSibling);
  }

  /**
   * Keep one pipeline's icon honest after we acted on it, until it settles
   * or we run out of patience.
   *
   * Timers are right here, unlike for watching the DOM: we are polling
   * something remote on a fixed cadence. The deadline is wall clock, so a
   * backgrounded tab throttling these ticks cannot quietly stretch it.
   */
  function trackPipeline(projectPath, pipelineId) {
    if (TRACKING[pipelineId]) {
      return;
    }
    TRACKING[pipelineId] = true;
    var deadline = Date.now() + TRACK_LIMIT_MS;

    function stop() {
      delete TRACKING[pipelineId];
    }

    function tick() {
      if (!findIcon(pipelineId)) {
        // Filtered away, paginated past, or the list moved on.
        stop();
        return;
      }
      fetchDetailedStatus(projectPath, pipelineId).then(
        function (detailed) {
          var $icon = findIcon(pipelineId);
          if (!$icon || !detailed) {
            stop();
            return;
          }
          var painted = paintIcon($icon, detailed);
          if (isSettledStatus(detailed.group)) {
            stop();
            return;
          }
          if (Date.now() >= deadline) {
            markStale($icon, pipelineId, painted);
            stop();
            return;
          }
          window.setTimeout(tick, TRACK_INTERVAL);
        },
        function (err) {
          console.error(ID, "status check failed", pipelineId, err);
          stop();
        }
      );
    }

    tick();
  }

  function onClick(event) {
    var $btn = event.currentTarget;
    var pipelineId = $btn.dataset.gmPipelineId;
    var projectPath = $btn.dataset.gmProjectPath;
    var kind = $btn.dataset.gmKind;
    var action = ACTIONS[kind];
    if (!pipelineId || !action || $btn.disabled) {
      return;
    }

    // We are about to start looking again, so the "?" no longer applies.
    var $mark = $btn.parentElement.querySelector("." + MARK_CLASS);
    if ($mark) {
      $mark.remove();
    }

    // No confirmation on purpose, one click is the whole point.
    $btn.disabled = true;
    $btn.dataset.gmState = "busy";
    $btn.textContent = "…"; // ellipsis
    $btn.title = action.gerund + " pipeline #" + pipelineId + "…";

    runAction(kind, pipelineId).then(
      function () {
        $btn.dataset.gmState = "done";
        $btn.textContent = "✓"; // check mark
        $btn.title = action.past + " pipeline #" + pipelineId;
        // GitLab will not repaint the icon on its own, so we do.
        if (projectPath) {
          trackPipeline(projectPath, pipelineId);
        }
      },
      function (err) {
        // Leave it enabled so a transient failure can be tried again.
        $btn.disabled = false;
        $btn.dataset.gmState = "failed";
        $btn.textContent = action.glyph;
        $btn.title =
          "Failed to " +
          action.verb.toLowerCase() +
          " pipeline #" +
          pipelineId +
          ": " +
          (err && err.message ? err.message : err);
        console.error(ID, kind + " failed", pipelineId, err);
      }
    );
  }

  function makeButton(kind) {
    var $btn = document.createElement("button");
    $btn.type = "button";
    $btn.className = BTN_CLASS;
    $btn.dataset.gmKind = kind;
    $btn.textContent = ACTIONS[kind].glyph;
    $btn.addEventListener("click", onClick);
    return $btn;
  }

  /**
   * Add, update or remove the action button on a single merge request row.
   * Safe to call over and over on the same row.
   */
  function syncRow($row) {
    var $existing = $row.querySelector("." + BTN_CLASS);
    var $icon = $row.querySelector(CI_ICON_SELECTOR);
    var pipeline = $icon && parsePipelineHref($icon.getAttribute("href"));

    var status = null;
    if ($icon) {
      var $statusIcon = $icon.querySelector(STATUS_ICON_SELECTOR);
      status = normalizeStatus(
        $statusIcon && $statusIcon.getAttribute("data-testid"),
        $icon.getAttribute("title") || $icon.getAttribute("aria-label")
      );
    }

    // Somebody moved the icon on from what we stamped, so the "?" is spent.
    var $mark = $row.querySelector("." + MARK_CLASS);
    if (
      $mark &&
      (shouldClearStaleMark($mark.dataset.gmMarkedStatus, status) ||
        !pipeline ||
        $mark.dataset.gmPipelineId !== pipeline.pipelineId)
    ) {
      $mark.remove();
    }

    var kind = actionForStatus(status);

    if (!pipeline || !kind) {
      // Don't yank the button out from under an in-flight request.
      if ($existing && $existing.dataset.gmState !== "busy") {
        $existing.remove();
      }
      return;
    }

    if ($existing) {
      // The row may have been recycled for a different pipeline, and a
      // pipeline we just acted on flips from cancelable to retryable.
      if (
        $existing.dataset.gmPipelineId !== pipeline.pipelineId ||
        $existing.dataset.gmKind !== kind
      ) {
        if ($existing.dataset.gmState === "busy") {
          return;
        }
        $existing.remove();
      } else {
        return;
      }
    }

    var $btn = makeButton(kind);
    $btn.dataset.gmPipelineId = pipeline.pipelineId;
    $btn.dataset.gmProjectPath = pipeline.projectPath;
    $btn.title = ACTIONS[kind].verb + " pipeline #" + pipeline.pipelineId;
    $icon.parentElement.insertBefore($btn, $icon.nextSibling);
  }

  function scan() {
    var $rows = document.querySelectorAll(ROW_SELECTOR);
    for (var i = 0; i < $rows.length; i++) {
      try {
        syncRow($rows[i]);
      } catch (e) {
        console.error(ID, "row failed", e);
      }
    }
  }

  var scanQueued = false;

  /**
   * Coalesce a burst of mutations into one scan.
   *
   * A microtask rather than a timer on purpose: Chrome throttles timers in a
   * background tab down to roughly once a minute, which left the buttons
   * missing for minutes at a time when this script polled. MutationObserver
   * and microtasks are not throttled.
   */
  function queueScan() {
    if (scanQueued) {
      return;
    }
    scanQueued = true;
    Promise.resolve().then(function () {
      scanQueued = false;
      scan();
    });
  }

  function main() {
    addStyle();

    // The list is a Vue app: it re-renders on sort, filter, pagination and
    // its own background polling, all without a page load.
    var $root = document.querySelector(ROOT_SELECTOR) || document.body;
    new window.MutationObserver(queueScan).observe($root, {
      childList: true,
      subtree: true,
      // Status lives in these. class is deliberately left out; GitLab churns
      // it constantly for hover and focus styling.
      attributes: true,
      attributeFilter: ["data-testid", "title", "href"],
    });

    // Our own inserts trip the observer, which queues one more scan. syncRow
    // is idempotent, so that scan changes nothing, mutates nothing, and the
    // loop settles right there.
    scan();
  }

  main();
});
