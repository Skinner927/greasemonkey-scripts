// Ya gotta copy-pasta buildTitleParse between amazon_price_per_item and here
// You also need to run in node 10+.
var expose = {};
var getCountFromTitle = buildTitleParser(expose);

var tests = [
  'PACK OF TWENTY',
  'box of 2',
  'box of six',
  'pack of 3',
  '2 pack',
  'triple pack',
  '2-pack',
  'twin-pack',
  '4 count',
  '4, count',
  'box of 12',
  'thirty-two count',
  'seventy seven pack',
];

console.table(tests.reduce(function(all, test) {
  all.push.apply(all, expose.regExes.map(function(reg) {
    reg.lastIndex = 0;
    return {
      test: test,
      result: expose.handleMatch(test.match(reg)),
      reg: String(reg),
    };
  }));
  return all;
}, []));

function buildTitleParser(expose) {
  expose = expose || {};
  /*
  Qualifiers -
  These are the overall matches that we use to identify packs.
  The first index is the "prefix"
  and the second index is the "suffix"
  wherein the number (be it a digit or words) lies between.
  Both values will be added to a regex so make it work correctly.
  Ensure any groups () are non-capturing (?:...)
  */
  var qualifiers = [
    ['pack of ', ''],   // pack of 3
    ['', '[ -]?pack'],  // 2 pack or 2-pack
    ['', ',? count'],   // 4 count or 4, count
    ['box of ', ''],    // box of 12
  ];

  var regExes = qualifiers.map(function(qual) {
    var words = '(?:[a-zA-Z\\-]+(?: |-)?){1,4}'; // We allow up to 4 words
    return new RegExp(qual[0] + '(?:(\\d+)|(' + words + '))' + qual[1]);
  });

  // Let's build all word numbers
  // https://stackoverflow.com/a/493788/721519

  // Some common slang for numbers
  var numberSlang = {
    2: ['twin', 'double'],
    3: ['triple'],
    4: ['quad']
  }

  var units = [
    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
    'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
    'sixteen', 'seventeen', 'eighteen', 'nineteen',
  ];
  var tens = [
    '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty',
    'seventy', 'eighty', 'ninety',
  ];
  var scales = ['hundred', 'thousand', 'million', 'billion', 'trillion'];

  /* numberWords */
  // Build numberWords which will be a map for all words to a tuple that will
  // descibe the value of the word.
  var numberWords = {
    and: [1, 0],
  };
  units.forEach(function(word, i) {
    numberWords[word] = [1, i];
  });
  tens.forEach(function(word, i) {
    if (word) {
      numberWords[word] = [1, i * 10];
    }
  });
  scales.forEach(function(word, i) {
    numberWords[word] = [Math.pow(10, (i * 3) || 2), 0];
  });
  Object.keys(numberSlang).forEach(function(num) {
    numberSlang[num].forEach(function(word) {
      numberWords[word] = [1, parseInt(num, 10)];
    });
  });

  function handleMatch(match) {
    if (!match) {
      return null;
    }
    var digits = match[1];
    var text = match[2];

    // Digits trump text numbers
    if (digits) {
      var d = parseInt(digits, 10);
      if (d && !isNaN(d)) {
        return d;
      }
    }
    if (!text) {
      return null;
    }

    // Ok, figure out what it's saying :D
    var current = 0;
    var result = 0;
    var started = false;
    var words = text.trim().split(/[ -]/);
    for (var i = 0; i < words.length; i++) {
      var word = words[i];
      if (!(word in numberWords)) {
        // This causes a break only if we've at least once captured something
        if (started) {
          break;
        }
        continue;
      }
      started = true;

      var values = numberWords[word];
      var scale = values[0];
      var increment = values[1];
      var current = current * scale + increment;
      if (scale > 100) {
        result += current;
        current = 0;
      }
    }
    result += current;
    return (typeof result === 'number') && result > 0 ? result : null;
  }

  // Parse a string for a count
  function parseTitle(title) {
    title = (title || '').trim().toLowerCase();
    for (var i = 0; i < regExes.length; i++) {
      var exp = regExes[i];
      exp.lastIndex = 0; // Reset it

      var result = handleMatch(title.match(exp));
      if (result) {
        return result;
      }
    }
    return null;
  }

  expose.regExes = regExes;
  expose.handleMatch = handleMatch;
  expose.parseTitle = parseTitle;

  return parseTitle;
}
