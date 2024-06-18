// You need to run in node 10+.
var tests = [
  ["PACK OF TWENTY", 20],
  ["pack of sandwiches", null],
  ["box of 2", 2],
  ["box of six", 6],
  ["box of bread", null],
  ["pack of 3", 3],
  ["2 pack", 2],
  ["triple pack", 3],
  ["triple score", null],
  ["2-pack", 2],
  ["twin-pack", 2],
  ["twin-screw", null],
  ["4 count", 4],
  ["4, count", 4],
  ["4Count", 4],
  ["box of 12", 12],
  ["thirty-two count", 32],
  ["seventy seven pack", 77],
  ["45-pack", 45],
  ["125 -pack", 125],
  ["1pack", 1],
  ["package of 22", 22],
  ["strip of 82", 82],
  ["[6.6ft 2-Pack]", 2],
  ["Sensitive Skin, 720 Count (12 packs),", 720],
  ["pack of 12 (2 packs) cheese", 12],
  ["(2 packs) pack of 12 cheese", 12],
  // TODO: test with locale
  ["lot de 1 799 fromage", 1799],
];

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

var expose = {};
var getCountFromTitle = gmScript.buildTitleParser(expose);

// Run each test
var failures = [];
tests.forEach(function (test) {
  // Test every regex against this test so we can see what matches
  var allMatchesForTest = expose.regExes.map(function (reg) {
    reg.lastIndex = 0;
    return {
      test: test[0],
      result: expose.handleMatch(test[0].toLowerCase().match(reg)),
      expected: test[1],
      regexp: reg,
    };
  });
  var onePassed = allMatchesForTest.some((r) => r.result === r.expected);

  // This is how our GM script is going to use it, so let's test that
  var usageTest = getCountFromTitle(test[0]);
  var usagePassed = usageTest === test[1];
  var allPassed = onePassed && usagePassed;
  allMatchesForTest.unshift({
    test: "getCountFromTitle",
    result: usageTest,
    expected: test[1],
  });

  var title = '"' + test[0] + '": ' + (allPassed ? "✔" : "FAILED");
  title = allPassed ? chalk.green(title) : chalk.red(title);

  if (!usagePassed) {
    title += chalk.red(" | Usage did not pass");
  }
  if (!onePassed) {
    title += chalk.red(" | None of the individual regex passed");
  }

  if (!allPassed) {
    failures.push(test);
  }

  console.group(title);
  console.table(allMatchesForTest);
  console.groupEnd();
});
console.log(" ");
if (failures.length > 0) {
  console.group(chalk.red("" + failures.length + " Failed Tests:"));
  failures.forEach((t) => {
    console.log(chalk.red('"' + t[0] + '"'));
  });
  console.groupEnd();
  process.exit(1);
} else {
  console.log(chalk.green("All tests passed"));
  process.exit(0);
}
