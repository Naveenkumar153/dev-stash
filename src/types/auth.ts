/** The signed-in user as the sidebar displays it. */
export interface SessionUser {
  name: string;
  email: string;
  image: string | null;
}

/** Body returned by `POST /api/auth/register`. */
export interface RegisterResponse {
  success: boolean;
  data: { id: string; name: string; email: string } | null;
  error: string | null;
}
