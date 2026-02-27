import { Link } from 'react-router-dom';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm p-8 md:p-12">

        {/* Header */}
        <div className="mb-8 border-b border-gray-200 pb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Terms and Conditions</h1>
          <p className="text-sm text-gray-500">Effective Date: February 27, 2026</p>
        </div>

        <div className="space-y-8 text-gray-700 leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p>
              By downloading, accessing, or using the Household Budget application (the &ldquo;Service&rdquo;), provided
              by ACED Division LLC (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), you agree to be bound by
              these Terms and Conditions. If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Description of Service</h2>
            <p>
              Household Budget is a personal finance management tool designed to help users track and categorize their
              expenses. The Service provides read-only access to your financial transaction history via third-party
              integrations to assist in personal budgeting.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Third-Party Services and Plaid Integration</h2>
            <p>
              Our Service utilizes Plaid Inc. (&ldquo;Plaid&rdquo;) to connect to your financial institutions. By using
              our Service, you grant us and Plaid the right, power, and authority to act on your behalf to access and
              transmit your personal and financial information from the relevant financial institution. You agree to
              your personal and financial information being transferred, stored, and processed by Plaid in accordance
              with the{' '}
              <a
                href="https://plaid.com/legal/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Plaid End User Privacy Policy
              </a>
              .
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. User Responsibilities</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account login information and are fully
              responsible for all activities that occur under your account. You agree to provide accurate, current, and
              complete information when creating your account and connecting financial institutions.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              5. Limitation of Liability and Disclaimer of Warranties
            </h2>
            <p className="mb-3">
              The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind.
              ACED Division LLC is not a financial planner, broker, or tax advisor. The Service is intended only to
              assist you in your financial organization and decision-making and is broad in scope. Your personal
              financial situation is unique, and any information and advice obtained through the Service may not be
              appropriate for your situation.
            </p>
            <p>
              To the maximum extent permitted by law, ACED Division LLC shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether
              incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses
              resulting from your use of the Service.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Intellectual Property</h2>
            <p>
              All code, design, graphics, and text included in the Service are the intellectual property of ACED
              Division LLC and are protected by applicable copyright and trademark laws. You may not copy, modify,
              distribute, or reverse-engineer any part of the Service.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account and access to the Service at our sole
              discretion, without notice, for conduct that we believe violates these Terms and Conditions or is harmful
              to other users of the Service, us, or third parties, or for any other reason.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Governing Law</h2>
            <p>
              These Terms and Conditions shall be governed by and construed in accordance with the laws of the State of
              Georgia, United States, without regard to its conflict of law provisions.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Contact Information</h2>
            <p className="mb-3">
              If you have any questions or concerns about these Terms, please contact us at:
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
          <Link to="/privacy-policy" className="text-blue-600 hover:underline">Privacy Policy</Link>
          <Link to="/register" className="text-blue-600 hover:underline">← Back to Sign Up</Link>
        </div>
      </div>
    </div>
  );
}
