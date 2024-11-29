import { PermissionContext } from './PermissionManager';

type ConditionEvaluator = (condition: any, context: PermissionContext) => Promise<boolean>;

const evaluators: Record<string, ConditionEvaluator> = {
  // Time-based conditions
  time: async (condition, context) => {
    const now = new Date();
    const { start, end, days, timezone } = condition;
    
    if (start && end) {
      const startTime = new Date(start);
      const endTime = new Date(end);
      return now >= startTime && now <= endTime;
    }
    
    if (days) {
      const currentDay = now.getDay();
      return days.includes(currentDay);
    }
    
    return true;
  },

  // Resource state conditions
  resource_state: async (condition, context) => {
    const { states, resource_type } = condition;
    // You can implement custom resource state checks here
    return true;
  },

  // Budget conditions
  budget: async (condition, context) => {
    const { min_budget, max_budget } = condition;
    // Implement budget checking logic
    return true;
  },

  // Location conditions
  location: async (condition, context) => {
    const { allowed_locations, radius } = condition;
    // Implement location checking logic
    return true;
  },

  // Team size conditions
  team_size: async (condition, context) => {
    const { min_members, max_members } = condition;
    // Implement team size checking logic
    return true;
  },

  // Custom function conditions
  custom_function: async (condition, context) => {
    const { function_name, parameters } = condition;
    // Implement custom function evaluation
    return true;
  }
};

// Easy to add new condition types
export function registerConditionEvaluator(
  type: string,
  evaluator: ConditionEvaluator
) {
  evaluators[type] = evaluator;
}

export async function evaluateCondition(
  type: string,
  condition: any,
  context: PermissionContext
): Promise<boolean> {
  const evaluator = evaluators[type];
  if (!evaluator) {
    console.warn(`No evaluator found for condition type: ${type}`);
    return true; // Default to permissive if evaluator not found
  }

  try {
    return await evaluator(condition, context);
  } catch (error) {
    console.error(`Error evaluating condition of type ${type}:`, error);
    return false; // Fail closed on error
  }
}
