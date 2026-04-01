import express from 'express';
import { celebrate as validate } from 'celebrate';
import { getConfig, patchConfig } from '../controllers/config.controller';
import { patchConfigBody } from '../validations/config.validation';

const router = express.Router();

router.get('/config', getConfig);
router.patch('/config', validate(patchConfigBody), patchConfig);

export default router;
