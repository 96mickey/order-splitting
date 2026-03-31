import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { jwtConfig } from './vars';
import { getAppModels } from '../db/models';
import type { AccessTokenPayload } from '../types/jwt';

const jwtOptions = {
  secretOrKey: jwtConfig.secret,
  issuer: jwtConfig.issuer,
  audience: jwtConfig.audience,
  jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme('JWT'),
};

const jwtVerify = async (
  payload: AccessTokenPayload,
  done: (err: Error | null, user?: unknown | false) => void,
) => {
  try {
    const { User, Role } = getAppModels();
    const rawSub = payload.sub;
    const id = typeof rawSub === 'string' ? Number.parseInt(rawSub, 10) : rawSub;
    if (Number.isNaN(id)) {
      return done(null, false);
    }
    const user = await User.findByPk(id, {
      include: [{ model: Role, as: 'Role' }],
    });
    if (!user || !user.is_active) {
      return done(null, false);
    }
    return done(null, user);
  } catch (error) {
    return done(error as Error, false);
  }
};

export const jwt = new JwtStrategy(jwtOptions, jwtVerify);
