// Type definitions for LogstashUDP Appender for log4js
import * as log4js from "log4js";

declare module 'log4js' {
    interface Logger {
        trace(logstashUDPData: LogstashUDP, message: string, ...args: any[]): void;
        debug(logstashUDPData: LogstashUDP, message: string, ...args: any[]): void;
        info(logstashUDPData: LogstashUDP, message: string, ...args: any[]): void;
        warn(logstashUDPData: LogstashUDP, message: string, ...args: any[]): void;
        error(logstashUDPData: LogstashUDP, message: string, ...args: any[]): void;
        fatal(logstashUDPData: LogstashUDP, message: string, ...args: any[]): void;
    }
}

export interface LogstashUDP {
    LogstashUDP: Boolean,
    [key: string]: any
}

export interface LogstashUDPAppender {
    'type': '@log4js-node/logstashUDP';
    // hostname (or IP-address) of the logstash server
    host: string;
    // port of the logstash server
    port: number;
    // used for the type field in the logstash data
    logType?: string;
    // used for the type field of the logstash data if logType is not defined
    category?: string;
    // extra fields to log with each event. User-defined fields can be either a string or a function.
    // Functions will be passed the log event, and should return a string.
    fields?: object;
    // used for the message field of the logstash data
    layout?: object;
    // determines how to log arguments and configuration fields:
    // direct logs them as direct properties of the log object, fields logs them as
    // child properties of the fields property, and both logs both.
    args?: string;
}