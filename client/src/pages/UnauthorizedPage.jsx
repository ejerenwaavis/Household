import React from 'react';
import { Link } from 'react-router-dom';

export default function UnauthorizedPage(){
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-xl w-full bg-white p-8 rounded-2xl shadow-md text-center">
        <h1 className="text-2xl font-bold text-gray-800">Unauthorized Access</h1>
        <p className="mt-3 text-gray-600">You do not have permission to view that page. Please sign in with appropriate credentials.</p>
        <div className="mt-6">
          <Link to="/login" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Go to Login</Link>
        </div>
      </div>
    </div>
  );
}
