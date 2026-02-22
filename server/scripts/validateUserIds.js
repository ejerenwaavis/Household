import 'dotenv/config';
import mongoose from 'mongoose';
import Household from '../src/models/Household.js';
import User from '../src/models/User.js';

async function validate() {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI not set');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const households = await Household.find({});
    let totalMembers = 0;
    let missing = [];

    for (const hh of households) {
      for (const m of hh.members) {
        totalMembers++;
        const user = await User.findOne({ userId: m.userId });
        if (!user) {
          missing.push({ householdId: hh.householdId, householdName: hh.householdName, memberName: m.name, userId: m.userId });
        }
      }
    }

    console.log(`Checked ${households.length} households and ${totalMembers} members.`);
    if (missing.length === 0) {
      console.log('✅ All member.userId values match a User document.');
    } else {
      console.log(`❌ Found ${missing.length} members with missing users:`);
      console.log(JSON.stringify(missing, null, 2));
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(1);
  }
}

validate();
