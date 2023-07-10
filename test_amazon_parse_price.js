// You need to run in node 10+.
var tests = [
  ["$1,234.99", { dollars: 1234, cents: 99 }],
  [" $    1,234  .  99   ", { dollars: 1234, cents: 99 }],
  ["$0.50", { dollars: 0, cents: 50 }],
  ["0.50", { dollars: 0, cents: 50 }],
  [".50", { dollars: 0, cents: 50 }],
  ["$.50", { dollars: 0, cents: 50 }],
  [" hamburger.50  ", { dollars: 0, cents: 50 }],
  [" tacos . 5 0  ", { dollars: 0, cents: 5 }],
  ["$0.22", { dollars: 0, cents: 22 }],
  ["$1", { dollars: 1, cents: 0 }],
  ["123", { dollars: 123, cents: 0 }],
  ["-123", { dollars: 123, cents: 0 }],
  ["-$123", { dollars: 123, cents: 0 }],
  ["123 99", { dollars: 123, cents: 99 }],
  ["123<sup>99</sup>", { dollars: 123, cents: 99 }],
  ["123<sup>.23</sup>", { dollars: 0, cents: 23 }],
  ["123<sup>8  </sup>", { dollars: 123, cents: 8 }],
  ["12 3<sup>8  </sup>", { dollars: 12, cents: 3 }],
  ["bacon", null],
  ["$cheese", null],
  [void 0, null],
  ["", null],
];

/// Exception class for failed tests
function TestFail(message) {
  this.message = message || "";
}
TestFail.prototype = Object.create(Error.prototype);
TestFail.prototype.constructor = TestFail;

var gmScript = require("./amazon_price_per_item.user.js");
var chalk = require("chalk");

var parsePrice = gmScript.parsePrice;

const fmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

// Run each test
var failures = [];
tests.forEach(function (test, i) {
  var price = test[0];
  var expected = test[1];

  try {
    var result = parsePrice(price);

    if (null === expected) {
      if (null !== result) {
        throw new TestFail();
      }
    } else {
      if (!result) {
        throw new TestFail("result is empty");
      }
      if (result.dollars !== expected.dollars) {
        throw new TestFail("dollars");
      }
      if (result.cents !== expected.cents) {
        throw new TestFail("cents");
      }
      var priceStr = [
        fmt.format(expected.dollars).split(".")[0],
        expected.cents,
      ].join(".");
      if (result.price !== priceStr) {
        throw new TestFail(`price (actual ${result.price}) != ${priceStr}`);
      }
      var pennies = expected.dollars * 100 + expected.cents;
      if (result.pennies !== pennies) {
        throw new TestFail("pennies != expected " + pennies);
      }
    }
  } catch (e) {
    if (!(e instanceof TestFail)) {
      console.error(`Unhandled exception for test ${price}`, e);
    }
    failures.push({
      test: price,
      result: result,
      expected: expected,
      idx: i,
      message: e.message || "",
    });
  }
});

console.log(" ");
if (failures.length > 0) {
  console.log(chalk.red("" + failures.length + " Failed Tests:"));
  failures.forEach((t) => {
    console.log(
      chalk.red(
        `[${t.idx}] ${t.test} | expected: ${JSON.stringify(
          t.expected
        )} result: ${JSON.stringify(t.result)}`
      )
    );
    if (t.message) {
      console.log("    " + chalk.bold.yellow(t.message));
    }
  });
  process.exit(1);
} else {
  console.log(chalk.green("All tests passed ✔"));
  process.exit(0);
}
