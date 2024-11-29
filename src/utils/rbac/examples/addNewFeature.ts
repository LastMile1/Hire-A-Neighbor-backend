import { prisma } from '../../../../lib/prisma';
import { registerConditionEvaluator } from '../conditionEvaluator';

async function addNewFeatureExample() {
  // 1. Add new permissions for the feature
  const newPermissions = await prisma.$transaction([
    prisma.permission.create({
      data: {
        name: 'manage_workflows',
        description: 'Can manage workflow templates',
        resource: 'workflows',
        action: 'manage',
        conditions: {
          requiredCertifications: ['workflow_designer'],
          minExperience: 2
        }
      }
    }),
    prisma.permission.create({
      data: {
        name: 'execute_workflow',
        description: 'Can execute workflow instances',
        resource: 'workflows',
        action: 'execute',
        conditions: {
          maxConcurrentExecutions: 5
        }
      }
    })
  ]);

  // 2. Create a new role for the feature
  const workflowManagerRole = await prisma.role.create({
    data: {
      name: 'workflow_manager',
      description: 'Can manage and execute workflows',
      scope: 'project',
      permissions: {
        create: newPermissions.map(permission => ({
          permissionId: permission.id,
          attributes: ['*']
        }))
      }
    }
  });

  // 3. Add new condition evaluator for the feature
  registerConditionEvaluator('workflow_state', async (condition, context) => {
    const { allowed_states, workflow_id } = condition;
    // Implement workflow state checking logic
    return true;
  });

  // 4. Create a new scope type for the feature
  const workflowScope = await prisma.scope.create({
    data: {
      name: 'workflow_environment',
      type: 'workflow',
      metadata: {
        allowedTriggers: ['manual', 'scheduled', 'event-driven'],
        maxConcurrency: 10
      }
    }
  });

  // 5. Assign the role to users
  await prisma.userRole.create({
    data: {
      userId: 'example_user_id',
      roleId: workflowManagerRole.id,
      scopeId: workflowScope.id,
      conditions: {
        time: {
          days: [1, 2, 3, 4, 5], // Weekdays only
          start: '09:00',
          end: '17:00'
        }
      }
    }
  });
}

// Example of using the new feature in an API endpoint
async function workflowApiExample() {
  import { PermissionManager } from '../PermissionManager';

  const permissionManager = PermissionManager.getInstance();

  app.post('/api/workflows/:workflowId/execute', async (req, res) => {
    const hasPermission = await permissionManager.checkPermission(
      {
        resource: 'workflows',
        action: 'execute',
        conditions: {
          workflow_state: {
            allowed_states: ['ready', 'idle'],
            workflow_id: req.params.workflowId
          }
        }
      },
      {
        userId: req.user.id,
        scopeId: req.body.scopeId,
        scopeType: 'workflow',
        context: {
          workflowType: req.body.workflowType,
          executionPriority: req.body.priority
        }
      }
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // Execute workflow...
  });
}
