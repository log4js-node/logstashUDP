const _ = require('lodash');
const debug = require('debug')('log4js:test.logstashUDP');
const path = require('path');
const proxyquire = require('proxyquire-2');
const assert = require('assert');
const appenderPath = path.resolve(__dirname, '../src');

const fakeDefaultConfig = {
  host: '127.0.0.1',
  port: 10001
};

const fakeDgramProducer = () => {
  const messageStore = [];
  const socket = {
    error: undefined,
    closed: false
  };
  const fakeDgram = {
    createSocket: () => ({
      send: function (buffer, offset, length, port, host, callback) {
        messageStore.push({
          date: new Date(),
          host: host,
          port: port,
          length: length,
          offset: 0,
          buffer: buffer
        });
        callback(socket.error, length);
      },
      close: function (cb) {
        socket.closed = true;
        cb();
      }
    }),
    messageStore,
    socket,
  };
  return fakeDgram;
};

const fakeDefaultLayoutsProducer = () => {
  const status = {isUsed: false};
  const defaultLayouts = {
    dummyLayout: function (event) {
      status.isUsed = true;
      return event.data[0];
    },
    status,
  };
  return defaultLayouts;
};

const fakeConsoleProducer = () => {
  const messageStore = [];
  const fakeConsole = {
    error: message => messageStore.push(message),
    messageStore
  };
  return fakeConsole;
};

/*
LoggingEvent
{
  startTime: 2018-03-14T07:44:16.675Z,
  categoryName: 'myCategory',
  data: [ 'Log event #1', { field1: 'value1' } ],
  level: Level { level: 5000, levelStr: 'TRACE', colour: 'blue' },
  context: {},
  pid: 1184
}
*/
const commonLoggingEvent = {
  startTime: '2018-03-14T07:44:16.675Z',
  categoryName: 'myCategory',
  data: ['Log event #1'],
  level: {
    level: 5000,
    levelStr: 'TRACE',
    colour: 'blue'
  },
  context: {},
  pid: 1184
};

const fakeLoggerProducer = ({fakeConfig, fakeDgram, fakeConsole, fakeLayouts}) => {
  const appender = proxyquire(appenderPath, {
    'dgram': fakeDgram || fakeDgramProducer()
  });
  return appender.configure(
    fakeConfig || fakeDefaultConfig,
    fakeLayouts || fakeDefaultLayoutsProducer(),
    (fakeConsole || fakeConsoleProducer()).error
  );
};

describe('logstashUDP appender', () => {
  it('should export a configure function', () => {
    assert.ok(_.isFunction(require(appenderPath).configure));
  });

  it('a UDP packet should be sent', () => {
    const fakeDgram = fakeDgramProducer();
    const fakeConsole = fakeConsoleProducer();

    const logger = fakeLoggerProducer({fakeDgram, fakeConsole});
    logger(commonLoggingEvent);

    assert.strictEqual(fakeDgram.messageStore.length, 1);
    const messageSent = fakeDgram.messageStore[0];
    assert.strictEqual(messageSent.host, fakeDefaultConfig.host);
    assert.strictEqual(messageSent.port, fakeDefaultConfig.port);
    assert.strictEqual(messageSent.offset, 0);
    assert.strictEqual(fakeConsole.messageStore.length, 0);
  });

  it('udp errors should be sent to console.error', () => {
    const errorMessage = 'Some sort of UDP thing';
    const error = new Error(errorMessage);
    const fakeDgram = fakeDgramProducer();
    fakeDgram.socket.error = error;
    const fakeConsole = fakeConsoleProducer();

    const logger = fakeLoggerProducer({fakeDgram, fakeConsole});
    logger(commonLoggingEvent);

    assert.strictEqual(fakeConsole.messageStore.length, 1);
    const actualErrorMessage = fakeConsole.messageStore[0];
    assert.ok(actualErrorMessage.startsWith('log4js.logstashUDP - 127.0.0.1:10001 Error: '));
    assert.ok(actualErrorMessage.indexOf(errorMessage) >= 0);
  });

  it('default options', () => {
    const fakeDgram = fakeDgramProducer();
    const defaultLayouts = fakeDefaultLayoutsProducer();

    const logger = fakeLoggerProducer({fakeDgram, fakeLayouts: defaultLayouts});
    logger(commonLoggingEvent);

    assert.strictEqual(defaultLayouts.status.isUsed, true);
    assert.strictEqual(fakeDgram.messageStore.length, 1);
    const messageSent = fakeDgram.messageStore[0];
    const json = JSON.parse(messageSent.buffer.toString());
    assert.strictEqual(json['@version'], 1, 'Default version is not 1.');
    const date = new Date();
    assert.strictEqual(json['@timestamp'], commonLoggingEvent.startTime);
    assert.ok(json.host);
    assert.strictEqual(json.level, 'TRACE');
    assert.strictEqual(json.category, commonLoggingEvent.categoryName);
    assert.strictEqual(json.message, commonLoggingEvent.data[0]);
    assert.ok(_.isEqual(json.fields, commonLoggingEvent.data[1]));
  });

  it('using a custom layout', () => {
    const fakeMessage = 'I used a custom layout';
    let isCustomizedLayoutUsed = false;
    const defaultLayouts = _.assign({}, fakeDefaultLayoutsProducer(), {
      layout: function (type, config) {
        isCustomizedLayoutUsed = true;
        return () => fakeMessage;
      }
    });
    const fakeConfig = _.assign({}, fakeDefaultConfig, {
      layout: {
        type: 'pattern',
        pattern: '%m'
      }
    });
    const fakeDgram = fakeDgramProducer();

    const logger = fakeLoggerProducer({fakeConfig, fakeDgram, fakeLayouts: defaultLayouts});
    logger(commonLoggingEvent);

    assert.strictEqual(defaultLayouts.status.isUsed, false);
    assert.strictEqual(isCustomizedLayoutUsed, true);
    assert.strictEqual(fakeDgram.messageStore.length, 1);
    const messageSent = fakeDgram.messageStore[0];
    const json = JSON.parse(messageSent.buffer.toString());
    assert.strictEqual(json.message, fakeMessage);
  });

  it('produce the right logObject according to the extraDataProvider', () => {
    const fakeConfig = _.assign({}, fakeDefaultConfig, {
      extraDataProvider: loggingEvent => ({
        host: 'anotherHostname',
        clientIp: '1.2.3.4',
        fields: {
          tag: 'myTag',
          pid: loggingEvent.pid,
          cheese: 'defaultCheese'
        }
      })
    });
    const fakeDgram = fakeDgramProducer();

    const logger = fakeLoggerProducer({fakeConfig, fakeDgram});
    const loggingEvent = _.assign({}, commonLoggingEvent);
    loggingEvent.data[1] = {cheese: 'gouda', biscuits: 'hobnob'};
    logger(loggingEvent);

    assert.strictEqual(fakeDgram.messageStore.length, 1);
    const messageSent = fakeDgram.messageStore[0];
    const json = JSON.parse(messageSent.buffer.toString());

    assert.strictEqual(json.host, 'anotherHostname');
    assert.strictEqual(json.clientIp, '1.2.3.4');
    assert.strictEqual(json.fields.tag, 'myTag');
    assert.ok(json.fields.pid);
    assert.strictEqual(json.fields.cheese, 'defaultCheese');
  });

  it('will ignore the extraDataProvider which is not a function and behave as the default', () => {

    const fakeConfig = _.assign({}, fakeDefaultConfig, {
      extraDataProvider: {}
    });
    const fakeDgram = fakeDgramProducer();

    const logger = fakeLoggerProducer({fakeConfig, fakeDgram});
    const loggingEvent = _.assign({}, commonLoggingEvent);
    loggingEvent.data[1] = {cheese: 'gouda', biscuits: 'hobnob'};
    logger(loggingEvent);

    assert.strictEqual(fakeDgram.messageStore.length, 1);
    const messageSent = fakeDgram.messageStore[0];
    const json = JSON.parse(messageSent.buffer.toString());
    assert.ok(_.isEqual(json.fields, loggingEvent.data[1]));
  });

  it('shutdown should close sockets', () => {
    const fakeDgram = fakeDgramProducer();
    const logger = fakeLoggerProducer({fakeDgram});
    logger.shutdown(() => {
      assert.ok(fakeDgram.socket.closed);
    });
  });

  it('should not crash on events with circular references', () => {
    const circularEvent = _.assign({}, commonLoggingEvent, {data: []});
    circularEvent.data[0] = circularEvent;

    const fakeDgram = fakeDgramProducer();
    const fakeConsole = fakeConsoleProducer();

    const logger = fakeLoggerProducer({fakeDgram, fakeConsole});
    logger(circularEvent);
    logger(commonLoggingEvent);

    const messageSent = fakeDgram.messageStore[0];
    let json = JSON.parse(messageSent.buffer.toString());
    assert.strictEqual(json.level, 'TRACE');
    assert.strictEqual(json.category, commonLoggingEvent.categoryName);
    assert.ok(
      json.message.data[0].indexOf(
        'Event could not be serialised to JSON: Converting circular structure to JSON'
      ) > -1
    );

    const normalMessage = fakeDgram.messageStore[1];
    json = JSON.parse(normalMessage.buffer.toString());
    assert.strictEqual(json.level, 'TRACE');
    assert.equal(json.message, commonLoggingEvent.data[0]);

  });
});
