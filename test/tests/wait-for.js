'use strict';

var waitFor = require('../../').waitFor;
var bPromise = require('bluebird');

suite('waitFor', function() {
  test('Does not resolve until the returned promise resolves', function() {
    var resolved = false;

    var poller = function() {
      return new bPromise(function(resolve) {
        setTimeout(function() {
          resolve(true);
          resolved = true;
        }, 50);
      });
    };

    return waitFor(poller)
      .then(function() {
        assert(resolved);
      });
  });

  test('Does not resolve until the returned promise resolves with `true`', function() {
    var callCount = 0;

    var poller = function() {
      return new bPromise(function(resolve) {
        setTimeout(function() {
          callCount += 1;
          assert(callCount <= 3);
          resolve(callCount === 3);
        }, 0);
      });
    };

    return waitFor(poller)
      .then(function() {
        assert.equal(callCount, 3);
      });
  });

  test('Rejects promise if returned promise is rejected', function() {
    var reason = new Error();
    var callCount = 0;
    var poller = function() {
      return new bPromise(function(_, reject) {
        setTimeout(function() {
          callCount += 1;
          reject(reason);
        }, 0);
      });
    };

    return waitFor(poller)
      .then(function() {
        throw new Error('Expected promise to be rejected.');
      }, function(err) {
        assert.equal(callCount, 1);
        assert.equal(err, reason);
      });
  });

  test('Honors the `timeout` option', function() {
    var callCount = 0;
    var start = new Date().getTime();

    var poller = function() {
      return new bPromise(function(resolve) {
        assert(
          new Date().getTime() - start < 30, 'Does not poll after timeout occurs'
        );
        callCount += 1;
        resolve(false);
      });
    };

    return waitFor(poller, { timeout: 30 })
      .then(function() {
        throw new Error('Expected promise to be rejected.');
      }, function(err) {
        assert(err instanceof Error, 'Rejected with an Error obejct');
        assert(
          callCount > 0, 'Polling function invoked at least prior to timeout'
        );
      });
  });

  test('Honors the `errorMsg` option', function() {
    var options = { timeout: 0, errorMsg: 'Leadfoot-driver test message' };

    var poller = function() {
      return new bPromise(function(resolve) {
        resolve(false);
      });
    };

    return waitFor(poller, options)
      .then(function() {
        throw new Error('Expected promise to be rejected.');
      }, function(err) {
        assert(err instanceof Error, 'Rejected with an Error obejct');
        assert.equal(err.message, 'Leadfoot-driver test message');
      });
  });
});
