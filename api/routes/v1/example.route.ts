import express from 'express';
import { ping } from '../../controllers/example.controller';

const router = express.Router();

router.get('/ping', ping);

export default router;
