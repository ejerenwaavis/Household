import mongoose from 'mongoose';

const taskReminderSchema = new mongoose.Schema({
  householdId: { type: String, required: true, index: true },
  type: { type: String, enum: ['overspend_payment', 'household_expense', 'credit_card_review', 'custom'], default: 'custom' },
  
  // Target
  assignedTo: { type: String, required: true }, // userId
  assignedToName: { type: String },
  createdBy: { type: String }, // userId who created the task
  createdByName: { type: String }, // name of creator
  
  // Content
  title: { type: String, required: true },
  description: { type: String },
  dueDate: { type: Date },
  
  // For overspend reminders specifically
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'OverspendProject' },
  weeklyAmount: { type: Number }, // $250/week
  weekNumber: { type: Number },
  
  // Status
  status: { type: String, enum: ['active', 'completed', 'dismissed', 'overdue'], default: 'active' },
  completedAt: { type: Date },
  completedBy: { type: String }, // userId who marked as complete
  dismissedAt: { type: Date },
  completionNotes: { type: String }, // notes when completing the task
  
  // Reminder settings
  showOnDashboard: { type: Boolean, default: true },
  sendNotification: { type: Boolean, default: true },
  notificationSentAt: { type: Date },
  priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('TaskReminder', taskReminderSchema);
