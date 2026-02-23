import 'dotenv/config';
import mongoose from 'mongoose';
import Household from '../src/models/Household.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/household';

async function findHouseholds() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const households = await Household.find().select('householdId householdName members').limit(10);

    if (households.length === 0) {
      console.log('❌ No households found. Create a household first by signing up.');
      await mongoose.connection.close();
      return;
    }

    console.log('📋 Found Households:\n');
    households.forEach((h, i) => {
      console.log(`${i + 1}. Household: "${h.householdName}"`);
      console.log(`   ID: ${h.householdId}`);
      if (h.members && h.members.length > 0) {
        console.log(`   Members:`);
        h.members.forEach(m => {
          console.log(`     - ${m.name} (${m.userId}) [${m.role}]`);
        });
      }
      console.log();
    });

    console.log('📝 To seed fixed expenses, run:');
    console.log('   HOUSEHOLD_ID="<householdId>" USER_ID="<userId>" node scripts/seedFixedExpenses.js\n');

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

findHouseholds();
