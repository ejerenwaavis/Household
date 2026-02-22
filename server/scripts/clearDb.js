import mongoose from 'mongoose';

async function clearDatabase() {
  try {
    await mongoose.connect('mongodb+srv://householdapp:householdAcedWorkstation@household.secp8dr.mongodb.net/?appName=household');
    const db = mongoose.connection.db;
    
    const collections = await db.listCollections().toArray();
    
    for (const col of collections) {
      await db.dropCollection(col.name);
      console.log(`✅ Dropped collection: ${col.name}`);
    }
    
    console.log('\n🗑️  Database cleared successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing database:', error.message);
    process.exit(1);
  }
}

clearDatabase();
