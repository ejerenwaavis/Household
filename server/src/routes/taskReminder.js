import { Router } from 'express';
import { authMiddleware, householdAuthMiddleware } from '../middleware/auth.js';
import TaskReminder from '../models/TaskReminder.js';
import Household from '../models/Household.js';

const router = Router({ mergeParams: true });

// GET: Fetch all tasks for current user in a household
router.get('/:householdId/tasks', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { status = 'active' } = req.query;

    const filter = {
      householdId,
      assignedTo: req.user.userId
    };

    if (status) {
      filter.status = status;
    }

    const tasks = await TaskReminder.find(filter)
      .populate('projectId')
      .sort({ createdAt: -1 });

    res.json({ tasks });
  } catch (error) {
    next(error);
  }
});

// GET: Get all tasks for household (admin view)
router.get('/:householdId/tasks/admin/all', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const household = await Household.findOne({ householdId });
    
    // Check if user is owner/co-owner/manager
    const userMember = household.members.find(m => m.userId === req.user.userId);
    if (!['owner', 'co-owner', 'manager'].includes(userMember?.role)) {
      return res.status(403).json({ error: 'Only managers can view all tasks' });
    }

    const tasks = await TaskReminder.find({ householdId })
      .populate('projectId')
      .sort({ createdAt: -1 });

    res.json({ tasks });
  } catch (error) {
    next(error);
  }
});

// PATCH: Update task status (complete, dismiss, override)
router.patch('/:householdId/tasks/:taskId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, taskId } = req.params;
    const { status, completionNotes } = req.body;

    const task = await TaskReminder.findById(taskId);
    if (!task || task.householdId !== householdId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Only assigned member can mark as complete, only managers can dismiss
    if (status === 'completed') {
      if (task.assignedTo !== req.user.userId) {
        return res.status(403).json({ error: 'Only assigned member can complete task' });
      }
      task.completedAt = new Date();
    } else if (status === 'dismissed') {
      const household = await Household.findOne({ householdId });
      const userMember = household.members.find(m => m.userId === req.user.userId);
      
      if (!['owner', 'co-owner', 'manager'].includes(userMember?.role)) {
        return res.status(403).json({ error: 'Only managers can dismiss tasks' });
      }
      task.dismissedAt = new Date();
    }

    task.status = status || task.status;
    if (completionNotes) {
      task.completionNotes = completionNotes;
    }

    await task.save();

    console.log('[Task Reminder] Updated:', { taskId, status: task.status });
    res.json({ task });
  } catch (error) {
    next(error);
  }
});

// GET: Dashboard summary (counts by priority and type)
router.get('/:householdId/tasks/summary', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;

    const taskStats = await TaskReminder.aggregate([
      { $match: { householdId, status: { $in: ['active', 'overdue'] } } },
      {
        $facet: {
          byPriority: [
            { $group: { _id: '$priority', count: { $sum: 1 } } }
          ],
          byType: [
            { $group: { _id: '$type', count: { $sum: 1 } } }
          ],
          urgent: [
            { $match: { priority: 'high', status: 'overdue' } },
            { $count: 'count' }
          ],
          myTasks: [
            { $match: { assignedTo: req.user.userId } },
            { $count: 'count' }
          ]
        }
      }
    ]);

    const summary = {
      byPriority: taskStats[0].byPriority.reduce((acc, p) => ({ ...acc, [p._id]: p.count }), {}),
      byType: taskStats[0].byType.reduce((acc, t) => ({ ...acc, [t._id]: t.count }), {}),
      overdue: (taskStats[0].urgent[0]?.count || 0),
      assigned: (taskStats[0].myTasks[0]?.count || 0)
    };

    res.json({ summary });
  } catch (error) {
    next(error);
  }
});

// POST: Create custom task (for managers to assign)
router.post('/:householdId/tasks/custom', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { assignedTo, title, description, dueDate, priority = 'medium' } = req.body;

    const household = await Household.findOne({ householdId });
    const userMember = household.members.find(m => m.userId === req.user.userId);
    
    // Only managers can create custom tasks
    if (!['owner', 'co-owner', 'manager'].includes(userMember?.role)) {
      return res.status(403).json({ error: 'Only managers can create tasks' });
    }

    const assignedMember = household.members.find(m => m.userId === assignedTo);
    if (!assignedMember) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const task = new TaskReminder({
      householdId,
      type: 'custom',
      assignedTo,
      assignedToName: assignedMember.name,
      createdBy: req.user.userId,
      createdByName: userMember.name,
      title,
      description,
      dueDate,
      priority,
      status: 'active'
    });

    await task.save();

    console.log('[Task Reminder] Custom created:', { taskId: task._id, assignedTo });
    res.status(201).json({ task });
  } catch (error) {
    next(error);
  }
});

export default router;
