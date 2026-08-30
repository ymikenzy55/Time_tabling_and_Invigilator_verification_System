import { invalidateAuthCache } from '../../middleware/auth.js';

export const normalizeDepartmentName = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed.length ? trimmed : null;
};

export const buildDepartmentCode = (name) => {
  const cleaned = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.slice(0, 3))
    .join('')
    .slice(0, 8);
  if (cleaned.length >= 2) return cleaned;
  return `DEPT${Math.random().toString(36).toUpperCase().slice(-4)}`;
};

export const ensureDepartmentForName = async (tx, normalizedName) => {
  const name = normalizeDepartmentName(normalizedName);
  if (!name) return null;

  let department = await tx.department.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true, name: true, code: true },
  });

  if (department) return department;

  const baseCode = buildDepartmentCode(name);

  let candidate = baseCode;
  let attempt = 1;
  while (await tx.department.findUnique({ where: { code: candidate } })) {
    attempt += 1;
    candidate = `${baseCode}${attempt}`.slice(0, 10);
  }

  try {
    department = await tx.department.create({
      data: {
        name,
        code: candidate,
      },
      select: { id: true, name: true, code: true },
    });
  } catch (err) {
    // P2002: another request created the same department concurrently — reuse it.
    if (err?.code === 'P2002') {
      department = await tx.department.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
        select: { id: true, name: true, code: true },
      });
      if (department) return department;
    }
    throw err;
  }

  return department;
};

export const linkDepartmentToUser = async (tx, user, { select, departmentNameOverride } = {}) => {
  const sourceName = departmentNameOverride ?? user?.departmentName;
  const normalized = normalizeDepartmentName(sourceName);
  if (!normalized || !user?.id) {
    return { department: null, updatedUser: null, normalized }; // nothing to do
  }

  const department = await ensureDepartmentForName(tx, normalized);
  if (!department) {
    return { department: null, updatedUser: null, normalized };
  }

  if (user.departmentId === department.id && user.departmentName === department.name) {
    return { department, updatedUser: null, normalized };
  }

  const updateArgs = {
    where: { id: user.id },
    data: {
      departmentId: department.id,
      departmentName: department.name,
    },
  };

  if (select) updateArgs.select = select;

  const updatedUser = await tx.user.update(updateArgs);
  invalidateAuthCache(user.id);

  return { department, updatedUser, normalized };
};
