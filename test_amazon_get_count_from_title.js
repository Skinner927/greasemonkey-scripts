// You need to run in node 10+.
var tests = [
  ['PACK OF TWENTY', 20],
  ['pack of sandwiches', null],
  ['box of 2', 2],
  ['box of six', 6],
  ['box of bread', null],
  ['pack of 3', 3],
  ['2 pack', 2],
  ['triple pack', 3],
  ['triple score', null],
  ['2-pack', 2],
  ['twin-pack', 2],
  ['twin-screw', null],
  ['4 count', 4],
  ['4, count', 4],
  ['4Count', 4],
  ['box of 12', 12],
  ['thirty-two count', 32],
  ['seventy seven pack', 77],
  ['45-pack', 45],
  ['125 -pack', 125],
  ['1pack', 1],
  ['package of 22', 22],
  ['strip of 82', 82],
];

var gmScript = require('./amazon_price_per_item.user.js');
var chalk = null;
try {
  chalk = require('chalk');
} catch (e) {
  // pass
}
var expose = {};
var getCountFromTitle = gmScript.buildTitleParser(expose);

// Colors
function red() {
  if (chalk) {
    return chalk.red.apply(chalk, arguments);
  }
  return Array.prototype.slice.call(arguments).join(' ');
}
function green() {
  if (chalk) {
    return chalk.green.apply(chalk, arguments);
  }
  return Array.prototype.slice.call(arguments).join(' ');
}

// Run each test
var failures = [];
tests.forEach(function(test) {
  // Test every regex against this test so we can see what matches
  var allMatchesForTest = expose.regExes.map(function(reg) {
    reg.lastIndex = 0;
    return {
      test: test[0],
      result: expose.handleMatch(test[0].toLowerCase().match(reg)),
      expected: test[1],
      reg: String(reg),
    };
  });
  var onePassed = allMatchesForTest.some(r => r.result === r.expected);

  // This is how our GM script is going to use it, so let's test that
  var usageTest = getCountFromTitle(test[0]);
  var usagePassed = usageTest === test[1];
  var allPassed = onePassed && usagePassed;
  allMatchesForTest.unshift({
    test: 'getCountFromTitle',
    result: usageTest,
    expected: test[1],
  });

  var title = '"' + test[0] + '": ' + (allPassed ? '✔' : 'FAILED');
  title = allPassed ? green(title) : red(title);

  if (!usagePassed) {
    title += red(' | Usage did not pass');
  }
  if (!onePassed) {
    title += red(' | None of the individual regex passed');
  }

  if (!allPassed) {
    failures.push(test);
  }

  console.group(title);
  console.table(allMatchesForTest);
  console.groupEnd();
});
console.log(' ');
if (failures.length > 0) {
  console.group(red('' + failures.length + ' Failed Tests:'))
  failures.forEach((t) => { console.log(chalk.red('"' + t[0] + '"')); });
  console.groupEnd();
  process.exit(1);
} else {
  console.log(green('All tests passed'));
  process.exit(0);
}
