/** The signed-in user as the sidebar displays it. */
export interface SessionUser {
  name: string;
  email: string;
  image: string | null;
}

/** Body returned by `POST /api/auth/register`. */
export interface RegisterResponse {
  success: boolean;
  data: {
    id: string;
    name: string;
    email: string;
    /** False while email verification is switched off; the user can sign in now. */
    verificationRequired: boolean;
  } | null;
  error: string | null;
}
