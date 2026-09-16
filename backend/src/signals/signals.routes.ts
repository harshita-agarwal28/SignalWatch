import { Router } from 'express'
import { prisma } from '../db'
import { asyncHandler, HttpError } from '../utils/http'
import { requireAuth, type AuthedRequest } from '../auth/auth.middleware'

export const signalsRouter = Router()
signalsRouter.use(requireAuth)

signalsRouter.post(
  '/:id/review',
  asyncHandler(async (req: AuthedRequest, res) => {
    const signal = await prisma.signalEvent.findUnique({ where: { id: req.params.id } })
    if (!signal) throw new HttpError(404, 'Signal not found')

    await prisma.userSignalAck.upsert({
      where: { userId_signalEventId: { userId: req.userId!, signalEventId: signal.id } },
      update: {},
      create: { userId: req.userId!, signalEventId: signal.id },
    })

    res.json({ acknowledged: true })
  })
)
