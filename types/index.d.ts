// Some types refer to https://github.com/log4js-node/log4js-node/blob/master/types/log4js.d.ts
export interface LogstashUDPAppender {
    'type': '@log4js-node/logstashUDP';
    // hostname (or IP-address) of the logstash server
    host: string;
    // port of the logstash server
    port: number;
    // used for the message field of the logstash data
    // the layout should be the `Layout` type in log4js
    layout?: object;
    // used to customize the log object being sent to logstash UDP server
    // the event should be the `LoggingEvent` type in log4s
    extraDataProvider?: (event: object) => object;
}
