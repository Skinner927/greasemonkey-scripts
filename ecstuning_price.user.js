// ==UserScript==
// @name         ECS Tuning Price Sort
// @namespace    https://github.com/Skinner927/greasemonkey-scripts
// @updateURL    https://github.com/Skinner927/greasemonkey-scripts/raw/master/ecstuning_price.user.js
// @author       skinner927
// @version      1.0
// @description  Reorder items on page based on price. Keeps in groups.
// @author       Skinner927
// @match        http*://www.ecstuning.com/*
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  function productToPriceElTuple(productEl) {
    var priceEl = productEl.querySelector(".price");
    if (!priceEl) {
      return null;
    }
    var price = priceEl.innerText
      .replace("$", "")
      .split(".")
      .reduce(function(total, value, index, arr) {
        if (index == 0) {
          return total + ((parseInt(value.replace(",", ""), 10) || 0) * 100);
        }
        if (index > 1) {
          console.warn("Too many price indexes: " + arr.join(", "));
        }
        return total + (parseInt(value, 10) || 0);

      }, 0);

    return [price, productEl];
  }

  function sortProductsInListing(listingEl, sortLowToHigh) {
    var productNodes = listingEl.querySelectorAll(".productListBox");
    if (!productNodes || productNodes.length < 1) {
      console.error("No products found in listing", listingEl);
      return;
    }

    // Sort product boxes by price
    Array.prototype.slice.call(productNodes)
      .map(productToPriceElTuple)
      .filter(n => !!n)
      // sort by price
      .sort(function(a, b) {
        if (sortLowToHigh) {
          return a[0] > b[0];
        } else {
          return a[0] < b[0];
        }
      })
      .forEach(function(pair) {
        listingEl.appendChild(pair[1]);
      });
  }

  function searchForProducts(sortLowToHigh) {
    var allListings = document.querySelectorAll(".listing");
    if (!allListings || allListings.length < 1) {
      console.error("Could not find listings");
    }
    Array.prototype.slice.call(allListings)
      .forEach(el => sortProductsInListing(el, sortLowToHigh));
  }

  // MAIN
  var priceButtonId = "ds-user-price=sort";
  if (document.getElementById(priceButtonId)) {
    return;
  }

  var priceBtn = document.createElement("button");
  priceBtn.id = priceButtonId;
  priceBtn.style.position = "fixed";
  priceBtn.style.right = "7px";
  priceBtn.style.top = "7px";
  priceBtn.style.padding = "5px";
  priceBtn.style.zIndex = "10000";
  priceBtn.style.cursor = "pointer";
  priceBtn.innerHTML = "Sort By Price";

  document.body.appendChild(priceBtn);

  var sortLowToHigh = true;
  priceBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    searchForProducts(sortLowToHigh);
    sortLowToHigh = !sortLowToHigh;
    return false;
  });
})();
