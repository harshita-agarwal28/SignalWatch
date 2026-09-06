import { prisma } from './db'
import { hashPassword } from './auth/auth.service'
import { seedMarketEvents } from './events/events.seed'
import { DEFAULT_WATCHLIST_TICKERS } from './market/universe'

const DEMO_EMAIL = 'demo@signalwatch.app'
const DEMO_PASSWORD = 'password123'

async function main() {
  await seedMarketEvents()

  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } })
  if (existing) {
    console.log(`Demo user already exists: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`)
    return
  }

  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      name: 'Harshita',
      passwordHash: await hashPassword(DEMO_PASSWORD),
    },
  })

  for (const ticker of DEFAULT_WATCHLIST_TICKERS) {
    await prisma.watchlistItem.create({ data: { userId: user.id, ticker } })
  }

  console.log('Demo user created:')
  console.log(`  email:    ${DEMO_EMAIL}`)
  console.log(`  password: ${DEMO_PASSWORD}`)
  console.log(`  watchlist seeded with: ${DEFAULT_WATCHLIST_TICKERS.join(', ')}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
