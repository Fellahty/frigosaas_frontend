import dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { Client } from '../src/models/Client.js';
import { Room } from '../src/models/Room.js';
import { SiteSettings } from '../src/models/SiteSettings.js';
import { hashPassword } from '../src/utils/password.js';

dotenv.config();

async function seed() {
  await connectDatabase();

  const tenantId = env.defaultTenantId;

  console.log(`🌱 Seeding database for tenant: ${tenantId}`);

  // Admin user
  const adminEmail = 'admin@frigosaas.com';
  let admin = await User.findOne({ email: adminEmail, tenantId });

  if (!admin) {
    admin = await User.create({
      tenantId,
      name: 'Administrateur',
      email: adminEmail,
      phone: '+212600000000',
      username: 'admin',
      password: await hashPassword('admin123'),
      role: 'admin',
      isActive: true,
    });
    console.log('✅ Admin user created — email: admin@frigosaas.com / password: admin123');
  } else {
    console.log('ℹ️  Admin user already exists');
  }

  // Test manager (compatible with Firebase test user)
  const testEmail = 'test@gmail.com';
  let testUser = await User.findOne({ email: testEmail, tenantId });

  if (!testUser) {
    testUser = await User.create({
      tenantId,
      name: 'Test User',
      email: testEmail,
      username: 'testuser',
      password: await hashPassword('password123'),
      role: 'admin',
      isActive: true,
    });
    console.log('✅ Test user created — email: test@gmail.com / password: password123');
  }

  // Site settings
  await SiteSettings.findOneAndUpdate(
    { tenantId },
    {
      tenantId,
      name: 'Frigo YAZAMI',
      currency: 'MAD',
      locale: 'fr',
      season: { from: '2025-06-01', to: '2025-10-31' },
      capacity_unit: 'caisses',
      ratio_caisses_par_palette: 20,
      initial_cash_balance: 0,
      pool_vides_total: 5000,
      tarif_caisse_saison: 2.5,
      caution_par_caisse: 50,
      paymentTerms: { mode: 'due_on_exit' },
    },
    { upsert: true }
  );
  console.log('✅ Site settings created');

  // Sample rooms
  const roomsData = [
    { room: 'CH1', capacity: 6000, sensorId: 'S-CH1', capteurInstalled: true },
    { room: 'CH2', capacity: 5000, sensorId: 'S-CH2', capteurInstalled: true },
    { room: 'CH3', capacity: 4500, sensorId: 'S-CH3', capteurInstalled: false },
    { room: 'CH4', capacity: 4000, sensorId: 'S-CH4', capteurInstalled: true },
    { room: 'CH5', capacity: 3500, sensorId: 'S-CH5', capteurInstalled: false },
  ];

  for (const roomData of roomsData) {
    await Room.findOneAndUpdate(
      { tenantId, room: roomData.room },
      { ...roomData, tenantId, active: true },
      { upsert: true }
    );
  }
  console.log(`✅ ${roomsData.length} rooms created`);

  // Sample clients
  const clientsData = [
    { name: 'Client Demo 1', email: 'client1@demo.com', phone: '+212611111111', company: 'Demo SARL' },
    { name: 'Client Demo 2', email: 'client2@demo.com', phone: '+212622222222', company: 'Test SA' },
  ];

  for (const clientData of clientsData) {
    const exists = await Client.findOne({ tenantId, email: clientData.email });
    if (!exists) {
      await Client.create({
        ...clientData,
        tenantId,
        password: await hashPassword('client123'),
        createdBy: 'seed',
      });
    }
  }
  console.log(`✅ Sample clients created (password: client123)`);

  console.log('\n🎉 Seed completed!');
  console.log(`\nAPI: http://localhost:${env.port}/api`);
  console.log('Login: POST /api/auth/login');
  console.log('  { "loginField": "admin@frigosaas.com", "password": "admin123", "tenantId": "YAZAMI" }');

  await disconnectDatabase();
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
