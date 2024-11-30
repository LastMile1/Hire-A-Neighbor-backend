/// <reference types="node" />

import { prisma } from '../../lib/prisma';

async function main() {
  // Create platform-level roles
  const platformAdmin = await prisma.role.create({
    data: {
      name: 'platform_admin',
      description: 'Full platform administration access',
      isSystem: true
    },
  });

  const moderator = await prisma.role.create({
    data: {
      name: 'moderator',
      description: 'Platform content moderation access',
      isSystem: true
    },
  });

  const support = await prisma.role.create({
    data: {
      name: 'support',
      description: 'Customer support access',
      isSystem: true
    },
  });

  // Create team-level roles
  const teamAdmin = await prisma.role.create({
    data: {
      name: 'team_admin',
      description: 'Team administration access',
      isSystem: true
    },
  });

  const teamModerator = await prisma.role.create({
    data: {
      name: 'team_moderator',
      description: 'Team moderation access',
      parentRoleId: teamAdmin.id
    },
  });

  const teamMember = await prisma.role.create({
    data: {
      name: 'team_member',
      description: 'Regular team member access',
      parentRoleId: teamModerator.id
    },
  });

  // Create project-level roles
  const projectManager = await prisma.role.create({
    data: {
      name: 'project_manager',
      description: 'Project management access',
      isSystem: true
    },
  });

  const projectLead = await prisma.role.create({
    data: {
      name: 'project_lead',
      description: 'Project team lead access',
      parentRoleId: projectManager.id
    },
  });

  const projectMember = await prisma.role.create({
    data: {
      name: 'project_member',
      description: 'Regular project member access',
      parentRoleId: projectLead.id
    },
  });

  // Create permissions
  const permissions = await Promise.all([
    // Platform admin permissions
    prisma.permission.create({
      data: {
        resource: '*',
        action: '*',
        description: 'Full platform access',
        RolePermission: {
          create: {
            roleId: platformAdmin.id
          }
        }
      }
    }),

    // Moderation permissions
    prisma.permission.create({
      data: {
        resource: 'content',
        action: 'moderate',
        description: 'Moderate platform content',
        RolePermission: {
          create: {
            roleId: moderator.id,
            conditions: {
              create: {
                type: 'content-state',
                condition: JSON.stringify({
                  type: 'content-state',
                  rule: 'content.status === "flagged" || content.status === "reported"'
                })
              }
            }
          }
        }
      }
    }),

    // Support permissions
    prisma.permission.create({
      data: {
        resource: 'support',
        action: 'manage',
        description: 'Manage support tickets',
        RolePermission: {
          create: {
            roleId: support.id,
            conditions: {
              create: {
                type: 'business-hours',
                condition: JSON.stringify({
                  type: 'time-window',
                  start: '09:00',
                  end: '17:00',
                  timezone: 'UTC'
                })
              }
            }
          }
        }
      }
    }),

    // Team admin permissions
    prisma.permission.create({
      data: {
        resource: 'team',
        action: 'manage',
        description: 'Manage team settings and members',
        RolePermission: {
          create: {
            roleId: teamAdmin.id,
            conditions: {
              create: {
                type: 'scope',
                condition: JSON.stringify({
                  type: 'scope-match',
                  rule: 'context.scopeId === team.id'
                })
              }
            }
          }
        }
      }
    }),

    // Team moderator permissions
    prisma.permission.create({
      data: {
        resource: 'team.content',
        action: 'moderate',
        description: 'Moderate team content',
        RolePermission: {
          create: {
            roleId: teamModerator.id,
            conditions: {
              create: {
                type: 'scope',
                condition: JSON.stringify({
                  type: 'scope-match',
                  rule: 'context.scopeId === team.id'
                })
              }
            }
          }
        }
      }
    }),

    // Team member permissions
    prisma.permission.create({
      data: {
        resource: 'team.content',
        action: 'create',
        description: 'Create team content',
        RolePermission: {
          create: {
            roleId: teamMember.id,
            conditions: {
              create: {
                type: 'membership',
                condition: JSON.stringify({
                  type: 'team-membership',
                  rule: 'user.teams.includes(team.id)'
                })
              }
            }
          }
        }
      }
    }),

    // Project manager permissions
    prisma.permission.create({
      data: {
        resource: 'project',
        action: 'manage',
        description: 'Manage project settings and members',
        RolePermission: {
          create: {
            roleId: projectManager.id,
            conditions: {
              create: {
                type: 'scope',
                condition: JSON.stringify({
                  type: 'scope-match',
                  rule: 'context.scopeId === project.id'
                })
              }
            }
          }
        }
      }
    }),

    // Project lead permissions
    prisma.permission.create({
      data: {
        resource: 'project.tasks',
        action: 'assign',
        description: 'Assign project tasks',
        RolePermission: {
          create: {
            roleId: projectLead.id,
            conditions: {
              create: {
                type: 'scope',
                condition: JSON.stringify({
                  type: 'scope-match',
                  rule: 'context.scopeId === project.id'
                })
              }
            }
          }
        }
      }
    }),

    // Project member permissions
    prisma.permission.create({
      data: {
        resource: 'project.tasks',
        action: 'view',
        description: 'View project tasks',
        RolePermission: {
          create: {
            roleId: projectMember.id,
            conditions: {
              create: {
                type: 'membership',
                condition: JSON.stringify({
                  type: 'project-membership',
                  rule: 'user.projects.includes(project.id)'
                })
              }
            }
          }
        }
      }
    })
  ]);

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
