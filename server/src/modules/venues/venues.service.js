import { prisma } from '../../utils/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { logAudit } from '../../utils/auditLog.js';
import { cache } from '../../utils/cache.js';

const clearVenuesCache = () => {
  cache.clearPrefix('venues:');
};

export const venuesService = {
  async list({ activeOnly } = {}) {
    const cacheKey = `venues:list:${activeOnly ? 'active' : 'all'}`;
    return cache.remember(cacheKey, 60_000, async () =>
      prisma.venue.findMany({
        where: activeOnly ? { isActive: true } : undefined,
        orderBy: [{ createdAt: 'desc' }],
      })
    );
  },

  async getById(id) {
    const venue = await prisma.venue.findUnique({ where: { id } });
    if (!venue) throw ApiError.notFound('Venue not found.');
    return venue;
  },

  async create(payload, actor) {
    const existing = await prisma.venue.findUnique({ where: { name: payload.name } });
    if (existing) throw ApiError.badRequest('A venue with this name already exists.');

    const venue = await prisma.venue.create({
      data: {
        name: payload.name,
        capacity: payload.capacity,
        location: payload.location || null,
        isActive: payload.isActive ?? true,
      },
    });

    logAudit({
      actorId: actor.id,
      action: 'VENUE.CREATE',
      targetType: 'Venue',
      targetId: venue.id,
      result: 'SUCCESS',
      metadata: { name: venue.name, capacity: venue.capacity },
    });

    clearVenuesCache();
    return venue;
  },

  async bulkImport(venues, actor) {
    if (!Array.isArray(venues) || venues.length === 0) {
      throw ApiError.badRequest('No venues to import.');
    }

    // De-duplicate within the payload (case-insensitive by name)
    const seen = new Map();
    for (const v of venues) {
      const key = v.name.trim().toLowerCase();
      if (!seen.has(key)) seen.set(key, v);
    }
    const unique = [...seen.values()];

    // Find which names already exist
    const existing = await prisma.venue.findMany({
      where: { name: { in: unique.map((v) => v.name.trim()), mode: 'insensitive' } },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((v) => v.name.toLowerCase()));

    const toCreate = unique.filter((v) => !existingNames.has(v.name.trim().toLowerCase()));
    const skipped = unique.length - toCreate.length;

    let created = [];
    if (toCreate.length > 0) {
      created = await prisma.$transaction(
        toCreate.map((v) => prisma.venue.create({
          data: {
            name: v.name.trim(),
            capacity: v.capacity,
            location: v.location?.trim() || null,
            isActive: v.isActive ?? true,
          },
        }))
      );
    }

    logAudit({
      actorId: actor.id,
      action: 'VENUE.BULK_IMPORT',
      targetType: 'Venue',
      targetId: 'bulk',
      result: 'SUCCESS',
      metadata: { created: created.length, skipped },
    });

    clearVenuesCache();
    return { created, skipped, total: venues.length };
  },

  async update(id, payload, actor) {
    const venue = await prisma.venue.findUnique({ where: { id } });
    if (!venue) throw ApiError.notFound('Venue not found.');

    if (payload.name && payload.name !== venue.name) {
      const clash = await prisma.venue.findUnique({ where: { name: payload.name } });
      if (clash) throw ApiError.badRequest('A venue with this name already exists.');
    }

    const updated = await prisma.venue.update({
      where: { id },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.capacity !== undefined ? { capacity: payload.capacity } : {}),
        ...(payload.location !== undefined ? { location: payload.location || null } : {}),
        ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
      },
    });

    logAudit({
      actorId: actor.id,
      action: 'VENUE.UPDATE',
      targetType: 'Venue',
      targetId: id,
      result: 'SUCCESS',
      metadata: { name: updated.name, capacity: updated.capacity },
    });

    clearVenuesCache();
    return updated;
  },

  async remove(id, actor) {
    const venue = await prisma.venue.findUnique({
      where: { id },
      include: { _count: { select: { invigilations: true } } },
    });
    if (!venue) throw ApiError.notFound('Venue not found.');
    if (venue._count.invigilations > 0) {
      throw ApiError.badRequest('This venue is used in a timetable. Deactivate it instead of deleting.');
    }

    await prisma.venue.delete({ where: { id } });

    logAudit({
      actorId: actor.id,
      action: 'VENUE.DELETE',
      targetType: 'Venue',
      targetId: id,
      result: 'SUCCESS',
      metadata: { name: venue.name },
    });

    clearVenuesCache();
    return { id };
  },
};
