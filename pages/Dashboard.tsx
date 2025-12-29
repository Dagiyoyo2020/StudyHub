import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../services/supabaseClient';
import { UserProfile, StudyPlan } from '../types';
import { Play, Pause, RefreshCw, Zap, Plus, MessageSquare, Star, TrendingUp, Sparkles, Target, Crown, Check, AlertCircle, LogOut, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { AppRoutes } from '../constants';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const Dashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Alert Modal State
  const [alertInfo, setAlertInfo] = useState<{show: boolean, title: string, message: string, type: 'success' | 'info' | 'error'}>({
      show: false, title: '', message: '', type: 'success'
  });

  // Stats
  const [completedTasks, setCompletedTasks] = useState(0);
  const [totalTasks, setTotalTasks] = useState(0);
  const [flashcardsDone, setFlashcardsDone] = useState(0);
  
  // Gamification
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [nextLevelXp, setNextLevelXp] = useState(100);
  const [prevLevelXp, setPrevLevelXp] = useState(0);

  // Focus Timer State
  const [timerActive, setTimerActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes
  const [timerMode, setTimerMode] = useState<'focus' | 'break'>('focus');

  // Check session and load data
  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        // Check if user is authenticated
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
          // No valid session, redirect to auth
          setTimeout(() => {
            navigate(AppRoutes.AUTH);
          }, 100);
          return;
        }

        setIsAuthenticated(true);
        await fetchUserData(session.user.id);
        
      } catch (err) {
        console.error('Dashboard initialization error:', err);
        setTimeout(() => {
          navigate(AppRoutes.AUTH);
        }, 100);
      } finally {
        setLoading(false);
      }
    };

    initializeDashboard();

    // Listen for auth state changes (for Google OAuth callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          // Store session in localStorage
          localStorage.setItem('supabase.auth.token', JSON.stringify(session));
          
          // Create profile if user is new (for Google sign-in)
          if (event === 'SIGNED_IN') {
            await handleNewUserProfile(session.user);
          }
          
          // Reload dashboard data
          setIsAuthenticated(true);
          await fetchUserData(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          setIsAuthenticated(false);
          clearAuthData();
          navigate(AppRoutes.AUTH);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const fetchUserData = async (userId: string) => {
    try {
      // Parallel fetch for better performance
      const [profileResult, planResult, statsResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('study_plans').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('study_stats').select('minutes, accuracy, category, subject').eq('user_id', userId)
      ]);

      // Set profile
      if (profileResult.data) {
        setProfile(profileResult.data);
      }

      // Process plan
      if (planResult.data) {
        setPlan(planResult.data);
        let done = 0;
        let total = 0;
        planResult.data.plan?.schedule?.forEach((day: any) => {
          day.tasks?.forEach((t: any) => {
            total++;
            if (t.completed) done++;
          });
        });
        setCompletedTasks(done);
        setTotalTasks(total);
      }

      // Process stats (optimized calculation)
      if (statsResult.data && statsResult.data.length > 0) {
        let totalXp = 0;
        let totalCards = 0;

        // Use reduce for better performance
        const stats = statsResult.data.reduce((acc, stat) => {
          const mins = stat.minutes || 0;
          const accuracy = stat.accuracy || 0;

          if (stat.category === 'task') {
            if (stat.subject === 'Quest Completed') {
              acc.xp += accuracy;
            } else {
              acc.xp += accuracy + (mins * 2);
            }
          } else {
            acc.cards += accuracy;
            acc.xp += (accuracy * 2) + (mins * 2);
          }
          return acc;
        }, { xp: 0, cards: 0 });

        totalXp = stats.xp;
        totalCards = stats.cards;

        setFlashcardsDone(totalCards);
        setXp(totalXp);
        
        // Level Calculation
        let calculatedLevel = 1;
        if (totalXp > 0) {
          calculatedLevel = Math.floor(Math.pow(totalXp / 50, 0.6)) + 1;
        }
        
        const prevXpBoundary = Math.floor(50 * Math.pow(calculatedLevel - 1, 1.0/0.6));
        const nextXpBoundary = Math.floor(50 * Math.pow(calculatedLevel, 1.0/0.6));
        
        setLevel(calculatedLevel);
        setPrevLevelXp(prevXpBoundary);
        setNextLevelXp(nextXpBoundary);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const handleNewUserProfile = async (user: any) => {
    try {
      // Check if profile already exists
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (fetchError && fetchError.code === 'PGRST116') {
        // Profile doesn't exist, create one
        const profileData: any = {
          id: user.id,
          email: user.email,
          theme: 'dark'
        };

        // Add name if available (from Google or sign-up form)
        if (user.user_metadata?.full_name) {
          profileData.name = user.user_metadata.full_name;
        } else if (user.user_metadata?.name) {
          profileData.name = user.user_metadata.name;
        }

        // Add username from email
        if (user.email) {
          profileData.username = user.email.split('@')[0];
        }

        await supabase.from('profiles').insert(profileData);
      }
    } catch (err) {
      console.error('Profile creation error:', err);
    }
  };

  // Timer Logic
  useEffect(() => {
    let interval: any;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0) {
      handleTimerComplete();
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  const handleTimerComplete = async () => {
    setTimerActive(false);
    const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
    audio.play().catch(() => {});
    
    if (timerMode === 'focus') {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('study_stats').insert({
            user_id: user.id,
            subject: 'Deep Work Session',
            minutes: 25,
            accuracy: 10,
            category: 'task',
            date: new Date().toISOString()
          });
          setXp(prev => prev + 60);
        }
        
        setAlertInfo({ 
          show: true, 
          title: "Focus Complete!", 
          message: "Great job! 25 minutes of deep work recorded.", 
          type: 'success' 
        });
        
        setTimerMode('break');
        setTimeLeft(5 * 60);
      } catch (error) {
        console.error('Error saving timer session:', error);
      }
    } else {
      setAlertInfo({ 
        show: true, 
        title: "Break Over", 
        message: "Time to get back to work!", 
        type: 'info' 
      });
      setTimerMode('focus');
      setTimeLeft(25 * 60);
    }
  };

  const handleLogout = async () => {
    try {
      clearAuthData();
      await supabase.auth.signOut();
      navigate(AppRoutes.AUTH);
    } catch (error) {
      console.error('Logout error:', error);
      setAlertInfo({
        show: true,
        title: 'Logout Error',
        message: 'Failed to logout. Please try again.',
        type: 'error'
      });
    }
  };

  const clearAuthData = () => {
    localStorage.removeItem('supabase.auth.token');
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getRankTitle = (lvl: number) => {
    if (lvl >= 50) return "Grandmaster";
    if (lvl >= 40) return "Arch-Scholar";
    if (lvl >= 30) return "Polymath";
    if (lvl >= 20) return "Expert";
    if (lvl >= 10) return "Apprentice";
    return "Novice";
  };

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  // Progress Bar Logic
  const xpNeededForLevel = nextLevelXp - prevLevelXp;
  const xpInCurrentLevel = xp - prevLevelXp;
  const progressPercent = xpNeededForLevel > 0 ? Math.min(100, Math.max(0, (xpInCurrentLevel / xpNeededForLevel) * 100)) : 0;

  const chartData = [
    { name: 'Completed', value: completedTasks },
    { name: 'Remaining', value: totalTasks - completedTasks },
  ];
  const COLORS = ['#10b981', '#334155']; 

  // Skeleton Loader
  const renderSkeleton = () => (
    <div className="space-y-6 md:space-y-8 pb-20">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="h-10 w-64 bg-white/10 rounded-lg animate-pulse" />
        <div className="h-24 w-full max-w-2xl bg-white/5 rounded-2xl animate-pulse mt-4 border border-white/5" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="h-[250px] w-full bg-white/5 rounded-3xl animate-pulse border border-white/5" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-40 bg-white/5 rounded-3xl animate-pulse border border-white/5" />
            <div className="h-40 bg-white/5 rounded-3xl animate-pulse border border-white/5" />
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <div className="h-[350px] w-full bg-white/5 rounded-3xl animate-pulse border border-white/5" />
          <div className="h-[150px] w-full bg-white/5 rounded-3xl animate-pulse border border-white/5" />
        </div>
      </div>
    </div>
  );

  // If loading or not authenticated, show skeleton
  if (loading || !isAuthenticated) {
    return renderSkeleton();
  }

  return (
    <div className="space-y-6 md:space-y-8 pb-20 relative">
      {/* Alert Modal */}
      <AnimatePresence>
        {alertInfo.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#0f172a] border border-white/10 rounded-2xl p-6 w-[90%] max-w-sm shadow-2xl pointer-events-auto text-center"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
                alertInfo.type === 'success' ? 'bg-green-500/20 text-green-400' :
                alertInfo.type === 'error' ? 'bg-red-500/20 text-red-400' :
                'bg-blue-500/20 text-blue-400'
              }`}>
                {alertInfo.type === 'success' ? <Check size={24}/> : 
                 alertInfo.type === 'error' ? <AlertCircle size={24}/> : 
                 <Zap size={24}/>}
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{alertInfo.title}</h3>
              <p className="text-slate-400 text-sm mb-4">{alertInfo.message}</p>
              <button 
                onClick={() => setAlertInfo({...alertInfo, show: false})} 
                className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white font-medium transition-colors"
              >
                Okay
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6">
        <div className="w-full">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              {`Welcome back, ${profile?.name?.split(' ')[0] || 'Student'}.`}
            </h1>
            <Sparkles className="text-yellow-400 animate-pulse" size={24} />
          </div>
          
          {/* Polished XP Bar */}
          <div className="glass-panel p-4 rounded-2xl border border-white/10 max-w-2xl relative overflow-hidden group mt-4">
             <div className="absolute top-0 right-0 p-12 bg-purple-500/20 rounded-full blur-2xl -mr-6 -mt-6"></div>
             <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4">
               <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 transform group-hover:scale-105 transition-transform flex-shrink-0">
                  <Crown size={32} className="text-white fill-white/20"/>
               </div>
               <div className="flex-1 w-full">
                 <div className="flex justify-between items-end mb-2">
                   <div className="flex items-center gap-2 flex-wrap">
                     <span className="text-lg font-bold text-white">Level {level}</span>
                     <span className="text-xs font-bold text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 uppercase tracking-wide">{getRankTitle(level)}</span>
                   </div>
                   <span className="text-xs text-slate-400 font-mono">{Math.floor(xpInCurrentLevel)} / {xpNeededForLevel} XP</span>
                 </div>
                 <div className="h-4 w-full bg-black/40 rounded-full overflow-hidden border border-white/5 relative">
                   <motion.div 
                     initial={{ width: 0 }} 
                     animate={{ width: `${progressPercent}%` }}
                     transition={{ duration: 1, ease: "easeOut" }}
                     className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-500 shadow-[0_0_15px_rgba(168,85,247,0.5)] relative rounded-full"
                   >
                     <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite] skew-x-12"></div>
                   </motion.div>
                 </div>
                 <p className="text-[10px] text-slate-500 mt-1 text-right">To next rank: {Math.floor(nextLevelXp - xp)} XP</p>
               </div>
             </div>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 h-full">
        
        {/* Left Column: Stats & Timer */}
        <div className="lg:col-span-2 flex flex-col gap-6 md:gap-8">
           
           {/* Focus Timer Widget */}
           <div className="glass-panel p-6 md:p-8 rounded-3xl border border-white/10 relative overflow-hidden flex-1 min-h-[250px] flex flex-col justify-center bg-gradient-to-b from-white/5 to-transparent">
              <div className="absolute top-0 right-0 p-32 bg-purple-500/10 blur-[80px] rounded-full pointer-events-none"></div>
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                 <div className="text-center md:text-left">
                    <h3 className="text-2xl font-bold text-white flex items-center justify-center md:justify-start gap-2">
                      <Zap className={timerActive ? "text-yellow-400 fill-current animate-pulse" : "text-slate-500"} /> 
                      Focus Timer
                    </h3>
                    <p className="text-slate-400 mt-2 max-w-xs mx-auto md:mx-0">Pomodoro technique. {timerMode === 'focus' ? 'Stay focused on your task.' : 'Take a short break.'}</p>
                 </div>
                 <div className="flex flex-col items-center">
                    <div className="text-6xl md:text-7xl font-mono font-bold text-white tracking-wider mb-6 tabular-nums text-shadow-lg">
                      {formatTime(timeLeft)}
                    </div>
                    <div className="flex gap-4">
                       <button 
                         onClick={() => setTimerActive(!timerActive)} 
                         className={`px-8 py-3 rounded-full font-bold transition-all transform hover:scale-105 ${timerActive ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-green-500/20 text-green-400 border border-green-500/50'}`}
                       >
                         {timerActive ? <span className="flex items-center gap-2"><Pause size={20}/> Pause</span> : <span className="flex items-center gap-2"><Play size={20}/> Start</span>}
                       </button>
                       <button 
                         onClick={() => { setTimerActive(false); setTimeLeft(timerMode === 'focus' ? 25 * 60 : 5 * 60); }} 
                         className="p-3 rounded-full bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors border border-white/5"
                       >
                         <RefreshCw size={20} />
                       </button>
                    </div>
                 </div>
              </div>
           </div>

           {/* Stats Cards Row */}
           <div className="grid grid-cols-2 gap-4 md:gap-6">
              <motion.div whileHover={{ y: -5 }} className="glass-panel p-6 rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/10 to-transparent h-40 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div className="p-3 rounded-xl bg-indigo-500/20 text-indigo-300"><Star size={24}/></div>
                  <TrendingUp size={16} className="text-indigo-400/50"/>
                </div>
                <div>
                  <h4 className="text-3xl md:text-4xl font-bold text-white mb-1">{flashcardsDone}</h4>
                  <p className="text-slate-400 text-xs md:text-sm">Flashcards Mastered</p>
                </div>
              </motion.div>

              <motion.div whileHover={{ y: -5 }} className="glass-panel p-6 rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/10 to-transparent h-40 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400"><Target size={24}/></div>
                  <TrendingUp size={16} className="text-emerald-400/50"/>
                </div>
                <div>
                   <h4 className="text-3xl md:text-4xl font-bold text-white mb-1">{completedTasks} <span className="text-lg text-slate-500">/ {totalTasks}</span></h4>
                   <p className="text-slate-400 text-xs md:text-sm">Tasks Completed</p>
                </div>
              </motion.div>
           </div>
        </div>

        {/* Right Column: Weekly Plan & Quick Actions */}
        <div className="flex flex-col gap-6 md:gap-8">
           
           {/* Weekly Progress Chart */}
           <div className="glass-panel p-6 rounded-3xl border border-white/10 flex flex-col flex-1 min-h-[350px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Current Plan</h3>
                <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-1 rounded">WEEKLY</span>
              </div>
              
              <div className="flex-1 flex flex-col items-center justify-center relative">
                {totalTasks > 0 ? (
                  <>
                    <div className="w-full h-56">
                       <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                           <Pie
                             data={chartData}
                             cx="50%"
                             cy="50%"
                             innerRadius={60}
                             outerRadius={80}
                             paddingAngle={5}
                             dataKey="value"
                             stroke="none"
                           >
                             {chartData.map((entry, index) => (
                               <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                             ))}
                           </Pie>
                           <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155' }} itemStyle={{color: '#fff'}} />
                         </PieChart>
                       </ResponsiveContainer>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                       <span className="text-4xl font-bold text-white">{completionRate}%</span>
                       <span className="text-xs text-slate-400">Done</span>
                    </div>
                  </>
                ) : (
                   <div className="text-center text-slate-500 py-8">
                     <p className="mb-4">No active study plan.</p>
                     <Link to={AppRoutes.PLANNER} className="text-purple-400 hover:underline">Create one now</Link>
                   </div>
                )}
              </div>
           </div>

           {/* Quick Actions */}
           <div className="glass-panel p-6 rounded-3xl border border-white/10">
              <h3 className="text-lg font-bold text-white mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                 <button 
                   onClick={() => navigate(AppRoutes.PLANNER)} 
                   className="p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left group"
                 >
                    <Plus className="text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-medium text-slate-300 block">New Plan</span>
                 </button>
                 <button 
                   onClick={() => navigate(AppRoutes.CHAT)} 
                   className="p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left group"
                 >
                    <MessageSquare className="text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-medium text-slate-300 block">Tutor Chat</span>
                 </button>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;