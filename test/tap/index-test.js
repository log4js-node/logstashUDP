'use strict';

const debug = require('debug')('log4js:test.logstashUDP');
const test = require('tap').test;
const sandbox = require('@log4js-node/sandboxed-module');
const appender = require('../../lib');

function setupLogging(category, options) {
  const udpSent = {};
  const socket = {closed: false};

  const fakeDgram = {
    createSocket: function () {
      return {
        send: function (buffer, offset, length, port, host, callback) {
          udpSent.date = new Date();
          udpSent.host = host;
          udpSent.port = port;
          udpSent.length = length;
          udpSent.offset = 0;
          udpSent.buffer = buffer;
          callback(udpSent.error, length);
        },
        close: function (cb) {
          socket.closed = true;
          cb();
        }
      };
    }
  };

  const fakeConsole = {
    error: function (message) {
      this.message = message;
    }
  };

  const fakeLayouts = {
    dummyLayout: function (event) {
      fakeLayouts.dummyLayoutUsed = true;
      return event.data[0];
    },
    layout: function (type, config) {
      fakeLayouts.type = type;
      fakeLayouts.config = config;
      return () => 'I used a custom layout';
    }
  };

  const log4js = sandbox.require('log4js', {
    requires: {
      dgram: fakeDgram,
      './layouts': fakeLayouts
    },
    globals: {
      console: fakeConsole
    }
  });

  options = options || {};
  options.type = '../../../lib';
  log4js.configure({
    appenders: {logstash: options},
    categories: {default: {appenders: ['logstash'], level: 'trace'}}
  });

  return {
    logger: log4js.getLogger(category),
    log4js: log4js,
    console: fakeConsole,
    layouts: fakeLayouts,
    results: udpSent,
    socket: socket
  };
}

test('logstashUDP appender', batch => {
  batch.test('should export a configure function', t => {
    t.type(appender.configure, 'function');
    t.end();
  });

  batch.test('a UDP packet should be sent', t => {
    const setup = setupLogging('myCategory', {
      host: '127.0.0.1',
      port: 10001,
      type: 'logstashUDP',
      logType: 'myAppType',
      category: 'myLogger',
      fields: {
        field1: 'value1',
        field2: 'value2'
      }
    });
    setup.logger.log('trace', 'Log event #1');

    t.equal(setup.results.host, '127.0.0.1');
    t.equal(setup.results.port, 10001);
    t.equal(setup.results.offset, 0);

    const json = JSON.parse(setup.results.buffer.toString());
    t.equal(json.type, 'myAppType');
    const fields = {
      field1: 'value1',
      field2: 'value2',
      level: 'TRACE',
      category: 'myCategory'
    };

    const keys = Object.keys(fields);
    for (let i = 0, length = keys.length; i < length; i += 1) {
      t.equal(json[keys[i]], fields[keys[i]]);
    }

    t.ok(setup.layouts.dummyLayoutUsed);

    t.equal(JSON.stringify(json.fields), JSON.stringify(fields));
    t.equal(json.message, 'Log event #1');
    // Assert timestamp, up to hours resolution.
    const date = new Date(json['@timestamp']);
    t.equal(
      date.toISOString().substring(0, 14),
      setup.results.date.toISOString().substring(0, 14)
    );

    t.end();
  });

  batch.test('udp errors', t => {
    const setup = setupLogging('myLogger', {
      host: '127.0.0.1',
      port: 10001,
      type: 'logstashUDP',
      category: 'myLogger'
    });
    setup.results.error = new Error('Some sort of UDP thing');
    setup.logger.log('trace', 'Log event #1');

    t.test('should be sent to console.error', assert => {
      assert.ok(setup.console.message.startsWith('log4js.logstashUDP - 127.0.0.1:10001 Error: '));
      assert.end();
    });
    t.end();
  });

  batch.test('default options', t => {
    const setup = setupLogging('myLogger', {
      host: '127.0.0.1',
      port: 10001,
      type: 'logstashUDP',
      category: 'myLogger'
    });
    setup.logger.log('trace', 'Log event #1');

    const json = JSON.parse(setup.results.buffer.toString());
    t.equal(json.type, 'myLogger');
    t.equal(
      JSON.stringify(json.fields),
      JSON.stringify({level: 'TRACE', category: 'myLogger'})
    );

    t.end();
  });

  batch.test('using a custom layout', t => {
    const setup = setupLogging('myLogger', {
      host: '127.0.0.1',
      port: 10001,
      type: 'logstashUDP',
      category: 'myLogger',
      layout: {
        type: 'pattern',
        pattern: '%m'
      }
    });
    setup.logger.info('this will not appear in the message');

    t.equal(setup.layouts.type, 'pattern');
    t.equal(setup.layouts.config.pattern, '%m');

    const json = JSON.parse(setup.results.buffer.toString());
    t.equal(json.message, 'I used a custom layout');
    t.end();
  });

  batch.test('configuration can include functions to generate field values at run-time', t => {
    const setup = setupLogging('myCategory', {
      host: '127.0.0.1',
      port: 10001,
      type: 'logstashUDP',
      logType: 'myAppType',
      category: 'myLogger',
      fields: {
        field1: 'value1',
        field2: function () {
          return 'evaluated at runtime';
        }
      }
    });
    setup.logger.log('trace', 'Log event #1');

    const json = JSON.parse(setup.results.buffer.toString());
    t.equal(json.fields.field1, 'value1');
    t.equal(json.fields.field2, 'evaluated at runtime');

    t.end();
  });

  batch.test('extra fields should be added to the fields structure', t => {
    const setup = setupLogging('myLogger', {
      host: '127.0.0.1',
      port: 10001,
      type: 'logstashUDP',
      category: 'myLogger'
    });
    setup.logger.log('trace', 'Log event #1', {extra1: 'value1', extra2: 'value2'});

    const json = JSON.parse(setup.results.buffer.toString());
    const fields = {
      extra1: 'value1',
      extra2: 'value2',
      level: 'TRACE',
      category: 'myLogger'
    };
    t.equal(JSON.stringify(json.fields), JSON.stringify(fields));
    t.end();
  });

  batch.test('use direct args', t => {
    const setup = setupLogging('myLogger', {
      host: '127.0.0.1',
      port: 10001,
      type: 'logstashUDP',
      category: 'myLogger',
      args: 'direct'
    });

    setup.logger.log('info', 'Log event with fields', {extra1: 'value1', extra2: 'value2'});
    const json = JSON.parse(setup.results.buffer.toString());

    t.equal(json.extra1, 'value1');
    t.equal(json.extra2, 'value2');
    t.equal(json.fields, undefined);
    t.end();
  });

  batch.test('use fields args', t => {
    const setup = setupLogging('myLogger', {
      host: '127.0.0.1',
      port: 10001,
      type: 'logstashUDP',
      category: 'myLogger',
      args: 'fields'
    });

    setup.logger.log('info', 'Log event with fields', {extra1: 'value1', extra2: 'value2'});
    const json = JSON.parse(setup.results.buffer.toString());

    t.equal(json.extra1, undefined);
    t.equal(json.extra2, undefined);
    t.equal(json.fields.extra1, 'value1');
    t.equal(json.fields.extra2, 'value2');
    t.end();
  });

  batch.test('Send null as argument', t => {
    const setup = setupLogging('myLogger', {
      host: '127.0.0.1',
      port: 10001,
      type: 'logstashUDP',
      category: 'myLogger'
    });

    const msg = 'test message with null';
    setup.logger.info(msg, null);
    const json = JSON.parse(setup.results.buffer.toString());

    t.equal(json.message, msg);
    t.end();
  });

  batch.test('Send undefined as argument', t => {
    const setup = setupLogging('myLogger', {
      host: '127.0.0.1',
      port: 10001,
      type: 'logstashUDP',
      category: 'myLogger'
    });

    const msg = 'test message with undefined';
    setup.logger.info(msg, undefined);
    const json = JSON.parse(setup.results.buffer.toString());

    t.equal(json.message, msg);
    t.end();
  });

  batch.test('shutdown should close sockets', t => {
    const setup = setupLogging('myLogger', {
      host: '127.0.0.1',
      port: 10001,
      type: 'logstashUDP',
      category: 'myLogger'
    });
    setup.log4js.shutdown(() => {
      t.ok(setup.socket.closed);
      t.end();
    });
  });

  batch.end();
});
