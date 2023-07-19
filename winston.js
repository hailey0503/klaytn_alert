const DiscordTransport = require('winston-discord-transport').default;
require("dotenv").config();
const appRootPath = require('app-root-path');
const winston = require('winston');
const { format } = require('winston');
const path = require('path');
const { toString: appRoot } = appRootPath;

const formatMeta = (meta) => {
  // You can format the splat yourself
  const splat = meta[Symbol.for('splat')];
  if (splat && splat.length) {
    return splat.length === 1 ? JSON.stringify(splat[0]) : JSON.stringify(splat);
  }
  return '';
};

const customFormat = winston.format.printf(({
  timestamp,
  level,
  message,
  label = '',
  ...meta
}) => `[${timestamp}] ${level}\t ${label} ${message} ${formatMeta(meta)}`);

const customJSONFormat = winston.format.json(({
    timestamp,
    level,
    message,
    label = '',
    ...meta
  }) => {
      return {
          timestamp: timestamp,
          level: level,
          message: message,
          label: label,
          meta: formatMeta(meta)
      }
  });

// define the custom settings for each transport (file, console)
const options = {
  file: {
    level: 'info',
    filename: path.join(appRoot(), 'logs', 'delegator.log'),
    handleExceptions: true,
    //json: true,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    colorize: false,
    format: format.combine(
        format.timestamp({format: 'MMM D, YYYY HH:mm'}),  
        customJSONFormat,  
    )
  },
  console: {
    level: 'debug',
    handleExceptions: true,
    json: false,
//    colorize: true,
    format: format.combine(
      format.colorize(),
      format.timestamp({format: 'MMM D, YYYY HH:mm'}),  
      customFormat
    )
  },
};

// instantiate a new Winston Logger with the settings defined above
const logger = winston.createLogger({
  transports: [
    new winston.transports.File(options.file),
	new winston.transports.Console(options.console),
	new DiscordTransport({
		webhook: process.env.discordURL,
		defaultMeta: { service: 'my_kimchi_service' },
		level: 'warn'
	  })
  ],
  exitOnError: false, // do not exit on handled exceptions
});

logger.log({
	level: 'error',
	message: 'Error intializing service',
	meta: {
	  additionalKey: 'someValue'
	},
	error: new Error()
  });
  

// create a stream object with a 'write' function that will be used by `morgan`
logger.stream = {
//  write: logger.info,
  write: function(message, encoding) { // eslint-disable-line no-unused-vars
    // use the 'info' log level so the output will be picked up by both transports (file and console)
    logger.info(message);
  },
};

module.exports = logger
