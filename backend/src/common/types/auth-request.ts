/** Shape of `request.user` attached by JwtStrategy.validate() */
export interface AuthUser {
  userId?: number;
  email?: string;
  accountNumber?: string;
  role?: string;
  fullName?: string;
  guichet?: string;
}

/** Minimal authenticated request shape used in controllers (@Req) */
export interface AuthenticatedRequest {
  user?: AuthUser;
}
