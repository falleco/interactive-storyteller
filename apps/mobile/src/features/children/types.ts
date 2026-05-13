export interface ChildProfile {
  id: string;
  userId: string;
  name: string;
  age: number;
  gender: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChildInput {
  name: string;
  age: number;
  gender?: string;
  imageUrl?: string;
}

export type UpdateChildInput = Partial<CreateChildInput>;
