import 'dotenv/config';
import mongoose from 'mongoose';
import FixedExpense from '../src/models/FixedExpense.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/household';

// IMPORTANT: Replace these with your actual household and user IDs
const HOUSEHOLD_ID = process.env.HOUSEHOLD_ID || 'household-1';
const USER_ID = process.env.USER_ID || 'user-1';

const fixedExpenses = [
  { name: 'Rent', nameES: 'Renta', amount: 1000, group: 'Housing', frequency: 'monthly', dueDay: 1 },
  { name: 'Phone', nameES: 'Teléfono', amount: 305, group: 'Utilities', frequency: 'monthly', dueDay: 15 },
  { name: 'Auto Insurance', nameES: 'Seguro del Carro', amount: 395, group: 'Insurance', frequency: 'monthly', dueDay: 10 },
  { name: 'Health Insurance', nameES: 'Seguro Médico', amount: 105, group: 'Insurance', frequency: 'monthly', dueDay: 10 },
  { name: 'Car Payment', nameES: 'Pago del Carro', amount: 1050, group: 'Auto', frequency: 'monthly', dueDay: 5 },
  { name: 'Vehicle Maintenance', nameES: 'Mantenimiento del Vehículo', amount: 300, group: 'Auto', frequency: 'monthly', dueDay: 20 },
  { name: 'Family Support', nameES: 'Apoyo Familiar', amount: 250, group: 'Family', frequency: 'monthly', dueDay: 1 },
  { name: 'Gabby – School', nameES: 'Gabby – Escuela', amount: 770, group: 'Family', frequency: 'monthly', dueDay: 1 },
  { name: 'Family Support - Maria', nameES: 'Apoyo Familia Maria', amount: 600, group: 'Family', frequency: 'monthly', dueDay: 1 },
  { name: 'Food', nameES: 'Comida', amount: 300, group: 'Food', frequency: 'monthly', dueDay: 1 },
  { name: 'Emergency Fund', nameES: 'Fondo de Emergencia', amount: 500, group: 'Savings', frequency: 'monthly', dueDay: 1 },
  { name: 'Project Fund', nameES: 'Fondo de Proyecto', amount: 500, group: 'Savings', frequency: 'monthly', dueDay: 1 },
  { name: 'Credit Card Payment', nameES: 'Pago de Tarjeta de Crédito', amount: 400, group: 'Debt', frequency: 'monthly', dueDay: 20 },
  { name: 'Affirm Purchases', nameES: 'Compras de Affirm', amount: 300, group: 'Bills', frequency: 'monthly', dueDay: 15 },
  { name: 'Lawyer Fees', nameES: 'Honorarios de Abogado', amount: 300, group: 'Bills', frequency: 'monthly', dueDay: 25 },
  { name: 'Home/Digital Entertainment', nameES: 'Entretenimiento Digital', amount: 40, group: 'Entertainment', frequency: 'monthly', dueDay: 1 },
];

async function seedFixedExpenses() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Check if expenses already exist
    const existing = await FixedExpense.countDocuments({ householdId: HOUSEHOLD_ID });
    if (existing > 0) {
      console.log(`⚠️  Found ${existing} existing fixed expenses. Skipping seed to avoid duplicates.`);
      console.log('   To reseed, delete existing records first or change HOUSEHOLD_ID.');
      await mongoose.connection.close();
      return;
    }

    // Insert all fixed expenses
    const docs = fixedExpenses.map(exp => ({
      ...exp,
      householdId: HOUSEHOLD_ID,
      userId: USER_ID,
      isActive: true,
    }));

    const result = await FixedExpense.insertMany(docs);
    console.log(`✅ Seeded ${result.length} fixed expenses into householdId: ${HOUSEHOLD_ID}`);

    // Calculate total
    const total = fixedExpenses.reduce((sum, e) => sum + e.amount, 0);
    console.log(`💰 Total Monthly Fixed Expenses: $${total.toFixed(2)}`);

    // Group by category
    const byGroup = {};
    fixedExpenses.forEach(exp => {
      if (!byGroup[exp.group]) byGroup[exp.group] = 0;
      byGroup[exp.group] += exp.amount;
    });

    console.log('\n📊 Breakdown by Category:');
    Object.entries(byGroup).sort().forEach(([group, amount]) => {
      console.log(`  ${group}: $${amount.toFixed(2)}`);
    });

    await mongoose.connection.close();
    console.log('\n✅ Seed completed successfully!');
  } catch (error) {
    console.error('❌ Seed error:', error.message);
    process.exit(1);
  }
}

seedFixedExpenses();
