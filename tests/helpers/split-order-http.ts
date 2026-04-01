/** POST body includes `meta`; persisted GET body does not — compare with this. */
export function stripPostMeta(body: Record<string, unknown>): Record<string, unknown> {
  const { meta: _meta, ...rest } = body;
  return rest;
}
