import { prisma } from '../../utils/prisma.js';
import { verifyPassword } from '../../utils/password.js';
import { signAccessToken } from '../../utils/jwt.js';
import { ApiError } from '../../utils/ApiError.js';
import { courseLevelsService } from '../courseLevels/courseLevels.service.js';
import { linkDepartmentToUser } from '../departments/departmentAutoLink.js';
import { logAudit } from '../../utils/auditLog.js';
import bcrypt from 'bcryptjs';

const GENERIC_LOGIN_ERROR = 'The email or password you entered is incorrect.';

// Pre-computed dummy hash for timing-attack mitigation on user-not-found.
const DUMMY_HASH = bcrypt.hashSync('dummy', 10);

export const authService = {
  async login({ email, password, ipAddress, userAgent }) {
    const user = await prisma.user.findUnique({ where: { email } });

    // Generic error for the "user not found" / "wrong password" branches
    // to avoid leaking which one failed. Run a dummy bcrypt compare when
    // the user doesn't exist so both branches take similar time.
    if (!user || !user.passwordHash) {
      await verifyPassword(password, DUMMY_HASH);
      logAudit({
        action: 'USER.LOGIN',
        result: 'FAILURE',
        metadata: { email, reason: 'INVALID_CREDENTIALS' },
        ipAddress,
        userAgent,
      });
      throw ApiError.unauthorized(GENERIC_LOGIN_ERROR);
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      logAudit({
        actorId: user.id,
        action: 'USER.LOGIN',
        result: 'FAILURE',
        metadata: { reason: 'INVALID_CREDENTIALS' },
        ipAddress,
        userAgent,
      });
      throw ApiError.unauthorized(GENERIC_LOGIN_ERROR);
    }

    // Status-specific, friendly messages
    switch (user.status) {
      case 'ACTIVE': break;
      case 'INVITED':
        throw ApiError.forbidden('Please complete your account activation before signing in.');
      case 'PENDING_APPROVAL':
        throw ApiError.forbidden('Your account is awaiting administrator approval.');
      case 'SUSPENDED':
        throw ApiError.forbidden('Your account has been suspended. Please contact the administrator.');
      case 'DISABLED':
        throw ApiError.forbidden('Your account has been disabled. Please contact the administrator.');
      case 'REJECTED':
        throw ApiError.forbidden('Your account request was not approved.');
      default:
        throw ApiError.forbidden('Your account is not active.');
    }

    let hydratedUser = user;

    if (user.role === 'DEPARTMENT_HEAD') {
      // Department linkage and default levels are conveniences — they must
      // never block a valid login if they fail (e.g. transient DB issues).
      try {
        const { department, updatedUser } = await linkDepartmentToUser(prisma, user, {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            status: true,
            departmentId: true,
            departmentName: true,
          },
        });

        if (updatedUser) {
          hydratedUser = { ...hydratedUser, ...updatedUser };
        } else if (department && (!hydratedUser.departmentId || hydratedUser.departmentId !== department.id)) {
          hydratedUser = {
            ...hydratedUser,
            departmentId: department.id,
            departmentName: department.name,
          };
        }

        if (department?.id) {
          await courseLevelsService.ensureDefaultsForDepartment(department.id);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Login side-effect failed (department link / default levels):', err.message);
      }
    }

    const token = signAccessToken({ sub: hydratedUser.id, role: hydratedUser.role });

    logAudit({
      actorId: hydratedUser.id,
      action: 'USER.LOGIN',
      result: 'SUCCESS',
      ipAddress,
      userAgent,
    });

    return {
      token,
      user: {
        id: hydratedUser.id,
        email: hydratedUser.email,
        fullName: hydratedUser.fullName,
        role: hydratedUser.role,
        status: hydratedUser.status,
        departmentId: hydratedUser.departmentId,
        departmentName: hydratedUser.departmentName,
        isDemo: hydratedUser.isDemo || false,
      },
    };
  },

  async me(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        departmentId: true,
        departmentName: true,
        staffId: true,
        phone: true,
        createdAt: true,
        isDemo: true,
      },
    });
    if (!user) throw ApiError.notFound('User not found.');
    return user;
  },
};
