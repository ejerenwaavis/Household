import { Link } from 'react-router-dom';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm p-8 md:p-12">

        {/* Header */}
        <div className="mb-8 border-b border-gray-200 pb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Privacy Policy</h1>
          <p className="text-sm text-gray-500">Effective Date: February 25, 2026</p>
        </div>

        <div className="space-y-8 text-gray-700 leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
            <p>
              ACED Division LLC (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) operates the Household Budget
              application (the &ldquo;Service&rdquo;). We are committed to protecting your privacy and ensuring the
              security of your personal and financial information. This Privacy Policy explains how we collect, use,
              disclose, and safeguard your information when you use our Service.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
            <p className="mb-3">To provide our tools, we collect the following types of information:</p>
            <ul className="space-y-3 list-none">
              <li className="pl-4 border-l-4 border-blue-200">
                <span className="font-medium text-gray-800">Account Information:</span> Name, email address, and
                password when you register for an account.
              </li>
              <li className="pl-4 border-l-4 border-blue-200">
                <span className="font-medium text-gray-800">Financial Information:</span> We use Plaid Inc.
                (&ldquo;Plaid&rdquo;) to connect your account with your bank accounts. We receive read-only access to
                data such as transaction history, account balances, and masked account details (e.g., the last four
                digits). We do not receive, collect, or store your full bank account numbers, routing numbers, or your
                banking login credentials.
              </li>
              <li className="pl-4 border-l-4 border-blue-200">
                <span className="font-medium text-gray-800">Usage Data:</span> Basic log data regarding how you
                interact with our application, which is used strictly for troubleshooting and improving the Service.
              </li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
            <p className="mb-3">
              We use the information we collect strictly to operate the Service, specifically to:
            </p>
            <ul className="space-y-2 list-disc list-inside text-gray-700">
              <li>Categorize transactions and provide household budgeting insights.</li>
              <li>Maintain and secure your account.</li>
              <li>Provide customer support and respond to inquiries.</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. How We Share Your Information</h2>
            <p className="mb-3">
              We do not sell, rent, or trade your personal or financial information. We only share your data with
              trusted third-party service providers who assist us in operating our application, strictly under
              obligations of confidentiality:
            </p>
            <ul className="space-y-3 list-none">
              <li className="pl-4 border-l-4 border-green-200">
                <span className="font-medium text-gray-800">Financial Data Partners:</span> We share necessary
                connection data with Plaid to facilitate the secure transfer of your financial information. Plaid&apos;s
                use of your data is governed by the{' '}
                <a
                  href="https://plaid.com/legal/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Plaid End User Privacy Policy
                </a>
                .
              </li>
              <li className="pl-4 border-l-4 border-green-200">
                <span className="font-medium text-gray-800">Infrastructure Providers:</span> Your data is hosted and
                secured utilizing Namecheap for web hosting and MongoDB for encrypted database services.
              </li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data Security and Retention</h2>
            <p>
              We implement industry-standard security measures to protect your data. All sensitive financial data
              retrieved via Plaid is encrypted at rest using volume-level storage encryption provided by our database
              host. We retain your personal and financial information only for as long as your account is active or as
              needed to provide you with the Service.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Your Rights and Choices</h2>
            <p className="mb-3">You have full control over your data:</p>
            <ul className="space-y-3 list-none">
              <li className="pl-4 border-l-4 border-purple-200">
                <span className="font-medium text-gray-800">Disconnecting Accounts:</span> You can revoke Household
                Budget&apos;s access to your financial institutions at any time within the application settings, which
                severs the connection through Plaid.
              </li>
              <li className="pl-4 border-l-4 border-purple-200">
                <span className="font-medium text-gray-800">Account Deletion:</span> You may request the complete
                deletion of your account and all associated personal and financial data by contacting us.
              </li>
              <li className="pl-4 border-l-4 border-purple-200">
                <span className="font-medium text-gray-800">Access and Correction:</span> You may review and update
                your account information at any time within your profile settings.
              </li>
            </ul>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy periodically. We will notify you of any significant changes by posting
              the new Privacy Policy on this page and updating the &ldquo;Effective Date&rdquo; at the top.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Contact Us</h2>
            <p className="mb-3">
              If you have any questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
              <p><span className="font-medium">Email:</span>{' '}
                <a href="mailto:support@aceddivision.com" className="text-blue-600 hover:underline">
                  support@aceddivision.com
                </a>
              </p>
              <p><span className="font-medium">Entity:</span> ACED Division LLC</p>
              <p><span className="font-medium">Location:</span> Cumming, Georgia, USA</p>
            </div>
          </section>
        </div>

        {/* Footer nav */}
        <div className="mt-10 pt-6 border-t border-gray-200 flex flex-wrap gap-4 justify-between items-center text-sm text-gray-500">
          <Link to="/terms" className="text-blue-600 hover:underline">Terms &amp; Conditions</Link>
          <Link to="/register" className="text-blue-600 hover:underline">← Back to Sign Up</Link>
        </div>
      </div>
    </div>
  );
}
