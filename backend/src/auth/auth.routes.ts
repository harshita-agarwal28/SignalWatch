import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db'
import { asyncHandler, HttpError } from '../utils/http'
import { requireAuth, type AuthedRequest } from './auth.middleware'
import { hashPassword, signToken, verifyPassword } from './auth.service'

export const authRouter = Router()

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1).max(60),
})

authRouter.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const body = signupSchema.parse(req.body)
    const existing = await prisma.user.findUnique({ where: { email: body.email } })
    if (existing) throw new HttpError(409, 'An account with this email already exists')

    const passwordHash = await hashPassword(body.password)
    const user = await prisma.user.create({
      data: { email: body.email, passwordHash, name: body.name },
    })
    const token = signToken({ userId: user.id })
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } })
  })
)

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const preferencesSchema = z.object({
  emailAlerts: z.boolean(),
  dailyDigest: z.boolean(),
  reduceMotion: z.boolean(),
})

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body)
    const user = await prisma.user.findUnique({ where: { email: body.email } })
    if (!user) throw new HttpError(401, 'Invalid email or password')

    const valid = await verifyPassword(body.password, user.passwordHash)
    if (!valid) throw new HttpError(401, 'Invalid email or password')

    const token = signToken({ userId: user.id })
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } })
  })
)

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } })
    if (!user) throw new HttpError(404, 'User not found')
    res.json({ user: { id: user.id, email: user.email, name: user.name } })
  })
)

authRouter.get(
  '/preferences',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } })
    if (!user) throw new HttpError(404, 'User not found')
    res.json({ preferences: { emailAlerts: user.emailAlerts, dailyDigest: user.dailyDigest, reduceMotion: user.reduceMotion } })
  })
)

authRouter.patch(
  '/preferences',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const preferences = preferencesSchema.parse(req.body)
    const user = await prisma.user.update({ where: { id: req.userId! }, data: preferences })
    res.json({ preferences: { emailAlerts: user.emailAlerts, dailyDigest: user.dailyDigest, reduceMotion: user.reduceMotion } })
  })
)
