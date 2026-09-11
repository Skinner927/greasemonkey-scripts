// You need to run in node 10+.
// Tests the pure helpers of gitlab_mr_pipeline_controls.user.js

/// Exception class for failed tests
function TestFail(message) {
  this.message = message || "";
}
TestFail.prototype = Object.create(Error.prototype);
TestFail.prototype.constructor = TestFail;

var fresh = require("./test_amazon_utils.js").fresh();
var gmScript = require("./gitlab_mr_pipeline_controls.user.js")(
  fresh.window,
  fresh.window.document
);

var chalk = null;
try {
  // npm install chalk@4.x
  // chalk 5+ is ESM
  chalk = require("chalk");
} catch (e) {
  // I haven't the time to check why this doesn't work in github runners
  function format() {
    return Array.prototype.slice.call(arguments).join(" ");
  }
  var _colors = {
    red: format,
    green: format,
    yellow: format,
  };
  chalk = {
    ..._colors,
    bold: _colors,
  };
}

var parsePipelineHref = gmScript.parsePipelineHref;
var normalizeStatus = gmScript.normalizeStatus;
var actionForStatus = gmScript.actionForStatus;
var buildMutation = gmScript.buildMutation;
var pipelineGid = gmScript.pipelineGid;
var iconFragment = gmScript.iconFragment;
var iconTestId = gmScript.iconTestId;
var statusTitle = gmScript.statusTitle;
var variantForGroup = gmScript.variantForGroup;
var isSettledStatus = gmScript.isSettledStatus;
var shouldClearStaleMark = gmScript.shouldClearStaleMark;

var failures = [];

function check(name, actual, expected) {
  var a = JSON.stringify(actual);
  var e = JSON.stringify(expected);
  if (a !== e) {
    failures.push({ test: name, result: a, expected: e });
  }
}

/// parsePipelineHref
[
  [
    "/talondefense/capes/prototypes/optempo/-/pipelines/2839396186",
    {
      projectPath: "talondefense/capes/prototypes/optempo",
      pipelineId: "2839396186",
    },
  ],
  [
    "https://gitlab.com/group/proj/-/pipelines/123",
    { projectPath: "group/proj", pipelineId: "123" },
  ],
  [
    "/group/proj/-/pipelines/123?ref=main",
    { projectPath: "group/proj", pipelineId: "123" },
  ],
  [
    "/group/proj/-/pipelines/123#js-tab-pipeline",
    { projectPath: "group/proj", pipelineId: "123" },
  ],
  // Deeply nested subgroups are legal.
  [
    "/a/b/c/d/e/-/pipelines/9",
    { projectPath: "a/b/c/d/e", pipelineId: "9" },
  ],
  // Not a pipeline link.
  ["/group/proj/-/merge_requests/463", null],
  ["/group/proj/-/pipelines", null],
  ["/group/proj/-/pipelines/", null],
  ["/group/proj/-/pipelines/abc", null],
  ["", null],
  [null, null],
  [void 0, null],
].forEach(function (t) {
  check("parsePipelineHref(" + t[0] + ")", parsePipelineHref(t[0]), t[1]);
});

/// normalizeStatus - reads either the inner icon data-testid or the title
[
  ["status_running_borderless-icon", null, "running"],
  ["status_success_borderless-icon", null, "success"],
  ["status_canceled_borderless-icon", null, "canceled"],
  ["status_waiting_for_resource_borderless-icon", null, "waiting_for_resource"],
  ["status_created-icon", null, "created"],
  // Falls back to the title when the testid is missing or unparseable.
  [null, "Status: Running", "running"],
  [null, "Status: Waiting for resource", "waiting_for_resource"],
  [null, "Status: Passed", "success"],
  [null, "Status: Failed", "failed"],
  ["bogus-icon", "Status: Pending", "pending"],
  // GitLab draws a canceling pipeline with the canceled icon, so only the
  // title can tell the two apart. A canceling pipeline is not retryable.
  ["status_canceled_borderless-icon", "Status: Canceling", "canceling"],
  ["status_canceled_borderless-icon", "Status: Canceled", "canceled"],
  // A title we don't recognise (a GitLab in another language) must not win
  // over the test id, which is the same in every locale.
  ["status_running_borderless-icon", "Estado: En ejecucion", "running"],
  ["status_failed_borderless-icon", "Statut : Echoue", "failed"],
  // Nothing usable.
  [null, null, null],
  ["bogus-icon", "", null],
  ["bogus-icon", "Estado: Cancelando", null],
].forEach(function (t) {
  check(
    "normalizeStatus(" + t[0] + ", " + t[1] + ")",
    normalizeStatus(t[0], t[1]),
    t[2]
  );
});

/// actionForStatus
[
  // Still going, so it can be stopped.
  ["running", "cancel"],
  ["pending", "cancel"],
  ["created", "cancel"],
  ["preparing", "cancel"],
  ["waiting_for_resource", "cancel"],
  ["scheduled", "cancel"],
  // Over and unhappy, so it can be run again.
  ["failed", "retry"],
  ["canceled", "retry"],
  // Nothing worth offering.
  ["success", null],
  ["canceling", null],
  ["skipped", null],
  ["manual", null],
  [null, null],
  ["", null],
].forEach(function (t) {
  check("actionForStatus(" + t[0] + ")", actionForStatus(t[0]), t[1]);
});

/// buildMutation
check(
  "buildMutation(cancel) calls pipelineCancel",
  /pipelineCancel\(input: \{id: \$id\}\)/.test(buildMutation("cancel")),
  true
);
check(
  "buildMutation(retry) calls pipelineRetry",
  /pipelineRetry\(input: \{id: \$id\}\)/.test(buildMutation("retry")),
  true
);
check(
  "buildMutation(cancel) does not call retry",
  /pipelineRetry/.test(buildMutation("cancel")),
  false
);
check("buildMutation(bogus)", buildMutation("bogus"), null);

/// pipelineGid
check(
  "pipelineGid(2839396186)",
  pipelineGid("2839396186"),
  "gid://gitlab/Ci::Pipeline/2839396186"
);

/// Repainting the status icon from detailedStatus
[
  ["status_running", "status_running_borderless"],
  ["status_canceled", "status_canceled_borderless"],
  ["", null],
  [null, null],
  [void 0, null],
].forEach(function (t) {
  check("iconFragment(" + t[0] + ")", iconFragment(t[0]), t[1]);
});

[
  ["status_running", "status_running_borderless-icon"],
  ["status_success", "status_success_borderless-icon"],
  [null, null],
].forEach(function (t) {
  check("iconTestId(" + t[0] + ")", iconTestId(t[0]), t[1]);
});

[
  // GitLab writes the title as "Status: <text>", and normalizeStatus reads
  // it straight back, so these two have to agree.
  ["Running", "Status: Running"],
  ["Passed", "Status: Passed"],
  ["Waiting for resource", "Status: Waiting for resource"],
  ["", null],
  [null, null],
].forEach(function (t) {
  check("statusTitle(" + t[0] + ")", statusTitle(t[0]), t[1]);
});

// What the title we write must normalize back to. Guards the round trip.
[
  ["Running", "running"],
  ["Passed", "success"],
  ["Canceling", "canceling"],
  ["Waiting for resource", "waiting_for_resource"],
].forEach(function (t) {
  check(
    "round trip normalizeStatus(statusTitle(" + t[0] + "))",
    normalizeStatus(null, statusTitle(t[0])),
    t[1]
  );
});

[
  // Confirmed against the live page.
  ["success", "success"],
  ["running", "info"],
  ["failed", "danger"],
  ["canceled", "neutral"],
  // Reasoned from GitLab's palette; a wrong colour is cosmetic only.
  ["pending", "warning"],
  ["success-with-warnings", "warning"],
  ["canceling", "neutral"],
  ["created", "neutral"],
  ["skipped", "neutral"],
  // Anything unrecognised stays grey rather than throwing.
  ["something-new", "neutral"],
  [null, "neutral"],
].forEach(function (t) {
  check("variantForGroup(" + t[0] + ")", variantForGroup(t[0]), t[1]);
});

[
  // Finished: stop polling.
  ["success", true],
  ["SUCCESS", true],
  ["failed", true],
  ["canceled", true],
  ["skipped", true],
  ["manual", true],
  ["success-with-warnings", true],
  // Still moving: keep polling.
  ["running", false],
  ["pending", false],
  ["created", false],
  ["preparing", false],
  ["scheduled", false],
  ["canceling", false],
  ["waiting_for_resource", false],
  ["waiting-for-resource", false],
  [null, false],
  ["", false],
].forEach(function (t) {
  check("isSettledStatus(" + t[0] + ")", isSettledStatus(t[0]), t[1]);
});

[
  // GitLab moved the icon on from what we stamped: the ? has done its job.
  ["running", "success", true],
  ["running", "canceled", true],
  // Unchanged, or nothing readable: leave the ? alone.
  ["running", "running", false],
  ["running", null, false],
  [null, "running", false],
  [null, null, false],
].forEach(function (t) {
  check(
    "shouldClearStaleMark(" + t[0] + ", " + t[1] + ")",
    shouldClearStaleMark(t[0], t[1]),
    t[2]
  );
});

/// @include patterns
// Violentmonkey rejects a "*" top level domain in @match, so the host wildcard
// lives in an @include regex instead. Make sure it still covers self hosted.
var source = require("fs").readFileSync("./gitlab_mr_pipeline_controls.user.js", "utf8");
var includes = source
  .split("\n")
  .filter(function (line) {
    return /^\/\/\s*@include\s/.test(line);
  })
  .map(function (line) {
    var body = line.replace(/^\/\/\s*@include\s+/, "").trim();
    return new RegExp(body.replace(/^\/|\/$/g, ""));
  });

check("has no @match line", /^\/\/\s*@match\s/m.test(source), false);
check("@include count", includes.length, 1);

function included(url) {
  return includes.some(function (re) {
    return re.test(url);
  });
}

[
  // The page this was built for.
  [
    "https://gitlab.com/talondefense/capes/prototypes/optempo/-/merge_requests",
    true,
  ],
  ["https://gitlab.com/group/proj/-/merge_requests?first_page_size=100", true],
  ["http://gitlab.com/group/proj/-/merge_requests", true],
  // Self hosted, including a multi label host and a port.
  ["https://gitlab.example.com/group/proj/-/merge_requests", true],
  ["https://gitlab.internal:8443/group/proj/-/merge_requests", true],
  // Group level list.
  ["https://gitlab.com/groups/talondefense/-/merge_requests", true],
  // A single MR page also matches; there are no rows there so it no-ops.
  ["https://gitlab.com/group/proj/-/merge_requests/463", true],
  // Should stay out of the way.
  ["https://gitlab.com/group/proj/-/issues", false],
  ["https://gitlab.com/group/proj/-/pipelines", false],
  ["https://github.com/group/proj/-/merge_requests", false],
  ["https://notgitlab.com/group/proj/-/merge_requests", false],
].forEach(function (t) {
  check("included(" + t[0] + ")", included(t[0]), t[1]);
});

// Report
if (failures.length) {
  failures.forEach(function (f) {
    console.error(
      chalk.red("FAIL"),
      f.test,
      "\n  expected:",
      chalk.green(f.expected),
      "\n  actual:  ",
      chalk.yellow(f.result)
    );
  });
  console.error(chalk.bold.red(failures.length + " test(s) failed"));
  process.exit(1);
}
console.log(chalk.green("All gitlab_mr_pipeline_controls tests passed"));
