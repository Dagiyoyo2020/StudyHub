import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { generateFlashcards, generateFlashcardsFromText } from '../services/geminiService';
import { Flashcard, FlashcardDeck } from '../types';
import { Plus, Play, Loader2, Sparkles, X, Layers, AlertCircle, Trash2, Edit2, CheckCircle, Upload, Save, AlertTriangle, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ShareModal from '../components/ShareModal';

// Declare PDFJS for TypeScript
declare const pdfjsLib: any;

// Fix for strict TS environment regarding motion props
const MotionDiv = motion.div as any;

const Flashcards = () => {
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [isLoadingDecks, setIsLoadingDecks] = useState(true); // New dedicated loading state
  const [activeDeck, setActiveDeck] = useState<FlashcardDeck | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [studyMode, setStudyMode] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(false); // Used for AI operations/specific card fetches
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Management Mode
  const [managingDeck, setManagingDeck] = useState<FlashcardDeck | null>(null);
  const [manageCardsList, setManageCardsList] = useState<Flashcard[]>([]);
  const [editTitle, setEditTitle] = useState('');

  // Sharing
  const [shareDeck, setShareDeck] = useState<FlashcardDeck | null>(null);

  // Custom Alert State
  const [alertInfo, setAlertInfo] = useState<{ show: boolean, title: string, message: string, type: 'success' | 'error' }>({
    show: false, title: '', message: '', type: 'success'
  });

  // Deletion States
  const [deletingDeckId, setDeletingDeckId] = useState<string | null>(null);
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);

  // Session Stats
  const [sessionCardsReviewed, setSessionCardsReviewed] = useState(0);

  // Creator State
  const [showNewDeck, setShowNewDeck] = useState(false);
  const [mode, setMode] = useState<'topic' | 'file'>('topic');
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('');
  const [cardCount, setCardCount] = useState(10);
  const [fileContent, setFileContent] = useState('');
  const [fileContext, setFileContext] = useState(''); 
  const [fileName, setFileName] = useState('');

  useEffect(() => {
    fetchDecks();
  }, []);

  const fetchDecks = async () => {
    setIsLoadingDecks(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        setIsLoadingDecks(false);
        return;
    }
    const { data } = await supabase.from('flashcard_decks').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (data) setDecks(data);
    setIsLoadingDecks(false);
  };

  const showAlert = (title: string, message: string, type: 'success' | 'error' = 'success') => {
    setAlertInfo({ show: true, title, message, type });
  };

  const requestDeleteDeck = (e: React.MouseEvent, deckId: string) => {
    e.stopPropagation();
    setDeletingDeckId(deckId);
  };

  const confirmDeleteDeck = async () => {
    if (!deletingDeckId) return;
    const { error } = await supabase.from('flashcard_decks').delete().eq('id', deletingDeckId);
    if (!error) setDecks(prev => prev.filter(d => d.id !== deletingDeckId));
    setDeletingDeckId(null);
  };

  const toggleMastered = async (e: React.MouseEvent, deck: FlashcardDeck) => {
    e.stopPropagation();
    const newStatus = deck.status === 'mastered' ? 'active' : 'mastered';
    setDecks(decks.map(d => d.id === deck.id ? { ...d, status: newStatus } : d));
    await supabase.from('flashcard_decks').update({ status: newStatus }).eq('id', deck.id);
  };

  const openManageModal = async (e: React.MouseEvent, deck: FlashcardDeck) => {
    e.stopPropagation();
    setManagingDeck(deck);
    setEditTitle(deck.title);
    setLoading(true);
    const { data } = await supabase.from('flashcards').select('*').eq('deck_id', deck.id).order('created_at');
    setManageCardsList(data || []);
    setLoading(false);
  };

  const saveDeckTitle = async () => {
    if (!managingDeck || !editTitle.trim()) return;
    const { error } = await supabase.from('flashcard_decks').update({ title: editTitle }).eq('id', managingDeck.id);
    if (!error) {
      setDecks(decks.map(d => d.id === managingDeck.id ? { ...d, title: editTitle } : d));
      setManagingDeck({ ...managingDeck, title: editTitle });
    }
  };

  // Trigger Custom Modal
  const requestDeleteCard = (cardId: string) => {
    setCardToDelete(cardId);
  };

  const confirmDeleteCard = async () => {
    if (!cardToDelete) return;
    const { error } = await supabase.from('flashcards').delete().eq('id', cardToDelete);
    if (!error) {
      setManageCardsList(prev => prev.filter(c => c.id !== cardToDelete));
    }
    setCardToDelete(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setFileName(file.name);
    setLoading(true);

    try {
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        const maxPages = Math.min(pdf.numPages, 100);
        for (let i = 1; i <= maxPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n';
        }
        setFileContent(fullText);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => setFileContent(e.target?.result as string);
        reader.readAsText(file);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to read file.");
    } finally {
      setLoading(false);
    }
  };

  const createDeck = async () => {
    setLoading(true);
    setErrorMsg(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    try {
      let generatedCards = [];
      if (mode === 'topic') {
        generatedCards = await generateFlashcards(subject, topic, cardCount);
      } else {
        generatedCards = await generateFlashcardsFromText(fileContent, cardCount, fileContext);
      }

      if (!generatedCards || !Array.isArray(generatedCards) || generatedCards.length === 0) {
        throw new Error("AI returned invalid data.");
      }

      const title = mode === 'topic' ? `${subject}: ${topic}` : `${fileName || 'Notes Upload'}`;
      const desc = mode === 'topic' ? `AI generated for ${topic}` : `Generated from file. ${fileContext ? `Context: ${fileContext}` : ''}`;

      const { data: deckData, error: deckError } = await supabase.from('flashcard_decks').insert({
        user_id: user.id,
        title: title.substring(0, 50),
        description: desc.substring(0, 100),
        status: 'active'
      }).select().single();

      if (deckError) throw new Error(deckError.message);

      const cardsToInsert = generatedCards.map((c: any) => ({
        deck_id: deckData.id,
        question: c.question || "No Question",
        answer: c.answer || "No Answer"
      }));

      await supabase.from('flashcards').insert(cardsToInsert);
      await fetchDecks();
      setShowNewDeck(false);
      setTopic('');
      setSubject('');
      setFileContent('');
      setFileContext('');
      setFileName('');
      
    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  const startStudy = async (deck: FlashcardDeck) => {
    setLoading(true);
    const { data } = await supabase.from('flashcards').select('*').eq('deck_id', deck.id);
    setLoading(false);
    
    if (data && data.length > 0) {
      setCards(data);
      setActiveDeck(deck);
      setStudyMode(true);
      setCurrentCardIndex(0);
      setIsFlipped(false);
      setSessionCardsReviewed(0);
    } else {
      alert("This deck is empty! Add cards or delete it.");
    }
  };

  const endStudySession = async () => {
    if (sessionCardsReviewed > 0 && activeDeck) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('study_stats').insert({
          user_id: user.id,
          subject: activeDeck.title,
          minutes: Math.ceil(sessionCardsReviewed * 0.5), // Approx 30s per card
          accuracy: sessionCardsReviewed,
          category: 'flashcard',
          date: new Date().toISOString()
        });
      }
    }
    setStudyMode(false);
    setActiveDeck(null);
  };

  const handleShareDeck = async (friendId: string) => {
    if (!shareDeck) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Fetch cards content explicitly
    const { data: deckCards } = await supabase.from('flashcards').select('question, answer').eq('deck_id', shareDeck.id);

    if (!deckCards || deckCards.length === 0) {
        showAlert("Empty Deck", "Cannot share a deck with no cards.", "error");
        setShareDeck(null);
        return;
    }

    // 2. Send Message with explicit null checks
    await supabase.from('direct_messages').insert({
        sender_id: user.id,
        receiver_id: friendId,
        message_type: 'deck',
        content: `Shared a deck: ${shareDeck.title}`,
        metadata: {
            title: shareDeck.title,
            description: shareDeck.description || '', // Ensure not null
            cards: deckCards // We know this has items now
        }
    });

    setShareDeck(null);
    showAlert("Success", "Deck sent successfully!", 'success');
  };

  // --- RENDER ---

  const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }: { isOpen: boolean, onClose: () => void, onConfirm: () => void, title: string, message: string }) => (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <MotionDiv initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-[#0f172a] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400"><Trash2 size={24} /></div>
            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-slate-400 text-sm mb-6">{message}</p>
            <div className="flex gap-3"><button onClick={onClose} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium">Cancel</button><button onClick={onConfirm} className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold">Delete</button></div>
          </MotionDiv>
        </div>
      )}
    </AnimatePresence>
  );

  if (studyMode && activeDeck) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] relative w-full px-4">
        <button onClick={endStudySession} className="absolute top-0 left-4 text-slate-400 hover:text-white flex items-center gap-2 transition-colors px-4 py-2 bg-white/5 rounded-lg border border-white/5">← Finish</button>
        <div className="mb-6 text-center w-full max-w-xl mt-12 md:mt-0">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 truncate px-2">{activeDeck.title}</h2>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
             <div className="h-full bg-purple-500 transition-all duration-300" style={{ width: `${((currentCardIndex + 1) / cards.length) * 100}%` }}></div>
          </div>
          <p className="text-slate-400 mt-2 font-medium text-sm">Card {currentCardIndex + 1} of {cards.length}</p>
        </div>
        <div className="relative w-full max-w-xl h-[300px] md:h-[400px] perspective-1000 group cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
           <MotionDiv className="w-full h-full relative transform-style-3d transition-all duration-700" animate={{ rotateY: isFlipped ? 180 : 0 }} initial={{ rotateY: 0 }}>
             <div className="absolute inset-0 backface-hidden glass-panel rounded-3xl flex flex-col items-center justify-center p-6 md:p-10 text-center border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-[#0f172a] z-20">
               <span className="absolute top-4 md:top-8 left-4 md:left-8 text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full">Question</span>
               <h3 className="text-xl md:text-3xl font-medium text-white leading-tight select-none overflow-y-auto max-h-[70%] custom-scrollbar">{cards[currentCardIndex]?.question}</h3>
               <div className="absolute bottom-4 md:bottom-8 text-xs md:text-sm text-purple-400 font-bold flex items-center gap-2 animate-pulse">Click to flip <Sparkles size={16}/></div>
             </div>
             <div className="absolute inset-0 backface-hidden rotate-y-180 bg-gradient-to-br from-purple-900 to-indigo-900 rounded-3xl flex flex-col items-center justify-center p-6 md:p-10 text-center border border-purple-500/50 shadow-[0_0_50px_rgba(124,58,237,0.3)] z-20">
               <span className="absolute top-4 md:top-8 left-4 md:left-8 text-[10px] md:text-xs font-bold text-purple-300 uppercase tracking-widest bg-black/20 px-3 py-1 rounded-full">Answer</span>
               <p className="text-lg md:text-2xl text-white leading-relaxed font-light select-none overflow-y-auto max-h-[70%] custom-scrollbar">{cards[currentCardIndex]?.answer}</p>
             </div>
           </MotionDiv>
        </div>
        <div className="flex gap-4 md:gap-6 mt-8 md:mt-12 w-full justify-center">
          <button disabled={currentCardIndex === 0} onClick={(e) => { e.stopPropagation(); setCurrentCardIndex(p => p - 1); setIsFlipped(false); }} className="flex-1 md:flex-none px-6 md:px-8 py-3 md:py-4 rounded-xl bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 transition-all border border-white/5 font-semibold text-sm md:text-base">Previous</button>
          <button disabled={currentCardIndex === cards.length - 1} onClick={(e) => { e.stopPropagation(); setCurrentCardIndex(p => p + 1); setIsFlipped(false); setSessionCardsReviewed(p => p + 1); }} className="flex-1 md:flex-none px-6 md:px-8 py-3 md:py-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white disabled:opacity-30 font-bold shadow-lg transition-all transform hover:scale-105 text-sm md:text-base">Next Card</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 max-w-6xl mx-auto relative">
      <ConfirmationModal isOpen={!!cardToDelete} onClose={() => setCardToDelete(null)} onConfirm={confirmDeleteCard} title="Delete Flashcard?" message="This action cannot be undone." />
      <ConfirmationModal isOpen={!!deletingDeckId} onClose={() => setDeletingDeckId(null)} onConfirm={confirmDeleteDeck} title="Delete Entire Deck?" message="This will permanently delete the deck and all flashcards inside it." />
      
      {/* Share Modal */}
      <ShareModal 
        isOpen={!!shareDeck} 
        onClose={() => setShareDeck(null)} 
        onShare={handleShareDeck} 
        title="Share Deck" 
        itemTitle={shareDeck?.title || ''} 
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

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Flashcards</h1>
          <p className="text-slate-400 text-lg">Your intelligent spaced-repetition library.</p>
        </div>
        <button onClick={() => { setShowNewDeck(!showNewDeck); setErrorMsg(null); }} className="bg-white text-black px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-200 transition-all shadow-lg hover:scale-105">
          <Plus size={20} /> New Deck
        </button>
      </header>

      {/* Creator Modal (Abbreviated for brevity, assuming standard logic remains) */}
      <AnimatePresence>
        {showNewDeck && (
          <MotionDiv initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-12">
            <div className="glass-panel p-8 rounded-3xl border border-white/10 relative shadow-2xl bg-black/40 backdrop-blur-xl">
              <button onClick={() => setShowNewDeck(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white p-2 hover:bg-white/5 rounded-full transition-colors"><X size={24}/></button>
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><Sparkles className="text-purple-400" /> AI Deck Generator</h2>
              <div className="flex gap-8 mb-8 border-b border-white/10">
                 <button onClick={() => setMode('topic')} className={`pb-4 text-sm font-bold border-b-2 transition-all px-2 ${mode === 'topic' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-500 hover:text-white'}`}>Generate from Topic</button>
                 <button onClick={() => setMode('file')} className={`pb-4 text-sm font-bold border-b-2 transition-all px-2 ${mode === 'file' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-500 hover:text-white'}`}>Upload PDF / Text</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {mode === 'topic' ? (
                  <>
                    <div>
                      <label className="text-xs font-bold text-slate-400 mb-2 block uppercase tracking-wider">Subject</label>
                      <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Biology" className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white focus:border-purple-500 outline-none transition-all focus:bg-black/50" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 mb-2 block uppercase tracking-wider">Specific Topic</label>
                      <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Mitosis vs Meiosis" className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white focus:border-purple-500 outline-none transition-all focus:bg-black/50" />
                    </div>
                  </>
                ) : (
                  <div className="md:col-span-2 space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-400 mb-2 block uppercase tracking-wider">Upload File (PDF/TXT)</label>
                      <div className="relative border border-white/10 bg-black/30 rounded-xl p-3 flex items-center hover:border-purple-500/50 transition-colors">
                        <Upload className="text-purple-400 ml-2" size={20} />
                        <input type="file" onChange={handleFileUpload} accept=".txt,.pdf" className="w-full bg-transparent text-sm text-slate-300 ml-3 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-purple-500/20 file:text-purple-300 hover:file:bg-purple-500/30"/>
                      </div>
                      {fileName && <div className="mt-2 text-xs text-green-400 font-mono bg-green-900/20 inline-block px-2 py-1 rounded">✓ {fileName} loaded</div>}
                    </div>
                    <div>
                       <label className="text-xs font-bold text-slate-400 mb-2 block uppercase tracking-wider">Additional Instructions / Context</label>
                       <textarea value={fileContext} onChange={e => setFileContext(e.target.value)} placeholder="e.g. Only focus on Chapter 3, specifically the summary section." className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white focus:border-purple-500 outline-none transition-all h-24 resize-none" />
                    </div>
                  </div>
                )}
                <div className="md:col-span-2">
                   <label className="text-xs font-bold text-slate-400 mb-2 block uppercase tracking-wider">Number of Cards: {cardCount}</label>
                   <input type="range" min="5" max="20" value={cardCount} onChange={e => setCardCount(Number(e.target.value))} className="w-full accent-purple-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"/>
                </div>
              </div>
              {errorMsg && <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 flex items-center gap-3 animate-pulse"><AlertCircle size={20} className="shrink-0" /><span className="text-sm font-medium">{errorMsg}</span></div>}
              <button onClick={createDeck} disabled={loading || (mode === 'topic' ? (!subject || !topic) : !fileContent)} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl py-4 font-bold flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(124,58,237,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95">
                  {loading ? <><Loader2 className="animate-spin" size={20}/> Generating Knowledge...</> : <><Sparkles size={20} /> Create Magic Deck</>}
              </button>
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>

      {/* Management Modal */}
      <AnimatePresence>
        {managingDeck && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
             <MotionDiv initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[#0f172a] border border-white/10 rounded-2xl p-6 w-full max-w-2xl shadow-2xl h-[80vh] flex flex-col relative z-50">
              <div className="flex justify-between items-center mb-6">
                 <h2 className="text-xl font-bold text-white">Manage Deck</h2>
                 <button onClick={() => setManagingDeck(null)} className="p-2 hover:bg-white/10 rounded-full"><X size={20}/></button>
              </div>
              <div className="mb-6 pb-6 border-b border-white/5">
                 <label className="text-xs text-slate-400 block mb-2 uppercase tracking-wider">Deck Title</label>
                 <div className="flex gap-2">
                    <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="flex-1 bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none" />
                    <button onClick={saveDeckTitle} className="p-3 bg-purple-600 rounded-lg text-white hover:bg-purple-500 transition-colors"><Save size={20} /></button>
                 </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                 <div className="flex justify-between items-center mb-4"><h3 className="text-sm font-semibold text-slate-400">Cards ({manageCardsList.length})</h3></div>
                 {manageCardsList.length === 0 ? <div className="text-center text-slate-500 py-10">No cards found.</div> : (
                   <div className="space-y-3">
                     <AnimatePresence>
                        {manageCardsList.map((card, idx) => (
                          <MotionDiv 
                            key={card.id} 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
                            transition={{ duration: 0.3 }}
                            className="p-4 bg-white/5 rounded-xl border border-white/5 flex gap-4 items-start group hover:border-white/10 transition-colors"
                          >
                             <span className="text-slate-500 font-mono text-xs mt-1 opacity-50">#{idx+1}</span>
                             <div className="flex-1">
                                <p className="font-semibold text-white mb-1">{card.question}</p>
                                <p className="text-sm text-slate-400">{card.answer}</p>
                             </div>
                             <button onClick={() => requestDeleteCard(card.id)} className="text-slate-600 hover:text-red-400 p-2 transition-colors opacity-50 group-hover:opacity-100" title="Delete Card"><Trash2 size={16} /></button>
                          </MotionDiv>
                        ))}
                     </AnimatePresence>
                   </div>
                 )}
              </div>
            </MotionDiv>
          </div>
        )}
      </AnimatePresence>

      {/* Deck Grid with Skeletons */}
      {isLoadingDecks ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="glass-panel h-[280px] rounded-3xl border border-white/5 animate-pulse">
                      <div className="flex justify-between mb-6 p-8 pb-0">
                          <div className="w-14 h-14 bg-white/5 rounded-2xl"></div>
                      </div>
                      <div className="px-8 space-y-3">
                          <div className="h-6 bg-white/5 rounded w-3/4"></div>
                          <div className="h-4 bg-white/5 rounded w-full"></div>
                          <div className="h-4 bg-white/5 rounded w-2/3"></div>
                      </div>
                  </div>
              ))}
          </div>
      ) : decks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-80 border-2 border-dashed border-white/10 rounded-3xl text-slate-500 bg-white/5">
           <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6"><Layers size={40} className="opacity-50" /></div>
           <p className="text-xl font-medium text-white mb-2">No decks found</p>
           <p className="text-sm">Create your first AI-powered deck to start studying.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {decks.map((deck, i) => (
            <MotionDiv 
              key={deck.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className={`glass-panel p-8 rounded-3xl border transition-all relative overflow-hidden flex flex-col justify-between h-[280px] shadow-xl hover:shadow-2xl ${deck.status === 'mastered' ? 'border-green-500/30 bg-green-900/10' : 'border-white/10 hover:border-purple-500/50'}`}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-purple-500/20"></div>
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${deck.status === 'mastered' ? 'bg-green-500/20 text-green-400' : 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-300'}`}>
                    {deck.status === 'mastered' ? <CheckCircle size={24} /> : <Layers size={24} />}
                  </div>
                  <div className="flex gap-1 z-20">
                    <button onClick={(e) => { e.stopPropagation(); setShareDeck(deck); }} className="p-2 text-slate-500 hover:text-white transition-colors hover:bg-white/5 rounded-lg" title="Share with Friend"><Share2 size={18} /></button>
                    <button onClick={(e) => toggleMastered(e, deck)} className={`p-2 transition-colors rounded-lg ${deck.status === 'mastered' ? 'text-green-400 hover:bg-green-500/10' : 'text-slate-500 hover:text-green-400 hover:bg-white/5'}`} title={deck.status === 'mastered' ? "Mark as Active" : "Mark as Mastered"}><CheckCircle size={18} /></button>
                    <button onClick={(e) => openManageModal(e, deck)} className="p-2 text-slate-500 hover:text-white transition-colors hover:bg-white/5 rounded-lg" title="Manage Cards & Edit"><Edit2 size={18} /></button>
                    <button onClick={(e) => requestDeleteDeck(e, deck.id)} className="p-2 text-slate-500 hover:text-red-400 transition-colors hover:bg-red-500/10 rounded-lg" title="Delete Deck"><Trash2 size={18} /></button>
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white mb-3 line-clamp-1" title={deck.title}>{deck.title}</h3>
                <p className="text-slate-400 text-sm line-clamp-2 leading-relaxed">{deck.description}</p>
                {deck.status === 'mastered' && <span className="inline-block mt-2 text-[10px] uppercase font-bold text-green-500 tracking-wider">Mastered</span>}
              </div>
              <button onClick={() => startStudy(deck)} className="w-full py-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all border border-white/5 hover:border-white/20 flex items-center justify-center gap-3 mt-auto"><Play size={18} fill="currentColor" /> Study Now</button>
            </MotionDiv>
          ))}
        </div>
      )}
    </div>
  );
};

export default Flashcards;