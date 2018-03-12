// There is something wrong in the log4js.configuration to cause Math not found if import all lodash here
const _ = require('lodash/core');
const debug = require('debug')('log4js:logstashUDP');
const dgram = require('dgram');
const util = require('util');

function sendLog(udp, host, port, logObject) {
  debug('Log being sent over UDP');
  const buffer = Buffer.from(JSON.stringify(logObject));

  udp.send(buffer, 0, buffer.length, port, host, err => {
    if (err) {
      console.error(`log4js.logstashUDP - ${host}:${port} Error: ${util.inspect(err)}.`);
    }
  });
}

function checkArgs(argsValue, logUnderFields) {
  if ((!argsValue) || (argsValue === 'both')) {
    return true;
  }

  if (logUnderFields && (argsValue === 'fields')) {
    return true;
  }

  if ((!logUnderFields) && (argsValue === 'direct')) {
    return true;
  }
}

function logstashUDP(config, layout) {
  const udp = dgram.createSocket('udp4');
  const type = config.logType ? config.logType : config.category;

  if (!config.fields) {
    config.fields = {};
  }

  /*
  https://gist.github.com/jordansissel/2996677
  {
  'message'  => 'hello world',
  '@version'  => '1',
  '@timestamp' => '2014-04-22T23:03:14.111Z',
  'type'    => 'stdin',
  'host'    => 'hello.local'
  }
  @timestamp is the ISO8601 high-precision timestamp for the event.
  @version is the version number of this json schema
  Every other field is valid and fine.
  */
  function log(loggingEvent) {
    const fields = {};
    _.keys(config.fields).forEach(key => {
      fields[key] = typeof config.fields[key] === 'function'
        ? config.fields[key](loggingEvent)
        : config.fields[key];
    });

    if (loggingEvent.data.length > 1) {
      const secondEvData = loggingEvent.data[1];
      if ((secondEvData !== undefined) && (secondEvData !== null)) {
        _.keys(secondEvData).forEach(key => {
          fields[key] = secondEvData[key];
        });
      }
    }
    fields.level = loggingEvent.level.levelStr;
    fields.category = loggingEvent.categoryName;

    const logObject = {
      '@version': '1',
      '@timestamp': (new Date(loggingEvent.startTime)).toISOString(),
      type: type,
      message: layout(loggingEvent)
    };

    if (checkArgs(config.args, true)) {
      logObject.fields = fields;
    }

    if (checkArgs(config.args, false)) {
      _.forEach(fields, (value, key) => logObject[key] = value);
    }

    sendLog(udp, config.host, config.port, logObject);
  }

  log.shutdown = function (cb) {
    udp.close(cb);
  };

  debug('Appender set and returned.');
  return log;
}

function configure(config, layouts) {
  let layout = layouts.dummyLayout;
  if (config.layout) {
    layout = layouts.layout(config.layout.type, config.layout);
  }
  return logstashUDP(config, layout);
}

module.exports.configure = configure;
