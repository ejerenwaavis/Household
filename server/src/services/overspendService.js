import OverspendProject from '../models/OverspendProject.js';
import TaskReminder from '../models/TaskReminder.js';
import Household from '../models/Household.js';

/**
 * OverspendDetectionService
 * Handles detection of credit card overspending and creation of accountability projects
 */

// Calculate overspend responsibility based on member's income percentage
const calculateMemberResponsibility = (totalCharges, memberIncomePercent) => {
  const responsibility = memberIncomePercent || 50; // Default 50/50 split
  const memberResponsibilityAmount = (totalCharges * responsibility) / 100;
  const weeklyContribution = memberResponsibilityAmount / 4; // Spread over 4 weeks

  return {
    memberResponsibilityPercent: responsibility,
    memberResponsibilityAmount,
    weeklyContribution
  };
};

/**
 * Detect overspends in credit card charges for a member
 * @param {String} householdId
 * @param {String} memberId
 * @param {Array} charges - Charges from the statement for this member
 * @param {Object} household - Household document with settings
 * @returns {Object} Overspend detection result
 */
export const detectMemberOverspend = (householdId, memberId, charges, household) => {
  const member = household.members.find(m => m.userId === memberId);
  if (!member) return null;

  const totalCharges = charges.reduce((sum, c) => sum + c.amount, 0);
  const threshold = household.settings.creditCardOverspendThreshold || 500;

  // Check if total exceeds threshold
  if (totalCharges <= threshold) {
    return null; // No overspend
  }

  const responsbilityData = calculateMemberResponsibility(totalCharges, member.incomePercentage);

  return {
    memberId,
    memberName: member.name,
    totalCharges,
    threshold,
    exceedsThreshold: true,
    ...responsbilityData,
    charges
  };
};

/**
 * Create an overspend project and associated task reminders
 * @param {String} householdId
 * @param {Object} overspendData - From detectMemberOverspend
 * @param {String} statementId - Reference to the statement
 * @param {Number} autoCreateThreshold - Threshold for auto-create vs approval
 * @returns {Promise} Created project
 */
export const createOverspendProject = async (householdId, overspendData, statementId, autoCreateThreshold) => {
  try {
    const autoCreate = overspendData.memberResponsibilityAmount < autoCreateThreshold;

    const project = new OverspendProject({
      householdId,
      type: 'overspend',
      memberId: overspendData.memberId,
      memberName: overspendData.memberName,
      originalChargeAmount: overspendData.totalCharges,
      memberResponsibilityPercent: overspendData.memberResponsibilityPercent,
      memberResponsibilityAmount: overspendData.memberResponsibilityAmount,
      weeklyContribution: overspendData.weeklyContribution,
      status: autoCreate ? 'active' : 'pending_approval',
      requiresApproval: !autoCreate,
      statementId,
      description: `Overspend project: ${overspendData.memberName} charged $${overspendData.totalCharges.toFixed(2)} - Member responsibility: $${overspendData.memberResponsibilityAmount.toFixed(2)}`
    });

    await project.save();

    // Create task reminders for each week
    const tasks = [];
    for (let week = 1; week <= project.weekCount; week++) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + week * 7); // Due one week per iteration

      const task = new TaskReminder({
        householdId,
        type: 'overspend_payment',
        assignedTo: overspendData.memberId,
        assignedToName: overspendData.memberName,
        createdBy: 'system',
        createdByName: 'System',
        title: `Overspend Payment - Week ${week}`,
        description: `Pay $${overspendData.weeklyContribution.toFixed(2)} towards overspend project (Total: $${overspendData.totalCharges.toFixed(2)})`,
        projectId: project._id,
        weeklyAmount: overspendData.weeklyContribution,
        weekNumber: week,
        dueDate,
        priority: 'high',
        status: autoCreate ? 'active' : 'pending_approval',
        showOnDashboard: true,
        sendNotification: true
      });

      await task.save();
      tasks.push(task);
    }

    console.log('[OverspendService] Project created:', {
      projectId: project._id,
      memberId: overspendData.memberId,
      amount: overspendData.memberResponsibilityAmount,
      taskCount: tasks.length
    });

    return {
      project,
      tasks,
      isAutoCreated: autoCreate
    };
  } catch (error) {
    console.error('[OverspendService] Error creating project:', error.message);
    throw error;
  }
};

/**
 * Generate notifications for overspend projects
 * @param {Object} household
 * @param {Object} projectResult - Result from createOverspendProject
 * @returns {Array} Notification objects
 */
export const generateNotifications = (household, projectResult) => {
  const { project, isAutoCreated } = projectResult;
  const managerIds = household.members
    .filter(m => ['owner', 'co-owner', 'manager'].includes(m.role))
    .map(m => m.userId);

  const notifications = [];

  if (isAutoCreated) {
    notifications.push({
      type: 'overspend_auto_created',
      timestamp: new Date(),
      recipients: managerIds,
      title: 'Overspend Project Auto-Created',
      message: `${project.memberName}'s overspend project auto-created: $${project.memberResponsibilityAmount.toFixed(2)} to be paid at $${project.weeklyContribution.toFixed(2)}/week`,
      projectId: project._id,
      priority: 'normal'
    });
  } else {
    notifications.push({
      type: 'overspend_approval_required',
      timestamp: new Date(),
      recipients: managerIds,
      title: 'Overspend Project Requires Approval',
      message: `${project.memberName} spent $${project.originalChargeAmount.toFixed(2)} on credit card. Requires approval for overspend project ($${project.memberResponsibilityAmount.toFixed(2)} member responsibility).`,
      projectId: project._id,
      priority: 'high'
    });
  }

  // Add notification to member
  notifications.push({
    type: 'overspend_assigned',
    timestamp: new Date(),
    recipients: [project.memberId],
    title: isAutoCreated ? 'Overspend Tasks Created' : 'Overspend Pending Approval',
    message: isAutoCreated
      ? `Weekly payment tasks created for $${project.originalChargeAmount.toFixed(2)} overspend. Start paying $${project.weeklyContribution.toFixed(2)}/week.`
      : `Your overspend of $${project.originalChargeAmount.toFixed(2)} is pending approval from household managers.`,
    projectId: project._id,
    priority: isAutoCreated ? 'normal' : 'high'
  });

  return notifications;
};

/**
 * Process all charges from a statement and create overspend projects
 * @param {String} householdId
 * @param {Array} charges - All charges from statement
 * @param {String} statementId
 * @returns {Promise} Processing results
 */
export const processStatementCharges = async (householdId, charges, statementId) => {
  try {
    const household = await Household.findOne({ householdId });
    if (!household) throw new Error('Household not found');

    const overspendThreshold = household.settings.creditCardOverspendThreshold || 500;
    const autoCreateThreshold = household.settings.autoCreateOverspendProject || 1000;

    // Group charges by member
    const chargesByMember = {};
    charges.forEach(charge => {
      if (!charge.memberId) return;
      if (!chargesByMember[charge.memberId]) {
        chargesByMember[charge.memberId] = [];
      }
      chargesByMember[charge.memberId].push(charge);
    });

    const results = {
      overspends: [],
      projects: [],
      notifications: [],
      errors: []
    };

    // Process each member's charges
    for (const [memberId, memberCharges] of Object.entries(chargesByMember)) {
      try {
        // Detect overspend
        const overspend = detectMemberOverspend(householdId, memberId, memberCharges, household);
        if (!overspend) continue;

        results.overspends.push(overspend);

        // Create project and tasks
        const projectResult = await createOverspendProject(
          householdId,
          overspend,
          statementId,
          autoCreateThreshold
        );

        results.projects.push({
          projectId: projectResult.project._id,
          memberId: overspend.memberId,
          memberResponsibility: overspend.memberResponsibilityAmount,
          autoCreated: projectResult.isAutoCreated
        });

        // Generate notifications
        const notifications = generateNotifications(household, projectResult);
        results.notifications.push(...notifications);

      } catch (error) {
        results.errors.push({
          memberId,
          error: error.message
        });
      }
    }

    console.log('[OverspendService] Statement processing complete:', {
      householdId,
      overspendCount: results.overspends.length,
      projectCount: results.projects.length,
      notificationCount: results.notifications.length,
      errorCount: results.errors.length
    });

    return results;
  } catch (error) {
    console.error('[OverspendService] Error processing statement:', error.message);
    throw error;
  }
};

/**
 * Update project status (complete, on_hold, etc.)
 * @param {String} projectId
 * @param {String} newStatus
 * @returns {Promise} Updated project
 */
export const updateProjectStatus = async (projectId, newStatus) => {
  try {
    const project = await OverspendProject.findByIdAndUpdate(
      projectId,
      {
        status: newStatus,
        ...(newStatus === 'completed' && { completedAt: new Date() })
      },
      { new: true }
    );

    if (newStatus === 'completed') {
      // Mark associated tasks as completed
      await TaskReminder.updateMany(
        { projectId },
        { status: 'completed', completedAt: new Date() }
      );
    }

    console.log('[OverspendService] Project updated:', { projectId, status: newStatus });
    return project;
  } catch (error) {
    console.error('[OverspendService] Error updating project:', error.message);
    throw error;
  }
};

/**
 * Get overspend summary for a household
 * @param {String} householdId
 * @returns {Promise} Summary object
 */
export const getOverspendSummary = async (householdId) => {
  try {
    const projects = await OverspendProject.find({ householdId });

    const summary = {
      totalProjects: projects.length,
      activeProjects: projects.filter(p => p.status === 'active').length,
      pendingApproval: projects.filter(p => p.requiresApproval && !p.approvedBy.length).length,
      totalResponsibility: projects.reduce((sum, p) => sum + p.memberResponsibilityAmount, 0),
      totalCollected: projects.reduce((sum, p) => sum + p.totalCollected, 0),
      byMember: {}
    };

    // Group by member
    projects.forEach(project => {
      if (!summary.byMember[project.memberId]) {
        summary.byMember[project.memberId] = {
          memberName: project.memberName,
          projectCount: 0,
          totalResponsibility: 0,
          totalCollected: 0
        };
      }
      summary.byMember[project.memberId].projectCount += 1;
      summary.byMember[project.memberId].totalResponsibility += project.memberResponsibilityAmount;
      summary.byMember[project.memberId].totalCollected += project.totalCollected;
    });

    return summary;
  } catch (error) {
    console.error('[OverspendService] Error getting summary:', error.message);
    throw error;
  }
};

export default {
  detectMemberOverspend,
  createOverspendProject,
  generateNotifications,
  processStatementCharges,
  updateProjectStatus,
  getOverspendSummary
};
