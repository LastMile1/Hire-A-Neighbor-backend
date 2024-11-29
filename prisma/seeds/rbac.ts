import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Create platform-level roles
  const platformAdmin = await prisma.role.create({
    data: {
      name: 'platform_admin',
      description: 'Full platform administration access',
    },
  });

  const moderator = await prisma.role.create({
    data: {
      name: 'moderator',
      description: 'Platform content moderation access',
    },
  });

  // Create resource-specific roles
  const teamAdmin = await prisma.role.create({
    data: {
      name: 'team_admin',
      description: 'Team administration access',
    },
  });

  const teamMember = await prisma.role.create({
    data: {
      name: 'team_member',
      description: 'Regular team member access',
    },
  });

  const projectManager = await prisma.role.create({
    data: {
      name: 'project_manager',
      description: 'Project management access',
    },
  });

  const projectMember = await prisma.role.create({
    data: {
      name: 'project_member',
      description: 'Regular project member access',
    },
  });

  // Create permissions
  const permissions = await Promise.all([
    // User management permissions
    prisma.permission.create({
      data: {
        name: 'manage_users',
        description: 'Can manage all user accounts',
        resource: 'users',
        action: 'manage',
        attributes: ['*'],
      },
    }),
    prisma.permission.create({
      data: {
        name: 'view_users',
        description: 'Can view user profiles',
        resource: 'users',
        action: 'read',
        attributes: ['profile'],
      },
    }),

    // Team permissions
    prisma.permission.create({
      data: {
        name: 'manage_teams',
        description: 'Can manage all teams',
        resource: 'teams',
        action: 'manage',
        attributes: ['*'],
      },
    }),
    prisma.permission.create({
      data: {
        name: 'create_team',
        description: 'Can create new teams',
        resource: 'teams',
        action: 'create',
        attributes: [],
      },
    }),

    // Project permissions
    prisma.permission.create({
      data: {
        name: 'manage_projects',
        description: 'Can manage all projects',
        resource: 'projects',
        action: 'manage',
        attributes: ['*'],
      },
    }),
    prisma.permission.create({
      data: {
        name: 'create_project',
        description: 'Can create new projects',
        resource: 'projects',
        action: 'create',
        attributes: [],
      },
    }),

    // Role and permission management
    prisma.permission.create({
      data: {
        name: 'manage_roles',
        description: 'Can manage roles and permissions',
        resource: 'roles',
        action: 'manage',
        attributes: ['*'],
      },
    }),
  ]);

  // Assign permissions to roles
  await prisma.role.update({
    where: { id: platformAdmin.id },
    data: {
      permissions: {
        connect: permissions.map(p => ({ id: p.id })),
      },
    },
  });

  await prisma.role.update({
    where: { id: moderator.id },
    data: {
      permissions: {
        connect: permissions
          .filter(p => ['view_users', 'manage_users'].includes(p.name))
          .map(p => ({ id: p.id })),
      },
    },
  });

  await prisma.role.update({
    where: { id: teamAdmin.id },
    data: {
      permissions: {
        connect: permissions
          .filter(p => ['manage_teams', 'create_team'].includes(p.name))
          .map(p => ({ id: p.id })),
      },
    },
  });

  await prisma.role.update({
    where: { id: projectManager.id },
    data: {
      permissions: {
        connect: permissions
          .filter(p => ['manage_projects', 'create_project'].includes(p.name))
          .map(p => ({ id: p.id })),
      },
    },
  });

  console.log('RBAC seed completed successfully');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
