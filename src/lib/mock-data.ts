// Mock user for the sidebar's user area. Replaced by the session once NextAuth lands.

export interface User {
  id: string;
  name: string;
  email: string;
  image?: string;
  isPro: boolean;
}

export const currentUser: User = {
  id: "user-1",
  name: "John Doe",
  email: "john@example.com",
  isPro: false,
};
