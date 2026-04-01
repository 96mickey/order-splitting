import express from 'express';
import bodyParser from 'body-parser';
import compress from 'compression';
import methodOverride from 'method-override';
import cors from 'cors';
import helmet from 'helmet';
import routes from '../api/routes';
import { requestContext } from '../api/middlewares/request-context';
import { httpRequestLogger } from '../api/middlewares/http-log';
import { apiRateLimiter, globalRateLimiter } from './rate-limit';
import { corsConfig, rateLimitConfig, serverConfig } from './vars';
import * as error from '../api/middlewares/error';

const app = express();

if (serverConfig.trustProxy) {
  app.set('trust proxy', 1);
}

app.use(requestContext);
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(httpRequestLogger);
// Skip compressing tiny JSON responses (threshold in bytes) — often faster than gzip overhead.
app.use(compress({ threshold: 1024 }));
app.use(methodOverride());
app.use(helmet({ contentSecurityPolicy: false }));
if (corsConfig.enabled) {
  app.use(cors({ origin: corsConfig.origin, credentials: corsConfig.credentials }));
}
if (rateLimitConfig.enabled && rateLimitConfig.scope === 'global') {
  app.use(globalRateLimiter);
}
if (rateLimitConfig.enabled && rateLimitConfig.scope === 'api') {
  app.use('/api', apiRateLimiter);
}

app.use(routes);

app.use(error.validationError);
app.use(error.converter);
app.use(error.notFound);
app.use(error.handler);

export default app;
