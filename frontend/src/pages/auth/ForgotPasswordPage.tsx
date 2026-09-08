import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { BrandLogo } from '@/components/ui/BrandLogo'
import { useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/services/api'
import { getErrorMessage } from '@/lib/utils'

export function ForgotPasswordPage() {
  const [loginId, setLoginId] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-navy-600 p-6">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 50% 45% at 90% 0%, rgba(216,165,52,0.18), transparent), radial-gradient(ellipse 55% 45% at 0% 100%, rgba(43,47,115,0.9), transparent)',
        }}
      />
      <div className="relative w-full max-w-md rounded-3xl border border-gold-400/20 bg-white p-8 shadow-2xl shadow-navy-950/50 dark:bg-navy-900/95 sm:p-9">
        <div className="mb-6 flex justify-center">
          <BrandLogo size="md" wordmarkClassName="text-navy-600 dark:text-white" />
        </div>
        <h1 className="text-center font-display text-2xl font-bold text-navy-600 dark:text-white">Forgot Password</h1>
        <p className="mt-2 text-center text-sm text-[#666666] dark:text-white/60">
          Enter your User ID. A request is sent to the School Manager. Passwords are never emailed for ID-based accounts.
        </p>
        {submitted ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-xl bg-gold-500/10 p-4 text-sm text-navy-600 dark:text-gold-300">
              Request submitted for <strong>{loginId.toUpperCase()}</strong>. The School Manager at Somali Star Academy,
              Dharkeynley will reset your password securely.
            </p>
            <Link to="/login">
              <Button variant="gold" className="w-full">Back to Login</Button>
            </Link>
          </div>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault()
              const id = loginId.trim().toUpperCase()
              if (!id) {
                toast.error('Enter your User ID')
                return
              }
              setLoading(true)
              try {
                const { error } = await api.from('password_reset_requests').insert({
                  login_id: id,
                  requester_note: note.trim() || null,
                })
                if (error) throw error
                setSubmitted(true)
              } catch (err) {
                toast.error(getErrorMessage(err, 'Could not submit request. Try again or contact the Manager.'))
              } finally {
                setLoading(false)
              }
            }}
          >
            <Input
              label="User ID"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="SOMSTAR100 or TCH001"
              autoComplete="username"
              className="focus:border-gold-500 focus:ring-gold-500/20"
            />
            <Input
              label="Optional note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. I forgot my password"
              className="focus:border-gold-500 focus:ring-gold-500/20"
            />
            <Button type="submit" variant="gold" className="w-full" loading={loading}>
              Submit Request
            </Button>
            <Link to="/login" className="block text-center text-sm text-gold-600 hover:underline dark:text-gold-400">
              Back to Login
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
