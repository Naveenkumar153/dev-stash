/** The signed-in user as the sidebar displays it. */
export interface SessionUser {
  name: string;
  email: string;
  image: string | null;
  /** The stored subscription state, read with the rest of the row. */
  isPro: boolean;
}

/** Body returned by `POST /api/auth/register`. */
export interface RegisterResponse {
  success: boolean;
  /**
   * No account id: while verification is on, an email that already has an
   * account gets this same reply, and there's no id to give it.
   */
  data: {
    name: string;
    email: string;
    /** False while email verification is switched off; the user can sign in now. */
    verificationRequired: boolean;
  } | null;
  error: string | null;
}
