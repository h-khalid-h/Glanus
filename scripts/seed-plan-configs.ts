/**
 * Seed default PlanConfig records.
 *
 * Run: npx tsx scripts/seed-plan-configs.ts
 *
 * Safe to run multiple times — uses upsert.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_PLANS = [
  {
    plan: 'FREE' as const,
    name: 'Free',
    description: 'Get started with basic features',
    priceMonthly: 0,
    priceYearly: 0,
    maxAssets: 5,
    maxAICreditsPerMonth: 100,
    maxStorageMB: 1024,
    maxMembers: 1,
    sortOrder: 0,
    highlighted: false,
    isActive: true,
    currency: 'usd',
    features: ['5 assets', '100 AI credits/mo', '1 GB storage', '1 workspace member'],
  },
  {
    plan: 'PERSONAL' as const,
    name: 'Personal',
    description: 'For individuals and small projects',
    priceMonthly: 900,
    priceYearly: 9000,
    maxAssets: 50,
    maxAICreditsPerMonth: 1000,
    maxStorageMB: 10240,
    maxMembers: 5,
    sortOrder: 1,
    highlighted: false,
    isActive: true,
    currency: 'usd',
    features: ['50 assets', '1,000 AI credits/mo', '10 GB storage', '5 workspace members'],
  },
  {
    plan: 'TEAM' as const,
    name: 'Team',
    description: 'For growing teams and organizations',
    priceMonthly: 2900,
    priceYearly: 29000,
    maxAssets: 200,
    maxAICreditsPerMonth: 5000,
    maxStorageMB: 51200,
    maxMembers: 999999,
    sortOrder: 2,
    highlighted: true,
    isActive: true,
    currency: 'usd',
    features: ['200 assets', '5,000 AI credits/mo', '50 GB storage', 'Unlimited members'],
  },
  {
    plan: 'ENTERPRISE' as const,
    name: 'Enterprise',
    description: 'Custom solutions for large organizations',
    priceMonthly: 0,
    priceYearly: 0,
    maxAssets: 999999,
    maxAICreditsPerMonth: 999999,
    maxStorageMB: 999999,
    maxMembers: 999999,
    sortOrder: 3,
    highlighted: false,
    isActive: true,
    currency: 'usd',
    features: ['Unlimited assets', 'Unlimited AI credits', 'Unlimited storage', 'Custom SLA'],
  },
];

async function main() {
  for (const plan of DEFAULT_PLANS) {
    await prisma.planConfig.upsert({
      where: { plan: plan.plan },
      update: {},        // Don't overwrite admin changes
      create: plan,
    });
    console.log(`✓ ${plan.plan}`);
  }
  console.log('\nPlanConfig seeded successfully.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
