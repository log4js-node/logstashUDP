# Log4JS - Logstash UDP appender

This is an optional appender for [log4js-node](https://log4js-node.github.io/log4js-node/).
```bash
npm install @log4js-node/logstashUDP
```

The logstashUDP appender supports sending log events to a [Logstash](https://www.elastic.co/products/logstash) server. It uses the node.js core UDP support, and so requires no extra dependencies. Remember to call `log4js.shutdown` in your application if you want the UDP socket closed cleanly.

## Configuration

* `type` - `@log4js-node/logstashUDP`
* `host` - `string` - hostname (or IP-address) of the logstash server
* `port` - `integer` - port of the logstash server
* `logType` - `string` (optional) - used for the type field in the logstash data
* `category` - `string` (optional) - used for the type field of the logstash data if logType is not defined
* `fields` - object (optional) - extra fields to log with each event. User-defined fields can be either a string or a function. Functions will be passed the log event, and should return a string.
* `layout` - (optional, defaults to dummyLayout) - used for the message field of the logstash data (see layouts)
* `args` - (optional, defaults to both) - determines how to log arguments and configuration fields: direct logs them as direct properties of the log object, fields logs them as child properties of the fields property, and both logs both.

## Example (default config)
```javascript
log4js.configure({
  appenders: {
    logstash: {
      type: '@log4js-node/logstashUDP',
      host: 'log.server',
      port: '12345',
      logType: 'application',
      fields: { biscuits: 'digestive', tea: 'tetley', user: function(logEvent) {
          return AuthLibrary.currentUser();
        }
      }
    }
  },
  categories: {
    default: { appenders: ['logstash'], level: 'info' }
  }
});
const logger = log4js.getLogger();
logger.info("important log message", { cheese: 'gouda', biscuits: 'hobnob' });
```
This will result in a JSON message being sent to log.server:12345 over UDP, with the following format:
```javascript
{
  '@version': '1',
  '@timestamp': '2014-04-22T23:03:14.111Z',
  'type': 'application',
  'message': 'important log message',
  'fields': {
    'level': 'INFO',
    'category': 'default',
    'biscuits': 'hobnob',
    'user': 'charlie',
    'cheese': 'gouda',
    'tea': 'tetley'
  }
}
```
