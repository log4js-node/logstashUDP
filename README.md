# Log4JS - Logstash UDP appender

This is an optional appender for [log4js-node](https://log4js-node.github.io/log4js-node/).
```bash
npm install @log4js-node/logstashudp
```

The logstashUDP appender supports sending log events to a [Logstash](https://www.elastic.co/products/logstash) server. It uses the node.js core UDP support, and so requires no extra dependencies. Remember to call `log4js.shutdown` in your application if you want the UDP socket closed cleanly.

## Configuration

* `type` - `@log4js-node/logstashudp`
* `host` - `string` - hostname (or IP-address) of the logstash server
* `port` - `integer` - port of the logstash server
* `layout` - (optional, defaults to dummyLayout) - used for the message field of the logstash data (see layouts)
* `extraDataProvider` - function (optional, defaults to put the second param of log to fields) - used to enhance the object sent to Logstash via UDP. this will be passed the log event and should return a object.

## Example
### default config
```javascript
log4js.configure({
  appenders: {
    logstash: {
      type: '@log4js-node/logstashudp',
      host: 'log.server',
      port: 12345
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
  'host': 'yourHostname',
  'level': 'INFO',
  'category': 'default',
  'message': 'important log message',
  'fields': {
    'biscuits': 'hobnob',
    'cheese': 'gouda'
  }
}
```
### use estraDataProvider
```javascript
log4js.configure({
  appenders: {
    logstash: {
      type: '@log4js-node/logstashudp',
      host: 'log.server',
      port: 12345,
      extraDataProvider: loggingEvent => ({
        host: 'anotherHostname',  // this will replace the default real host
        clientIp: '1.2.3.4', // this will be added
        fields: {
          tag: 'myTag', // this will be added to the fields
          pid: loggingEvent.pid, // this will be added to the fields
          cheese: 'defaultCheese' // this will be added to the fields but will not be replaced in this example
        }
      })
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
  'host': 'anotherHostname',
  'level': 'INFO',
  'category': 'default',
  'message': 'important log message',
  'clientIp': '1.2.3.4',
  'fields': {
    'cheese': 'defaultCheese',
    'tag': 'myTag',
    'pid': 123
  }
}
```
So, if not using the default `extraDataProvider`, you have to put the second param of the log to the fields yourself if you want.
