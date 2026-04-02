import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

function priorityColor(priority) {
  if (priority === 'high') return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700';
  if (priority === 'normal') return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700';
  return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600';
}

function priorityLabel(priority) {
  if (priority === 'high') return '🔴 High';
  if (priority === 'normal') return '🟡 Normal';
  return '⚪ Low';
}

function formatDue(dueDate) {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  const now = new Date();
  const diff = d - now;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, overdue: true };
  if (days === 0) return { label: 'Due today', overdue: false };
  if (days === 1) return { label: 'Due tomorrow', overdue: false };
  return { label: `Due in ${days}d`, overdue: false };
}

export default function TaskReminderWidget() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(null);
  const [completionNotes, setCompletionNotes] = useState({});
  const [confirmId, setConfirmId] = useState(null);

  const fetchTasks = useCallback(async () => {
    if (!user?.householdId) return;
    try {
      const res = await api.get(`/tasks/${user.householdId}/tasks?status=active`);
      const active = (res.data?.tasks || []).filter(
        (t) => t.showOnDashboard !== false && ['active', 'overdue'].includes(t.status)
      );
      setTasks(active);
    } catch (_) {
      // Silent — widget collapses if no tasks
    } finally {
      setLoading(false);
    }
  }, [user?.householdId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleComplete = async (taskId) => {
    setCompleting(taskId);
    try {
      await api.patch(`/tasks/${user.householdId}/tasks/${taskId}`, {
        status: 'completed',
        completionNotes: completionNotes[taskId] || '',
      });
      setTasks((prev) => prev.filter((t) => String(t._id) !== taskId));
      setConfirmId(null);
    } catch (err) {
      console.error('[TaskReminderWidget] complete failed:', err.message);
    } finally {
      setCompleting(null);
    }
  };

  if (loading || tasks.length === 0) return null;

  return (
    <div className="mb-6 bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-amber-200 dark:border-amber-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700">
        <span className="text-lg">📋</span>
        <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex-1">
          Your Tasks
        </h3>
        <span className="text-xs bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
          {tasks.length} active
        </span>
      </div>

      {/* Task list */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {tasks.map((task) => {
          const due = formatDue(task.dueDate);
          const isConfirming = confirmId === String(task._id);
          const taskId = String(task._id);

          return (
            <div key={taskId} className={`px-4 py-3 transition-colors ${isConfirming ? 'bg-green-50 dark:bg-green-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}`}>
              <div className="flex items-start gap-3">
                {/* Priority dot */}
                <span className={`mt-0.5 text-xs px-1.5 py-0.5 rounded-full border font-medium shrink-0 ${priorityColor(task.priority)}`}>
                  {task.priority === 'high' ? '!' : task.priority === 'normal' ? '•' : '·'}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{task.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {task.weeklyAmount && (
                      <span className="text-xs font-semibold text-green-700 dark:text-green-400">
                        ${Number(task.weeklyAmount).toFixed(2)}/week
                      </span>
                    )}
                    {due && (
                      <span className={`text-xs ${due.overdue ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                        {due.label}
                      </span>
                    )}
                    {task.createdByName && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">from {task.createdByName}</span>
                    )}
                  </div>

                  {/* Confirm completion inline */}
                  {isConfirming && (
                    <div className="mt-2 space-y-2">
                      <input
                        type="text"
                        placeholder="Add a note (optional)"
                        value={completionNotes[taskId] || ''}
                        onChange={(e) => setCompletionNotes((prev) => ({ ...prev, [taskId]: e.target.value }))}
                        className="w-full text-xs px-2 py-1.5 border border-green-300 dark:border-green-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-green-400"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleComplete(taskId)}
                          disabled={completing === taskId}
                          className="flex-1 text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
                        >
                          {completing === taskId ? 'Saving...' : 'Confirm Complete'}
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="text-xs px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Complete button */}
                {!isConfirming && (
                  <button
                    onClick={() => setConfirmId(taskId)}
                    className="shrink-0 text-xs px-2.5 py-1 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400 rounded-lg border border-green-200 dark:border-green-700 font-medium transition-colors"
                  >
                    Done ✓
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
