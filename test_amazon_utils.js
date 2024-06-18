function FakeDocument() {
  this.documentElement = {
    lang: "en-US",
  };
}

function FakeWindow(debug) {
  this.document = new FakeDocument();
  this.location = {
    search: debug ? "?appi=1" : "",
  };
}

module.exports = {
  fresh: function fresh(debug) {
    if (typeof debug === "undefined") {
      debug = !!process.env.DEBUG;
    } else {
      debug = !!debug;
    }

    const theWindow = new FakeWindow(debug);
    return {
      window: theWindow,
      document: theWindow.document,
      isDebug: debug,
    };
  },
};
