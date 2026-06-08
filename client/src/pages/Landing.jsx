import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { 
  Brain, 
  Users, 
  FileText, 
  Zap, 
  ArrowRight,
  CheckCircle,
  GraduationCap,
  BookOpen,
  MessageSquare
} from 'lucide-react'

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background">

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl">NoteLearn</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
              Sign In
            </Button>
            <Button size="sm" onClick={() => navigate('/register')} className="hidden sm:flex">
              Get Started Free
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-4 py-2 rounded-full mb-6">
            <Zap className="w-4 h-4" />
            AI-Powered Study Platform for African Universities
          </div>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold leading-tight mb-6">
            Study Smarter,{' '}
            <span className="text-primary">Together</span>
          </h1>
          <p className="text-base md:text-xl text-muted-foreground mb-8 md:mb-10 max-w-2xl mx-auto leading-relaxed">
            NoteLearn transforms your study materials into interactive learning experiences. 
            Upload your notes, get AI-generated summaries and flashcards, and collaborate 
            in intelligent live study groups.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto px-8 h-12 text-base" onClick={() => navigate('/register')}>
              Start Studying Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto px-8 h-12 text-base" onClick={() => navigate('/login')}>
              Sign In
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-secondary/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Everything you need to excel</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Built specifically for university students in Cameroon and across Africa
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: FileText,
                color: 'bg-blue-100 text-blue-600',
                title: 'AI Document Intelligence',
                description: 'Upload your lecture notes and PDFs. Get instant summaries, flashcards, and concept maps generated from your own materials.'
              },
              {
                icon: Users,
                color: 'bg-green-100 text-green-600',
                title: 'Live Study Groups',
                description: 'Create study groups, invite classmates, and study together in AI-facilitated sessions that identify knowledge gaps and suggest peer teaching.'
              },
              {
                icon: Brain,
                color: 'bg-purple-100 text-purple-600',
                title: 'Knowledge Gap Detection',
                description: 'Our AI analyzes your group and tells you who understands what — then intelligently pairs stronger students with those who need help.'
              },
              {
                icon: MessageSquare,
                color: 'bg-orange-100 text-orange-600',
                title: 'Smart Study Sessions',
                description: 'Sessions are structured like real study groups — topic introduction, peer explanation, AI clarification, practice questions, and summary.'
              },
              {
                icon: BookOpen,
                color: 'bg-red-100 text-red-600',
                title: 'Flashcards & Summaries',
                description: 'Auto-generated flashcards and summaries from your uploaded documents so you never have to create study materials from scratch.'
              },
              {
                icon: Zap,
                color: 'bg-yellow-100 text-yellow-600',
                title: 'Low Bandwidth Optimized',
                description: 'Designed to work efficiently on Cameroonian internet speeds. Text-first approach'
              }
            ].map((feature, i) => {
              const Icon = feature.icon
              return (
                <div key={i} className="bg-card rounded-xl p-6 border border-border">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${feature.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How it works</h2>
            <p className="text-muted-foreground text-lg">Get started in minutes</p>
          </div>
          <div className="space-y-8">
            {[
              { step: '01', title: 'Create your account', description: 'Sign up for free and set up your student profile in under a minute.' },
              { step: '02', title: 'Upload your study materials', description: 'Upload your lecture notes, PDFs, and slides. Our AI processes them instantly.' },
              { step: '03', title: 'Study individually or in groups', description: 'Use AI-generated flashcards and summaries alone, or create a study group and invite your classmates.' },
              { step: '04', title: 'Let AI facilitate your learning', description: 'In group sessions, AI identifies who knows what and facilitates structured peer teaching for maximum comprehension.' }
            ].map((item, i) => (
              <div key={i} className="flex gap-6 items-start">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold text-sm">{item.step}</span>
                </div>
                <div className="pt-2">
                  <h3 className="font-semibold text-lg mb-1">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-primary">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-primary-foreground mb-4">
            Ready to transform how you study?
          </h2>
          <p className="text-primary-foreground/80 text-lg mb-8">
            Optimize your group Study sessions with NoteLearn.
          </p>
          <Button 
            size="lg" 
            variant="secondary"
            className="px-8 h-12 text-base"
            onClick={() => navigate('/register')}
          >
            Get Started Free
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">NoteLearn</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Built for university students in Cameroon and across Africa
          </p>
        </div>
      </footer>

    </div>
  )
}