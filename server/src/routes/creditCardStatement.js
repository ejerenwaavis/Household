import { Router } from 'express';
import { householdAuthMiddleware, authMiddleware } from '../middleware/auth.js';
import CreditCardStatement from '../models/CreditCardStatement.js';
import CreditCard from '../models/CreditCard.js';
import Household from '../models/Household.js';
import OverspendProject from '../models/OverspendProject.js';
import TaskReminder from '../models/TaskReminder.js';
import overspendService from '../services/overspendService.js';

const router = Router({ mergeParams: true });
router.post('/:householdId/statements', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { cardId, statementDate, charges } = req.body;

    if (!cardId || !charges || !Array.isArray(charges)) {
      return res.status(400).json({ error: 'cardId and charges array required' });
    }

    // Fetch household and card
    const household = await Household.findOne({ householdId });
    if (!household) {
      return res.status(404).json({ error: 'Household not found' });
    }

    const card = await CreditCard.findById(cardId);
    if (!card || card.householdId !== householdId) {
      return res.status(404).json({ error: 'Credit card not found' });
    }

    // Create statement
    const statement = new CreditCardStatement({
      householdId,
      cardId,
      statementDate: statementDate || new Date(),
      charges,
      submittedBy: req.user.userId,
      totalAmount: charges.reduce((sum, c) => sum + c.amount, 0)
    });

    await statement.save();

    console.log('[CC Statement] Created:', { statementId: statement._id, householdId, chargeCount: charges.length });
    res.status(201).json({ statement });
  } catch (error) {
    next(error);
  }
});

// GET: Get statements for a household
router.get('/:householdId/statements', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const statements = await CreditCardStatement.find({ householdId })
      .populate('cardId')
      .sort({ statementDate: -1 });

    res.json({ statements });
  } catch (error) {
    next(error);
  }
});

// POST: Process statement and detect overspends
router.post('/:householdId/statements/:statementId/process', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, statementId } = req.params;
    const household = await Household.findOne({ householdId });

    if (!household) {
      return res.status(404).json({ error: 'Household not found' });
    }

    const statement = await CreditCardStatement.findById(statementId);
    if (!statement || statement.householdId !== householdId) {
      return res.status(404).json({ error: 'Statement not found' });
    }

    if (statement.processed) {
      return res.status(400).json({ error: 'Statement already processed' });
    }

    // Use overspend service to process all charges
    const processingResults = await overspendService.processStatementCharges(
      householdId,
      statement.charges,
      statementId
    );

    // Mark statement as processed
    statement.processed = true;
    statement.processedAt = new Date();
    
    // Update charges with project references
    statement.charges = statement.charges.map(charge => {
      const overspend = processingResults.overspends.find(o => o.memberId === charge.memberId);
      if (overspend) {
        charge.overspendFlag = true;
        const project = processingResults.projects.find(p => p.memberId === charge.memberId);
        if (project) {
          charge.projectCreated = project.projectId;
        }
      }
      return charge;
    });

    await statement.save();

    console.log('[CC Statement] Processed:', { statementId, overspendCount: processingResults.overspends.length });
    res.json({
      statement,
      overspends: processingResults.overspends,
      projects: processingResults.projects,
      notifications: processingResults.notifications,
      errors: processingResults.errors
    });
  } catch (error) {
    next(error);
  }
});

// POST: Approve overspend project (for >$1000 projects)
router.post('/:householdId/overspend-projects/:projectId/approve', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, projectId } = req.params;
    const household = await Household.findOne({ householdId });
    
    // Check if user is owner/co-owner
    const userMember = household.members.find(m => m.userId === req.user.userId);
    if (!['owner', 'co-owner'].includes(userMember?.role)) {
      return res.status(403).json({ error: 'Only owners can approve projects' });
    }

    const project = await OverspendProject.findById(projectId);
    if (!project || project.householdId !== householdId) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Approve project
    project.status = 'active';
    project.approvedBy.push(req.user.userId);
    project.approvalDate = new Date();
    await project.save();

    // Activate tasks
    await TaskReminder.updateMany(
      { projectId },
      { status: 'active' }
    );

    console.log('[Overspend Project] Approved:', { projectId });
    res.json({ project, message: 'Project approved and tasks activated' });
  } catch (error) {
    next(error);
  }
});

// GET: Get overspend projects for household
router.get('/:householdId/overspend-projects', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const projects = await OverspendProject.find({ householdId })
      .sort({ createdAt: -1 });

    res.json({ projects });
  } catch (error) {
    next(error);
  }
});

// GET: Get overspend summary for household
router.get('/:householdId/overspend-summary', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const summary = await overspendService.getOverspendSummary(householdId);
    res.json({ summary });
  } catch (error) {
    next(error);
  }
});

// PATCH: Update overspend project status
router.patch('/:householdId/overspend-projects/:projectId/status', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, projectId } = req.params;
    const { status } = req.body;

    const project = await OverspendProject.findById(projectId);
    if (!project || project.householdId !== householdId) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const updated = await overspendService.updateProjectStatus(projectId, status);
    res.json({ project: updated, message: `Project status updated to ${status}` });
  } catch (error) {
    next(error);
  }
});

// POST: Record payment towards overspend project
router.post('/:householdId/overspend-projects/:projectId/payments', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, projectId } = req.params;
    const { amount, week } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    const project = await OverspendProject.findById(projectId);
    if (!project || project.householdId !== householdId) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Add payment record
    project.payments.push({
      amount,
      date: new Date(),
      week: week || Math.ceil(project.payments.length / 1) + 1
    });

    // Update total collected
    project.totalCollected += amount;

    // Mark task as completed if full week payment made
    if (week) {
      await TaskReminder.findOneAndUpdate(
        { projectId, weekNumber: week },
        { status: 'completed', completedAt: new Date() }
      );
    }

    await project.save();

    console.log('[Overspend Project] Payment recorded:', { projectId, amount, week });
    res.json({ project, message: 'Payment recorded successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
