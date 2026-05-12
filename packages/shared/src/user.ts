export interface PublicUser {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  image?: string | null;
}

export interface User extends PublicUser {
  createdAt: string;
  updatedAt: string;
}
