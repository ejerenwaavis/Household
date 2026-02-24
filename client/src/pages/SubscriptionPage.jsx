import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

const STATUS_COLORS = {
  active: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
  past_due: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400',
  canceled: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
};

const PLAN_COLORS = {
  free: 'text-gray-600 dark:text-gray-400',
  basic: 'text-blue-600 dark:text-blue-400',
  plus: 'text-purple-600 dark:text-purple-400',
  pro: 'text-indigo-600 dark:text-indigo-400',
};

export default function SubscriptionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [subscription, setSubscription] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const successParam = searchParams.get('success');

  useEffect(() => {
    if (successParam) setSuccess('🎉 Subscription activated! Welcome to your new plan.');
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      const res = await api.get('/subscription');
      setSubscription(res.data.subscription);
      setPlan(res.data.plan);
    } catch (err) {
      setError('Failed to load subscription details.');
    } finally {
      setLoading(false);
    }
  };

  const handlePortal = async () => {
    setActionLoading('portal');
    try {
      const res = await api.post('/subscription/portal');
      window.location.href = res.data.url;
    } catch (err) {
      setError('No billing portal available. Please subscribe first.');
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel your subscription? You\'ll keep access until the end of your billing period.')) return;
    setActionLoading('cancel');
    try {
      await api.post('/subscription/cancel');
      setSuccess('Subscription will cancel at end of billing period.');
      await loadSubscription();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel subscription.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivate = async () => {
    setActionLoading('reactivate');
    try {
      await api.post('/subscription/reactivate');
      setSuccess('✓ Subscription reactivated!');
      await loadSubscription();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reactivate subscription.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  const isFreePlan = !subscription || subscription.plan?.type === 'free';
  const isCanceling = subscription && !subscription.billing?.autoRenew && subscription.plan?.type !== 'free';
  const periodEnd = subscription?.billing?.currentPeriodEnd
    ? new Date(subscription.billing.currentPeriodEnd).toLocaleDateString('en-US', { dateStyle: 'long' })
    : null;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">Subscription</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage your plan and billing</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-400 rounded-lg">
            {success}
          </div>
        )}

        {/* Current Plan Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Current Plan</h2>
            {subscription?.billing?.status && (
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${STATUS_COLORS[subscription.billing.status] || STATUS_COLORS.active}`}>
                {subscription.billing.status.replace('_', ' ').toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className={`text-5xl font-extrabold ${PLAN_COLORS[plan?.id || 'free']}`}>
              {plan?.name || 'Free'}
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-sm">{plan?.description}</p>
              {plan?.price > 0 && (
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">${plan.price}<span className="text-sm font-normal text-gray-500">/month</span></p>
              )}
            </div>
          </div>

          {/* Feature summary */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              ['Members', plan?.features?.maxMembers === -1 ? 'Unlimited' : `Up to ${plan?.features?.maxMembers}`],
              ['History', plan?.features?.historyMonths === -1 ? 'Unlimited' : `${plan?.features?.historyMonths} months`],
              ['AI Insights', plan?.features?.aiInsightsEnabled ? '✓ Included' : '✗ Not included'],
              ['Forecasting', plan?.features?.forecastingEnabled ? '✓ Included' : '✗ Not included'],
            ].map(([label, value]) => (
              <div key={label} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{value}</p>
              </div>
            ))}
          </div>

          {isCanceling && periodEnd && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-300">
              ⚠️ Your subscription will cancel on {periodEnd}. You can reactivate before then.
            </div>
          )}

          {periodEnd && !isCanceling && plan?.price > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Next billing date: <span className="font-medium text-gray-700 dark:text-gray-300">{periodEnd}</span></p>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            {isFreePlan ? (
              <button
                onClick={() => navigate('/pricing')}
                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-sm transition-colors"
              >
                Upgrade Plan
              </button>
            ) : (
              <>
                <button
                  onClick={handlePortal}
                  disabled={actionLoading === 'portal'}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-colors disabled:opacity-60"
                >
                  {actionLoading === 'portal' ? 'Opening...' : '💳 Manage Billing & Payment'}
                </button>

                {isCanceling ? (
                  <button
                    onClick={handleReactivate}
                    disabled={actionLoading === 'reactivate'}
                    className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm transition-colors disabled:opacity-60"
                  >
                    {actionLoading === 'reactivate' ? 'Reactivating...' : '↩ Reactivate'}
                  </button>
                ) : (
                  <button
                    onClick={handleCancel}
                    disabled={actionLoading === 'cancel'}
                    className="px-6 py-2.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60 rounded-lg font-semibold text-sm transition-colors disabled:opacity-60"
                  >
                    {actionLoading === 'cancel' ? 'Canceling...' : 'Cancel Subscription'}
                  </button>
                )}

                <button
                  onClick={() => navigate('/pricing')}
                  className="px-6 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-semibold text-sm transition-colors"
                >
                  Change Plan
                </button>
              </>
            )}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6">
          <h3 className="font-bold text-blue-900 dark:text-blue-300 mb-3">💡 Billing FAQ</h3>
          <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-400">
            <li>✓ All paid plans start with a <strong>14-day free trial</strong></li>
            <li>✓ You can cancel anytime — access continues until period end</li>
            <li>✓ Upgrade or downgrade at any time, prorated billing applies</li>
            <li>✓ Payment is processed securely by Stripe</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}
