// ==UserScript==
// @name         Gitlab Wider Pipeline Labels
// @namespace    https://github.com/Skinner927/greasemonkey-scripts
// @updateURL    https://github.com/Skinner927/greasemonkey-scripts/raw/master/gitlab_wider_pipelines.user.js
// @author       skinner927
// @version      1.0
// @description  Widens pipeline labels and adds scroll bar on top
// @match        *://gitlab.com/*/pipelines/*
// @grant        GM_addStyle
// ==/UserScript==

(function gitlabWiderPipelineLabels() {
  GM_addStyle(`
.pipeline-graph .build {
  width: 250px;
}
.pipeline-graph .build .mw-70p {
  max-width: 100%;
  position: absolute;
}
.pipeline-graph .ci-job-component {
  position: relative;
  overflow: hidden;
}
`);

  function waitForTest(test, callback, interval, forever) {
    var result = test();
    if (result) {
      callback(result);
      if (!forever) {
        return;
      }
    }
    setTimeout(waitForTest, interval, test, callback, interval, forever);
  }

  waitForTest(function testPipelineOuter() {
    return document.querySelector("#js-tab-pipeline > div > div.pipeline-visualization.pipeline-graph.pipeline-tab-content");
  }, function foundPipelineOuter($pipelineOuter) {
    if (!$pipelineOuter || $pipelineOuter.dataset.hasScroll) {
      return;
    }
    $pipelineOuter.dataset.hasScroll = 1;

    waitForTest(function testPipelineInner() {
      return $pipelineOuter.querySelector("div");
    }, function foundPipelineInner($pipelineInner) {
      setup($pipelineOuter, $pipelineInner);
    }, 100, false);
  }, 250, false);

  function setup($pipelineOuter, $pipelineInner) {
    console.log("start wider pipelines", $pipelineOuter, $pipelineInner);
    if (!$pipelineOuter || !$pipelineInner) {
      console.error("setup missing element", $pipelineOuter, $pipelineInner);
      return;
    }

    // Build top scrollbar
    var $scroll = document.createElement("div");
    $scroll.style.overflow = "auto";
    $scroll.style.overflowY = "hidden";
    $scroll.style.lineHeight = "0px";
    $scroll.appendChild(document.createElement("div"));
    $scroll.firstChild.style.width = "" + $pipelineInner.scrollWidth + "px";
    $scroll.firstChild.style.paddingTop = "1px";
    $scroll.firstChild.appendChild(document.createTextNode("\xA0"));
    var running = false;
    $scroll.onscroll = function scrollOnScroll() {
      if (running) {
        running = false;
        return;
      }
      running = true;
      $pipelineOuter.scrollLeft = $scroll.scrollLeft;
    };
    $pipelineOuter.onscroll = function pipelineOuterOnScroll() {
      if (running) {
        running = false;
        return;
      }
      running = true;
      $scroll.scrollLeft = $pipelineOuter.scrollLeft;
    };
    $pipelineOuter.parentElement.insertBefore($scroll, $pipelineOuter);

    // constantly check sizes and ensure we're staying in sync
    var doWork;
    doWork = function doWork() {
      if (!$scroll || !$pipelineInner) {
        console.error("doWork missing elements", $scroll, $pipelineInner);
        return;
      }
      var newWidth = "" + $pipelineInner.scrollWidth + "px";
      if (newWidth !== $scroll.firstChild.style.width) {
        $scroll.firstChild.style.width = newWidth;
      }
      setTimeout(doWork, 250);
    }
    doWork();
  }
})();
