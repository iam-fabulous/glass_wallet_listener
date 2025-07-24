"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel["INFO"] = "INFO";
    LogLevel["WARN"] = "WARN";
    LogLevel["ERROR"] = "ERROR";
    LogLevel["DEBUG"] = "DEBUG";
})(LogLevel || (LogLevel = {}));
function log(level, message, ...args) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`, ...args);
}
exports.logger = {
    info: (message, ...args) => log(LogLevel.INFO, message, ...args),
    warn: (message, ...args) => log(LogLevel.WARN, message, ...args),
    error: (message, ...args) => log(LogLevel.ERROR, message, ...args),
    debug: (message, ...args) => log(LogLevel.DEBUG, message, ...args),
};
