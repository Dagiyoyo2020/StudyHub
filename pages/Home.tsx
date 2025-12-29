
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppRoutes } from '../constants';
import { 
  ArrowRight, 
  Sparkles, 
  Layers, 
  Calendar, 
  BrainCircuit, 
  Zap,
  Globe,
  TrendingUp,
  Clock,
  Award,
  Target,
  Star,
  Plus
} from 'lucide-react';

const Navbar = () => (
  <nav className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-white/5 h-20 flex items-center">
    <div className="w-full max-w-7xl mx-auto px-6 flex items-center justify-between">
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-2 group cursor-pointer"
      >
        <div className="relative">
          <Sparkles className="text-purple-500 group-hover:text-purple-400 transition-colors" size={24} />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border-2 border-purple-500/30 rounded-full"
            style={{ clipPath: 'inset(50% 0 0 0)' }}
          />
        </div>
        <span className="text-lg font-bold tracking-tight text-white">Study Hub</span>
      </motion.div>
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-6"
      >
        <Link to={AppRoutes.AUTH} className="text-sm font-medium text-slate-400 hover:text-white transition-colors relative group">
          Log in
          <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-purple-500 group-hover:w-full transition-all duration-300"></span>
        </Link>
        <Link to={AppRoutes.AUTH}>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-white text-black px-5 py-2.5 rounded-full text-sm font-bold hover:bg-slate-200 transition-colors shadow-lg shadow-purple-500/20"
          >
            Get Started
          </motion.button>
        </Link>
      </motion.div>
    </div>
  </nav>
);

const FeatureCard = ({ icon: Icon, title, description, delay, gradient }: { icon: any, title: string, description: string, delay: number, gradient: string }) => (
  <motion.div 
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-100px" }}
    transition={{ delay, duration: 0.6, type: "spring" }}
    whileHover={{ y: -8, scale: 1.02 }}
    className="group glass-panel p-8 rounded-3xl border border-white/10 relative overflow-hidden hover:border-purple-500/40 transition-all duration-500"
  >
    {/* Gradient Background */}
    <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${gradient}`} />
    
    {/* Glow Effect */}
    <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500" />
    
    <div className="relative z-10">
      <motion.div 
        whileHover={{ rotate: [0, -10, 10, -10, 0], scale: 1.1 }}
        transition={{ duration: 0.5 }}
        className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-6 text-purple-400 border border-purple-500/30 group-hover:border-purple-500/60 transition-colors"
      >
        <Icon size={28} className="group-hover:scale-110 transition-transform" />
      </motion.div>
      <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-purple-400 group-hover:to-pink-400 transition-all duration-500">
        {title}
      </h3>
      <p className="text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">
        {description}
      </p>
      
      {/* Arrow indicator on hover */}
      <motion.div 
        initial={{ opacity: 0, x: -10 }}
        whileHover={{ opacity: 1, x: 0 }}
        className="mt-6 flex items-center gap-2 text-purple-400 text-sm font-medium"
      >
        Learn more <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
      </motion.div>
    </div>
  </motion.div>
);

const Home = () => {
  // Generate particle positions safely
  const particles = useMemo(() => 
    [...Array(20)].map(() => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      duration: Math.random() * 10 + 10,
      delay: Math.random() * 2,
    })), []
  );

  return (
    <div className="min-h-screen bg-[#030712] font-sans selection:bg-purple-500/30 text-white relative overflow-hidden">
      {/* Animated background particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {particles.map((particle, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-purple-500/30 rounded-full"
            initial={{
              x: `${particle.x}vw`,
              y: `${particle.y}vh`,
              opacity: 0.2,
            }}
            animate={{
              y: [`${particle.y}vh`, `${(particle.y + 30) % 100}vh`],
              opacity: [0.2, 0.6, 0.2],
            }}
            transition={{
              duration: particle.duration,
              repeat: Infinity,
              ease: "linear",
              delay: particle.delay,
            }}
          />
        ))}
      </div>

      <Navbar />
      
      {/* Hero Section */}
      <section className="pt-32 pb-40 px-6 relative overflow-hidden">
        {/* Enhanced Background Gradients with Animation */}
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.5, 0.7, 0.5]
          }}
          transition={{ 
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[700px] bg-gradient-to-r from-purple-600/30 via-pink-600/20 to-blue-600/30 rounded-full blur-[140px] pointer-events-none"
        />
        <motion.div 
          animate={{ 
            scale: [1.2, 1, 1.2],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ 
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
          className="absolute bottom-0 right-0 w-[900px] h-[700px] bg-gradient-to-r from-blue-600/20 to-cyan-600/20 rounded-full blur-[120px] pointer-events-none"
        />
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <motion.span 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/40 bg-purple-500/10 backdrop-blur-sm text-xs font-bold text-purple-300 mb-8 uppercase tracking-wider shadow-lg shadow-purple-500/20"
            >
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Zap size={14} fill="currentColor" className="text-yellow-400" />
              </motion.div>
              AI-Powered Productivity
            </motion.span>
            
            <motion.h1 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-6xl md:text-8xl font-bold text-white tracking-tight mb-8 leading-[1.1]"
            >
              Master any subject{' '}
              <motion.span 
                className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 inline-block"
                animate={{
                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: "linear"
                }}
                style={{
                  backgroundSize: '200% 200%',
                }}
              >
                at lightspeed.
              </motion.span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto leading-relaxed mb-12 font-light"
            >
              Generate personalized study plans, create instant flashcards from your notes, and chat with an expert AI tutor trained on your curriculum.
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.8 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-5"
            >
              <Link to={AppRoutes.AUTH}>
                <motion.button 
                  whileHover={{ scale: 1.05, boxShadow: "0 0 40px rgba(147, 51, 234, 0.5)" }}
                  whileTap={{ scale: 0.95 }}
                  className="px-10 py-5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full text-base font-bold transition-all flex items-center gap-2 group shadow-2xl shadow-purple-500/40 relative overflow-hidden"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Start Learning Free 
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform"/>
                  </span>
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-pink-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    initial={false}
                  />
                </motion.button>
              </Link>
              <Link to={AppRoutes.AUTH}>
                <motion.button 
                  whileHover={{ scale: 1.05, backgroundColor: "rgba(255, 255, 255, 0.15)" }}
                  whileTap={{ scale: 0.95 }}
                  className="px-10 py-5 glass-panel text-white rounded-full text-base font-bold transition-all border border-white/20 backdrop-blur-sm"
                >
                  View Demo
                </motion.button>
              </Link>
            </motion.div>
          </motion.div>

          {/* Enhanced Dashboard Preview */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 1, duration: 1, ease: "easeOut" }}
            className="mt-32 relative max-w-7xl mx-auto"
          >
            {/* Glow effect behind mockup */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-3xl blur-3xl -z-10 scale-110" />
            
            <div className="glass-panel rounded-3xl border border-white/20 shadow-2xl overflow-hidden relative group bg-[#030712]">
                {/* Window Bar */}
                <div className="h-12 border-b border-white/10 flex items-center px-6 gap-3 bg-[#0f172a]">
                   <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500/30 border border-red-500/50" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/30 border border-yellow-500/50" />
                      <div className="w-3 h-3 rounded-full bg-green-500/30 border border-green-500/50" />
                   </div>
                   <div className="flex-1 flex justify-center">
                      <div className="h-5 w-48 bg-white/5 rounded-md border border-white/5" />
                   </div>
                   <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded bg-white/5 border border-white/5" />
                      <div className="h-6 w-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 border border-white/10" />
                   </div>
                </div>
                
                {/* Dashboard Content */}
                <div className="p-6 md:p-8 bg-[#030712] relative">
                   {/* Welcome Header */}
                   <motion.div 
                     initial={{ opacity: 0, y: -20 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ delay: 1.2 }}
                     className="mb-6"
                   >
                     <div className="flex items-center gap-2 mb-4">
                       <h2 className="text-2xl font-bold text-white">Welcome back, Alex.</h2>
                       <Sparkles className="text-yellow-400" size={20} />
                     </div>
                     {/* XP Bar */}
                     <div className="glass-panel p-4 rounded-2xl border border-white/10 max-w-md">
                       <div className="flex items-center justify-between mb-2">
                         <div className="flex items-center gap-2">
                           <span className="text-sm font-bold text-white">Level 12</span>
                           <span className="text-xs font-bold text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 uppercase">Scholar</span>
                         </div>
                         <span className="text-xs text-slate-400 font-mono">1,240 / 1,500 XP</span>
                       </div>
                       <div className="h-3 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                         <motion.div 
                           initial={{ width: 0 }}
                           animate={{ width: "83%" }}
                           transition={{ delay: 1.5, duration: 1 }}
                           className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-500 rounded-full"
                         />
                       </div>
                     </div>
                   </motion.div>

                   {/* Main Grid */}
                   <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                     
                     {/* Left Column - Timer & Stats */}
                     <div className="lg:col-span-2 space-y-4 md:space-y-6">
                       
                       {/* Focus Timer */}
                       <motion.div
                         initial={{ opacity: 0, x: -30 }}
                         animate={{ opacity: 1, x: 0 }}
                         transition={{ delay: 1.4 }}
                         className="glass-panel p-6 rounded-3xl border border-white/10 relative overflow-hidden bg-gradient-to-b from-white/5 to-transparent"
                       >
                         <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/10 blur-[60px] rounded-full" />
                         <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                           <div className="text-center md:text-left">
                             <h3 className="text-xl font-bold text-white flex items-center justify-center md:justify-start gap-2 mb-2">
                               <Zap className="text-yellow-400 fill-current" size={20} />
                               Focus Timer
                             </h3>
                             <p className="text-xs text-slate-400">Pomodoro technique. Stay focused on your task.</p>
                           </div>
                           <div className="flex flex-col items-center">
                             <motion.div
                               animate={{ scale: [1, 1.02, 1] }}
                               transition={{ repeat: Infinity, duration: 2 }}
                               className="text-5xl md:text-6xl font-mono font-bold text-white mb-4"
                             >
                               25:00
                             </motion.div>
                             <div className="flex gap-3">
                               <button className="px-6 py-2.5 bg-green-500/20 text-green-400 border border-green-500/50 rounded-full text-sm font-bold">
                                 Start
                               </button>
                               <button className="p-2.5 bg-white/5 text-slate-400 border border-white/5 rounded-full">
                                 <Clock size={16} />
                               </button>
                             </div>
                           </div>
                         </div>
                       </motion.div>

                       {/* Stats Cards */}
                       <div className="grid grid-cols-2 gap-4">
                         <motion.div
                           initial={{ opacity: 0, y: 20 }}
                           animate={{ opacity: 1, y: 0 }}
                           transition={{ delay: 1.6 }}
                           className="glass-panel p-5 rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/10 to-transparent"
                         >
                           <div className="flex justify-between items-start mb-4">
                             <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300">
                               <Star size={20} />
                             </div>
                             <TrendingUp size={14} className="text-indigo-400/50" />
                           </div>
                           <div>
                             <h4 className="text-3xl font-bold text-white mb-1">342</h4>
                             <p className="text-xs text-slate-400">Flashcards</p>
                           </div>
                         </motion.div>

                         <motion.div
                           initial={{ opacity: 0, y: 20 }}
                           animate={{ opacity: 1, y: 0 }}
                           transition={{ delay: 1.7 }}
                           className="glass-panel p-5 rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/10 to-transparent"
                         >
                           <div className="flex justify-between items-start mb-4">
                             <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                               <Target size={20} />
                             </div>
                             <TrendingUp size={14} className="text-emerald-400/50" />
                           </div>
                           <div>
                             <h4 className="text-3xl font-bold text-white mb-1">24 <span className="text-lg text-slate-500">/ 32</span></h4>
                             <p className="text-xs text-slate-400">Tasks Done</p>
                           </div>
                         </motion.div>
                       </div>
                     </div>

                     {/* Right Column - Progress Chart */}
                     <motion.div
                       initial={{ opacity: 0, x: 30 }}
                       animate={{ opacity: 1, x: 0 }}
                       transition={{ delay: 1.5 }}
                       className="glass-panel p-6 rounded-3xl border border-white/10 flex flex-col"
                     >
                       <div className="flex items-center justify-between mb-4">
                         <h3 className="text-lg font-bold text-white">Current Plan</h3>
                         <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-1 rounded">WEEKLY</span>
                       </div>
                       
                       {/* Circular Progress */}
                       <div className="flex-1 flex items-center justify-center relative my-6">
                         <div className="relative w-32 h-32">
                           <svg className="transform -rotate-90 w-32 h-32">
                             <circle
                               cx="64"
                               cy="64"
                               r="56"
                               stroke="rgba(255,255,255,0.1)"
                               strokeWidth="8"
                               fill="none"
                             />
                             <motion.circle
                               cx="64"
                               cy="64"
                               r="56"
                               stroke="url(#gradient)"
                               strokeWidth="8"
                               fill="none"
                               strokeLinecap="round"
                               strokeDasharray={`${2 * Math.PI * 56}`}
                               initial={{ strokeDashoffset: 2 * Math.PI * 56 }}
                               animate={{ strokeDashoffset: 2 * Math.PI * 56 * 0.32 }}
                               transition={{ delay: 2, duration: 1.5, ease: "easeOut" }}
                             />
                             <defs>
                               <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                 <stop offset="0%" stopColor="#10b981" />
                                 <stop offset="100%" stopColor="#34d399" />
                               </linearGradient>
                             </defs>
                           </svg>
                           <div className="absolute inset-0 flex items-center justify-center flex-col">
                             <span className="text-3xl font-bold text-white">75%</span>
                             <span className="text-xs text-slate-400">Done</span>
                           </div>
                         </div>
                       </div>

                       {/* Quick Actions */}
                       <div className="grid grid-cols-2 gap-2 mt-4">
                         <button className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-left group transition-colors">
                           <div className="text-purple-400 mb-1">
                             <Plus size={16} className="group-hover:scale-110 transition-transform" />
                           </div>
                           <span className="text-xs font-medium text-slate-300 block">New Plan</span>
                         </button>
                         <button className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-left group transition-colors">
                           <div className="text-blue-400 mb-1">
                             <BrainCircuit size={16} className="group-hover:scale-110 transition-transform" />
                           </div>
                           <span className="text-xs font-medium text-slate-300 block">AI Tutor</span>
                         </button>
                       </div>
                     </motion.div>

                   </div>
                </div>
             </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 border-t border-white/10 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/5 to-transparent" />
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
           <motion.div 
             initial={{ opacity: 0, y: 30 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true, margin: "-100px" }}
             transition={{ duration: 0.8 }}
             className="text-center mb-24"
           >
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="inline-block px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-sm font-bold mb-6 uppercase tracking-wider"
              >
                Powerful Features
              </motion.span>
              <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent">
                Built for the modern student.
              </h2>
              <p className="text-slate-300 max-w-2xl mx-auto text-xl leading-relaxed">
                Everything you need to excel in your academics, all in one cohesive operating system.
              </p>
           </motion.div>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <FeatureCard 
                delay={0.1}
                icon={Calendar}
                title="Adaptive Planner"
                description="Upload your syllabus or text. We automatically generate a spaced-repetition schedule tailored to your exam dates."
                gradient="bg-gradient-to-br from-indigo-500/10 to-purple-500/10"
              />
              <FeatureCard 
                delay={0.2}
                icon={Layers}
                title="Smart Flashcards"
                description="Convert raw notes into active recall decks instantly. Track mastery levels for every single card."
                gradient="bg-gradient-to-br from-purple-500/10 to-pink-500/10"
              />
              <FeatureCard 
                delay={0.3}
                icon={BrainCircuit}
                title="Contextual AI Tutor"
                description="Stuck on a concept? Chat with an AI that has read your specific notes and understands your curriculum."
                gradient="bg-gradient-to-br from-pink-500/10 to-rose-500/10"
              />
           </div>

           {/* Additional feature highlights */}
           <motion.div 
             initial={{ opacity: 0, y: 40 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             transition={{ delay: 0.5, duration: 0.8 }}
             className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-6"
           >
              {[
                { icon: Clock, label: "Focus Timer", desc: "Pomodoro sessions" },
                { icon: TrendingUp, label: "Progress Tracking", desc: "Real-time insights" },
                { icon: Award, label: "Gamification", desc: "Level up & earn XP" },
                { icon: Target, label: "Goal Setting", desc: "Achieve milestones" },
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.6 + idx * 0.1 }}
                  whileHover={{ scale: 1.05, y: -5 }}
                  className="glass-panel p-6 rounded-2xl border border-white/10 text-center group hover:border-purple-500/40 transition-all"
                >
                  <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                    <item.icon size={24} />
                  </div>
                  <div className="text-sm font-bold text-white mb-1">{item.label}</div>
                  <div className="text-xs text-slate-400">{item.desc}</div>
                </motion.div>
              ))}
           </motion.div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-32 glass-panel border-t border-white/10 relative overflow-hidden">
         {/* Animated background pattern */}
         <div className="absolute inset-0 opacity-5">
           <div className="absolute inset-0" style={{
             backgroundImage: `radial-gradient(circle at 2px 2px, rgba(147, 51, 234, 0.3) 1px, transparent 0)`,
             backgroundSize: '40px 40px'
           }} />
         </div>
         
         {/* Gradient overlay */}
         <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 via-transparent to-blue-500/5" />
         
         <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="inline-block mb-8"
              >
                <Sparkles className="text-purple-400 mx-auto" size={48} />
              </motion.div>
              
              <h2 className="text-5xl md:text-6xl font-bold text-white mb-6 tracking-tight">
                Ready to transform{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                  your grades?
                </span>
              </h2>
              <p className="text-slate-300 mb-12 text-xl max-w-2xl mx-auto leading-relaxed">
                Join thousands of students using <span className="text-white font-semibold">Study Hub</span> to reclaim their time and excel in their studies.
              </p>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-5"
              >
                <Link to={AppRoutes.AUTH}>
                  <motion.button 
                    whileHover={{ scale: 1.05, boxShadow: "0 0 50px rgba(255, 255, 255, 0.3)" }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-white text-black px-12 py-5 rounded-full font-bold text-lg hover:bg-slate-100 transition-colors shadow-2xl relative overflow-hidden group"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      Get Started for Free
                      <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                    </span>
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-purple-100 to-pink-100 opacity-0 group-hover:opacity-100 transition-opacity"
                      initial={false}
                    />
                  </motion.button>
                </Link>
                <Link to={AppRoutes.AUTH}>
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-12 py-5 glass-panel text-white rounded-full font-bold text-lg border border-white/20 hover:border-white/40 transition-all"
                  >
                    Learn More
                  </motion.button>
                </Link>
              </motion.div>

              {/* Stats */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6 }}
                className="mt-20 grid grid-cols-3 gap-8 max-w-2xl mx-auto"
              >
                {[
                  { value: "10K+", label: "Active Students" },
                  { value: "98%", label: "Success Rate" },
                  { value: "24/7", label: "AI Support" },
                ].map((stat, idx) => (
                  <div key={idx} className="text-center">
                    <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-2">
                      {stat.value}
                    </div>
                    <div className="text-sm text-slate-400">{stat.label}</div>
                  </div>
                ))}
              </motion.div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.8 }}
              className="mt-24 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center text-sm text-slate-500 gap-6"
            >
               <span>© 2025 Study Hub. All rights reserved.</span>
               <div className="flex gap-8 justify-center">
                  <a href="#" className="hover:text-white transition-colors relative group">
                    Privacy
                    <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-purple-500 group-hover:w-full transition-all duration-300"></span>
                  </a>
                  <a href="#" className="hover:text-white transition-colors relative group">
                    Terms
                    <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-purple-500 group-hover:w-full transition-all duration-300"></span>
                  </a>
                  <a href="#" className="hover:text-white transition-colors relative group">
                    Twitter
                    <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-purple-500 group-hover:w-full transition-all duration-300"></span>
                  </a>
               </div>
            </motion.div>
         </div>
      </section>

    </div>
  );
};

export default Home;
