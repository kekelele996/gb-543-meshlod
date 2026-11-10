export const ROLES = ['admin', 'artist', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: '管线负责人',
  artist: '模型师',
  viewer: '引擎组',
};

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}
