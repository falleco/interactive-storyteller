export const PARENT_ROLES = ['mom', 'dad', 'guardian', 'other'] as const;
export type ParentRole = (typeof PARENT_ROLES)[number];

export const PARENT_ROLE_LABELS: Record<ParentRole, string> = {
  mom: 'Mom',
  dad: 'Dad',
  guardian: 'Guardian',
  other: 'Other',
};

/**
 * The current parent/account holder's profile. `image` comes from the
 * social login (OAuth avatar); `profileImageUrl` is the user-uploaded
 * picture and takes precedence wherever both are available.
 */
export interface ParentProfile {
  id: string;
  email: string;
  name: string;
  image: string | null;
  age: number | null;
  parentRole: ParentRole | null;
  profileImageUrl: string | null;
}

export interface UpdateParentInput {
  name?: string;
  age?: number;
  parentRole?: ParentRole | null;
}
