import React, { useState, useEffect } from 'react';
import { generateStudyPlan } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';
import { Loader2, Plus, Trash2, CheckSquare, Square, Calendar, AlertTriangle, ChevronDown, ChevronUp, Youtube, BookOpen, Download, Upload, Edit2, PlayCircle, X, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { StudyPlan, Task } from '../types';

// Declare PDFJS for TypeScript
declare const pdfjsLib: any;

// Fix for strict TS environment regarding motion props
const MotionDiv = motion.div as any;

const StudyPlanner = () => {
  const [subjects, setSubjects] = useState('');
  const [focus, setFocus] = useState('');
  const [hours, setHours] = useState(2);
  const [difficulty, setDifficulty] = useState('Balanced');
  const [gradeLevel, setGradeLevel] = useState('College');
  const [learningStyle, setLearningStyle] = useState('Visual');
  
  // Custom Duration State
  const [durationValue, setDurationValue] = useState(1);
  const [durationUnit, setDurationUnit] = useState<'Days' | 'Weeks'>('Weeks');

  // Context File State
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);

  const [plan, setPlan] = useState<StudyPlan['plan'] | null>(null);
  const [loading, setLoading] = useState(false); // For generating
  const [fetchingPlan, setFetchingPlan] = useState(true); // For initial load
  const [dbId, setDbId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Add Task Modal State
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTaskDayIndex, setNewTaskDayIndex] = useState<number | null>(null);
  const [newTaskSubject, setNewTaskSubject] = useState('');
  const [newTaskTopic, setNewTaskTopic] = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState('30m');
  const [newTaskDifficulty, setNewTaskDifficulty] = useState('Medium');
  
  useEffect(() => {
    if (!dbId || !plan) return;
    const timeout = setTimeout(() => {
        savePlanSilent();
    }, 1500);
    return () => clearTimeout(timeout);
  }, [plan?.weekGoal]);

  useEffect(() => {
    fetchLatestPlan();
  }, []);

  const fetchLatestPlan = async () => {
    setFetchingPlan(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('study_plans').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single();
      if (data) {
        setPlan(data.plan);
        setDbId(data.id);
      }
    }
    setFetchingPlan(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setUploadingFile(true);
    try {
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        const maxPages = Math.min(pdf.numPages, 100);
        for (let i = 1; i <= maxPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
        }
        setFileContent(fullText);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => setFileContent(e.target?.result as string);
        reader.readAsText(file);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to read file.");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const subjectList = subjects.split(',').map(s => s.trim());
      const result = await generateStudyPlan(
        subjectList, 
        focus, 
        hours, 
        difficulty, 
        gradeLevel, 
        learningStyle, 
        durationValue, 
        durationUnit,
        fileContent
      );
      if (result) {
        setPlan(result);
        setDbId(null);
        const { data: { user } } = await supabase.auth.getUser();
        if(user) {
            const { data } = await supabase.from('study_plans').insert({ user_id: user.id, plan: result }).select().single();
            if(data) setDbId(data.id);
        }
      } else {
        setError("AI returned an empty plan. Try adding more specific details.");
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to generate plan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const savePlanSilent = async () => {
    if (!plan || !dbId) return;
    await supabase.from('study_plans').update({ plan }).eq('id', dbId);
  };

  const confirmDeletePlan = async () => {
    if (dbId) {
       await supabase.from('study_plans').delete().eq('id', dbId);
    }
    setPlan(null);
    setDbId(null);
    setShowDeleteModal(false);
  };

  const exportToCSV = () => {
    if (!plan) return;
    let csv = "Day,Subject,Topic,Duration,Difficulty,Status\n";
    plan.schedule.forEach(day => {
      day.tasks.forEach(task => {
        csv += `${day.day},"${task.subject}","${task.topic}",${task.duration},${task.difficulty},${task.completed ? 'Done' : 'Pending'}\n`;
      });
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'study_plan.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleTask = async (dayIndex: number, taskIndex: number) => {
    if (!plan) return;
    const newPlan = { ...plan };
    const task = newPlan.schedule[dayIndex].tasks[taskIndex];
    const isNowCompleted = !task.completed;
    task.completed = isNowCompleted;
    setPlan(newPlan);
    if (dbId) supabase.from('study_plans').update({ plan: newPlan }).eq('id', dbId).then(() => {});
    if (isNowCompleted) {
       const { data: { user } } = await supabase.auth.getUser();
       if (user) {
         let mins = parseInt(task.duration) || 30;
         await supabase.from('study_stats').insert({
           user_id: user.id,
           subject: task.subject,
           minutes: mins,
           accuracy: 10, // Nerfed: Reduced to 10 XP base
           category: 'task',
           date: new Date().toISOString()
         });
       }
    }
  };

  const openAddTaskModal = (dayIndex: number) => {
    setNewTaskDayIndex(dayIndex);
    setNewTaskSubject('');
    setNewTaskTopic('');
    setNewTaskDuration('30m');
    setNewTaskDifficulty('Medium');
    setShowAddTaskModal(true);
  };

  const confirmAddTask = () => {
    if (!plan || newTaskDayIndex === null || !newTaskSubject.trim() || !newTaskTopic.trim()) return;
    
    const newPlan = { ...plan };
    newPlan.schedule[newTaskDayIndex].tasks.push({
      subject: newTaskSubject,
      topic: newTaskTopic,
      duration: newTaskDuration,
      difficulty: newTaskDifficulty,
      completed: false,
      subtasks: ['Review materials', 'Practice concepts', 'Summary'], // Default subtasks
      resources: []
    });
    setPlan(newPlan);
    savePlanSilent();
    setShowAddTaskModal(false);
  };

  const removeTask = (dayIndex: number, taskIndex: number) => {
    if (!plan) return;
    const newPlan = { ...plan };
    newPlan.schedule[dayIndex].tasks.splice(taskIndex, 1);
    setPlan(newPlan);
    savePlanSilent();
  };

  const toggleExpand = (id: string) => {
    setExpandedTask(expandedTask === id ? null : id);
  };

  return (
    <div className="space-y-6 h-full flex flex-col relative pb-20">
      
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <MotionDiv initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative bg-[#0f172a] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
              <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400"><Trash2 size={24} /></div>
              <h3 className="text-xl font-bold text-white mb-2">Delete Study Plan?</h3>
              <p className="text-slate-400 text-sm mb-6">This will remove your entire schedule and progress. Action cannot be undone.</p>
              <div className="flex gap-3">
                 <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors">Cancel</button>
                 <button onClick={confirmDeletePlan} className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-colors shadow-lg shadow-red-900/20">Delete</button>
              </div>
            </MotionDiv>
          </div>
        )}
      </AnimatePresence>

      {/* Add Task Modal */}
      <AnimatePresence>
        {showAddTaskModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <MotionDiv 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              className="relative bg-[#0f172a] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-bold text-white flex items-center gap-2"><Plus className="text-purple-400" size={20}/> Add Task</h3>
                 <button onClick={() => setShowAddTaskModal(false)} className="text-slate-400 hover:text-white p-1 hover:bg-white/5 rounded-full"><X size={20}/></button>
              </div>
              
              <div className="space-y-4 mb-6">
                 <div>
                    <label className="text-xs font-bold text-slate-400 mb-1.5 block uppercase tracking-wider">Subject</label>
                    <input 
                        value={newTaskSubject} 
                        onChange={e => setNewTaskSubject(e.target.value)} 
                        placeholder="e.g. Mathematics" 
                        className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white focus:border-purple-500 outline-none transition-all placeholder:text-slate-600"
                        autoFocus 
                    />
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-400 mb-1.5 block uppercase tracking-wider">Topic</label>
                    <input 
                        value={newTaskTopic} 
                        onChange={e => setNewTaskTopic(e.target.value)} 
                        placeholder="e.g. Linear Algebra" 
                        className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white focus:border-purple-500 outline-none transition-all placeholder:text-slate-600" 
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-slate-400 mb-1.5 block uppercase tracking-wider">Duration</label>
                        <select 
                            value={newTaskDuration} 
                            onChange={e => setNewTaskDuration(e.target.value)} 
                            className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white focus:border-purple-500 outline-none appearance-none cursor-pointer"
                        >
                            <option>15m</option>
                            <option>30m</option>
                            <option>45m</option>
                            <option>1h</option>
                            <option>1.5h</option>
                            <option>2h</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 mb-1.5 block uppercase tracking-wider">Difficulty</label>
                        <select 
                            value={newTaskDifficulty} 
                            onChange={e => setNewTaskDifficulty(e.target.value)} 
                            className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white focus:border-purple-500 outline-none appearance-none cursor-pointer"
                        >
                            <option>Easy</option>
                            <option>Medium</option>
                            <option>Hard</option>
                        </select>
                    </div>
                 </div>
              </div>

              <div className="flex gap-3">
                 <button onClick={() => setShowAddTaskModal(false)} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors">Cancel</button>
                 <button onClick={confirmAddTask} disabled={!newTaskSubject || !newTaskTopic} className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-colors shadow-lg disabled:opacity-50">Add Task</button>
              </div>
            </MotionDiv>
          </div>
        )}
      </AnimatePresence>

      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
         <div>
            <h1 className="text-3xl font-bold text-white mb-2">AI Study Planner</h1>
            <p className="text-slate-400">Upload your book/notes or enter topics to generate a schedule.</p>
         </div>
         {plan && (
           <div className="flex gap-2 w-full md:w-auto">
              <button onClick={exportToCSV} className="flex-1 md:flex-none px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-300 font-medium flex items-center justify-center gap-2 transition-colors border border-white/5"><Download size={18} /> Export</button>
              <button onClick={() => setShowDeleteModal(true)} className="flex-1 md:flex-none px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors border border-red-500/10"><Trash2 size={18} /> Delete Plan</button>
           </div>
         )}
      </header>

      <div className="glass-panel p-6 rounded-2xl border border-white/10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end mb-4">
          <div className="lg:col-span-2">
             <label className="text-xs text-slate-400 block mb-1">Subjects</label>
             <input value={subjects} onChange={e => setSubjects(e.target.value)} placeholder="Calculus, History, Coding..." className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-white text-sm focus:border-purple-500 outline-none" />
          </div>
          <div className="lg:col-span-2">
             <label className="text-xs text-slate-400 block mb-1">Focus Topic</label>
             <input value={focus} onChange={e => setFocus(e.target.value)} placeholder="Finals, Chapter 3, etc..." className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-white text-sm focus:border-purple-500 outline-none" />
          </div>
        </div>
        <div className="mb-4">
           <label className="text-xs text-slate-400 block mb-2 uppercase tracking-wider">Context Source (Optional)</label>
           <div className="relative border border-dashed border-white/20 bg-black/20 rounded-xl p-4 flex flex-col items-center justify-center hover:bg-white/5 transition-colors group">
             <Upload className="text-purple-400 mb-2 group-hover:scale-110 transition-transform" size={24} />
             <p className="text-sm text-slate-300 mb-1">{fileName ? `Loaded: ${fileName}` : "Upload your Textbook (PDF) or Notes (TXT)"}</p>
             <input type="file" onChange={handleFileUpload} accept=".txt,.pdf" className="absolute inset-0 opacity-0 cursor-pointer"/>
           </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div>
             <label className="text-xs text-slate-400 block mb-1">Duration</label>
             <div className="flex gap-2">
                <input type="number" min="1" max="30" value={durationValue} onChange={e => setDurationValue(Number(e.target.value))} className="w-16 bg-black/30 border border-white/10 rounded-lg p-2 text-white text-sm focus:border-purple-500 outline-none" />
                <select value={durationUnit} onChange={e => setDurationUnit(e.target.value as any)} className="bg-black/30 border border-white/10 rounded-lg p-2 text-white text-sm outline-none flex-1"><option>Days</option><option>Weeks</option></select>
             </div>
          </div>
          <div>
             <label className="text-xs text-slate-400 block mb-1">Intensity</label>
             <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-white text-sm outline-none"><option>Relaxed</option><option>Balanced</option><option>Intense</option></select>
          </div>
          <div className="col-span-2 md:col-span-2">
            <button onClick={handleGenerate} disabled={loading || !subjects} className="w-full bg-white text-black font-bold p-2 rounded-lg flex items-center justify-center hover:bg-slate-200 transition-colors disabled:opacity-50 h-[38px]">
              {loading ? <Loader2 className="animate-spin" /> : 'Generate Plan'}
            </button>
          </div>
        </div>
        {error && (<div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-200 text-sm"><AlertTriangle size={16} />{error}</div>)}
      </div>

      {fetchingPlan ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[200px]">
           <Loader2 size={32} className="animate-spin text-purple-500 mb-4" />
           <p className="text-slate-400">Syncing schedule...</p>
        </div>
      ) : plan ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <div className="md:col-span-2 lg:col-span-3 xl:col-span-4 mb-4">
            <div className="bg-purple-900/20 border border-purple-500/30 p-4 rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.1)] group hover:border-purple-500/50 transition-colors">
               <div className="flex items-center gap-2 mb-1">
                 <span className="text-purple-300 font-bold uppercase tracking-widest text-xs block">Study Goal</span>
                 <Edit2 size={12} className="text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
               </div>
               <input value={plan.weekGoal} onChange={(e) => setPlan({...plan, weekGoal: e.target.value})} className="w-full bg-transparent text-white text-lg font-medium border-b border-transparent hover:border-white/20 focus:border-purple-500 outline-none transition-all placeholder:text-white/20" placeholder="Enter your main goal here..."/>
            </div>
          </div>
          {plan.schedule?.map((day: any, dIdx: number) => (
            <MotionDiv initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: dIdx * 0.05 }} key={dIdx} className="glass-panel rounded-xl border border-white/10 overflow-hidden flex flex-col">
              <div className="bg-white/5 p-3 flex justify-between items-center border-b border-white/5">
                <h3 className="font-bold text-white">{day.day}</h3>
                <button onClick={() => openAddTaskModal(dIdx)} className="text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-1 rounded transition-colors"><Plus size={16}/></button>
              </div>
              <div className="p-3 space-y-3 flex-1">
                {day.tasks?.map((task: Task, tIdx: number) => {
                  const taskId = `${dIdx}-${tIdx}`;
                  const isExpanded = expandedTask === taskId;
                  return (
                    <div key={tIdx} className={`group rounded-lg border transition-all ${task.completed ? 'bg-green-900/10 border-green-500/30 opacity-60' : 'bg-black/20 border-white/5 hover:border-purple-500/30'}`}>
                      <div className="p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                             <div className="flex items-center gap-2 mb-1">
                                <button onClick={(e) => { e.stopPropagation(); toggleTask(dIdx, tIdx); }} className="text-slate-400 hover:text-purple-400 flex-shrink-0">
                                   {task.completed ? <CheckSquare size={18} className="text-green-400"/> : <Square size={18}/>}
                                </button>
                                <span className={`font-semibold text-sm ${task.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>{task.subject}</span>
                             </div>
                             <p className="text-xs text-slate-400 ml-7 line-clamp-2">{task.topic}</p>
                          </div>
                          <div className="flex items-center gap-1">
                             <button onClick={() => toggleExpand(taskId)} className="text-slate-500 hover:text-white p-1">{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
                             <button onClick={() => removeTask(dIdx, tIdx)} className="text-slate-600 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-7">
                           <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-500">{task.duration}</span>
                           <span className={`text-[10px] px-1.5 py-0.5 rounded ${task.difficulty === 'Hard' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>{task.difficulty}</span>
                        </div>
                      </div>
                      
                      {/* Expanded Details */}
                      <AnimatePresence>
                        {isExpanded && (
                          <MotionDiv initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-white/5 bg-black/10">
                            <div className="p-3 pl-10 space-y-3">
                               {task.subtasks && task.subtasks.length > 0 && (
                                 <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-500 mb-1 flex items-center gap-1"><BookOpen size={10}/> Steps</p>
                                    <ul className="list-disc ml-3 text-xs text-slate-300 space-y-1">{task.subtasks.map((st, i) => <li key={i}>{st}</li>)}</ul>
                                 </div>
                               )}
                               {task.resources && task.resources.length > 0 && (
                                 <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-500 mb-1 flex items-center gap-1"><Youtube size={10}/> Suggested Videos</p>
                                    <div className="flex flex-col gap-2 mt-2">
                                      {task.resources.map((res, i) => (
                                        <a key={i} href={`https://www.youtube.com/results?search_query=${encodeURIComponent(res)}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-2 rounded-lg bg-red-900/10 border border-red-500/20 hover:bg-red-900/20 transition-colors group/video">
                                          <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white shrink-0 group-hover/video:scale-110 transition-transform"><PlayCircle size={16} fill="currentColor"/></div>
                                          <span className="text-xs text-slate-200 font-medium truncate">{res}</span>
                                        </a>
                                      ))}
                                    </div>
                                 </div>
                               )}
                            </div>
                          </MotionDiv>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
                {day.tasks.length === 0 && <div className="text-center text-xs text-slate-600 py-4">No tasks planned</div>}
              </div>
            </MotionDiv>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-white/10 rounded-2xl min-h-[300px]">
           <Calendar size={48} className="mb-4 opacity-50"/>
           <p>Configure settings to generate your custom plan</p>
           {fileName && <p className="mt-2 text-green-400 text-sm">Context loaded: {fileName}</p>}
        </div>
      )}
    </div>
  );
};

export default StudyPlanner;