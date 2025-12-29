import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { CalendarClock, Plus, Trash2, ExternalLink, CheckCircle2, Circle, AppWindow, Link2, Monitor, Loader2, Clock, Check, Cpu, Command, Globe, Zap, ArrowRight, Clipboard, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScheduleItem } from '../types';

// Fix for strict TS environment regarding motion props
const MotionDiv = motion.div as any;

const Scheduler = () => {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  
  // Link List Builder
  const [tempLink, setTempLink] = useState('');
  const [newLinks, setNewLinks] = useState<string[]>([]);
  
  // App List Builder
  const [tempApp, setTempApp] = useState('');
  const [newPrograms, setNewPrograms] = useState<string[]>([]);

  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchSchedules();
    // Default to today
    const now = new Date();
    setNewDate(now.toISOString().split('T')[0]);
    // Round to next hour
    now.setHours(now.getHours() + 1);
    now.setMinutes(0);
    setNewTime(now.toTimeString().slice(0,5));
  }, []);

  const fetchSchedules = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('schedules').select('*').eq('user_id', user.id).order('scheduled_at', { ascending: true });
    if (data) setSchedules(data);
    setLoading(false);
  };

  const addLink = () => {
    if (tempLink.trim()) {
      setNewLinks([...newLinks, tempLink.trim()]);
      setTempLink('');
    }
  };

  const addApp = () => {
    if (tempApp.trim()) {
      setNewPrograms([...newPrograms, tempApp.trim()]);
      setTempApp('');
    }
  };

  const createSchedule = async () => {
    if (!newTitle.trim() || !newDate || !newTime) return;
    setCreating(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const scheduledAt = new Date(`${newDate}T${newTime}:00`);

    const { data } = await supabase.from('schedules').insert({
      user_id: user.id,
      title: newTitle,
      scheduled_at: scheduledAt.toISOString(),
      links: newLinks,
      programs: newPrograms,
      completed: false
    }).select().single();

    if (data) {
      setSchedules([...schedules, data].sort((a,b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()));
      setNewTitle('');
      setNewLinks([]);
      setNewPrograms([]);
    }
    setCreating(false);
  };

  const toggleComplete = async (e: React.MouseEvent, id: string, current: boolean) => {
    e.stopPropagation();
    // Optimistic
    setSchedules(schedules.map(s => s.id === id ? { ...s, completed: !current } : s));
    await supabase.from('schedules').update({ completed: !current }).eq('id', id);
  };

  const deleteSchedule = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSchedules(schedules.filter(s => s.id !== id));
    await supabase.from('schedules').delete().eq('id', id);
  };

  const openAllLinks = (links: string[]) => {
    links.forEach(link => {
       const url = link.startsWith('http') ? link : `https://${link}`;
       window.open(url, '_blank');
    });
  };

  const copyAppsToClipboard = (apps: string[]) => {
    navigator.clipboard.writeText(apps.join('\n'));
    alert("Protocol copied! Paste this list into your notes or terminal.");
  };

  const getTimeStatus = (dateStr: string, completed: boolean) => {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = date.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));

      if (completed) return { label: 'COMPLETE', color: 'text-green-500', bg: 'bg-green-500/10' };
      if (diff < 0) return { label: 'OVERDUE', color: 'text-red-500', bg: 'bg-red-500/10' };
      if (hours < 1) return { label: 'IMMINENT', color: 'text-yellow-500', bg: 'bg-yellow-500/10' };
      return { label: 'SCHEDULED', color: 'text-cyan-500', bg: 'bg-cyan-500/10' };
  };

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
            <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-[10px] text-cyan-400 font-mono tracking-widest uppercase">System V.2.0</span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3 tracking-tight">
                <Command size={36} className="text-cyan-400" /> Command Center
            </h1>
            <p className="text-slate-400">Design your environment protocols. Execute with precision.</p>
        </div>
        <div className="flex gap-4">
            <div className="text-right hidden md:block">
                <div className="text-3xl font-mono font-bold text-white">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                <div className="text-xs text-slate-500 uppercase tracking-widest">{new Date().toLocaleDateString()}</div>
            </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Creator Panel - Redesigned */}
        <div className="lg:col-span-1">
            <div className="bg-[#0b101b]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sticky top-8 shadow-2xl relative overflow-hidden group">
                {/* Decorative elements */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-600 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="relative z-10">
                    <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 font-mono tracking-tight">
                        <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
                        NEW_PROTOCOL_V3
                    </h2>

                    <div className="space-y-6">
                        {/* Objective */}
                        <div className="group/input">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block flex justify-between">
                                <span>Mission Objective</span>
                                <span className="text-cyan-500/50 group-focus-within/input:text-cyan-400 transition-colors">REQ</span>
                            </label>
                            <input 
                                value={newTitle} 
                                onChange={e => setNewTitle(e.target.value)} 
                                placeholder="e.g. Deep Work: Physics Engine" 
                                className="w-full bg-[#0f172a] border border-white/10 rounded-xl p-4 text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:bg-[#0f172a] outline-none transition-all text-sm font-medium shadow-inner" 
                            />
                        </div>

                        {/* Timing */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Execution Date</label>
                                <input 
                                    type="date" 
                                    value={newDate} 
                                    onChange={e => setNewDate(e.target.value)} 
                                    className="w-full bg-[#0f172a] border border-white/10 rounded-xl p-3 text-white focus:border-cyan-500/50 outline-none text-xs font-mono shadow-inner" 
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">T-Minus</label>
                                <input 
                                    type="time" 
                                    value={newTime} 
                                    onChange={e => setNewTime(e.target.value)} 
                                    className="w-full bg-[#0f172a] border border-white/10 rounded-xl p-3 text-white focus:border-cyan-500/50 outline-none text-xs font-mono shadow-inner" 
                                />
                            </div>
                        </div>

                        {/* Environment Loader */}
                        <div className="bg-[#0f172a]/50 rounded-2xl p-4 border border-white/5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4 block flex items-center gap-2">
                                <Cpu size={12} /> Environment Config
                            </label>
                            
                            {/* Link Input */}
                            <div className="flex gap-2 mb-3">
                                <div className="flex-1 relative group/link">
                                    <Globe size={14} className="absolute left-3 top-3 text-slate-600 group-focus-within/link:text-cyan-400 transition-colors"/>
                                    <input 
                                        value={tempLink} 
                                        onChange={e => setTempLink(e.target.value)} 
                                        onKeyDown={e => e.key === 'Enter' && addLink()}
                                        placeholder="https://resource..." 
                                        className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-xs text-white focus:border-cyan-500/50 outline-none font-mono transition-all"
                                    />
                                </div>
                                <button onClick={addLink} className="p-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-lg text-cyan-400 transition-all hover:scale-105">
                                    <Plus size={16}/>
                                </button>
                            </div>

                            {/* App Input */}
                            <div className="flex gap-2">
                                <div className="flex-1 relative group/app">
                                    <Command size={14} className="absolute left-3 top-3 text-slate-600 group-focus-within/app:text-purple-400 transition-colors"/>
                                    <input 
                                        value={tempApp} 
                                        onChange={e => setTempApp(e.target.value)} 
                                        onKeyDown={e => e.key === 'Enter' && addApp()}
                                        placeholder="Process Name (e.g. VS Code)..." 
                                        className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-xs text-white focus:border-purple-500/50 outline-none font-mono transition-all"
                                    />
                                </div>
                                <button onClick={addApp} className="p-2.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg text-purple-400 transition-all hover:scale-105">
                                    <Plus size={16}/>
                                </button>
                            </div>
                        </div>

                        {/* Staged Payload */}
                        <AnimatePresence>
                            {(newLinks.length > 0 || newPrograms.length > 0) && (
                                <MotionDiv 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="p-3 bg-black/20 rounded-xl border border-white/5">
                                        <div className="text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-2 flex justify-between">
                                            <span>Payload Manifest</span>
                                            <span>{newLinks.length + newPrograms.length} Items</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {newLinks.map((l, i) => (
                                                <span key={`l-${i}`} className="text-[10px] bg-cyan-950/30 text-cyan-300 border border-cyan-500/20 px-2 py-1 rounded flex items-center gap-1 max-w-full truncate cursor-pointer hover:border-red-500/50 hover:text-red-400 hover:bg-red-950/30 transition-all group" onClick={() => setNewLinks(newLinks.filter((_, idx) => idx !== i))}>
                                                    <Globe size={10} className="text-cyan-500 group-hover:text-red-400"/> {l.replace(/^https?:\/\/(www\.)?/, '').substring(0, 12)}... 
                                                </span>
                                            ))}
                                            {newPrograms.map((p, i) => (
                                                <span key={`p-${i}`} className="text-[10px] bg-purple-950/30 text-purple-300 border border-purple-500/20 px-2 py-1 rounded flex items-center gap-1 cursor-pointer hover:border-red-500/50 hover:text-red-400 hover:bg-red-950/30 transition-all group" onClick={() => setNewPrograms(newPrograms.filter((_, idx) => idx !== i))}>
                                                    <Command size={10} className="text-purple-500 group-hover:text-red-400"/> {p}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </MotionDiv>
                            )}
                        </AnimatePresence>

                        <button 
                            onClick={createSchedule} 
                            disabled={creating || !newTitle} 
                            className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl text-white font-bold text-sm shadow-lg shadow-cyan-900/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale transition-all hover:scale-[1.02] active:scale-[0.98] border border-cyan-400/20 relative overflow-hidden"
                        >
                            {creating ? <Loader2 className="animate-spin" size={18}/> : <Zap size={18} fill="currentColor" />} 
                            INITIALIZE PROTOCOL
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* Timeline */}
        <div className="lg:col-span-2 space-y-4">
            {loading ? (
                <div className="text-center py-20"><Loader2 size={32} className="animate-spin text-cyan-500 mx-auto"/></div>
            ) : schedules.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] border-2 border-dashed border-white/5 rounded-3xl text-slate-500 bg-[#0b101b]/50">
                    <CalendarClock size={48} className="mb-4 opacity-20"/>
                    <p className="font-mono text-sm">NO ACTIVE PROTOCOLS</p>
                </div>
            ) : (
                <div className="relative">
                    {/* Vertical Line */}
                    <div className="absolute left-6 top-0 bottom-0 w-[1px] bg-white/5 hidden sm:block"></div>

                    <AnimatePresence>
                        {schedules.map((schedule, idx) => {
                            const isExpanded = expandedId === schedule.id;
                            const status = getTimeStatus(schedule.scheduled_at, schedule.completed);
                            const dateObj = new Date(schedule.scheduled_at);
                            
                            return (
                                <MotionDiv 
                                    key={schedule.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className={`relative mb-4 sm:pl-16 group`}
                                >
                                    {/* Timeline Dot */}
                                    <div className={`absolute left-[21px] top-8 w-2 h-2 rounded-full border-2 bg-[#030712] z-10 hidden sm:block ${schedule.completed ? 'border-green-500' : 'border-cyan-500'}`}></div>

                                    <div className={`
                                        bg-[#0b101b] border rounded-2xl transition-all duration-300 overflow-hidden
                                        ${schedule.completed ? 'border-white/5 opacity-60' : 'border-white/10 hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/5'}
                                    `}>
                                        <div className="p-5 flex items-center gap-5 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : schedule.id)}>
                                            {/* Status / Check */}
                                            <button onClick={(e) => toggleComplete(e, schedule.id, schedule.completed)} className={`p-2 rounded-full transition-colors ${schedule.completed ? 'text-green-400 bg-green-500/10' : 'text-slate-600 hover:text-white hover:bg-white/5'}`}>
                                                {schedule.completed ? <CheckCircle2 size={24}/> : <Circle size={24}/>}
                                            </button>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border border-transparent ${status.bg} ${status.color}`}>
                                                        {status.label}
                                                    </span>
                                                    <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
                                                        <Clock size={12}/> {dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                    </span>
                                                </div>
                                                <h3 className={`font-bold text-lg truncate ${schedule.completed ? 'text-slate-500 line-through decoration-slate-600' : 'text-white'}`}>{schedule.title}</h3>
                                            </div>

                                            {/* Indicators */}
                                            <div className="flex gap-3 mr-4">
                                                {schedule.links?.length > 0 && (
                                                    <div className="text-center">
                                                        <div className="text-xs font-bold text-cyan-400">{schedule.links.length}</div>
                                                        <div className="text-[8px] text-slate-500 uppercase">Links</div>
                                                    </div>
                                                )}
                                                {schedule.programs?.length > 0 && (
                                                    <div className="text-center">
                                                        <div className="text-xs font-bold text-purple-400">{schedule.programs.length}</div>
                                                        <div className="text-[8px] text-slate-500 uppercase">Apps</div>
                                                    </div>
                                                )}
                                            </div>

                                            <button onClick={(e) => deleteSchedule(e, schedule.id)} className="p-2 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={18}/></button>
                                        </div>

                                        {/* Expanded View */}
                                        <AnimatePresence>
                                            {isExpanded && (
                                                <MotionDiv initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="bg-black/30 border-t border-white/5">
                                                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        {/* Link Execution */}
                                                        <div>
                                                            <div className="flex justify-between items-center mb-4">
                                                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Globe size={14}/> Network</h4>
                                                                {schedule.links?.length > 0 && (
                                                                    <button onClick={() => openAllLinks(schedule.links)} className="text-[10px] bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-3 py-1.5 rounded flex items-center gap-1 transition-colors shadow shadow-cyan-900/50">
                                                                        <ExternalLink size={10}/> LAUNCH ALL
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <div className="space-y-2">
                                                                {schedule.links?.map((link, i) => (
                                                                    <div key={i} className="flex items-center justify-between group/link p-2 rounded hover:bg-white/5 border border-transparent hover:border-white/5 transition-colors">
                                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                                            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/50"></div>
                                                                            <a href={link.startsWith('http') ? link : `https://${link}`} target="_blank" rel="noreferrer" className="text-sm text-slate-300 hover:text-cyan-400 truncate underline decoration-slate-700 hover:decoration-cyan-500/50 underline-offset-4">{link}</a>
                                                                        </div>
                                                                        <a href={link.startsWith('http') ? link : `https://${link}`} target="_blank" rel="noreferrer" className="text-slate-600 hover:text-white opacity-0 group-hover/link:opacity-100 transition-opacity"><ArrowRight size={14}/></a>
                                                                    </div>
                                                                ))}
                                                                {(!schedule.links || schedule.links.length === 0) && <div className="text-xs text-slate-600 italic pl-2">No network resources configured.</div>}
                                                            </div>
                                                        </div>

                                                        {/* App Execution */}
                                                        <div>
                                                            <div className="flex justify-between items-center mb-4">
                                                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Cpu size={14}/> System</h4>
                                                                {schedule.programs?.length > 0 && (
                                                                    <button onClick={() => copyAppsToClipboard(schedule.programs)} className="text-[10px] bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1.5 rounded flex items-center gap-1 transition-colors shadow shadow-purple-900/50">
                                                                        <Clipboard size={10}/> COPY LIST
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <div className="space-y-2">
                                                                {schedule.programs?.map((prog, i) => (
                                                                    <div key={i} className="flex items-center gap-3 p-2 rounded bg-purple-500/5 border border-purple-500/10">
                                                                        <div className="w-5 h-5 rounded bg-[#0b101b] border border-white/10 flex items-center justify-center text-[10px] font-mono text-purple-400">
                                                                            {i+1}
                                                                        </div>
                                                                        <span className="text-sm text-purple-200 font-mono">{prog}</span>
                                                                    </div>
                                                                ))}
                                                                {(!schedule.programs || schedule.programs.length === 0) && <div className="text-xs text-slate-600 italic pl-2">No system processes configured.</div>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </MotionDiv>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </MotionDiv>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Scheduler;