import { request } from '@/services/httpClient'
import { motion } from 'framer-motion'
import { Mail, MapPin, Phone, Send } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  subject: z.string().min(3, 'Subject must be at least 3 characters'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
})

type ContactInput = z.infer<typeof contactSchema>

const contactInfo = [
  { icon: MapPin, label: 'Address', value: 'Dharkeynley, Mogadishu, Somalia' },
  { icon: Phone, label: 'Phone', value: '+252 6X XXX XXXX' },
  { icon: Mail, label: 'Email', value: 'info@somalistaracademy.so' },
]

export function ContactPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
  })

  const onSubmit = async (data: ContactInput) => {
    try {
      await request('/contact',data)
      toast.success('Thank you! Your message has been received.')
      reset()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to send message') }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <motion.div
        className="mb-14 text-center"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="font-display text-4xl font-semibold text-ink-900 dark:text-white sm:text-5xl">
          Get in Touch
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-ink-500 dark:text-ink-400">
          Have questions about admissions, curriculum, or partnership opportunities? We'd love to hear from you.
        </p>
      </motion.div>

      <div className="grid gap-10 lg:grid-cols-5 lg:gap-16">
        <motion.div
          className="space-y-6 lg:col-span-2"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {contactInfo.map((item) => (
            <div key={item.label} className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-ink-900 dark:text-white">{item.label}</p>
                <p className="text-sm text-ink-500 dark:text-ink-400">{item.value}</p>
              </div>
            </div>
          ))}

          <div className="rounded-2xl border border-ink-200/80 bg-surface-elevated p-5 dark:border-ink-800 dark:bg-ink-900/80">
            <h3 className="font-display text-base font-semibold text-ink-900 dark:text-white">Office Hours</h3>
            <div className="mt-2 space-y-1.5 text-sm text-ink-500 dark:text-ink-400">
              <p>Saturday – Thursday: 7:30 AM – 2:00 PM</p>
              <p>Friday: Closed</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="lg:col-span-3"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="rounded-2xl border border-ink-200/80 bg-surface-elevated p-6 shadow-sm dark:border-ink-800 dark:bg-ink-900/80 sm:p-8"
          >
            <h2 className="font-display text-xl font-semibold text-ink-900 dark:text-white">Send a Message</h2>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
              Fill in the form below and we'll get back to you.
            </p>

            <div className="mt-6 space-y-4">
              <Input label="Your Name" placeholder="Ahmed Mohamed" error={errors.name?.message} {...register('name')} />
              <Input label="Email" type="email" placeholder="ahmed@example.com" error={errors.email?.message} {...register('email')} />
              <Input label="Subject" placeholder="Enrolment Inquiry" error={errors.subject?.message} {...register('subject')} />
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-ink-700 dark:text-ink-200">Message</label>
                <textarea
                  rows={5}
                  placeholder="Write your message here..."
                  className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 shadow-sm transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100 dark:placeholder:text-ink-500"
                  {...register('message')}
                />
                {errors.message && (
                  <p className="text-xs text-danger" role="alert">{errors.message.message}</p>
                )}
              </div>
            </div>

            <Button type="submit" size="lg" className="mt-6 w-full" loading={isSubmitting} leftIcon={<Send className="h-4 w-4" />}>
              Send Message
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  )
}
