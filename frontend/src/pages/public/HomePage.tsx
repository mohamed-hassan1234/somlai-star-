import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Users,
  UserCheck,
  CalendarCheck,
  CalendarRange,
  ClipboardList,
  Wallet,
  Library,
  Sparkles,
  ArrowRight,
  Megaphone,
  Newspaper,
  MapPin,
  GraduationCap,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
}

const stats = [
  { icon: Users, value: '1,200+', label: 'Total Students' },
  { icon: UserCheck, value: '45+', label: 'Teachers' },
  { icon: CalendarRange, value: '24', label: 'Classes' },
  { icon: ClipboardList, value: '12', label: 'Subjects' },
]

const features = [
  {
    icon: Users,
    title: 'Student Management',
    desc: 'Enrol, track, and manage every student record securely in one place.',
  },
  {
    icon: UserCheck,
    title: 'Teacher Management',
    desc: 'Assign classes, manage schedules, and support your teaching staff.',
  },
  {
    icon: CalendarCheck,
    title: 'Attendance',
    desc: 'Record daily attendance and review reports with one click.',
  },
  {
    icon: CalendarRange,
    title: 'Timetable',
    desc: 'Build clear class schedules that keep every school day organised.',
  },
  {
    icon: ClipboardList,
    title: 'Exams',
    desc: 'Publish exams and results that students and parents can view online.',
  },
  {
    icon: Wallet,
    title: 'Fees',
    desc: 'Manage school fees and payments through a simple finance dashboard.',
  },
  {
    icon: Library,
    title: 'Library',
    desc: 'Organise books and learning resources for the whole school.',
  },
]

const announcements = [
  {
    date: '01 Aug 2026',
    type: 'Enrolment',
    title: '2026 Academic Year Enrolment Now Open',
    body: 'Enrolments for the new academic year are open at the school office, 8:00am–2:00pm, Sunday to Thursday.',
  },
  {
    date: '18 Jul 2026',
    type: 'Exams',
    title: 'Final Examinations Timetable Released',
    body: 'The end-of-year examination timetable is now available. Please contact your class teacher for details.',
  },
  {
    date: '02 Jul 2026',
    type: 'Event',
    title: 'Parent–Teacher Conference Day',
    body: 'Join us for our termly parent–teacher conference to review your child’s progress together.',
  },
]

const news = [
  {
    date: '25 Jul 2026',
    title: 'Somali Star Wins Regional Quran Competition',
    excerpt: 'Our students took first place at the Dharkeynley regional Quran memorisation competition.',
  },
  {
    date: '10 Jul 2026',
    title: 'New Computer Laboratory Opens',
    excerpt: 'A fully-equipped computer lab now supports our modern ICT and digital literacy programme.',
  },
  {
    date: '20 Jun 2026',
    title: 'Annual Sports Day a Big Success',
    excerpt: 'Students, teachers, and parents came together for a day of athletics, teamwork, and fun.',
  },
]

export function HomePage() {
  return (
    <>
      {/* ============================ Hero ============================ */}
      <section className="relative overflow-hidden bg-navy-600">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 60% 50% at 85% 10%, rgba(216,165,52,0.22), transparent), radial-gradient(ellipse 70% 60% at 10% 90%, rgba(43,47,115,0.9), transparent)',
          }}
        />
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(216,165,52,0.9), transparent 70%)' }}
        />

        <div className="relative mx-auto max-w-7xl px-4 pb-36 pt-20 sm:px-6 sm:pt-28 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
            >
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-white/5 px-4 py-1.5 text-sm font-medium text-gold-300 backdrop-blur">
                <MapPin className="h-4 w-4" />
                Dharkeynley, Mogadishu
              </div>
              <h1 className="font-display text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
                Welcome to <span className="text-gold-400">Somali Star Academy</span>
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-white/75 sm:text-lg">
                Empowering Students Through Quality Education.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link to="/login">
                  <Button variant="gold" size="lg">
                    Explore System
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/about">
                  <Button variant="goldOutline" size="lg">
                    About Academy
                  </Button>
                </Link>
              </div>
            </motion.div>

            <motion.div
              className="hidden justify-end lg:flex"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.15 }}
            >
              <div className="relative">
                <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-gold-400/30 to-transparent blur-2xl" />
                <div className="relative flex aspect-square w-80 items-center justify-center rounded-[2rem] border border-white/15 bg-white/5 p-10 backdrop-blur">
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-navy-700 to-navy-900 shadow-2xl">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 text-navy-900 shadow-lg shadow-gold-500/30">
                      <GraduationCap className="h-10 w-10" />
                    </div>
                    <p className="mt-6 font-display text-xl font-semibold text-white">Somali Star</p>
                    <p className="text-sm tracking-widest text-gold-400 uppercase">Academy</p>
                    <div className="mt-6 flex items-center gap-2 rounded-full border border-gold-400/40 bg-gold-400/10 px-4 py-1.5 text-xs text-gold-300">
                      <Sparkles className="h-3.5 w-3.5" />
                      Quality Education
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ============================ Quick Stats ============================ */}
      <section className="relative z-10 mx-auto -mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              className="flex items-center gap-4 rounded-2xl border border-ink-100 bg-white p-6 shadow-lg shadow-navy-900/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy-600 text-gold-400">
                <s.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="font-display text-2xl font-bold text-navy-600">{s.value}</p>
                <p className="text-sm text-[#666666]">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ============================ Features ============================ */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <motion.div className="mb-14 text-center" {...fadeUp} transition={{ duration: 0.4 }}>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-gold-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-gold-600">
            <Sparkles className="h-3.5 w-3.5" />
            Everything in one platform
          </div>
          <h2 className="font-display text-3xl font-bold text-navy-600 sm:text-4xl">
            A Complete School Management System
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[#666666]">
            Powerful, easy-to-use tools that keep every part of the academy running smoothly.
          </p>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              className="group rounded-2xl border border-ink-100 bg-white p-7 shadow-sm transition-all duration-300 hover:scale-[1.03] hover:border-gold-400/50 hover:shadow-xl hover:shadow-navy-900/5"
              {...fadeUp}
              transition={{ duration: 0.35, delay: (i % 3) * 0.06 }}
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-navy-600 text-gold-400 transition-colors duration-300 group-hover:bg-gold-500 group-hover:text-white">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="font-display text-lg font-bold text-navy-600">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#666666]">{f.desc}</p>
            </motion.div>
          ))}

          <motion.div
            className="flex flex-col justify-center rounded-2xl bg-gradient-to-br from-navy-600 to-navy-800 p-7 text-white shadow-lg transition-all duration-300 hover:scale-[1.03]"
            {...fadeUp}
            transition={{ duration: 0.35, delay: 0.18 }}
          >
            <h3 className="font-display text-lg font-bold">And much more…</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              Notices, quizzes, behaviour tracking, outside activities, and a parent portal — all
              built in.
            </p>
            <Link to="/about" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-400 hover:text-gold-300">
              Learn more
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ============================ Announcements ============================ */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-5">
            <motion.div className="lg:col-span-2" {...fadeUp} transition={{ duration: 0.4 }}>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-gold-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-gold-600">
                <Megaphone className="h-3.5 w-3.5" />
                Stay informed
              </div>
              <h2 className="font-display text-3xl font-bold text-navy-600 sm:text-4xl">
                School Announcements
              </h2>
              <p className="mt-3 max-w-sm text-[#666666]">
                The latest updates and notices for students, parents, and the wider academy
                community.
              </p>
            </motion.div>

            <div className="space-y-5 lg:col-span-3">
              {announcements.map((a, i) => (
                <motion.div
                  key={a.title}
                  className="flex gap-5 rounded-2xl border border-ink-100 bg-[#f5f5f5] p-6 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                  {...fadeUp}
                  transition={{ duration: 0.35, delay: i * 0.08 }}
                >
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-navy-600 text-gold-400">
                    <CalendarCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-gold-600">{a.date}</span>
                      <span className="rounded-full bg-navy-600 px-2.5 py-0.5 font-medium text-white">
                        {a.type}
                      </span>
                    </div>
                    <h3 className="mt-1.5 font-display text-lg font-bold text-navy-600">{a.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-[#666666]">{a.body}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================ Latest News ============================ */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <motion.div className="mb-12 text-center" {...fadeUp} transition={{ duration: 0.4 }}>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-gold-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-gold-600">
            <Newspaper className="h-3.5 w-3.5" />
            What's happening
          </div>
          <h2 className="font-display text-3xl font-bold text-navy-600 sm:text-4xl">Latest News</h2>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {news.map((n, i) => (
            <motion.article
              key={n.title}
              className="flex flex-col rounded-2xl border border-ink-100 bg-white p-7 shadow-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-xl hover:shadow-navy-900/5"
              {...fadeUp}
              transition={{ duration: 0.35, delay: i * 0.08 }}
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-gold-600">
                <CalendarCheck className="h-4 w-4" />
                {n.date}
              </div>
              <h3 className="mt-3 font-display text-lg font-bold leading-snug text-navy-600">{n.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-[#666666]">{n.excerpt}</p>
              <Link
                to="/about"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-navy-600 hover:text-gold-600"
              >
                Read more
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.article>
          ))}
        </div>
      </section>

      {/* ============================ CTA ============================ */}
      <section className="relative overflow-hidden bg-navy-600">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 70% 60% at 15% 20%, rgba(43,47,115,0.9), transparent), radial-gradient(ellipse 50% 50% at 90% 90%, rgba(216,165,52,0.18), transparent)',
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <motion.div className="text-center" {...fadeUp} transition={{ duration: 0.4 }}>
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
              Ready to explore <span className="text-gold-400">Somali Star Academy</span>?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-white/70">
              Sign in to the portal to access attendance, results, lessons, and more.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Link to="/login">
                <Button variant="gold" size="lg">
                  Sign In
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/contact">
                <Button variant="goldOutline" size="lg">
                  Contact Us
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  )
}
