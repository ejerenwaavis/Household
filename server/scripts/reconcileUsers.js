import 'dotenv/config';
import mongoose from 'mongoose';
import Household from '../src/models/Household.js';
import User from '../src/models/User.js';

async function reconcile() {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI is not set in environment');

    await mongoose.connect(uri, { dbName: new URL(uri).searchParams.get('appName') || undefined });
    console.log('Connected to MongoDB');

    const households = await Household.find({});
    console.log(`Found ${households.length} households`);

    let updatedCount = 0;
    const unmatched = [];

    for (const hh of households) {
      let changed = false;
      const members = hh.members.map((m) => ({ ...m.toObject ? m.toObject() : m }));

      for (let i = 0; i < members.length; i++) {
        const m = members[i];

        // If a user exists with this userId, nothing to do
        const existing = await User.findOne({ userId: m.userId });
        if (existing) continue;

        // Try to find a user by name and householdId
        const found = await User.findOne({ 'profile.name': m.name, householdId: hh.householdId });
        if (found) {
          members[i].userId = found.userId;
          changed = true;
          updatedCount++;
          console.log(`Updated member '${m.name}' in household '${hh.householdName}': set userId -> ${found.userId}`);
        } else {
          unmatched.push({ householdId: hh.householdId, householdName: hh.householdName, memberName: m.name, oldUserId: m.userId });
          console.log(`Unmatched member '${m.name}' in household '${hh.householdName}' (old userId: ${m.userId})`);
        }
      }

      if (changed) {
        hh.members = members;
        await hh.save();
        console.log(`Saved household ${hh.householdName} (${hh.householdId})`);
      }
    }

    console.log(`\nReconciliation complete. Updated ${updatedCount} member userIds.`);
    if (unmatched.length) {
      console.log(`Unmatched members: ${unmatched.length}`);
      console.log(JSON.stringify(unmatched, null, 2));
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error during reconciliation:', err);
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(1);
  }
}

reconcile();
