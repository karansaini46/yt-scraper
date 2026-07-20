import pino from 'pino';
import { config } from './config';

export const logger = pino({
  level: config.NODE_ENV === 'development' ? 'debug' : 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
});
