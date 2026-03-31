import { Joi, Segments } from 'celebrate';

const email = Joi.string().email().required();
const password = Joi.string().min(8).max(128).required();

export const register = {
  [Segments.BODY]: Joi.object({
    email,
    password,
    first_name: Joi.string().max(128).allow('', null),
    last_name: Joi.string().max(128).allow('', null),
  }),
};

export const login = {
  [Segments.BODY]: Joi.object({ email, password }),
};
