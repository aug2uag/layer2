/* jshint mocha: true, node: true */

(function () {
  'use strict';

  var assert = require('assert'),
      addon = require('../lib/utils').requireAddon();

  describe('Addon', function () {

    describe('Dispatcher', function () {

      var Dispatcher = addon.Dispatcher;

      var maybeIt = maybe(it, hasActiveDevice()); // jshint ignore: line

      it('can be instantiated on a file', function () {

        var dispatcher = Dispatcher.fromSavefile('./test/dat/mesh.pcap');

        assert.equal(dispatcher.getSnaplen(), 65535);
        assert.equal(dispatcher.getDatalink(), 127); // Radiotap.

      });

      it('throws an error when instantiated on a missing file', function () {

        assert.throws(function () {
          Dispatcher.fromSavefile('./foobar');
        });

      });

      it('throws an error when no handle is present', function () {
        // Most importantly, it doesn't segfault.

        assert.throws(function () {
          Dispatcher.getSnaplen();
        });

      });

      it('dispatches frames async', function (done) {

        var isAsync = false;
        var dispatcher = Dispatcher.fromSavefile('./test/dat/mesh.pcap');

        dispatcher
          .dispatch(3, function (err, iter) {
            assert.ok(err === null);
            var nFrames = 0;
            while (iter.next()) {
              nFrames++;
            }
            assert.ok(isAsync);
            assert.equal(nFrames, 3);
            done();
          });

        setImmediate(function () { isAsync = true; });

      });

      it('throws an error when dispatching concurrently', function (done) {

        var dispatcher = new Dispatcher.fromSavefile('./test/dat/mesh.pcap');

        dispatcher
          .dispatch(-1, function () {})
          .dispatch(-1, function (err) {
            assert.ok(err !== null);
            done();
          });

      });

      it('dispatches all frames from a save file', function (done) {

        var dispatcher = new Dispatcher
          .fromSavefile('./test/dat/mesh.pcap');
        var nFrames = 0;

        dispatcher
          .dispatch(-1, function (err, iter) {
            assert.ok(err === null);
            while (iter.next()) {
              nFrames++;
            }
            assert.equal(nFrames, 780);
            done();
          });

      });

      it('dispatches no frames after finishing a save file', function (done) {

        var dispatcher = new Dispatcher
          .fromSavefile('./test/dat/mesh.pcap');

        dispatcher
          .dispatch(-1, function (err) {
            assert.ok(err === null);
            dispatcher.dispatch(1, function (err, iter) {
              assert.ok(err === null);
              assert.ok(iter.next() === null);
              done();
            });
          });

      });

      // TODO: Tests that require a live interface.

    });

    describe('Frame', function () {

      it('supports radiotap', function () {

        var buf = new Buffer('000020006708040054c6b82400000000220cdaa002000000400100003c142411b4007c013ce072e6612bcc03fadc202a719fe3d6', 'hex');
        var frame = new addon.Frame(127, buf); // radiotap link type
        var pdu = frame.getPdu(3); // radiotap pdutype
        assert.deepEqual(pdu.getChannel(), {freq: 5180, type: 320});
        assert.equal(pdu.getRate(), 12);
        assert.equal(pdu.getSize(), 48);
        assert.deepEqual(pdu.getDbm(), {signal: 218, noise: 160});

      });

    });

    describe('Utilities', function () {

      it('can parse MAC addresses', function () {

        var buf = new Buffer('0123456789ab001122334455', 'hex');
        assert.equal(addon.readMacAddr(buf, 0), '01:23:45:67:89:ab');
        assert.equal(addon.readMacAddr(buf, 6), '00:11:22:33:44:55');
        assert.throws(function () { addon.readMacAddr(buf, 8); });

      });

      it('can return link infos', function () {

        assert.equal(addon.getLinkInfo(-5), null); // Invalid type.

        assert.deepEqual(
          addon.getLinkInfo(127),
          {
            name: 'IEEE802_11_RADIO',
            description: '802.11 plus radiotap header'
          }
        );

        assert.deepEqual(
          addon.getLinkInfo(0),
          {
            name: 'NULL',
            description: 'BSD loopback'
          }
        );

      });

    });

    function hasActiveDevice() {
      // Check whether there is an active network we can listen to.

      var device;
      try {
        device = addon.getDefaultDevice();
      } catch (err) {
        device = null;
      }
      return !!device;

    }

  });

  function maybe(fn, predicate) {
    // Skip test if predicate is false (fn should be `describe` or `it`).

    return predicate ? fn : fn.skip;

  }

})();
