/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await -- hand-built Prisma fakes */
import { ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';

function setup(targetName: string, targetKeys: string[]) {
  const prisma: any = {
    user: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'u2',
        role: {
          name: targetName,
          permissions: targetKeys.map((key) => ({ permission: { key } })),
        },
        permissionOverrides: [],
      }),
      findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'u2' }),
    },
    permission: { findMany: jest.fn().mockResolvedValue([]) },
    userPermissionOverride: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn(async (ops: any[]) => {
      for (const op of ops) await op;
      return [];
    }),
  };
  const svc: any = Object.create(UsersService.prototype);
  svc.prisma = prisma;
  svc.audit = { record: jest.fn(async () => ({})) };
  return { svc, prisma };
}

const actor = {
  id: 'u1',
  restaurantId: 'r1',
  roleName: 'STAFF',
  permissions: ['users.manage', 'roles.manage', 'orders.create'],
};

const dto = {
  overrides: [
    {
      permissionKey: 'backup.manage',
      effect: 'DENY',
      reason: null,
      expiresAt: null,
    },
  ],
};

describe('permission override privilege ceiling', () => {
  it('refuses to edit overrides of a stronger account', async () => {
    const { svc, prisma } = setup('ADMINISTRATOR', ['backup.manage']);
    await expect(
      svc.setPermissionOverrides('r1', actor, 'u2', dto),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.userPermissionOverride.deleteMany).not.toHaveBeenCalled();
  });

  it('allows editing overrides of an account within the actor reach', async () => {
    const { svc, prisma } = setup('WAITER', ['orders.create']);
    prisma.permission.findMany.mockResolvedValue([
      { id: 'p1', key: 'backup.manage' },
    ]);
    await svc.setPermissionOverrides('r1', actor, 'u2', dto);
    expect(prisma.userPermissionOverride.createMany).toHaveBeenCalled();
  });
});
