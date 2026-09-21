import { UserRole } from '../enums/user-role.enum';

/** Shape attached to request.user by JwtStrategy.validate(). */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}
