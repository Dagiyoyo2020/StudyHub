
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { generateFlashcardsFromText, continueWriting, explainText } from '../services/geminiService';
import { Note } from '../types';
import { 
  Plus, Save, Trash2, Search, Sparkles, Loader2, Layers, 
  NotebookPen, Tag, ArrowLeft, Wand2, X, BrainCircuit, Zap, FileText, Share2, CheckCircle, AlertCircle, Eye, Edit
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ShareModal from '../components/ShareModal';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// Fix for strict TS environment regarding motion props
const MotionDiv = motion.div as any;

const Notes = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Editor State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  
  const [saving, setSaving] = useState(false);
  
  // AI State
  const [generatingCards, setGeneratingCards] = useState(false);
  const [aiWriting, setAiWriting] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  
  // Modals
  const [showFlashcardConfig, setShowFlashcardConfig] = useState(false);
  const [showAiResultModal, setShowAiResultModal] = useState(false);
  const [showMagicModal, setShowMagicModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  
  // Custom Alert State
  const [alertInfo, setAlertInfo] = useState<{ show: boolean, title: string, message: string, type: 'success' | 'error' }>({
    show: false, title: '', message: '', type: 'success'
  });

  // Magic Result
  const [magicResult, setMagicResult] = useState('');
  const [magicType, setMagicType] = useState<'explain' | 'summarize' | 'quiz'>('explain');
  
  // Delete Modal State
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  // Config State
  const [cardCount, setCardCount] = useState(10);
  const [cardFocus, setCardFocus] = useState('Key Concepts');
  const [customFocus, setCustomFocus] = useState('');

  const [aiResult, setAiResult] = useState<any[]>([]);
  const [aiSuccess, setAiSuccess] = useState(false);

  // Mobile View State
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');

  useEffect(() => {
    fetchNotes();
  }, []);

  // Auto-save debounce
  useEffect(() => {
    if (!activeNote) return;

    const timer = setTimeout(() => {
      // Check if content changed compared to the 'clean' activeNote state
      if (title !== activeNote.title || content !== activeNote.content || JSON.stringify(tags) !== JSON.stringify(activeNote.tags)) {
        saveNote(true);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [title, content, tags, activeNote]);

  const fetchNotes = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('notes').select('*').eq('user_id', user.id).order('updated_at', { ascending: false });
      if (data) {
        setNotes(data);
      }
    }
    setLoading(false);
  };

  const showAlert = (title: string, message: string, type: 'success' | 'error' = 'success') => {
    setAlertInfo({ show: true, title, message, type });
  };

  const createNote = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newNote = {
        user_id: user.id,
        title: 'Untitled Note',
        content: '',
        tags: []
    };

    const { data } = await supabase.from('notes').insert(newNote).select().single();
    if (data) {
        setNotes([data, ...notes]);
        selectNote(data);
    }
  };

  const selectNote = (note: Note) => {
    setActiveNote(note);
    setTitle(note.title);
    setContent(note.content || '');
    setTags(note.tags || []);
    setAiResult([]);
    setAiSuccess(false);
    setTagInput('');
    setMobileView('editor');
    setPreviewMode(false);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    setNotes(prev => prev.map(n => n.id === activeNote?.id ? { ...n, title: newTitle } : n));
  };

  const goBackToList = () => {
    setMobileView('list');
    setActiveNote(null);
  };

  const saveNote = async (silent = false) => {
    if (!activeNote) return;
    if (!silent) setSaving(true);

    const { error } = await supabase.from('notes').update({
        title,
        content,
        tags,
        updated_at: new Date().toISOString()
    }).eq('id', activeNote.id);

    if (!error) {
        const newDate = new Date();
        const updatedNote = { 
            ...activeNote, 
            title, 
            content, 
            tags, 
            updated_at: newDate.toISOString() 
        };
        setActiveNote(updatedNote);
        setNotes(prev => prev.map(n => n.id === activeNote.id ? updatedNote : n));
        if (!silent) setSaving(false);
    }
  };

  const requestDeleteNote = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setNoteToDelete(id);
  };

  const confirmDeleteNote = async () => {
    if (!noteToDelete) return;
    await supabase.from('notes').delete().eq('id', noteToDelete);
    const remaining = notes.filter(n => n.id !== noteToDelete);
    setNotes(remaining);
    if (activeNote?.id === noteToDelete) {
        setActiveNote(null);
        setTitle('');
        setContent('');
        setTags([]);
        setMobileView('list');
    }
    setNoteToDelete(null);
  };

  const handleAiContinue = async () => {
    if (!content.trim()) return;
    setAiWriting(true);
    try {
      const completion = await continueWriting(content);
      if (completion) {
        const prefix = content.endsWith(' ') || content.endsWith('\n') ? '' : ' ';
        setContent(prev => prev + prefix + completion);
      }
    } catch (e) {
      console.error(e);
      alert("AI Writer is currently unavailable.");
    } finally {
      setAiWriting(false);
    }
  };

  const handleMagicAction = async (type: 'explain' | 'summarize' | 'quiz') => {
     setMagicType(type);
     setShowMagicModal(true);
     setMagicLoading(true);
     setMagicResult('');

     // Get selected text or full content
     const selection = window.getSelection()?.toString();
     const textToProcess = selection && selection.trim().length > 0 ? selection : content;

     if (!textToProcess.trim()) {
        setMagicResult("Please write something or select text first.");
        setMagicLoading(false);
        return;
     }

     const result = await explainText(textToProcess, type);
     setMagicResult(result || "No result generated.");
     setMagicLoading(false);
  };

  const openFlashcardConfig = () => {
    if (!content.trim()) return;
    setShowFlashcardConfig(true);
    setAiSuccess(false);
    setAiResult([]);
  }

  const handleGenerateFlashcards = async () => {
    setShowFlashcardConfig(false);
    setShowAiResultModal(true);
    setGeneratingCards(true);
    try {
        const finalFocus = cardFocus === 'Custom' ? customFocus : cardFocus;
        const instructions = `Focus strictly on: ${finalFocus}.`;
        const cards = await generateFlashcardsFromText(content, cardCount, instructions);
        setAiResult(cards);
    } catch (e) {
        console.error(e);
    } finally {
        setGeneratingCards(false);
    }
  };

  const saveFlashcardsToDeck = async () => {
    if (aiResult.length === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: deck } = await supabase.from('flashcard_decks').insert({
        user_id: user.id,
        title: `Notes: ${title}`,
        description: `Generated from note. Focus: ${cardFocus === 'Custom' ? customFocus : cardFocus}`
    }).select().single();

    if (deck) {
        const cardsToInsert = aiResult.map(c => ({
            deck_id: deck.id,
            question: c.question,
            answer: c.answer
        }));
        await supabase.from('flashcards').insert(cardsToInsert);
        setAiSuccess(true);
        setTimeout(() => setShowAiResultModal(false), 2000);
    }
  };

  const handleShareNote = async (friendId: string) => {
    if (!activeNote) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('direct_messages').insert({
        sender_id: user.id,
        receiver_id: friendId,
        message_type: 'note',
        content: `Shared a note: ${activeNote.title}`,
        metadata: {
            title: activeNote.title,
            content: activeNote.content,
            tags: activeNote.tags || []
        }
    });

    setShowShareModal(false);
    showAlert("Success", "Note sent successfully!", 'success');
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const filteredNotes = notes.filter(n => 
    n.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (n.tags && n.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  return (
    <div className="flex w-full h-screen bg-[#030712] overflow-hidden relative">
        
        <ShareModal 
            isOpen={showShareModal}
            onClose={() => setShowShareModal(false)}
            onShare={handleShareNote}
            title="Share Note"
            itemTitle={activeNote?.title || 'Untitled'}
        />

        {/* Alert Modal */}
        <AnimatePresence>
            {alertInfo.show && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
                    <MotionDiv 
                        initial={{ opacity: 0, scale: 0.9 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        exit={{ opacity: 0, scale: 0.9 }} 
                        className="bg-[#0f172a] border border-white/10 rounded-2xl p-6 w-[90%] max-w-sm shadow-2xl pointer-events-auto text-center"
                    >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${alertInfo.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {alertInfo.type === 'success' ? <CheckCircle size={24}/> : <AlertCircle size={24}/>}
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">{alertInfo.title}</h3>
                        <p className="text-slate-400 text-sm mb-4">{alertInfo.message}</p>
                        <button onClick={() => setAlertInfo({ ...alertInfo, show: false })} className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white font-medium">
                            Okay
                        </button>
                    </MotionDiv>
                </div>
            )}
        </AnimatePresence>

        {/* Left Sidebar */}
        <div className={`w-full md:w-72 bg-black/40 border-r border-white/5 flex flex-col glass-panel backdrop-blur-none z-10 absolute md:relative h-full transition-transform duration-300 ${mobileView === 'list' ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
            <div className="p-4 border-b border-white/5">
                <button onClick={createNote} className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-900/20 mb-4">
                    <Plus size={16} /> New Note
                </button>
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
                    <input 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search title or tag..." 
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:border-purple-500 outline-none"
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {loading ? (
                    <div className="space-y-3 p-2">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="p-3 rounded-lg border border-white/5 bg-white/5 animate-pulse">
                                <div className="h-4 bg-white/10 rounded w-3/4 mb-2"></div>
                                <div className="h-3 bg-white/5 rounded w-1/2 mb-3"></div>
                                <div className="h-2 bg-white/5 rounded w-1/4"></div>
                            </div>
                        ))}
                    </div>
                ) : filteredNotes.length === 0 ? (
                    <div className="text-center text-slate-500 py-10 text-xs">No notes found.</div>
                ) : (
                    filteredNotes.map(note => (
                        <div key={note.id} onClick={() => selectNote(note)} className={`group p-3 rounded-lg cursor-pointer border transition-all ${activeNote?.id === note.id ? 'bg-white/10 border-purple-500/50' : 'bg-transparent border-transparent hover:bg-white/5'}`}>
                            <div className="flex justify-between items-start">
                                 <h4 className={`font-medium text-sm truncate mb-1 ${activeNote?.id === note.id ? 'text-white' : 'text-slate-300'}`}>{note.title || 'Untitled'}</h4>
                                 <button onClick={(e) => requestDeleteNote(e, note.id)} className="md:opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-1"><Trash2 size={12}/></button>
                            </div>
                            {note.tags && note.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-1">
                                 {note.tags.slice(0, 3).map((t, i) => (<span key={i} className="text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-slate-400">{t}</span>))}
                              </div>
                            )}
                            <p className="text-[10px] text-slate-500 line-clamp-2">{note.content || "No content"}</p>
                            <span className="text-[9px] text-slate-600 mt-2 block">{new Date(note.updated_at).toLocaleDateString()}</span>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* Main Editor */}
        <div className={`flex-1 flex flex-col bg-[#030712] relative w-full h-full absolute md:relative transition-transform duration-300 ${mobileView === 'editor' ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
            {activeNote ? (
                <>
                    {/* Editor Toolbar */}
                    <div className="border-b border-white/5 flex flex-col px-4 md:px-6 py-3 bg-black/20 gap-3">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2 flex-1">
                            <button onClick={goBackToList} className="md:hidden p-2 text-slate-400 hover:text-white"><ArrowLeft size={18}/></button>
                            <input value={title} onChange={handleTitleChange} className="bg-transparent text-lg font-bold text-white outline-none placeholder:text-slate-600 flex-1 min-w-0" placeholder="Note Title"/>
                          </div>
                          
                          <div className="flex items-center gap-2">
                              <span className="hidden md:flex text-[10px] text-slate-500 items-center gap-1">
                                {saving ? <Loader2 size={10} className="animate-spin"/> : <Save size={10}/>} 
                                {saving ? 'Saving...' : 'Saved'}
                              </span>
                              <div className="h-6 w-[1px] bg-white/10 mx-2 hidden md:block"></div>
                              
                              <button onClick={() => setPreviewMode(!previewMode)} className={`p-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${previewMode ? 'bg-purple-600 text-white' : 'bg-white/5 hover:bg-white/10 text-slate-400'}`} title="Toggle Preview">
                                 {previewMode ? <Edit size={14} /> : <Eye size={14} />} <span className="hidden md:inline">{previewMode ? 'Edit' : 'Preview'}</span>
                              </button>

                              <button onClick={() => setShowShareModal(true)} className="p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-all" title="Share Note">
                                 <Share2 size={14} />
                              </button>

                              <button onClick={handleAiContinue} disabled={!content.trim() || aiWriting} className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-xs font-bold flex items-center gap-2 transition-all border border-blue-500/20" title="AI Continue Writing">
                                {aiWriting ? <Loader2 size={14} className="animate-spin"/> : <Wand2 size={14} />} <span className="hidden md:inline">Continue</span>
                              </button>

                              <button onClick={openFlashcardConfig} disabled={!content.trim()} className="px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg text-white text-xs font-bold flex items-center gap-2 hover:opacity-90 transition-opacity whitespace-nowrap">
                                  <Sparkles size={14} /> <span className="hidden sm:inline">Flashcards</span>
                              </button>
                          </div>
                        </div>

                        {/* Magic Bar */}
                        <div className="flex gap-2 pb-1 border-t border-white/5 pt-2 mt-1 overflow-x-auto no-scrollbar">
                           <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1 mr-2"><BrainCircuit size={12}/> AI Tools:</span>
                           <button onClick={() => handleMagicAction('explain')} className="text-[10px] text-slate-300 hover:text-white hover:bg-white/5 px-2 py-1 rounded flex items-center gap-1 transition-colors whitespace-nowrap"><BrainCircuit size={12}/> Explain</button>
                           <button onClick={() => handleMagicAction('summarize')} className="text-[10px] text-slate-300 hover:text-white hover:bg-white/5 px-2 py-1 rounded flex items-center gap-1 transition-colors whitespace-nowrap"><FileText size={12}/> Summarize</button>
                           <button onClick={() => handleMagicAction('quiz')} className="text-[10px] text-slate-300 hover:text-white hover:bg-white/5 px-2 py-1 rounded flex items-center gap-1 transition-colors whitespace-nowrap"><Zap size={12}/> Quiz Me</button>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                           <Tag size={12} className="text-slate-500"/>
                           {tags.map((tag, idx) => (<span key={idx} className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-md flex items-center gap-1">{tag}<button onClick={() => removeTag(tag)} className="hover:text-white"><Trash2 size={8} /></button></span>))}
                           <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={handleAddTag} placeholder="Add tag..." className="bg-transparent text-[10px] text-slate-400 outline-none placeholder:text-slate-600 min-w-[60px]"/>
                        </div>
                    </div>

                    {previewMode ? (
                        <div className="flex-1 w-full bg-[#030712] p-6 overflow-y-auto custom-scrollbar">
                            <div className="prose prose-invert prose-sm max-w-none">
                                <ReactMarkdown 
                                    remarkPlugins={[remarkMath]} 
                                    rehypePlugins={[rehypeKatex]}
                                    components={{
                                        code: ({node, inline, className, children, ...props}: any) => (
                                            <code className={inline ? "bg-white/10 px-1 py-0.5 rounded text-pink-300 font-mono text-sm" : "block bg-black/30 p-3 rounded-lg text-slate-200 font-mono text-xs overflow-x-auto border border-white/5 my-2"} {...props}>
                                                {children}
                                            </code>
                                        )
                                    }}
                                >
                                    {content}
                                </ReactMarkdown>
                            </div>
                        </div>
                    ) : (
                        <textarea value={content} onChange={(e) => setContent(e.target.value)} className="flex-1 w-full bg-transparent p-4 md:p-6 text-slate-200 outline-none resize-none leading-relaxed text-sm md:text-base font-light placeholder:text-slate-700 custom-scrollbar font-mono" placeholder="Start typing... (Markdown & LaTeX supported)"/>
                    )}
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-600 hidden md:flex">
                    <NotebookPen size={48} className="mb-4 opacity-20" />
                    <p className="text-sm">Select a note or create a new one.</p>
                </div>
            )}
        </div>

        {/* Delete Modal */}
        <AnimatePresence>
            {noteToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <MotionDiv initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative bg-[#0f172a] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
                        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400"><Trash2 size={24} /></div>
                        <h3 className="text-xl font-bold text-white mb-2">Delete Note?</h3>
                        <p className="text-slate-400 text-sm mb-6">Permanently remove this note?</p>
                        <div className="flex gap-3">
                            <button onClick={() => setNoteToDelete(null)} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium">Cancel</button>
                            <button onClick={confirmDeleteNote} className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold">Delete</button>
                        </div>
                    </MotionDiv>
                </div>
            )}
        </AnimatePresence>

        {/* Magic Result Modal */}
        <AnimatePresence>
          {showMagicModal && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
               <MotionDiv initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[#0f172a] border border-purple-500/30 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative">
                  <button onClick={() => setShowMagicModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20}/></button>
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    {magicType === 'explain' && <><BrainCircuit className="text-purple-400"/> AI Explanation</>}
                    {magicType === 'summarize' && <><FileText className="text-blue-400"/> Summary</>}
                    {magicType === 'quiz' && <><Zap className="text-yellow-400"/> Quick Quiz</>}
                  </h3>
                  
                  <div className="bg-black/30 rounded-xl p-4 min-h-[100px] text-slate-200 text-sm leading-relaxed border border-white/5 overflow-y-auto max-h-[60vh]">
                     {magicLoading ? (
                        <div className="flex items-center justify-center h-full gap-2 text-slate-400">
                           <Loader2 className="animate-spin" size={20}/> Thinking...
                        </div>
                     ) : (
                        <div className="prose prose-invert prose-sm max-w-none">
                            <ReactMarkdown 
                                remarkPlugins={[remarkMath]} 
                                rehypePlugins={[rehypeKatex]}
                            >
                                {magicResult}
                            </ReactMarkdown>
                        </div>
                     )}
                  </div>
                  
                  <div className="mt-4 flex justify-end">
                     <button onClick={() => setShowMagicModal(false)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium">Close</button>
                  </div>
               </MotionDiv>
            </div>
          )}
        </AnimatePresence>

        {/* Config and Flashcard Modals (Existing) */}
        <AnimatePresence>
          {showFlashcardConfig && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <MotionDiv initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[#0f172a] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative">
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-lg font-bold text-white flex items-center gap-2"><Sparkles className="text-purple-400" size={18} /> Flashcard Setup</h3>
                   <button onClick={() => setShowFlashcardConfig(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
                </div>
                <div className="space-y-6">
                   <div>
                      <label className="text-xs font-bold text-slate-400 mb-2 block uppercase tracking-wider">Number of Cards: {cardCount}</label>
                      <input type="range" min="3" max="50" step="1" value={cardCount} onChange={e => setCardCount(Number(e.target.value))} className="w-full accent-purple-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"/>
                   </div>
                   <div>
                      <label className="text-xs font-bold text-slate-400 mb-2 block uppercase tracking-wider">Focus Area</label>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                         {['Key Concepts', 'Definitions', 'Dates & Events'].map(opt => (<button key={opt} onClick={() => setCardFocus(opt)} className={`text-xs py-2 px-3 rounded-lg border transition-all ${cardFocus === opt ? 'bg-purple-600 border-purple-500 text-white' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}>{opt}</button>))}
                         <button onClick={() => setCardFocus('Custom')} className={`text-xs py-2 px-3 rounded-lg border transition-all ${cardFocus === 'Custom' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}>Custom...</button>
                      </div>
                      {cardFocus === 'Custom' && (<input value={customFocus} onChange={(e) => setCustomFocus(e.target.value)} placeholder="e.g. Focus specifically on paragraph 3..." className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-white text-sm focus:border-purple-500 outline-none"/>)}
                   </div>
                   <button onClick={handleGenerateFlashcards} className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl text-white font-bold flex items-center justify-center gap-2 shadow-lg"><Sparkles size={16} /> Generate</button>
                </div>
              </MotionDiv>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
            {showAiResultModal && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                 <MotionDiv initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[#0f172a] border border-white/10 rounded-3xl w-full max-w-2xl shadow-2xl relative overflow-hidden">
                    <div className="p-6 border-b border-white/5 flex justify-between items-center">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2"><Sparkles className="text-purple-400" size={18} /> Generated Cards</h3>
                        <button onClick={() => setShowAiResultModal(false)} className="text-slate-400 hover:text-white"><Trash2 size={18} /></button>
                    </div>
                    <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                        {generatingCards ? (
                            <div className="flex flex-col items-center justify-center py-10 text-slate-400"><Loader2 size={32} className="animate-spin text-purple-500 mb-4" /><p>Analyzing your notes & extracting gems...</p></div>
                        ) : (
                            <div className="grid gap-4">
                                {aiResult.map((card, i) => (<div key={i} className="bg-white/5 border border-white/5 rounded-xl p-4"><p className="font-semibold text-white mb-2 text-sm">Q: {card.question}</p><p className="text-slate-400 text-sm">A: {card.answer}</p></div>))}
                            </div>
                        )}
                    </div>
                    <div className="p-4 bg-black/20 border-t border-white/5 flex justify-end gap-3">
                         {aiSuccess ? (
                            <span className="flex items-center gap-2 text-green-400 font-bold px-4 py-2"><Sparkles size={16}/> Saved to Decks!</span>
                         ) : (
                             <>
                                <button onClick={() => setShowAiResultModal(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
                                <button onClick={saveFlashcardsToDeck} disabled={generatingCards || aiResult.length === 0} className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"><Layers size={16} /> Save as Deck</button>
                             </>
                         )}
                    </div>
                 </MotionDiv>
               </div>
            )}
        </AnimatePresence>
    </div>
  );
};

export default Notes;
