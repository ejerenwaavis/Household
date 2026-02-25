# Manual QA Checklist

## Pre-Release Testing Checklist

### 1. Authentication & Security
- [ ] User can register with valid email and strong password
- [ ] Registration rejects weak passwords with helpful message
- [ ] Registration rejects invalid email formats
- [ ] User can login with correct credentials
- [ ] Login rejects invalid credentials without revealing which is wrong
- [ ] Tokens are generated and stored correctly
- [ ] Refresh token successfully generates new access token
- [ ] Logout invalidates refresh tokens
- [ ] User cannot access protected routes without token
- [ ] Expired tokens are properly rejected
- [ ] CORS headers are properly configured for allowed origins
- [ ] Sensitive headers (X-Frame-Options, CSP) are present

### 2. User Management
- [ ] User profile can be viewed
- [ ] User can change password
- [ ] Password change requires old password verification
- [ ] Password change requires new password confirmation
- [ ] User can update profile information
- [ ] User avatar/profile picture uploads work
- [ ] User can view login history
- [ ] Sessions are tracked correctly

### 3. Household Management
- [ ] User can create a household
- [ ] Household name is validated (required, min 2 chars)
- [ ] User can update household settings
- [ ] User can view household members
- [ ] User can invite members by email
- [ ] Invitation email is sent to invited member
- [ ] Invited member receives invitation notification
- [ ] Invited member can accept/decline invitation
- [ ] Only authorized members can view household data
- [ ] Member roles and permissions are enforced

### 4. Credit Card Management
- [ ] User can add credit card
- [ ] Credit card form validates card number (Luhn check)
- [ ] Credit card form validates expiry date (MM/YY format)
- [ ] Credit card form validates CVV (3-4 digits)
- [ ] Card holder name is validated
- [ ] Credit limit is positive number
- [ ] Interest rate is between 0-100%
- [ ] User can update card information
- [ ] User can view list of all cards
- [ ] User can deactivate/delete card
- [ ] Cannot delete card with active statements
- [ ] Card details are encrypted at rest

### 5. Card Statements
- [ ] User can create statement for card
- [ ] Statement date is validated and stored correctly
- [ ] All balance fields are required
- [ ] Opening balance matches previous closing balance (or shown as warning)
- [ ] Closing balance formula is calculated correctly
- [ ] Cannot exceed credit limit
- [ ] Duplicate prevention: Cannot create two statements for same card/month
- [ ] User is offered to edit existing statement if duplicate attempt
- [ ] Month is automatically calculated from statement date
- [ ] Month field displays correctly (e.g., "February 2026")
- [ ] All amount fields support decimal precision (2 places)
- [ ] User can view statement history by month
- [ ] User can update existing statement
- [ ] Statement calculations are recalculated on update
- [ ] User can delete statement with warning
- [ ] Deleted statement frees up month slot for re-entry

### 6. Debt Payments
- [ ] User can create payment record for card
- [ ] Payment date cannot be before statement date
- [ ] Payment date cannot be in future
- [ ] Payment amount is positive and less than or equal to balance
- [ ] Payment method options are available (cash, check, wire, ACH)
- [ ] Payment reference number is optional but stored
- [ ] User can view payment history
- [ ] Payments are grouped by month
- [ ] User can update payment
- [ ] User can delete payment
- [ ] Payment balance calculations are correct

### 7. Form Validation (Frontend)
- [ ] Real-time validation shows errors as user types
- [ ] Valid field shows green checkmark
- [ ] Invalid field shows red X and error message
- [ ] Password strength indicator shows color coding
- [ ] Form prevents submission when invalid
- [ ] Clear/Reset button clears all form data
- [ ] Currency fields format with commas and decimals
- [ ] Date fields show calendar picker
- [ ] Phone fields show formatting suggestions
- [ ] Email autocomplete is available

### 8. Financial Calculations
- [ ] Total balance calculations are accurate
- [ ] Credit utilization ratio is calculated correctly (within 0.01%)
- [ ] Monthly payment estimates are correct (within $0.01)
- [ ] Interest calculations match financial standards
- [ ] Percentage calculations don't have rounding errors
- [ ] All calculations handle edge cases (zero amounts, null values)
- [ ] Calculations display with proper formatting

### 9. Data Display & Reporting
- [ ] Statements are sorted by month (descending)
- [ ] Cards are grouped logically in views
- [ ] Summary totals are accurate
- [ ] Charts and graphs display correctly
- [ ] Export to CSV works and includes all data
- [ ] Export file uses proper formatting
- [ ] Print functionality includes all relevant data
- [ ] Mobile view is responsive and readable
- [ ] Data formatting is consistent across app

### 10. Error Handling
- [ ] Network errors show user-friendly messages
- [ ] Validation errors list all fields with issues
- [ ] Business logic errors explain the constraint
- [ ] Duplicate statements show "Edit Existing" option
- [ ] Rate limit errors are caught and shown
- [ ] Server errors don't show stack traces to user
- [ ] User is prompted to retry after temporary errors
- [ ] Error IDs are provided for support tickets
- [ ] Console shows detailed errors for debugging

### 11. Performance
- [ ] Page loads in under 2 seconds
- [ ] Form submission completes in under 1 second
- [ ] Searching/filtering completes instantly
- [ ] No excessive console warnings/errors
- [ ] Memory usage is stable (no memory leaks)
- [ ] Charts render efficiently even with large data sets
- [ ] Mobile performance is acceptable

### 12. Database & Backend
- [ ] Dates are stored consistently (UTC/ISO format)
- [ ] Month field is auto-calculated (never independently input)
  - [ ] Verify in database: month = derived from statementDate
  - [ ] Pre-save hook is working on all documents
  - [ ] No cases where month differs from calculated value
- [ ] Balance fields have proper decimal precision
- [ ] Compound indexes are created (householdId, cardId, month)
- [ ] Unique constraints prevent duplicates
- [ ] Foreign key relationships are maintained
- [ ] No orphaned data records
- [ ] Timestamps are accurate

### 13. API Endpoints
- [ ] Authentication endpoints work (register, login, refresh, logout)
- [ ] All endpoints validate input with Joi schemas
- [ ] Validation errors return detailed field-level messages
- [ ] Business logic validation rejects invalid scenarios
- [ ] Protected endpoints require authentication
- [ ] Household endpoints verify user authorization
- [ ] Rate limiting is enforced per endpoint
- [ ] Response headers include metadata (timestamps, pagination)
- [ ] 400 errors are returned for validation
- [ ] 401 errors are returned for auth failures
- [ ] 403 errors are returned for authorization failures
- [ ] 409 errors are returned for conflicts (duplicate statements)
- [ ] 500 errors are logged with error ID for support

### 14. Logging & Monitoring
- [ ] Important events are logged with timestamps
- [ ] Login attempts are logged
- [ ] Failed validation attempts are logged
- [ ] Errors include error ID for tracking
- [ ] Sentry captures errors in production
- [ ] Performance metrics are tracked
- [ ] No sensitive data (passwords, tokens) is logged
- [ ] Log rotation is working
- [ ] Old logs are archived

### 15. Security
- [ ] All passwords meet strength requirements (8+ chars, upper, lower, number, special)
- [ ] Tokens expire after 15 minutes (access) / 7 days (refresh)
- [ ] Refresh tokens rotate on use
- [ ] Failed login attempts are rate-limited (5/15min)
- [ ] SQL/NoSQL injection is prevented (input sanitization)
- [ ] XSS attacks are prevented (HTML encoding, CSP)
- [ ] CSRF tokens are used where applicable
- [ ] Sensitive data (credit cards) is never logged
- [ ] HTTPS/SSL is enforced in production
- [ ] Session hijacking is prevented (token versioning)

### 16. Browser Compatibility
- [ ] Chrome (latest 2 versions)
- [ ] Firefox (latest 2 versions)
- [ ] Safari (latest 2 versions)
- [ ] Edge (latest 2 versions)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)
- [ ] All features work consistently across browsers

### 17. Accessibility
- [ ] All form inputs have labels
- [ ] Color isn't the only indicator of status
- [ ] Error messages are associated with fields
- [ ] Tab navigation works through form
- [ ] Focus indicators are visible
- [ ] Images have alt text
- [ ] Contrast ratios meet WCAG standards
- [ ] Forms can be submitted with keyboard only

### 18. Regression Testing
- [ ] Month display still shows correct month (not timezone shifted)
- [ ] Duplicate prevention still works
- [ ] Pre-save hooks still calculate month from date
- [ ] Existing statements can still be edited
- [ ] Date comparisons are still timezone-safe
- [ ] All previously fixed bugs still stay fixed

### Sign-Off

**Test Date:** _______________
**Tester Name:** _______________
**Overall Status:** ☐ PASS  ☐ FAIL  ☐ CONDITIONAL (note issues below)

**Critical Issues Found:**
- 
- 
- 

**Minor Issues Found:**
- 
- 

**Recommended Actions:**
- 
- 

**Notes:**
___________________________________________________________________________
___________________________________________________________________________

