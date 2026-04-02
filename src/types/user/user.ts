// src/types/user/user.ts
export interface UserInfo {
  id: string;
  userId: string;
  username: string;
  email: string;
  is_staff: boolean;
  avatar: string;
  bio: string;
  created_at: string;
  updated_at?: string;
  gender?: string;
  is_private?: boolean;
}
