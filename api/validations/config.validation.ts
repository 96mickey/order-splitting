import { Joi, Segments } from 'celebrate';

/** PATCH /config — only maxDecimalPlaces may change at runtime. */
export const patchConfigBody = {
  [Segments.BODY]: Joi.object({
    maxDecimalPlaces: Joi.number()
      .integer()
      .min(0)
      .max(10)
      .required(),
  }),
};
