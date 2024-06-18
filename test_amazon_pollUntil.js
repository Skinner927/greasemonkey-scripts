// You need to run in node 10+.
// This is an example of over engineering. Why I didn't use a test framework
// or really just barf to console, I don't know.
var fresh = require("./test_amazon_utils.js").fresh();
var gmScript = require("./amazon_price_per_item.user.js")(
  fresh.window,
  fresh.window.document
);
var chalk = null;
try {
  // npm install chalk@4.x
  // chalk 5+ is ESM
  chalk = require("chalk");
} catch (e) {
  function format() {
    return Array.prototype.slice.call(arguments).join(" ");
  }
  chalk = {
    red: format,
    green: format,
  };
}
var pollUntil = gmScript.pollUntil;

// Store test names
var failures = [];

function makeResultHandlers(
  testName,
  expectPass,
  testDone,
  testSuccessOk,
  testFailureOk
) {
  function final(passed, message) {
    var fullMessage = (passed ? "✔ " : "FAILED ") + testName;
    if (message) {
      fullMessage += ": " + message;
    }
    if (passed) {
      console.log(chalk.green(fullMessage));
    } else {
      failures.push(testName);
      console.log(chalk.red(fullMessage));
    }
    testDone();
  }

  function success(val, loops) {
    var passed = expectPass;
    var msg = "value " + val;
    if (typeof testSuccessOk === "function") {
      var res = testSuccessOk(val, loops);
      if (Array.isArray(res)) {
        passed = !!res[0];
        msg = res[1];
      } else {
        passed = !!res;
      }
    }
    final(passed, msg);
  }

  function failure(val, loops) {
    var passed = !expectPass;
    var msg = "value " + val;
    if (typeof testFailureOk === "function") {
      var res = testFailureOk(val, loops);
      if (Array.isArray(res)) {
        passed = !!res[0];
        msg = res[1];
      } else {
        passed = !!res;
      }
    }
    final(passed, msg);
  }

  function wrapper(fn) {
    return function (val, loops) {
      try {
        fn(val, loops);
      } catch (e) {
        failures.push(testName);
        console.log(chalk.red("UNHANDLED EXCEPTION", testName, e));
      }
    };
  }

  return [wrapper(success), wrapper(failure)];
}

function makeTestCounter(test, startAt, step) {
  if (typeof step !== "number") {
    step = 1;
  }
  function wrapper() {
    wrapper.counter += step;
    if (test) {
      return test(wrapper);
    }
    return wrapper.counter;
  }
  wrapper.counter = startAt || 0;
  return wrapper;
}

///////////////////////////
// BEGIN TESTS

var tests = [
  // TEST: Wait till 10
  function test_WaitTill10(testDone) {
    var testName = "Wait Till 10";
    var startLoops = 13; // should only need 10

    function validateSuccess(val, loop) {
      var passed = true;
      var msg = [];
      if (val !== 10) {
        passed = false;
        msg.push(`Expected result to be 10 got ${val} instead`);
      }
      var burnedLoops = startLoops - loop;
      if (burnedLoops !== 9) {
        passed = false;
        msg.push(`Expected only 9 loops got ${burnedLoops} instead`);
      }

      if (!passed) {
        return [false, msg.join("; ")];
      }
      return true;
    }

    pollUntil(
      ...makeResultHandlers(testName, true, testDone, validateSuccess),
      makeTestCounter(),
      function validator(val) {
        return val >= 10;
      },
      0, // interval
      startLoops
    );
  },

  // TEST: Truthy Validator 1
  function test_TruthyValidator1(testDone) {
    pollUntil(
      ...makeResultHandlers("Truthy Validator 1", true, testDone),
      makeTestCounter(),
      null, // Use the default truthy
      0, // interval
      1 // Should only need 1 loop
    );
  },

  // TEST: Truthy Validator 2
  function test_TruthyValidator2(testDone) {
    pollUntil(
      ...makeResultHandlers("Truthy Validator 2", true, testDone),
      makeTestCounter(null, 2),
      null, // Use the default truthy
      0, // interval
      1 // Should pass immediately
    );
  },

  // TEST: Truthy Validator 3
  function test_TruthyValidator3(testDone) {
    // Expect to fail because we'll never increment past 0
    pollUntil(
      ...makeResultHandlers("Truthy Validator 3", false, testDone),
      () => 0,
      null, // Use the default truthy
      0, // interval
      3 // Doesn't matter, do a few to ensure we don't somehow trigger success
    );
  },

  // TEST: Object Params
  function test_ObjectParams(testDone) {
    var flag = "WINNER";
    var t = makeResultHandlers("Object Params", true, testDone);
    pollUntil({
      success: t[0],
      failure: t[1],
      test: makeTestCounter((w) => w.counter > 5 && flag),
      validator: (val) => val === flag,
      interval: 0,
      loops: 10,
    });
  },
];

///////////////////////////
// Run each test

function final() {
  console.log(" ");
  if (failures.length > 0) {
    console.log(chalk.red("" + failures.length + " Failed Tests:"));
    failures.forEach((t) => {
      console.log(chalk.red("  " + t));
    });
    process.exit(1);
  } else {
    console.log(chalk.green("All tests passed"));
    process.exit(0);
  }
}

var start = tests.reverse().reduce((previous, next) => {
  return () => {
    next(previous);
  };
}, final);
start();
