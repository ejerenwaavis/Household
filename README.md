# Household Budget App

Clean, safe MERN stack budgeting application with multi-tenant household support.

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment

Create `server/.env`:
```
MONGO_URI=mongodb://localhost:27017/household
JWT_SECRET=your-secret-key-change-in-production
PORT=5000
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

### 3. Start Development
```bash
npm run dev
```

Server runs on `http://localhost:5000`
Client runs on `http://localhost:5173`

## Dependencies Used

### Backend (Server)
- **express** - Web framework
- **mongoose** - MongoDB ODM
- **jsonwebtoken** - JWT authentication
- **bcryptjs** - Password hashing
- **cors** - Cross-origin requests
- **dotenv** - Environment variables
- **uuid** - ID generation

All are popular, well-maintained packages with minimal security concerns.

### Frontend (Client)
- **react** - UI library
- **react-router-dom** - Client routing
- **axios** - HTTP client
- **vite** - Build tool
- **tailwindcss** - Styling
- **postcss** - CSS processing

All popular, stable packages with strong communities.

## Architecture

```
/server
  /src
    /models       - Mongoose schemas
    /routes       - API endpoints
    /middleware   - Auth & validation
    /app.js       - Express setup

/client
  /src
    /pages        - Page components
    /hooks        - Custom hooks
    /services     - API service
    /index.css    - Tailwind CSS
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login

### Households
- `GET /api/households/:householdId` - Get household
- `GET /api/households/:householdId/summary` - Get summary

### Income
- `POST /api/income/:householdId/daily` - Log income
- `GET /api/income/:householdId/:month` - Get monthly income

### Expenses
- `POST /api/expenses/:householdId` - Log expense
- `GET /api/expenses/:householdId/:month` - Get monthly expenses
- `DELETE /api/expenses/:householdId/:expenseId` - Delete expense

## Multi-Tenant Isolation

Every API endpoint is protected:
1. Authentication middleware verifies JWT
2. Household middleware verifies user belongs to household
3. All database queries filtered by householdId

This ensures complete data isolation between households.
