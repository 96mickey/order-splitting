import express from 'express';
import { celebrate as validate } from 'celebrate';
import * as controller from '../../controllers/auth.controller';
import { authorize } from '../../middlewares/auth';
import { register, login } from '../../validations/auth.validation';

const router = express.Router();

router.post('/register', validate(register, { allowUnknown: true }), controller.register);
router.post('/login', validate(login, { allowUnknown: true }), controller.login);
router.get('/me', ...authorize(), controller.me);

export default router;
