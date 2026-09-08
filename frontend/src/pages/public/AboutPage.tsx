import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Target,
  Eye,
  Star,
  ShieldCheck,
  CheckCircle2,
  Lightbulb,
  HeartHandshake,
  School,
  MonitorSmartphone,
  Library,
  Dumbbell,
  FlaskConical,
  Quote,
  ArrowRight,
  GraduationCap,
  Sparkles,
  CheckCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
}

const values = [
  { icon: Star, title: 'Excellence', desc: 'We pursue the highest standards in everything we do.' },
  { icon: ShieldCheck, title: 'Integrity', desc: 'We act with honesty, fairness, and strong character.' },
  { icon: CheckCircle2, title: 'Discipline', desc: 'We build focus, order, and responsibility in learners.' },
  { icon: Lightbulb, title: 'Innovation', desc: 'We embrace modern teaching methods and technology.' },
  { icon: HeartHandshake, title: 'Respect', desc: 'We value every student, family, and community member.' },
]

const whyUs = [
  {
    title: 'Balanced Curriculum',
    desc: 'National academics combined with Quran, Arabic, and Islamic values.',
  },
  {
    title: 'Qualified Faculty',
    desc: 'Dedicated teachers trained in both secular and Islamic pedagogy.',
  },
  {
    title: 'Modern Facilities',
    desc: 'Well-equipped classrooms, labs, and learning resources.',
  },
  {
    title: 'Safe Environment',
    desc: 'A caring, disciplined atmosphere where every child can thrive.',
  },
]

const facilities = [
  { icon: School, title: 'Modern Classrooms', desc: 'Bright, spacious rooms designed for focused learning.' },
  { icon: MonitorSmartphone, title: 'Computer Lab', desc: 'Hands-on ICT lessons for the digital age.' },
  { icon: Library, title: 'Library', desc: 'A growing collection of books and study resources.' },
  { icon: Dumbbell, title: 'Sports', desc: 'Athletics and team sports for healthy development.' },
  { icon: FlaskConical, title: 'Science Lab', desc: 'Practical experiments that bring science to life.' },
]

export function AboutPage() {
  return (
    <>
      {/* ============================ Header Banner ============================ */}
      <section className="relative overflow-hidden bg-navy-600">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 60% 50% at 90% 0%, rgba(216,165,52,0.2), transparent), radial-gradient(ellipse 70% 60% at 10% 100%, rgba(43,47,115,0.9), transparent)',
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-24 text-center sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-white/5 px-4 py-1.5 text-sm font-medium text-gold-300 backdrop-blur">
              <GraduationCap className="h-4 w-4" />
              Dharkeynley, Mogadishu
            </div>
            <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
              About <span className="text-gold-400">Somali Star Academy</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
              Excellence in education, grounded in faith — nurturing the leaders of tomorrow in the
              heart of Mogadishu.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ============================ Mission & Vision ============================ */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <motion.div
            className="rounded-2xl border border-ink-100 bg-white p-9 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-navy-900/5"
            {...fadeUp}
            transition={{ duration: 0.4 }}
          >
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-600 text-gold-400">
              <Target className="h-7 w-7" />
            </div>
            <h2 className="font-display text-2xl font-bold text-navy-600">Our Mission</h2>
            <p className="mt-3 leading-relaxed text-[#666666]">
              Somali Star Academy is dedicated to providing a comprehensive education that integrates
              the national curriculum with Islamic studies, Quran memorisation, and Arabic language.
              We develop well-rounded individuals who are confident in their faith, proud of their
              heritage, and equipped with the skills to thrive in a modern world.
            </p>
          </motion.div>

          <motion.div
            className="rounded-2xl border border-ink-100 bg-white p-9 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-navy-900/5"
            {...fadeUp}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-500 text-white">
              <Eye className="h-7 w-7" />
            </div>
            <h2 className="font-display text-2xl font-bold text-navy-600">Our Vision</h2>
            <p className="mt-3 leading-relaxed text-[#666666]">
              To be a leading centre of learning in Mogadishu, recognised for academic excellence,
              strong Islamic values, and graduates who lead with knowledge, discipline, and service
              to their community and country.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ============================ Core Values ============================ */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <motion.div className="mb-12 text-center" {...fadeUp} transition={{ duration: 0.4 }}>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-gold-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-gold-600">
              <Sparkles className="h-3.5 w-3.5" />
              What we stand for
            </div>
            <h2 className="font-display text-3xl font-bold text-navy-600 sm:text-4xl">Our Core Values</h2>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {values.map((v, i) => (
              <motion.div
                key={v.title}
                className="rounded-2xl border border-ink-100 bg-[#f5f5f5] p-7 text-center transition-all duration-300 hover:scale-[1.03] hover:border-gold-400/50 hover:bg-white hover:shadow-xl hover:shadow-navy-900/5"
                {...fadeUp}
                transition={{ duration: 0.35, delay: i * 0.06 }}
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-navy-600 text-gold-400">
                  <v.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-base font-bold text-navy-600">{v.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#666666]">{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ Why Choose Us ============================ */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div {...fadeUp} transition={{ duration: 0.4 }}>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-gold-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-gold-600">
              <CheckCheck className="h-3.5 w-3.5" />
              The Somali Star difference
            </div>
            <h2 className="font-display text-3xl font-bold text-navy-600 sm:text-4xl">Why Choose Us</h2>
            <p className="mt-4 max-w-lg leading-relaxed text-[#666666]">
              Parents choose Somali Star Academy because we care for the whole child — mind, faith,
              and character — and we back it with structure, technology, and dedicated educators.
            </p>
            <Link to="/contact">
              <Button variant="gold" size="lg" className="mt-7">
                Get In Touch
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </motion.div>

          <div className="grid gap-5 sm:grid-cols-2">
            {whyUs.map((w, i) => (
              <motion.div
                key={w.title}
                className="rounded-2xl border border-ink-100 bg-white p-7 shadow-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-xl hover:shadow-navy-900/5"
                {...fadeUp}
                transition={{ duration: 0.35, delay: i * 0.08 }}
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-gold-500 text-white">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <h3 className="font-display text-base font-bold text-navy-600">{w.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#666666]">{w.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ Facilities ============================ */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <motion.div className="mb-12 text-center" {...fadeUp} transition={{ duration: 0.4 }}>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-gold-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-gold-600">
              <School className="h-3.5 w-3.5" />
              Built for learning
            </div>
            <h2 className="font-display text-3xl font-bold text-navy-600 sm:text-4xl">
              School Facilities
            </h2>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {facilities.map((f, i) => (
              <motion.div
                key={f.title}
                className="rounded-2xl border border-ink-100 bg-[#f5f5f5] p-7 text-center transition-all duration-300 hover:scale-[1.03] hover:border-gold-400/50 hover:bg-white hover:shadow-xl hover:shadow-navy-900/5"
                {...fadeUp}
                transition={{ duration: 0.35, delay: i * 0.06 }}
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-navy-600 text-gold-400">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-base font-bold text-navy-600">{f.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#666666]">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ Principal Message ============================ */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <motion.div
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy-600 to-navy-800 p-10 shadow-2xl sm:p-14"
          {...fadeUp}
          transition={{ duration: 0.4 }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 50% 60% at 90% 0%, rgba(216,165,52,0.18), transparent)',
            }}
          />
          <Quote className="relative h-12 w-12 text-gold-400" />
          <blockquote className="relative mt-6 max-w-3xl">
            <p className="font-display text-xl font-medium leading-relaxed text-white sm:text-2xl">
              "Every child who walks through our gates carries a star. Our job is to help it shine —
              through knowledge, faith, and character. We welcome you to be part of our family."
            </p>
          </blockquote>
          <div className="relative mt-8 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-600 text-navy-900">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold text-white">The Principal</p>
              <p className="text-sm text-gold-400">Somali Star Academy</p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ============================ CTA ============================ */}
      <section className="bg-navy-600">
        <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <motion.div {...fadeUp} transition={{ duration: 0.4 }}>
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
              Join <span className="text-gold-400">Somali Star Academy</span> Today
            </h2>
            <p className="mx-auto mt-3 max-w-md text-white/70">
              Enrolments are open. Reach out to us and begin the journey of a lifetime.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/contact">
                <Button variant="goldOutline" size="lg">
                  Contact Us
                </Button>
              </Link>
              <Link to="/contact">
                <Button variant="gold" size="lg">
                  Apply Now
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  )
}
