'use strict';

var buildSelector = require('./build-selector');
var readAll = require('./read-all');
var readEl = require('./read-el');
var waitFor = require('./wait-for');

/**
 * An API for authoring UI tests using the Leadfoot Selenium bindings.
 *
 * @constructor
 *
 * @param {object} options
 * @param {object} command - A LeadFoot "command" instance
 * @param {string} root - The application URL (normally something like
 *                        "http://localhost")
 * @param {object} selectors - A mapping of generic "region" names to CSS
 *                             selectors that define their location in the
 *                             application's DOM.
 */
function Driver(options) {
  this._cmd = options.command;
  this._root = options.root;
  this._selectors = options.selectors;
}

module.exports = Driver;

/**
 * Select an element at a given path as described by the `selectors.json` file.
 *
 * @param {string|Array} path - As a string: a dot-separated set of keys in the
 *                              `selectors.json` file for use in building a CSS
 *                              selector. As an array, a combination of such
 *                              dot-separated keys and integers, where integers
 *                              will be used to limit the returned elements at
 *                              the appropriate point in the selection
 *                              operation.
 *
 * Examples:
 *
 *     driver._$('home.menu.tabs.links')
 *
 * Selects all "links" appearing within any tab on the home page's menu.
 *
 *     driver._$(['home.menu.tabs', 2, 'links'])
 *
 * Selects all "links" appearing within the third tab on the home page's menu.
 */
Driver.prototype._$ = function(path, context, pathContext) {
  var selector;

  context = context || this._cmd;

  if (!Array.isArray(path)) {
    selector = buildSelector(this._selectors, pathContext, path);

    return context.findAllByCssSelector(selector);
  }
  var firstPart = path[0];
  var index = path[1];
  var rest = path.slice(2);

  return this._$(firstPart, context, pathContext)
    .then(function(els) {
      var el;

      if (index === undefined) {
        return els;
      }

      el = els[index];

      if (pathContext) {
        pathContext += '.' + firstPart;
      } else {
        pathContext = firstPart;
      }

      if (!el) {
        throw new Error(
          'Expected at least ' + (index + 1) + ' elements at region "' +
          pathContext + '", but only found ' + els.length + '.'
        );
      }

      if (!rest.length) {
        return el;
      }

      return this._$(rest, el, pathContext);
    }.bind(this));
};

Driver.prototype.selectOption = function(element, value) {
  var optionEls;
  return element.findAllByTagName('option')
    .then(function(options) {
      optionEls = options;
      return readAll(options);
    })
    .then(function(text) {
      var index = text.indexOf(value);

      if (index === -1) {
        throw new Error('Could not find option value "' + value + '".');
      }

      return this._cmd.execute(function(el) {
        /* jshint browser: true */
        var evt;

        el.selected = true;

        if ('createEvent' in document) {
          evt = document.createEvent('HTMLEvents');
          evt.initEvent('change', false, true);
          el.parentNode.dispatchEvent(evt);
        } else {
          element.fireEvent('onchange');
        }
      }, [optionEls[index]]);
    }.bind(this));
};

/**
 * Get the visible text within the element found at the given region
 *
 * @param {string} region The name of the region from which the text should be
 *                        read.
 *
 * @returns {string}
 */
Driver.prototype.read = function(region) {
  return this._$(region).then(function(els) {
      return readEl(els[0]);
    });
};

/**
 * Get the visible text within the elements found in the given region
 *
 * @param {string} region The name of the region from which the text should be
 *                        read.
 *
 * @returns {Array<string>}
 */
Driver.prototype.readAll = function(region) {
  return this._$(region).then(function(els) {
      return Promise.all(els.map(function(el) {
        return readEl(el);
      }));
    });
};

/**
 * Get the number of instances of a given region
 *
 * @param {string} region The name of the region that should be counted
 *
 * @returns {number}
 */
Driver.prototype.count = function(region) {
  return this._$(region).then(function(els) {
      return els.length;
    });
};

/**
 * Navigate to a specific URL within the application.
 *
 * @param {string} path
 */
Driver.prototype.get = function(path) {
  return this._cmd.get(this._root + path);
};

Driver.prototype.waitForRegion = function(region, timeout) {
  var options = {
    timeout: timeout,
    errorMsg: 'Unable to find element at region "' + region + '"'
  };

  return waitFor(function() {
      return this._$(region)
        .then(function(els) {
          return els.length > 0;
        });
    }.bind(this), options);
};

/**
 * Return the element rendered at the specified position (relative to the
 * viewport) or null if the position is not with the viewport boundaries.
 *
 * @param {number} x
 * @param {number} y
 *
 * @returns {null|Leadfoot.Element}
 */
Driver.prototype.getElementAtPosition = function(x, y) {
  return this._cmd.execute(function(x, y) {
      return document.elementFromPoint(x, y);
    }, [x, y]);
};

/**
 * Determine if an element is visible and in the current viewport. This means
 * that the following types of elements are considered to be not displayed:
 *
 * - Elements with display: none
 * - Elements with visibility: hidden
 * - Elements positioned outside of the viewport
 * - Elements with opacity: 0
 * - Elements with no offsetWidth or offsetHeight
 *
 * @param {Leadfoot.Element} el
 *
 * @returns {boolean}
 */
Driver.prototype.elementIsInViewport = function(el) {
  var driver = this;
  return el.isDisplayed()
     .then(function(isDisplayed) {
       if (!isDisplayed) {
         return false;
       }

       return Promise.all([
           el.getPosition(),
           el.getSize()
         ]).then(function(results) {
           var x = results[0].x;
           var y = results[0].y;
           var width = results[1].width;
           var height = results[1].height;

           return driver.getElementAtPosition(x + width / 2, y + height / 2);
         }).then(function(el) {
           return !!el;
         });
     });
};
