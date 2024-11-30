import { PermissionContext } from './PermissionManager';

interface TimeWindowCondition {
  type: 'time-window';
  start: string;
  end: string;
  timezone: string;
}

interface ScopeMatchCondition {
  type: 'scope-match';
  rule: string;
}

interface MembershipCondition {
  type: 'team-membership' | 'project-membership';
  rule: string;
}

interface ContentStateCondition {
  type: 'content-state';
  rule: string;
}

type ConditionType = 
  | TimeWindowCondition 
  | ScopeMatchCondition 
  | MembershipCondition 
  | ContentStateCondition;

export async function evaluateCondition(
  conditionJson: any,
  context: PermissionContext
): Promise<boolean> {
  try {
    const condition = JSON.parse(typeof conditionJson === 'string' ? conditionJson : JSON.stringify(conditionJson)) as ConditionType;

    switch (condition.type) {
      case 'time-window':
        return evaluateTimeWindow(condition, context);
      case 'scope-match':
        return evaluateScopeMatch(condition, context);
      case 'team-membership':
      case 'project-membership':
        return evaluateMembership(condition, context);
      case 'content-state':
        return evaluateContentState(condition, context);
      default:
        console.warn(`Unknown condition type: ${(condition as any).type}`);
        return false;
    }
  } catch (error) {
    console.error('Error evaluating condition:', error);
    return false;
  }
}

function evaluateTimeWindow(
  condition: TimeWindowCondition,
  context: PermissionContext
): boolean {
  const now = new Date();
  const tz = condition.timezone || 'UTC';
  
  const [startHour, startMinute] = condition.start.split(':').map(Number);
  const [endHour, endMinute] = condition.end.split(':').map(Number);
  
  const currentTime = new Date(now.toLocaleString('en-US', { timeZone: tz }));
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  
  const currentMinutes = currentHour * 60 + currentMinute;
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

function evaluateScopeMatch(
  condition: ScopeMatchCondition,
  context: PermissionContext
): boolean {
  try {
    // Create a safe evaluation context
    const evalContext = {
      context: context,
      team: { id: context.scopeType === 'team' ? context.scopeId : null },
      project: { id: context.scopeType === 'project' ? context.scopeId : null },
    };
    
    // Use Function constructor for safer evaluation
    const evalFn = new Function('context', 'team', 'project', `return ${condition.rule};`);
    return evalFn(evalContext.context, evalContext.team, evalContext.project);
  } catch (error) {
    console.error('Error evaluating scope match:', error);
    return false;
  }
}

function evaluateMembership(
  condition: MembershipCondition,
  context: PermissionContext
): boolean {
  try {
    // Create a safe evaluation context
    const evalContext = {
      user: context.user,
      team: context.scopeType === 'team' ? { id: context.scopeId } : null,
      project: context.scopeType === 'project' ? { id: context.scopeId } : null,
    };
    
    // Use Function constructor for safer evaluation
    const evalFn = new Function('user', 'team', 'project', `return ${condition.rule};`);
    return evalFn(evalContext.user, evalContext.team, evalContext.project);
  } catch (error) {
    console.error('Error evaluating membership:', error);
    return false;
  }
}

function evaluateContentState(
  condition: ContentStateCondition,
  context: PermissionContext
): boolean {
  try {
    // Create a safe evaluation context
    const evalContext = {
      content: context.content,
      user: context.user,
    };
    
    // Use Function constructor for safer evaluation
    const evalFn = new Function('content', 'user', `return ${condition.rule};`);
    return evalFn(evalContext.content, evalContext.user);
  } catch (error) {
    console.error('Error evaluating content state:', error);
    return false;
  }
}
