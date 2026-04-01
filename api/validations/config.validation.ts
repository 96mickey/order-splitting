import { Joi, Segments } from 'celebrate';

/** PATCH /config — only maxDecimalPlaces may change at runtime.
 * Range 0–10 is enforced in `setMaxDecimalPlaces` so INVALID_PRECISION is returned per spec.
 */
export const patchConfigBody = {
  [Segments.BODY]: Joi.object({
    maxDecimalPlaces: Joi.number().integer().strict().required(),
  }),
};
