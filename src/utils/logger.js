const { createLogger, format, transports } = require('winston');
const path = require('path');
const config = require('../config');

const { combine, timestamp, printf, colorize, errors } = format;

const logFormat = printf(({ timestamp: ts, level, message, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
  const stackStr = stack ? `\n${stack}` : '';
  return `${ts} [${level}] ${message} ${metaStr}${stackStr}`;
});

const logger = createLogger({
  level: config.logLevel,
  format: combine(
    timestamp(),
    errors({ stack: true }),
    logFormat
  ),
  transports: [
    new transports.File({ filename: path.join(__dirname, '../../logs/error.log'), level: 'error' }),
    new transports.File({ filename: path.join(__dirname, '../../logs/combined.log') }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: combine(colorize(), logFormat),
  }));
}

module.exports = logger;