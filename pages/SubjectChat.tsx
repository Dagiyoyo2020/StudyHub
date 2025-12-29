import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { chatWithTutorStream } from '../services/geminiService';
import { Send, User, Bot, Sparkles, Plus, MessageSquare, Loader2, Trash2, Menu, X, Lightbulb, Zap, BookOpen, Mic, StopCircle, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TutorChat, ChatMessage } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// Fix for strict TS environment regarding motion props
const MotionDiv = motion.div as any;

const SubjectChat = () => {
  const [chats, setChats] = useState<TutorChat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [activeChat, setActiveChat] = useState<TutorChat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [messagesLoading, setMessagesLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Voice Input State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Mobile Sidebar State
  const [showSidebar, setShowSidebar] = useState(false);

  // New Chat Modal State
  const [showNewChat, setShowNewChat] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Delete Modal State
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchChats();
  }, []);

  useEffect(() => {
    if (activeChat) {
      setMessages([]);
      setStreamingContent('');
      fetchMessages(activeChat.id);
      setShowSidebar(false);
    }
  }, [activeChat]);

  // Auto-scroll
  useLayoutEffect(() => {
    if (scrollRef.current) {
        // Only scroll if near bottom or streaming
        const isNearBottom = scrollRef.current.scrollHeight - scrollRef.current.scrollTop - scrollRef.current.clientHeight < 100;
        if (isNearBottom || loading || messagesLoading) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }
  }, [messages, streamingContent, loading, messagesLoading]);

  const fetchChats = async () => {
    setChatsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        setChatsLoading(false);
        return;
    }
    const { data } = await supabase.from('tutor_chats').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (data) setChats(data);
    setChatsLoading(false);
  };

  const fetchMessages = async (chatId: string) => {
    setMessagesLoading(true);
    // Optimization: Fetch only latest 100 messages descending, then reverse
    const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(100);
        
    if (data) setMessages(data.reverse());
    setMessagesLoading(false);
  };

  const createChat = async () => {
    if (!newTitle || !newSubject) return;
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('tutor_chats').insert({
        user_id: user.id,
        title: newTitle,
        subject: newSubject,
        description: newDesc
      }).select().single();

      if (data) {
        setChats([data, ...chats]);
        setActiveChat(data);
        setShowNewChat(false);
        setNewTitle('');
        setNewSubject('');
        setNewDesc('');
        const greeting = `Hello! I'm your AI tutor for ${newSubject}. ${newDesc ? `I understand we're focusing on: ${newDesc}.` : ''} How can I help you today?`;
        await saveMessage(data.id, 'model', greeting);
      }
    }
    setCreating(false);
  };

  const requestDeleteChat = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    setChatToDelete(chatId);
  };

  const confirmDeleteChat = async () => {
    if (!chatToDelete) return;
    await supabase.from('tutor_chats').delete().eq('id', chatToDelete);
    setChats(chats.filter(c => c.id !== chatToDelete));
    if (activeChat?.id === chatToDelete) setActiveChat(null);
    setChatToDelete(null);
  };

  const saveMessage = async (chatId: string, role: 'user' | 'model', content: string) => {
    // Only save to DB, don't update state manually if not needed, but for responsiveness we usually do
    const { data } = await supabase.from('chat_messages').insert({
      chat_id: chatId,
      role,
      content
    }).select().single();
    
    if (data) {
        setMessages(prev => {
            if (prev.some(m => m.id === data.id)) return prev;
            return [...prev, data];
        });
    }
    return data;
  };

  const submitMessage = async (text: string) => {
    if (!text.trim() || loading || !activeChat) return;
    setLoading(true);
    
    // Add user message immediately
    const userMsg = await saveMessage(activeChat.id, 'user', text);
    if(!userMsg) { setLoading(false); return; }

    const historyContext = messages.map(m => ({ role: m.role, content: m.content }));
    // Add the new user message to context locally for the API call
    historyContext.push({ role: 'user', content: text });

    // Stream response
    let accumulatedText = '';
    await chatWithTutorStream(
        activeChat.subject, 
        activeChat.description, 
        historyContext.slice(0, -1), // API might handle history differently, but usually we pass previous history. 
        // Actually geminiService helper reconstructs history. Let's pass excluding current msg if helper adds it? 
        // The helper uses 'history' prop to init chat. So we should pass messages UP TO now.
        // The `sendMessageStream` takes the NEW message.
        text,
        (chunk) => {
            accumulatedText += chunk;
            setStreamingContent(accumulatedText);
        }
    );

    await saveMessage(activeChat.id, 'model', accumulatedText);
    setStreamingContent('');
    setLoading(false);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const txt = input;
    setInput('');
    await submitMessage(txt);
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("Voice input is not supported in this browser. Please use Chrome or Edge.");
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false; 
      recognition.interimResults = false; 
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        if (event.results && event.results[0]) {
             finalTranscript = event.results[0][0].transcript;
        }

        if (finalTranscript) {
           // Fix duplication: Only append if it's not already at the end of the input string
           setInput(prev => {
             const trimmedPrev = prev.trim();
             if (trimmedPrev.endsWith(finalTranscript.trim())) {
                 return prev;
             }
             return trimmedPrev ? `${trimmedPrev} ${finalTranscript}` : finalTranscript;
           });
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    }
  };

  return (
    <div className="flex w-full h-screen bg-[#030712] overflow-hidden relative">
      
      {/* Sidebar */}
      <div className={`
         fixed md:relative z-40 inset-y-0 left-0 w-80 bg-[#0b101b] border-r border-white/5 flex flex-col transition-transform duration-300 shadow-2xl md:shadow-none
         ${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
         <div className="p-4 flex flex-col h-full bg-[#0b101b]">
            <div className="flex justify-between items-center mb-6 md:hidden">
              <span className="font-bold text-white text-lg">Sessions</span>
              <button onClick={() => setShowSidebar(false)}><X size={24} className="text-slate-400 hover:text-white"/></button>
            </div>

            <button 
              onClick={() => setShowNewChat(true)}
              className="w-full py-3.5 mb-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl text-white font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-900/20 group transform hover:scale-[1.02]"
            >
              <Plus size={20} className="group-hover:rotate-90 transition-transform" /> New Session
            </button>
            
            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
              {chatsLoading ? (
                 <div className="flex flex-col gap-2 p-2">
                    {[1,2,3].map(i => <div key={i} className="h-16 w-full bg-white/5 rounded-xl animate-pulse"/>)}
                 </div>
              ) : chats.length === 0 ? (
                <div className="text-center text-slate-500 py-10 text-sm flex flex-col items-center">
                  <MessageSquare size={32} className="mb-3 opacity-20"/>
                  No active sessions.
                </div>
              ) : (
                chats.map(chat => (
                  <div
                    key={chat.id}
                    onClick={() => setActiveChat(chat)}
                    className={`group w-full text-left p-4 rounded-xl transition-all cursor-pointer border relative overflow-hidden ${
                      activeChat?.id === chat.id 
                        ? 'bg-white/10 border-purple-500/30 text-white shadow-lg' 
                        : 'bg-transparent border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'
                    }`}
                  >
                    <div className="relative z-10 flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <h4 className={`font-bold truncate text-sm mb-1.5 ${activeChat?.id === chat.id ? 'text-white' : 'text-slate-300'}`}>{chat.title}</h4>
                        <span className="text-[10px] uppercase tracking-wider font-bold bg-black/30 px-2 py-0.5 rounded text-slate-500 border border-white/5">{chat.subject}</span>
                      </div>
                      <button onClick={(e) => requestDeleteChat(e, chat.id)} className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-all">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
         </div>
      </div>

      {showSidebar && <div className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm" onClick={() => setShowSidebar(false)} />}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative bg-[#030712] w-full h-full">
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="h-16 px-6 border-b border-white/5 flex items-center justify-between bg-[#030712]/80 backdrop-blur-xl sticky top-0 z-20 shadow-sm">
               <div className="flex items-center gap-4">
                 <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setShowSidebar(true)}>
                   <Menu size={24} />
                 </button>
                 <div>
                   <h3 className="font-bold text-white flex items-center gap-2 text-lg">
                     <Sparkles size={18} className="text-purple-400"/> {activeChat.title}
                   </h3>
                 </div>
               </div>
               <div className="flex items-center gap-2 text-xs font-medium text-green-400 bg-green-900/10 px-3 py-1.5 rounded-full border border-green-500/10">
                 <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
                 AI Online
               </div>
            </div>

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth bg-gradient-to-b from-[#030712] to-[#050a14]" ref={scrollRef}>
              {messagesLoading && messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20">
                      <Loader2 className="animate-spin text-purple-500 mb-2" size={32}/>
                      <p className="text-slate-500 text-sm">Loading chat history...</p>
                  </div>
              )}
              
              {!messagesLoading && messages.map((msg) => (
                <MotionDiv 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={msg.id} 
                  className={`flex gap-4 w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Bot Icon */}
                  {msg.role === 'model' && (
                    <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-600 shadow-lg mt-1">
                       <Bot size={18} className="text-white"/>
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div className={`
                    p-5 rounded-2xl shadow-md max-w-[90%] md:max-w-[75%]
                    ${msg.role === 'user' 
                      ? 'bg-white/10 text-white rounded-tr-sm backdrop-blur-sm border border-white/5' 
                      : 'bg-[#0f172a] text-slate-200 border border-white/10 rounded-tl-sm'}
                  `}>
                    <div className="prose prose-invert prose-sm max-w-none break-words">
                      <ReactMarkdown 
                        remarkPlugins={[remarkMath]} 
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline" />,
                          code: ({node, inline, className, children, ...props}: any) => (
                              <code className={inline ? "bg-white/10 px-1 py-0.5 rounded text-pink-300 font-mono text-sm" : "block bg-black/30 p-3 rounded-lg text-slate-200 font-mono text-xs overflow-x-auto border border-white/5 my-2"} {...props}>
                                {children}
                              </code>
                          )
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>

                  {/* User Icon */}
                  {msg.role === 'user' && (
                     <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center bg-slate-800 border border-white/10 mt-1">
                        <User size={18} className="text-slate-300"/>
                     </div>
                  )}
                </MotionDiv>
              ))}

              {/* Streaming Message */}
              {streamingContent && (
                <MotionDiv 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-4 w-full justify-start"
                >
                   <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-600 shadow-lg mt-1">
                       <Bot size={18} className="text-white"/>
                   </div>
                   <div className="bg-[#0f172a] text-slate-200 border border-white/10 rounded-2xl rounded-tl-sm p-5 shadow-md max-w-[90%] md:max-w-[75%]">
                      <div className="prose prose-invert prose-sm max-w-none break-words">
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
                            {streamingContent}
                        </ReactMarkdown>
                        <span className="inline-block w-2 h-4 ml-1 bg-purple-500 animate-pulse align-middle"></span>
                      </div>
                   </div>
                </MotionDiv>
              )}
              
              {/* Quick Suggestions */}
              {messages.length <= 1 && !loading && !streamingContent && !messagesLoading && (
                 <div className="flex flex-col items-center justify-center mt-12 gap-6 animate-in fade-in duration-700">
                    <p className="text-slate-500 text-sm font-medium">How can I assist you today?</p>
                    <div className="flex flex-wrap gap-3 justify-center max-w-2xl">
                      <button onClick={() => submitMessage("Explain the core concepts of this topic simply.")} className="px-5 py-3 rounded-full bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 hover:border-purple-500/50 hover:text-white transition-all flex items-center gap-2 shadow-sm hover:shadow-md">
                         <Lightbulb size={16} className="text-yellow-400" /> Explain simply
                      </button>
                      <button onClick={() => submitMessage("Give me 5 practice quiz questions about this.")} className="px-5 py-3 rounded-full bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 hover:border-purple-500/50 hover:text-white transition-all flex items-center gap-2 shadow-sm hover:shadow-md">
                         <Zap size={16} className="text-purple-400" /> Quiz me
                      </button>
                      <button onClick={() => submitMessage("What are the real-world applications of this?")} className="px-5 py-3 rounded-full bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 hover:border-purple-500/50 hover:text-white transition-all flex items-center gap-2 shadow-sm hover:shadow-md">
                         <BookOpen size={16} className="text-blue-400" /> Real-world examples
                      </button>
                    </div>
                 </div>
              )}

              {loading && !streamingContent && (
                 <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg">
                      <Bot size={18} className="text-white"/>
                    </div>
                    <div className="bg-[#0f172a] px-6 py-4 rounded-2xl rounded-tl-sm border border-white/5 flex items-center gap-3 shadow-md">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
                      </div>
                    </div>
                 </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 md:p-6 bg-[#030712] border-t border-white/5 relative z-30">
              <form onSubmit={handleSend} className="relative w-full flex items-end gap-3 max-w-4xl mx-auto">
                <button type="button" onClick={toggleVoiceInput} className={`p-4 rounded-2xl transition-all flex-shrink-0 ${isListening ? 'bg-red-500/20 text-red-400 animate-pulse border border-red-500/30' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/5'}`}>
                   {isListening ? <StopCircle size={24} /> : <Mic size={24} />}
                </button>
                <div className="flex-1 relative">
                    <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder={isListening ? "Listening..." : "Ask a follow-up question..."}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-6 pr-14 py-4 text-white text-base focus:bg-[#0f172a] focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all placeholder:text-slate-600 shadow-inner"
                    />
                    <button 
                    type="submit" 
                    disabled={!input.trim() || loading}
                    className="absolute right-2 top-2 bottom-2 aspect-square bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-all disabled:opacity-0 disabled:scale-75 flex items-center justify-center shadow-lg hover:shadow-purple-500/25"
                    >
                    <Send size={20} />
                    </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-4">
             <button className="md:hidden absolute top-4 left-4 p-2 text-white" onClick={() => setShowSidebar(true)}><Menu size={24}/></button>
             <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 shadow-2xl border border-white/5">
                <MessageSquare size={40} className="opacity-30" />
             </div>
             <h3 className="text-2xl font-bold text-white mb-2">AI Tutor Ready</h3>
             <p className="max-w-xs text-center text-slate-400">Select a session from the sidebar or start a new one to begin learning.</p>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      <AnimatePresence>
        {showNewChat && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <MotionDiv 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0f172a] border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl relative"
            >
              <button onClick={() => setShowNewChat(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white"><X size={20}/></button>
              <h2 className="text-2xl font-bold text-white mb-6">New Tutor Session</h2>
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Session Name</label>
                  <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. Calculus Exam Prep" className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white focus:border-purple-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Subject</label>
                  <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="e.g. Mathematics" className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white focus:border-purple-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Context / Goal</label>
                  <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Tell the AI what you want to achieve..." className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white focus:border-purple-500 outline-none h-32 resize-none transition-all" />
                </div>
                <button onClick={createChat} disabled={!newTitle || !newSubject || creating} className="w-full py-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-lg disabled:opacity-50 shadow-lg shadow-purple-900/20 transition-all">
                  {creating ? <Loader2 className="animate-spin mx-auto"/> : 'Start Learning'}
                </button>
              </div>
            </MotionDiv>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {chatToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <MotionDiv
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0f172a] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center"
            >
              <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400">
                <Trash2 size={24} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Delete Session?</h3>
              <p className="text-slate-400 text-sm mb-6">This will permanently delete this chat history.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setChatToDelete(null)}
                  className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteChat}
                  className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold"
                >
                  Delete
                </button>
              </div>
            </MotionDiv>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SubjectChat;