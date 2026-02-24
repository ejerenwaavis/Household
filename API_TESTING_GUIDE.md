# Credit Card Overspend System - API Testing Guide

## Quick Start

### 1. Ensure Server is Running
```bash
cd server
npm install  # if needed
npm start    # or node src/index.js
```

### 2. Test Overspend Processing

#### Create Statement with Charges
```http
POST http://localhost:5000/api/credit-card-statements/household-123/statements
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN

{
  "cardId": "card_id_from_db",
  "statementDate": "2025-02-28",
  "charges": [
    {
      "memberId": "user_1",
      "memberName": "Maria",
      "amount": 1200,
      "description": "Combined purchases",
      "category": "Groceries",
      "source": "manual",
      "verified": false
    },
    {
      "memberId": "user_2",
      "memberName": "Avis",
      "amount": 800,
      "description": "Gas and utilities",
      "category": "Transportation",
      "source": "manual",
      "verified": false
    }
  ]
}
```

#### Process Statement (Detect Overspends)
```http
POST http://localhost:5000/api/credit-card-statements/household-123/statements/STATEMENT_ID/process
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response shows:**
- Detected overspends
- Created projects
- Generated notifications
- Any errors during processing

#### Get Overspend Summary
```http
GET http://localhost:5000/api/credit-card-statements/household-123/overspend-summary
Authorization: Bearer YOUR_JWT_TOKEN
```

### 3. Task Management

#### Get Member's Tasks
```http
GET http://localhost:5000/api/tasks/household-123/tasks
Authorization: Bearer YOUR_JWT_TOKEN
```

#### Complete a Task
```http
PATCH http://localhost:5000/api/tasks/household-123/tasks/TASK_ID
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN

{
  "status": "completed",
  "completionNotes": "Payment sent via bank transfer"
}
```

#### Get Task Summary (Dashboard)
```http
GET http://localhost:5000/api/tasks/household-123/tasks/summary
Authorization: Bearer YOUR_JWT_TOKEN
```

### 4. Overspend Project Management

#### Get Projects for Household
```http
GET http://localhost:5000/api/credit-card-statements/household-123/overspend-projects
Authorization: Bearer YOUR_JWT_TOKEN
```

#### Approve High-Value Overspend (>$1000)
```http
POST http://localhost:5000/api/credit-card-statements/household-123/overspend-projects/PROJECT_ID/approve
Authorization: Bearer YOUR_JWT_TOKEN (manager only)
```

#### Record Payment Progress
```http
POST http://localhost:5000/api/credit-card-statements/household-123/overspend-projects/PROJECT_ID/payments
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN (manager only)

{
  "amount": 300,
  "week": 1
}
```

## Flow Example

### Scenario: Maria charges $1200, need 50% responsibility

1. **Statement submitted** with charge:
   - Amount: $1200
   - Member: Maria
   - Income %: 50%

2. **Processing**:
   - Total > $500 threshold → Overspend detected
   - Maria's responsibility: $1200 × 50% = $600
   - $600 < $1000 threshold → Auto-create project
   - 4 weekly tasks created: $600 ÷ 4 = $150/week

3. **Notifications**:
   - Managers get: "Maria's overspend project created"
   - Maria gets: 4 tasks showing "$150 due this week"

4. **Maria pays**:
   - Week 1: Manager records $150 payment
   - Task 1 marked complete
   - Week 2-4: Repeat process

5. **Completion**:
   - After all 4 payments received
   - Project marked as "completed"
   - All tasks closed

## High-Value Approval Example

### Scenario: Avis charges $2500, need 50% responsibility

1. **Processing**:
   - Total > $500 threshold → Overspend detected
   - Avis's responsibility: $2500 × 50% = $1250
   - $1250 > $1000 threshold → Pending approval
   - 4 weekly tasks created BUT status is "pending_approval"

2. **Manager approval**:
   - Manager sees "Overspend requires approval"
   - Reviews details: $2500 charge, $1250 member responsibility
   - Clicks "Approve" button
   - Tasks automatically activated

3. **Notification to member**:
   - Avis now sees 4 active tasks
   - Each task: $312.50/week payment

## Configuration

**To adjust thresholds:**

Admin/Owner updates household settings:
```http
PATCH http://localhost:5000/api/households/household-123
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN

{
  "settings": {
    "creditCardOverspendThreshold": 500,
    "autoCreateOverspendProject": 1000
  }
}
```

## Error Handling

### Common Error Scenarios

**Statement already processed:**
```json
{
  "error": "Statement already processed"
}
```

**Household not found:**
```json
{
  "error": "Household not found"
}
```

**Permission denied:**
```json
{
  "error": "Only owners can approve projects"
}
```

**Rate limit exceeded:**
```
Status: 429 Too Many Requests
```

## Testing Checklist

- [ ] Submit statement with charges
- [ ] Process statement and verify overspends detected
- [ ] Confirm projects created for valid overspends
- [ ] Verify tasks assigned to members
- [ ] Check notifications generated
- [ ] Member completes task
- [ ] Record payment to project
- [ ] Verify task marked complete
- [ ] Check project status updates
- [ ] Test high-value approval workflow
- [ ] Verify role-based access control (managers only)

## Notes

- All endpoints require JWT authentication
- Rate limiting: 15 requests per 15 minutes
- Timestamps automatically recorded for audit trail
- All changes create audit logs (if audit middleware configured)
- Notifications can be persisted or sent via email/push
