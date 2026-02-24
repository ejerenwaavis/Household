import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const TransactionReviewPage = () => {
  const { token: authToken } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">📊 Review Transactions</h1>
          <p className="text-gray-600">Review synced transactions from your bank accounts</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <AlertCircle className="w-12 h-12 text-blue-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Transaction Review</h2>
          <p className="text-gray-600 mb-4">
            This page will display transactions once you link a bank account.
          </p>
          <a 
            href="/linked-accounts" 
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Link Bank Account →
          </a>
        </div>
      </div>
    </div>
  );
};

export default TransactionReviewPage;
