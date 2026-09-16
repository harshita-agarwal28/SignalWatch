import { prisma } from '../db'

function daysFromNow(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}

export async function seedMarketEvents() {
  const count = await prisma.marketEvent.count()
  if (count > 0) return

  await prisma.marketEvent.createMany({
    data: [
      { ticker: 'MSFT', title: 'Microsoft earnings call', type: 'earnings', date: daysFromNow(2), timeLabel: 'After market close' },
      { ticker: 'AAPL', title: 'Apple product event', type: 'product-launch', date: daysFromNow(8), timeLabel: '10:00 AM PT' },
      { ticker: 'NVDA', title: 'NVIDIA developer conference keynote', type: 'conference', date: daysFromNow(15), timeLabel: '9:00 AM PT' },
      { ticker: 'TSLA', title: 'Tesla earnings call', type: 'earnings', date: daysFromNow(21), timeLabel: 'After market close' },
      { ticker: 'AMD', title: 'AMD product roadmap event', type: 'product-launch', date: daysFromNow(26), timeLabel: '1:00 PM PT' },
    ],
  })
}
