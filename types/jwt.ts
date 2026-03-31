/**
 * Claims we embed in access tokens (`sub` may be number or string per JWT/jsonwebtoken).
 */
export interface AccessTokenPayload {
  sub: number | string;
  email: string;
  role: string;
}
