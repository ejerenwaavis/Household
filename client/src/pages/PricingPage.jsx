import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

const FEATURE_LIST = {
  free:  ['2 household members', '3 months history', '50 expenses/month', '2 goals', 'Manual entry only'],
  basic: ['3 household members', '12 months history', '200 expenses/month', '5 goals', '1 linked bank account'],
  plus:  ['6 household members', '24 months history', 'Unlimited expenses', '20 goals', '3 linked accounts', 'AI financial insights', 'Spending forecasts'],
  pro:   ['Unlimited members', 'Unlimited history', 'Unlimited everything', 'AI insights', 'Custom reports', 'API access', 'Priority support'],
};

const PLAN_COLORS = {
  free: 'border-gray-200 dark:border-gray-700',
  basic: 'border-blue-300 dark:border-blue-700',
  plus: 'border-purple-500 dark:border-purple-500 ring-2 ring-purple-500',
  pro: 'border-indigo-400 dark:border-indigo-600',
};

const PLAN_BUTTON_COLORS = {
  free: 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 cursor-default',
  basic: 'bg-blue-600 hover:bg-blue-700 text-white',
  plus: 'bg-purple-600 hover:bg-purple-700 text-white',
  pro: 'bg-indigo-600 hover:bg-indigo-700 text-white',
};

export default function PricingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [plans, setPlans] = useState([]);
  const [currentPlan, setCurrentPlan] = useState('free');
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);

  const canceled = searchParams.get('canceled');

  useEffect(() => {
    api.get('/subscription').then(res => {
      setPlans(res.data.plans || []);
      setCurrentPlan(res.data.subscription?.plan?.type || 'free');
    }).catch(() => {});
  }, []);

  const handleSelectPlan = async (planId) => {
    if (planId === 'free' || planId === currentPlan) return;
    setLoading(planId);
    setError(null);
    try {
      const res = await api.post('/subscription/checkout', { planId });
      window.location.href = res.data.url;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start checkout. Please try again.');
      setLoading(null);
    }
  };

  const planOrder = ['free', 'basic', 'plus', 'pro'];
  const sortedPlans = planOrder.map(id => plans.find(p => p.id === id)).filter(Boolean);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3">Choose Your Plan</h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg">All paid plans include a 14-day free trial. No credit card required to start.</p>
          {canceled && (
            <div className="mt-4 inline-block bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300 px-4 py-2 rounded-lg text-sm">
              Checkout was canceled — no charge was made.
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-400 rounded-lg text-center">
            {error}
          </div>
        )}

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {sortedPlans.map(plan => {
            const isCurrent = plan.id === currentPlan;
            const isPopular = plan.highlight;
            const features = FEATURE_LIST[plan.id] || [];

            return (
              <div
                key={plan.id}
                className={`relative bg-white dark:bg-gray-800 rounded-2xl border-2 p-6 flex flex-col ${PLAN_COLORS[plan.id]} transition-shadow hover:shadow-lg`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    MOST POPULAR
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 right-4 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    CURRENT
                  </div>
                )}

                <div className="mb-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">{plan.name}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{plan.description}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-gray-900 dark:text-gray-100">
                      {plan.price === 0 ? 'Free' : `$${plan.price}`}
                    </span>
                    {plan.price > 0 && <span className="text-gray-500 dark:text-gray-400 text-sm">/month</span>}
                  </div>
                </div>

                <ul className="flex-1 space-y-2 mb-6">
                  {features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <span className="text-green-500 font-bold mt-0.5">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={isCurrent || plan.id === 'free' || loading === plan.id}
                  className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all ${
                    isCurrent
                      ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 cursor-default'
                      : PLAN_BUTTON_COLORS[plan.id]
                  } disabled:opacity-60`}
                >
                  {loading === plan.id ? 'Redirecting...' :
                   isCurrent ? 'Current Plan' :
                   plan.id === 'free' ? 'Free Forever' :
                   `Start ${plan.name} Trial`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer Note */}
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-8">
          Prices in USD. Cancel anytime. Secure payments via Stripe.
          {currentPlan !== 'free' && (
            <button onClick={() => navigate('/subscription')} className="ml-2 underline text-blue-600 dark:text-blue-400">
              Manage your subscription →
            </button>
          )}
        </p>
      </div>
    </Layout>
  );
}
