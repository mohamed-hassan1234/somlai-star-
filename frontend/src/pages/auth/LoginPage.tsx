import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { GraduationCap, UserRound, Sparkles, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { loginSchema, type LoginInput } from '@/schemas'
import { useAuth } from '@/providers/AuthProvider'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { getErrorMessage } from '@/lib/utils'
import { ROLE_HOME } from '@/types'

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { loginId: '', password: '', rememberMe: true },
  })

  const onSubmit = async (values: LoginInput) => {
    try {
      await signIn(values.loginId, values.password, values.rememberMe)
      toast.success('Welcome back')
      // role detected after auth — navigate based on refreshed auth state via short delay
      // AuthProvider has set user; read from session storage path via window reload of auth context
      const { useAuth: _ } = await import('@/providers/AuthProvider')
      void _
      // Navigate after signIn populated user — useAuth in parent will have user
      // We need to get role from the sign-in result; AuthProvider stores it.
      // Re-fetch via a small trick: signIn already set user in context but this component
      // may have stale closure. Use navigate after getting profile from api.
      const { api } = await import('@/services/api')
      const { data: sessionData } = await api.auth.getSession()
      if (!sessionData.session) throw new Error('Session missing')
      const { data: profile } = await api
        .from('profiles')
        .select('role')
        .eq('id', sessionData.session.user.id)
        .single()
      if (!profile) throw new Error('Profile missing')
      navigate(ROLE_HOME[profile.role as keyof typeof ROLE_HOME], { replace: true })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Login failed'))
    }
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-navy-600">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            'linear-gradient(120deg, rgba(11,13,33,0.96), rgba(30,33,79,0.85)), url(https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=1800&q=80)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 50% 45% at 90% 0%, rgba(216,165,52,0.18), transparent), radial-gradient(ellipse 55% 45% at 0% 100%, rgba(43,47,115,0.9), transparent)',
        }}
      />

      <div className="relative z-10 flex w-full flex-col lg:flex-row">
        <motion.section
          className="flex flex-1 flex-col justify-end p-8 text-white lg:justify-center lg:p-16"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 text-navy-900 shadow-lg shadow-gold-500/30">
            <GraduationCap className="h-8 w-8" />
          </div>
          <p className="font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Somali Star <span className="text-gold-400">Academy</span>
          </p>
          <div className="mt-3 inline-flex items-center gap-2 text-sm text-gold-300">
            <Sparkles className="h-4 w-4" />
            Empowering Students Through Quality Education
          </div>
          <p className="mt-5 max-w-md text-base text-white/75 sm:text-lg">
            School management for Dharkeynley, Mogadishu — students, teachers, attendance, lessons,
            and results in one secure platform.
          </p>
        </motion.section>

        <motion.section
          className="flex flex-1 items-center justify-center p-6 sm:p-10"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
        >
          <div className="w-full max-w-md rounded-3xl border border-gold-400/20 bg-white p-7 shadow-2xl shadow-navy-950/50 dark:bg-navy-900/95 sm:p-9">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-600 text-gold-400 dark:bg-gold-500 dark:text-white">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold text-navy-600 dark:text-white">Sign in</h1>
                <p className="text-sm text-[#666666] dark:text-white/60">
                  Use your Student ID or Teacher ID — no email required.
                </p>
              </div>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
              <Input
                label="User ID"
                placeholder="e.g. SOMSTAR100 or TCH001"
                autoComplete="username"
                error={errors.loginId?.message}
                className="focus:border-gold-500 focus:ring-gold-500/20"
                {...register('loginId')}
              />
              <Input
                label="Password"
                type="password"
                autoComplete="current-password"
                error={errors.password?.message}
                className="focus:border-gold-500 focus:ring-gold-500/20"
                {...register('password')}
              />

              <div className="flex items-center justify-between gap-3 text-sm">
                <label className="flex items-center gap-2 text-[#666666] dark:text-white/70">
                  <input type="checkbox" className="rounded border-ink-300 text-navy-600 focus:ring-gold-500/40" {...register('rememberMe')} />
                  Remember Me
                </label>
                <Link to="/forgot-password" className="font-medium text-gold-600 hover:underline dark:text-gold-400">
                  Forgot Password
                </Link>
              </div>

              <Button
                type="submit"
                variant="gold"
                className="w-full"
                size="lg"
                loading={isSubmitting}
                leftIcon={<UserRound className="h-4 w-4" />}
              >
                Login
              </Button>
            </form>

            <div className="mt-6 border-t border-ink-100 pt-5 text-center text-xs text-[#666666] dark:border-white/10 dark:text-white/50">
              Accounts are issued by the School Manager. Role is detected automatically after login.
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  )
}
