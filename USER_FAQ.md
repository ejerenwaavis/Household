# Household Finance Manager - User FAQ

## Getting Started

### How do I create an account?
Click "Sign Up" on the home page. Enter your email, create a strong password (must include uppercase, lowercase, number, and special character), your name, and household name. Click "Create Account" and you'll be logged in immediately.

### What is a household?
A household is your financial management group. You can have multiple members in a household who can all see and manage the finances together. When you sign up, you become the household owner.

### How do I invite family members?
1. Go to "Settings" → "Household" → "Members"
2. Click "Invite Member"
3. Enter their email address and select their role (Member or Admin)
4. They'll receive an email invitation they can accept to join

### Can I have multiple households?
Currently, each account is tied to one household. If you need to manage finances separately, please contact support.

---

## Credit Cards

### How do I add a credit card?
1. Go to "Credit Cards" section
2. Click "Add New Card"
3. Enter card holder name, card number, expiry date (MM/YY), CVV, credit limit, and interest rate
4. Click "Add Card"

**Note:** Card information is encrypted and never displayed after initial entry.

### What happens if I enter an invalid card number?
The system uses the Luhn algorithm to validate card numbers. Invalid numbers will be rejected with a helpful error message.

### Can I edit card information?
Yes, click the card and select "Edit". You can update the credit limit, interest rate, and activation status. Card number is never editable for security.

### How do I deactivate a card?
Go to the card details and toggle "Active" to off. Deactivated cards are hidden from statements and calculations but historical data remains.

---

## Card Statements

### What is a card statement?
A monthly statement showing your opening balance, purchases, payments, fees, interest charges, and closing balance. Track your credit card balances month by month.

### How do I create a statement?
1. Go to "Statements" for a specific card
2. Click "Add Statement"
3. Enter the statement date (automatically calculates which month)
4. Enter all balance amounts
5. The system will validate:
   - Closing balance formula: Opening + Purchases + Interest + Fees - Payments
   - Closing balance doesn't exceed card limit
   - No duplicate statement for this month
6. Click "Save"

### What does "Month" mean?
Month is automatically derived from the statement date. For example, if you enter "2026-02-24" as the date, the month automatically becomes "February 2026" (2026-02). You cannot manually enter the month.

### Why am I seeing "January 2026" instead of "February 2026"?
This was a known bug that has been fixed. The issue was timezone shifting when parsing dates. If you still see incorrect months, please try:
1. Refresh the page (Ctrl+F5 or Cmd+Shift+R)
2. Clear your browser cache
3. Log out and back in

If the issue persists, contact support with your card name and statement date.

### Why can't I create a statement for the same card and month twice?
This is by design. Each card can have only one statement per month. If you need to update an existing statement:
1. Click the statement to view details
2. Click "Edit"
3. Make your changes and save

When you try to create a duplicate, you'll see "Edit Existing" option to quickly open the existing statement.

### Can I delete a statement?
Yes, click the statement and select "Delete". This will remove the statement and free up that month slot if you need to re-enter it. Deleted statements cannot be recovered.

### My closing balance formula doesn't match. What's wrong?
The system validates that:
> Closing Balance = Opening Balance + Purchases + Interest + Fees - Payments

If your numbers don't match this formula, check:
- Did you include all charges? (Some statements show fees separately)
- Did you account for all payments? (Including automatic payments)
- Are decimal places correct? (0.01 tolerance allowed)

If it still doesn't balance, the statement may have errors from your bank. You can add a note explaining the discrepancy.

---

## Debt Payments

### What is a debt payment?
A record of a payment you made toward your credit card debt. Track when you paid, how much, and the payment method.

### How do I record a payment?
1. Go to "Payments" for a specific card
2. Click "Add Payment"
3. Enter payment date (must be on or after statement date, cannot be future)
4. Enter payment amount (must be positive, cannot exceed card balance)
5. Select payment method (Cash, Check, Wire, ACH, or Other)
6. Optionally enter reference number (check #, transaction ID, etc.)
7. Click "Save"

### Can a payment be larger than the statement balance?
No, the system prevents payments that exceed the available balance. If you need to overpay (for example, for next month), create a new statement first.

### Why does my payment date have to be after the statement date?
Logically, you cannot make a payment before the statement is issued. Payment dates must fall within the statement month to properly track.

### Can I make a payment from the future?
No, payment dates cannot be in the future. Only record payments you've actually made on or before today.

---

## Navigation & Features

### How do I view my financial summary?
Go to the "Dashboard" home page to see:
- Total credit card debt
- Credit utilization ratio (how much of your limits you're using)
- Recent statements and payments
- Monthly trends

### How do I export my data?
1. Click "Export" button on any page
2. Choose format:
   - CSV (for Excel/Sheets)
   - PDF (for printing/sharing)
3. Your data downloads automatically

### Can I print statements?
Yes, use your browser's print function (Ctrl+P or Cmd+P) or click "Export" → "PDF" to generate a printable version.

### How do I search for specific data?
Most pages have a search box. You can search by:
- Card name
- Month
- Amount

### How do I change my display settings?
Go to "Settings" → "Preferences" to customize:
- Currency format
- Date format
- Default language
- Dark/Light theme

---

## Account & Security

### How do I change my password?
1. Go to "Settings" → "Account"
2. Click "Change Password"
3. Enter your current password
4. Enter new password (must meet strength requirements)
5. Confirm new password
6. Click "Update"

### What makes a strong password?
Your password must have at least 8 characters and include:
- ✓ Uppercase letters (A-Z)
- ✓ Lowercase letters (a-z)
- ✓ Numbers (0-9)
- ✓ Special characters (!@#$%^&*)

Examples of strong passwords:
- `FamilyBudget2024!`
- `Secure#Pass99`
- `MyHouse$2026`

### How do I enable two-factor authentication?
This feature is coming soon. We're working on adding 2FA for additional security.

### What should I do if I forget my password?
1. Click "Forgot Password" on the login page
2. Enter your email address
3. Check your email for a password reset link
4. The link expires in 24 hours
5. Create a new password and log in

Not receiving the email? Check your spam folder or contact support.

### My data is sensitive. How is it protected?
Your data is protected by:
- End-to-end HTTPS encryption (SSL/TLS 1.2+)
- Passwords are hashed with bcrypt (never stored in plain text)
- Credit card data is encrypted at rest
- Regular security audits
- Rate limiting to prevent brute force attacks
- Session tokens expire after 15 minutes of activity

### How long are my sessions active?
- Access tokens expire after 15 minutes of activity
- Refresh tokens last 7 days
- Logging out immediately ends your session
- Closing the browser doesn't auto-logout, but you'll need to re-authenticate after 15 minutes

### What happens if my device is lost?
1. Log in on another device
2. Go to "Settings" → "Security" → "Active Sessions"
3. Click "Log Out All Devices" - this will invalidate all your refresh tokens
4. Log in again on your new device

---

## Calculations & Formulas

### How is credit utilization calculated?
> Credit Utilization = (Total Card Balances) ÷ (Total Credit Limits) × 100%

Example: If you owe $2,500 across cards with a $5,000 total limit:
- Utilization = (2,500 ÷ 5,000) × 100% = 50%

Lower is better. Lenders typically like to see < 30% utilization.

### How is interest calculated?
The app displays interest rates but doesn't auto-calculate. You enter the interest charges from your statement. If you want to project future interest:
> Formula: Balance × (Annual Rate ÷ 12) = Monthly Interest

Example: $5,000 balance at 18% interest
- Monthly Interest = $5,000 × (0.18 ÷ 12) = $75

### How is monthly payment calculated?
You enter your actual payments. The app doesn't auto-calculate minimum payments, but if you want guidance:
> Minimum Typically = Balance × 1-2% (check your card agreement)

For 0% interest loans:
> Monthly Payment = Total Amount ÷ Number of Months

---

## Troubleshooting

### I can't log in. What should I do?
1. Verify you're using the correct email address (case-insensitive)
2. Check "Forgot Password" if you're unsure about your password
3. Try clearing your browser cache (Ctrl+Shift+Delete)
4. Try a different browser (Chrome, Firefox, Safari)
5. Disable extensions temporarily (they can interfere with login)
6. Contact support if issue persists

### The app is very slow
1. Try refreshing the page (F5 or Cmd+R)
2. Check your internet connection
3. Close other browser tabs using heavy resources
4. Try a different browser
5. Report performance issues to support

### A statement won't save even though I entered all data
Check the error message to see what validation failed. Common issues:
- [ ] Closing balance doesn't match formula
- [ ] Closing balance exceeds credit limit
- [ ] Month is a duplicate
- [ ] Amounts have too many decimal places (max 2)
- [ ] Date is invalid

Fix the specific error and try again.

### My data looks wrong. Can I fix it?
Yes! You can edit any statement or payment. Click the item, select "Edit", make changes, and save. Updated calculations happen automatically.

### Data is missing from my household
1. Confirm you're in the correct household (check top left)
2. Verify members have permission to view data (admin/member roles)
3. Check if data was deleted accidentally
4. Contact support if data still appears missing

### I don't see an expected field or feature
We're continuously adding new features. Check:
- [ ] Your software is up to date (refresh page)
- [ ] You have the correct user role (some features require admin)
- [ ] The feature is available in your region
- [ ] You're not using an outdated browser

Update to the latest version or contact support.

---

## Getting Help

### How do I contact support?
- **Email:** support@household-finance.app
- **Live Chat:** Available Mon-Fri 9AM-5PM EST (click chat icon)
- **Help Center:** help.household-finance.app

### What information should I provide when reporting a bug?
Please include:
- Description of what happened
- Steps to reproduce
- Browser/device type
- Error ID (if shown)
- Screenshot if possible
- Your user email (don't share password!)

This helps us fix issues faster.

### Is there a knowledge base or community forum?
Yes! Visit our knowledge base at help.household-finance.app. You can also post questions in our community forum at community.household-finance.app

### How do I suggest a feature?
We'd love your feedback! Email suggestions to features@household-finance.app or post in the community forum. Features that get the most votes are prioritized for development.

---

## About Your Data

### Will my data be deleted if I delete my account?
Yes, deleting your account removes all your data within 30 days. We keep a backup for 30 days in case of accidental deletion, then permanently delete it.

**Warning:** This action is irreversible.

### Can I export my data?
Yes, you can export financial statements as CSV or PDF anytime. Go to any page and click "Export". Historical exports are not automatically kept, so export regularly if you want archives.

### How long is my data kept?
- **Active data:** Kept as long as your account is active
- **Deleted account:** 30-day grace period, then permanent deletion
- **Backups:** MongoDB Atlas keeps 7-day rolling backups
- **Audit logs:** 90 days for security purposes

### Who can see my data?
Only household members you invite can see your data. All members see all household financial information. The system doesn't support limiting data visibility within a household.

---

## Additional Resources

- **Homepage:** www.household-finance.app
- **API Documentation:** api.household-finance.app/docs
- **Blog:** blog.household-finance.app (tips, feature announcements)
- **Twitter:** @HouseholdFinApp
- **Status Page:** status.household-finance.app

---

**Last Updated:** February 24, 2026  
**FAQ Version:** 1.0  
**Still have questions?** Contact support@household-finance.app
