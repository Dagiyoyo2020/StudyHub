import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { StudyStat } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { BarChart as BarChartIcon, Clock, Download, Activity, Flame, Trophy } from 'lucide-react';

const Analytics = () => {
  const [stats, setStats] = useState<StudyStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [xp, setXp] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Chart Data States
  const [activityData, setActivityData] = useState<any[]>([]);
  const [subjectData, setSubjectData] = useState<any[]>([]);
  const [totalTime, setTotalTime] = useState(0);

  useEffect(() => {
    fetchStats();
    
    // Subscribe to real-time changes
    const channel = supabase.channel('realtime_analytics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'study_stats' }, () => {
        fetchStats();
        setLastUpdated(new Date());
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('study_stats').select('*').eq('user_id', user.id).order('date', { ascending: true });
      if (data) {
        setStats(data);
        processData(data);
      }
    }
    setLoading(false);
  };

  const calculateStreak = (data: StudyStat[]) => {
    if (!data || data.length === 0) return 0;
    
    // 1. Get unique days (Local Time Strings) to handle timezone correctly
    const uniqueDaysSet = new Set(data.map(s => new Date(s.date).toDateString()));
    const uniqueDays = Array.from(uniqueDaysSet);

    // 2. Convert to timestamps for math and sort Descending (Newest first)
    const timestamps = uniqueDays.map(d => new Date(d).getTime()).sort((a,b) => b - a);

    if (timestamps.length === 0) return 0;

    // 3. Define Today and Yesterday in local time timestamps (at 00:00:00)
    const today = new Date().toDateString();
    const todayTs = new Date(today).getTime();
    const yesterdayTs = todayTs - 86400000; // Exactly 24 hours behind

    // 4. Check if the most recent activity allows for a current streak
    const lastActivity = timestamps[0];
    
    // If the last activity wasn't Today OR Yesterday, the streak is broken (0).
    if (lastActivity !== todayTs && lastActivity !== yesterdayTs) {
      return 0;
    }

    // 5. Calculate streak
    let currentStreak = 1;
    
    // Iterate backwards checking for consecutive days
    for (let i = 0; i < timestamps.length - 1; i++) {
        const current = timestamps[i];
        const prev = timestamps[i+1];
        
        // Calculate difference in days
        const diffTime = Math.abs(current - prev);
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            currentStreak++;
        } else {
            break; // Gap found, stop counting
        }
    }

    return currentStreak;
  };

  const processData = (data: StudyStat[]) => {
    if (!data || data.length === 0) return;
    
    // 1. Calculate Streak
    const s = calculateStreak(data);
    setStreak(s);

    // 2. Calculate XP (Gamified Score) & Aggregates
    let totalXp = 0;
    let totalMins = 0;

    // 3. Activity & Subject Data
    const groupedDate: Record<string, { name: string, flashcards: number, tasks: number }> = {};
    const groupedSubject: Record<string, number> = {};

    data.forEach(stat => {
      const date = new Date(stat.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const mins = stat.minutes || 0;
      totalMins += mins;

      if (!groupedDate[date]) {
        groupedDate[date] = { name: date, flashcards: 0, tasks: 0 };
      }

      if (stat.category === 'task') {
        groupedDate[date].tasks += 1;
        totalXp += (stat.accuracy || 10); 
        totalXp += mins;
      } else {
        // Assume flashcards or generic study
        groupedDate[date].flashcards += (stat.accuracy || 0);
        totalXp += (stat.accuracy || 0) * 5; 
        totalXp += mins * 10;
      }

      // Group Subjects - Normalize names
      let sub = stat.subject ? stat.subject.trim() : 'General';
      // Simple capitalization
      if (sub.length > 2) {
          sub = sub.charAt(0).toUpperCase() + sub.slice(1);
      }
      groupedSubject[sub] = (groupedSubject[sub] || 0) + mins;
    });

    setXp(totalXp);
    setTotalTime(totalMins);
    
    // Ensure chronological order for chart
    const sortedDates = Object.values(groupedDate).sort((a,b) => {
        return new Date(a.name).getTime() - new Date(b.name).getTime();
    });
    // Limit to last 14 entries
    setActivityData(sortedDates.slice(-14)); 

    // Prepare Pie Data (Filter out 0 values and Sort)
    const pieData = Object.keys(groupedSubject)
        .map(key => ({
            name: key,
            value: groupedSubject[key]
        }))
        .filter(item => item.value > 0)
        .sort((a,b) => b.value - a.value);

    setSubjectData(pieData);
  };

  const exportData = () => {
    if (stats.length === 0) return;
    let csv = "Date,Subject,Minutes,Score/Count,Category\n";
    stats.forEach(s => {
      csv += `"${s.date}","${s.subject}",${s.minutes},${s.accuracy},${s.category || 'flashcard'}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'study_analytics.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const COLORS = ['#8b5cf6', '#06b6d4', '#ec4899', '#10b981', '#f59e0b', '#6366f1', '#84cc16', '#d946ef'];

  if (loading) {
      return (
        <div className="space-y-6 md:space-y-8 h-full pb-20">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="w-full">
                    <div className="h-8 bg-white/5 rounded w-1/3 mb-2 animate-pulse"></div>
                    <div className="h-4 bg-white/5 rounded w-1/4 animate-pulse"></div>
                </div>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                    <div key={i} className="glass-panel h-40 rounded-3xl border border-white/5 animate-pulse bg-white/5"></div>
                ))}
                <div className="glass-panel h-[350px] md:col-span-2 lg:col-span-2 rounded-3xl border border-white/5 animate-pulse bg-white/5"></div>
                <div className="glass-panel h-[350px] rounded-3xl border border-white/5 animate-pulse bg-white/5"></div>
            </div>
        </div>
      )
  }

  return (
    <div className="space-y-6 md:space-y-8 h-full pb-20">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
             Performance Analytics 
             <span className="text-xs font-mono font-normal text-green-400 bg-green-900/20 px-2 py-1 rounded-full border border-green-500/20 flex items-center gap-1 animate-pulse">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div> LIVE
             </span>
          </h1>
          <p className="text-slate-400">Real-time insights into your learning patterns.</p>
        </div>
        <button onClick={exportData} disabled={stats.length === 0} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white font-medium flex items-center gap-2 transition-colors disabled:opacity-50">
           <Download size={18} /> Export CSV
        </button>
      </header>

      {stats.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[400px] border-2 border-dashed border-white/10 rounded-3xl text-slate-500">
           <BarChartIcon size={48} className="mb-4 opacity-30" />
           <h3 className="text-xl font-bold text-white mb-2">No Data Yet</h3>
           <p className="max-w-md text-center">Start studying flashcards or completing planner tasks to populate your dashboard.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Streak Card */}
          <div className="glass-panel p-6 rounded-3xl border border-white/10 bg-gradient-to-br from-orange-500/10 to-red-500/5">
             <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-orange-500/20 rounded-lg text-orange-400"><Flame size={20}/></div>
                <span className="text-slate-400 font-medium">Study Streak</span>
             </div>
             <div className="text-5xl font-bold text-white mb-1">{streak} <span className="text-lg font-normal text-slate-400">day{streak !== 1 ? 's' : ''}</span></div>
             <p className="text-sm text-slate-500">Consecutive days of activity.</p>
          </div>

          {/* XP Card */}
          <div className="glass-panel p-6 rounded-3xl border border-white/10 bg-gradient-to-br from-purple-500/10 to-indigo-500/5">
             <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400"><Trophy size={20}/></div>
                <span className="text-slate-400 font-medium">Knowledge XP</span>
             </div>
             <div className="text-5xl font-bold text-white mb-1">{xp.toLocaleString()}</div>
             <p className="text-sm text-slate-500">Earned from tasks & flashcards.</p>
          </div>

          {/* Time Card */}
          <div className="glass-panel p-6 rounded-3xl border border-white/10 bg-gradient-to-br from-blue-500/10 to-cyan-500/5 md:col-span-2 lg:col-span-1">
             <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><Clock size={20}/></div>
                <span className="text-slate-400 font-medium">Total Time</span>
             </div>
             <div className="text-5xl font-bold text-white mb-1">{totalTime} <span className="text-lg font-normal text-slate-400">mins</span></div>
             <p className="text-sm text-slate-500">Deep work focus time.</p>
          </div>

          {/* Flashcards vs Tasks Line Chart */}
          <div className="glass-panel p-6 rounded-3xl border border-white/10 md:col-span-2 lg:col-span-2 min-h-[350px]">
            <div className="flex justify-between items-center mb-6">
               <h3 className="text-lg font-semibold text-white flex items-center gap-2"><Activity size={18} className="text-purple-400"/> Daily Activity Volume</h3>
               <span className="text-xs text-slate-500">Updated: {lastUpdated.toLocaleTimeString()}</span>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityData}>
                  <defs>
                    <linearGradient id="colorCards" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }} 
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="flashcards" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorCards)" name="Cards Reviewed" animationDuration={500} />
                  <Area type="monotone" dataKey="tasks" stroke="#10b981" fillOpacity={1} fill="url(#colorTasks)" name="Tasks Completed" animationDuration={500} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Subject Focus Card (Redesigned) */}
          <div className="glass-panel p-6 rounded-3xl border border-white/10 min-h-[350px] flex flex-col">
             <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                 <Clock size={18} className="text-blue-400"/> Subject Distribution
             </h3>
             <p className="text-sm text-slate-500 mb-6">Time breakdown by subject.</p>
             
             <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-8">
                 {/* Chart */}
                 <div className="h-[220px] w-[220px] relative">
                     {subjectData.length > 0 ? (
                         <>
                         <ResponsiveContainer width="100%" height="100%">
                             <PieChart>
                                 <Pie
                                     data={subjectData}
                                     cx="50%"
                                     cy="50%"
                                     innerRadius={65}
                                     outerRadius={85}
                                     paddingAngle={4}
                                     dataKey="value"
                                     stroke="none"
                                     cornerRadius={8}
                                 >
                                     {subjectData.map((entry, index) => (
                                         <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                     ))}
                                 </Pie>
                                 <Tooltip 
                                     formatter={(value: number) => [`${value} mins`, 'Duration']}
                                     contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                                     itemStyle={{ color: '#fff' }}
                                 />
                             </PieChart>
                         </ResponsiveContainer>
                         {/* Center Text */}
                         <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                              <span className="text-3xl font-bold text-white">
                                 {Math.max(0.1, Math.round(totalTime / 60 * 10) / 10)}
                              </span>
                              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Hours</span>
                         </div>
                         </>
                     ) : (
                         <div className="absolute inset-0 flex items-center justify-center text-slate-600">
                             <div className="text-center">
                                 <Activity size={32} className="mx-auto mb-2 opacity-20"/>
                                 <span className="text-xs">No data</span>
                             </div>
                         </div>
                     )}
                 </div>

                 {/* Legend Sidebar */}
                 <div className="flex-1 w-full md:w-auto overflow-y-auto max-h-[220px] custom-scrollbar pr-2">
                     <div className="space-y-3">
                         {subjectData.length > 0 ? subjectData.map((entry, index) => {
                             const percentage = ((entry.value / totalTime) * 100).toFixed(0);
                             return (
                                 <div key={index} className="flex items-center justify-between group p-2 rounded-lg hover:bg-white/5 transition-colors">
                                     <div className="flex items-center gap-3">
                                         <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                         <span className="text-sm text-slate-300 font-medium truncate max-w-[120px]" title={entry.name}>{entry.name}</span>
                                     </div>
                                     <div className="flex items-center gap-3">
                                          <span className="text-xs text-white font-bold">{entry.value}m</span>
                                          <div className="w-10 text-right">
                                             <span className="text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">{percentage}%</span>
                                          </div>
                                     </div>
                                 </div>
                             );
                         }) : (
                             <div className="text-center text-slate-600 py-4 text-xs italic">
                                 Complete tasks to see breakdown
                             </div>
                         )}
                     </div>
                 </div>
             </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default Analytics;