/* eslint-disable camelcase */
import bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import {
  Request, Response, NextFunction,
} from 'express';
import { bcryptRounds, defaultRoleName } from '../../config/vars';
import { getAppModels } from '../../db/models';
import APIError from '../utils/APIError';
import { toPublicUser } from '../helpers/auth.helpers';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { User, Role } = getAppModels();
    const { email, password, first_name, last_name } = req.body;
    const normalizedEmail = String(email).toLowerCase();

    const existing = await User.findOne({ where: { email: normalizedEmail } });
    if (existing) throw new APIError({ message: 'Email already registered', status: httpStatus.CONFLICT });

    const role = await Role.findOne({ where: { name: defaultRoleName } });
    if (!role) {
      throw new APIError({ message: 'Default role missing. Run database migrations.', status: httpStatus.INTERNAL_SERVER_ERROR });
    }

    const password_hash = await bcrypt.hash(password, bcryptRounds);
    const user = await User.create({
      email: normalizedEmail,
      password_hash,
      first_name: first_name || null,
      last_name: last_name || null,
      role_id: role.id,
    });

    const withRole = await User.findByPk(user.id, { include: [{ model: Role, as: 'Role' }] });
    if (!withRole) {
      throw new APIError({ message: 'User not found after create', status: httpStatus.INTERNAL_SERVER_ERROR });
    }
    if (!withRole.Role) {
      throw new APIError({ message: 'Role not loaded', status: httpStatus.INTERNAL_SERVER_ERROR });
    }
    const token = withRole.issueAccessToken(withRole.Role);
    return res.status(httpStatus.CREATED).json({ user: toPublicUser(withRole), token });
  } catch (error) {
    return next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { User, Role } = getAppModels();
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email: String(email).toLowerCase() }, include: [{ model: Role, as: 'Role' }] });
    if (!user) throw new APIError({ message: 'Invalid email or password', status: httpStatus.UNAUTHORIZED });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) throw new APIError({ message: 'Invalid email or password', status: httpStatus.UNAUTHORIZED });

    if (!user.Role) {
      throw new APIError({ message: 'Role not loaded', status: httpStatus.INTERNAL_SERVER_ERROR });
    }
    const token = user.issueAccessToken(user.Role);
    return res.json({ user: toPublicUser(user), token });
  } catch (error) {
    return next(error);
  }
};

export const me = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    next(new APIError({ message: 'Unauthorized', status: httpStatus.UNAUTHORIZED }));
    return;
  }
  res.json({ user: toPublicUser(req.user) });
};
