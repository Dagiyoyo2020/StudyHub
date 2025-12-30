import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { Users, UserPlus, MessageCircle, Search, X, Check, Loader2, Send, Clock, UserCheck, AlertCircle, Bell, RefreshCw, Layers, FileText, Download, Activity, Mic, Square, CornerUpLeft, Forward, Quote, Hash, Image as ImageIcon, Trash2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Message, Group } from '../types';
import ShareModal from '../components/ShareModal';

// Fix for strict TS environment regarding motion props
const MotionDiv = motion.div as any;

interface Profile {
  id: string;
  username: string;
  name: string;
  avatar_url: string | null;
}

interface FriendRequest {
  id: string;
  sender: Profile;
}

const Social = () => {
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [friends, setFriends] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Online Status State
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  // Custom Alert State
  const [alertInfo, setAlertInfo] = useState<{show: boolean, title: string, message: string, type: 'success' | 'error'}>({
    show: false, title: '', message: '', type: 'success'
  });

  // Chat State
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChatDetails, setActiveChatDetails] = useState<Profile | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Reply & Forward State
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [messageToForward, setMessageToForward] = useState<Message | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);

  // Audio/Image Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Typing Indicators
  const [isTyping, setIsTyping] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);
  const typingTimeoutRef = useRef<any>(null);
  const channelRef = useRef<any>(null);
  
  // Auth State
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Importing System States
  const [importingId, setImportingId] = useState<string | null>(null);
  const [successImportId, setSuccessImportId] = useState<string | null>(null);

  // 1. Initial Data Fetch & Online Presence Setup
  useEffect(() => {
    let socialSubscription: any;
    let presenceChannel: any;

    const init = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setCurrentUserId(user.id);
            
            await fetchSocialData(user.id);
            setLoading(false);

            // A. Realtime Data Updates
            socialSubscription = supabase.channel('social_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests', filter: `receiver_id=eq.${user.id}` }, () => fetchSocialData(user.id))
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friends', filter: `user_id_1=eq.${user.id}` }, () => fetchSocialData(user.id))
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friends', filter: `user_id_2=eq.${user.id}` }, () => fetchSocialData(user.id))
            .subscribe();

            // B. Online Presence System
            presenceChannel = supabase.channel('online_users', {
                config: { presence: { key: user.id } }
            })
            .on('presence', { event: 'sync' }, () => {
                const newState = presenceChannel.presenceState();
                const onlineIds = new Set(Object.keys(newState));
                setOnlineUsers(onlineIds);
            })
            .subscribe(async (status: string) => {
                if (status === 'SUBSCRIBED') {
                    await presenceChannel.track({ online_at: new Date().toISOString() });
                }
            });
        }
    };

    init();

    return () => {
        if (socialSubscription) supabase.removeChannel(socialSubscription);
        if (presenceChannel) supabase.removeChannel(presenceChannel);
    };
  }, []);

  // 2. Chat Logic (Messages & Typing)
  useEffect(() => {
    if (activeChatId && currentUserId) {
        setMessages([]); 
        fetchMessages(activeChatId);
        setReplyTo(null);
        
        let msgChannel: any;
        
        // Subscribe to New Messages & Deletions
        msgChannel = supabase.channel(`dm:${activeChatId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, (payload) => {
            const newMsg = payload.new as Message;
            if (newMsg.sender_id === currentUserId) return;

            if ((newMsg.sender_id === activeChatId && newMsg.receiver_id === currentUserId) || 
                (newMsg.sender_id === currentUserId && newMsg.receiver_id === activeChatId)) {
                setMessages(prev => {
                    if(prev.some(m => m.id === newMsg.id)) return prev;
                    return [...prev, newMsg];
                });
            }
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'direct_messages' }, (payload) => {
             setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        })
        .subscribe();

        // Subscribe to Typing Indicator
        if (channelRef.current) supabase.removeChannel(channelRef.current);
        channelRef.current = supabase.channel('social_presence')
        .on('broadcast', { event: 'typing' }, (payload) => {
            if (payload.payload.sender_id === activeChatId && payload.payload.receiver_id === currentUserId) {
                setFriendTyping(true);
                setTimeout(() => setFriendTyping(false), 3000); 
            }
        })
        .subscribe();

        return () => { 
            if(msgChannel) supabase.removeChannel(msgChannel);
            if (channelRef.current) supabase.removeChannel(channelRef.current);
        };
    }
  }, [activeChatId, currentUserId]);

  useLayoutEffect(() => {
    if (chatScrollRef.current) {
        chatScrollRef.current.scrollTo({
            top: chatScrollRef.current.scrollHeight,
            behavior: 'smooth'
        });
    }
  }, [messages, friendTyping, activeChatId, isRecording, replyTo, chatLoading]);

  const handleTyping = async () => {
      if (!currentUserId || !activeChatId) return;

      if (!isTyping) {
          setIsTyping(true);
          channelRef.current?.send({
              type: 'broadcast',
              event: 'typing',
              payload: { sender_id: currentUserId, receiver_id: activeChatId }
          });
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
      }, 2000);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserId || !activeChatId) return;

    if (file.size > 2.5 * 1024 * 1024) {
        showAlert("File Too Large", "Images must be under 2.5MB.", "error");
        return;
    }

    setIsUploading(true);
    const fileName = `img-${Date.now()}-${Math.random().toString(36).substring(7)}.${file.name.split('.').pop()}`;

    try {
        const { error: uploadError } = await supabase.storage.from('chat_attachments').upload(fileName, file);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('chat_attachments').getPublicUrl(fileName);

        const tempMsg: Message = { 
            id: 'temp-' + Date.now(), 
            sender_id: currentUserId, 
            receiver_id: activeChatId,
            content: publicUrl, 
            message_type: 'image',
            created_at: new Date().toISOString()
        };

        setMessages(prev => [...prev, tempMsg]);

        const { data: realMsg } = await supabase.from('direct_messages').insert({ 
            sender_id: currentUserId, 
            receiver_id: activeChatId, 
            content: publicUrl, 
            message_type: 'image'
        }).select().single();

        if (realMsg) {
            setMessages(prev => prev.map(m => m.id === tempMsg.id ? realMsg : m));
        }
    } catch (err) {
        console.error(err);
        showAlert("Upload Failed", "Could not send image.", "error");
    } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmDeleteMessage = async () => {
      if (!messageToDelete) return;
      setMessages(prev => prev.filter(m => m.id !== messageToDelete));
      const idToDelete = messageToDelete;
      setMessageToDelete(null);
      
      const { error } = await supabase.from('direct_messages').delete().eq('id', idToDelete);
      if (error) {
          showAlert("Error", "Failed to delete message", "error");
          if (activeChatId) fetchMessages(activeChatId);
      }
  };

  const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mediaRecorderRef.current.onstop = async () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            await sendVoiceMessage(audioBlob);
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorderRef.current.start();
        setIsRecording(true);
        setRecordingTime(0);
        recordingTimerRef.current = setInterval(() => {
            setRecordingTime(prev => prev + 1);
        }, 1000);

    } catch (err) {
        console.error("Mic error:", err);
        showAlert("Error", "Could not access microphone.", "error");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  const sendVoiceMessage = async (audioBlob: Blob) => {
      if (!currentUserId || !activeChatId) return;
      const fileName = `voice-${Date.now()}-${Math.random().toString(36).substring(7)}.webm`;
      
      try {
        const { error: uploadError } = await supabase.storage.from('chat_attachments').upload(fileName, audioBlob);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('chat_attachments').getPublicUrl(fileName);

        const tempMsg: Message = { 
          id: 'temp-' + Date.now(), 
          sender_id: currentUserId, 
          receiver_id: activeChatId,
          content: publicUrl, 
          message_type: 'audio',
          created_at: new Date().toISOString()
        };

        setMessages(prev => [...prev, tempMsg]);

        const { data: realMsg } = await supabase.from('direct_messages').insert({ 
            sender_id: currentUserId, 
            receiver_id: activeChatId, 
            content: publicUrl, 
            message_type: 'audio' 
        }).select().single();

        if (realMsg) {
            setMessages(prev => prev.map(m => m.id === tempMsg.id ? realMsg : m));
        }

      } catch (err: any) {
         console.error("Voice upload error", err);
         showAlert("Error", "Voice upload failed.", "error");
      }
  };

  const showAlert = (title: string, message: string, type: 'success' | 'error' = 'success') => {
      setAlertInfo({ show: true, title, message, type });
      if (type === 'success') {
          setTimeout(() => setAlertInfo(prev => ({...prev, show: false})), 3000);
      }
  };

  const fetchSocialData = useCallback(async (userId: string) => {
    try {
        const [requestsRes, f1Res, f2Res, outgoingRes] = await Promise.all([
            supabase.from('friend_requests').select('id, sender_id').eq('receiver_id', userId).eq('status', 'pending'),
            supabase.from('friends').select('user_id_2').eq('user_id_1', userId),
            supabase.from('friends').select('user_id_1').eq('user_id_2', userId),
            supabase.from('friend_requests').select('receiver_id').eq('sender_id', userId).eq('status', 'pending')
        ]);

        const friendIds = new Set<string>();
        f1Res.data?.forEach((r: any) => friendIds.add(r.user_id_2));
        f2Res.data?.forEach((r: any) => friendIds.add(r.user_id_1));

        const requestSenderIds = requestsRes.data?.map(r => r.sender_id) || [];
        const allProfileIds = Array.from(new Set([...friendIds, ...requestSenderIds]));
        
        let profilesMap = new Map();
        if (allProfileIds.length > 0) {
            const { data: profiles } = await supabase.from('profiles').select('*').in('id', allProfileIds);
            profiles?.forEach(p => profilesMap.set(p.id, p));
        }

        if (requestsRes.data && requestsRes.data.length > 0) {
            const combinedRequests = requestsRes.data.map(r => ({
                id: r.id,
                sender: profilesMap.get(r.sender_id) || { id: r.sender_id, name: 'Unknown', username: 'unknown', avatar_url: null }
            }));
            setRequests(combinedRequests as any);
        } else {
            setRequests([]);
        }

        if (friendIds.size > 0) {
            const friendsList = Array.from(friendIds).map(id => profilesMap.get(id)).filter(Boolean);
            setFriends(friendsList);
        } else {
            setFriends([]);
        }

        if (outgoingRes.data) setOutgoingRequests(outgoingRes.data.map(r => r.receiver_id));
    } catch (e) { console.error(e); }
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const cleanQuery = searchQuery.trim().toLowerCase();
    const { data } = await supabase.from('profiles').select('id, username, name, avatar_url, email').or(`email.ilike.%${cleanQuery}%,username.ilike.%${cleanQuery}%`).neq('id', user?.id || '').limit(10);
    setSearchResults(data || []);
    setLoading(false);
  };

  const sendFriendRequest = async (receiverId: string) => {
    if (!currentUserId) return;
    if (outgoingRequests.includes(receiverId)) { showAlert("Wait", "Request pending!", 'error'); return; }
    
    setOutgoingRequests(prev => [...prev, receiverId]);
    showAlert("Success", "Friend request sent!");

    const { error } = await supabase.from('friend_requests').insert({ sender_id: currentUserId, receiver_id: receiverId });
    if (error && error.code !== '23505') {
       setOutgoingRequests(prev => prev.filter(id => id !== receiverId));
       showAlert("Error", "Could not send request", 'error');
    }
  };

  const acceptRequest = async (reqId: string, senderProfile: Profile) => {
    if (!currentUserId) return;
    setRequests(prev => prev.filter(r => r.id !== reqId));
    setFriends(prev => [...prev, senderProfile]);
    showAlert("Connected!", `You and ${senderProfile.name} are now friends.`);
    setActiveChatId(senderProfile.id);
    setActiveChatDetails(senderProfile);
    setActiveTab('friends');

    await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', reqId);
    
    const { data: existing } = await supabase.from('friends').select('*').or(`and(user_id_1.eq.${currentUserId},user_id_2.eq.${senderProfile.id}),and(user_id_1.eq.${senderProfile.id},user_id_2.eq.${currentUserId})`);
    if (!existing || existing.length === 0) await supabase.from('friends').insert({ user_id_1: currentUserId, user_id_2: senderProfile.id });
  };

  const rejectRequest = async (reqId: string) => {
    setRequests(prev => prev.filter(r => r.id !== reqId));
    await supabase.from('friend_requests').update({ status: 'rejected' }).eq('id', reqId);
  };

  const fetchMessages = async (chatId: string) => {
    if (!currentUserId) return;
    setChatLoading(true);
    const { data } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${chatId}),and(sender_id.eq.${chatId},receiver_id.eq.${currentUserId})`)
        .order('created_at', { ascending: false })
        .limit(50);
        
    if (data) setMessages(data.reverse());
    setChatLoading(false);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChatId || !currentUserId) return;

    const metadata = replyTo ? {
        replyTo: { id: replyTo.id, content: replyTo.content, type: replyTo.message_type }
    } : {};

    const tempMsg: Message = { 
        id: 'temp-' + Date.now(), 
        sender_id: currentUserId, 
        receiver_id: activeChatId,
        content: newMessage, 
        message_type: 'text',
        created_at: new Date().toISOString(),
        metadata: metadata
    };
    
    setMessages(prev => [...prev, tempMsg]);
    setNewMessage('');
    setReplyTo(null);
    
    const { data: realMsg } = await supabase.from('direct_messages').insert({ 
        sender_id: currentUserId, 
        receiver_id: activeChatId, 
        content: tempMsg.content, 
        message_type: 'text',
        metadata: metadata
    }).select().single();

    if (realMsg) {
        setMessages(prev => prev.map(m => m.id === tempMsg.id ? realMsg : m));
    }
  };

  const handleForwardMessage = async (friendId: string) => {
      if (!messageToForward || !currentUserId) return;
      await supabase.from('direct_messages').insert({
          sender_id: currentUserId,
          receiver_id: friendId,
          message_type: messageToForward.message_type,
          content: messageToForward.content,
          metadata: { ...messageToForward.metadata, forwarded: true }
      });
      setMessageToForward(null);
      showAlert("Success", "Message forwarded!");
  };
  
  const importSharedItem = async (msg: Message) => {
    if (!currentUserId || importingId) return;
    
    // START LOADING
    setImportingId(msg.id);
    setSuccessImportId(null);
    
    try {
        let meta = msg.metadata;
        // In Supabase, jsonb columns might return as objects already OR as strings.
        // We force a parse if it's a string, or use directly if it's an object.
        if (typeof meta === 'string') {
            try { 
                meta = JSON.parse(meta); 
            } catch (e) { 
                console.error("Metadata JSON parse error", e);
                throw new Error("Could not parse shared data format."); 
            }
        }
        
        if (!meta) throw new Error("This shared message contains no valid metadata.");

        // Visual delay for the "Working..." state
        await new Promise(r => setTimeout(r, 1200));

        if (msg.message_type === 'deck') {
            const { title, description, cards } = meta;
            if (!Array.isArray(cards) || cards.length === 0) throw new Error("This shared deck contains no cards.");

            // 1. Create the Deck for current user
            const { data: newDeck, error: deckError } = await supabase.from('flashcard_decks').insert({
                user_id: currentUserId, 
                title: title || 'Imported Deck', 
                description: description || 'Imported via StudyForge Social', 
                status: 'active'
            }).select().single();

            if (deckError || !newDeck) {
                console.error("Deck insertion error", deckError);
                throw new Error("Failed to create the deck entry in your database.");
            }

            // 2. Create the Cards
            const formattedCards = cards.map((c: any) => ({ 
                deck_id: newDeck.id, 
                question: c.question || 'Empty Question', 
                answer: c.answer || 'Empty Answer' 
            }));

            const { error: cardsError } = await supabase.from('flashcards').insert(formattedCards);
            if (cardsError) {
                console.error("Cards insertion error", cardsError);
                throw new Error("Deck shell created, but failed to populate cards.");
            }

            // SUCCESS
            setSuccessImportId(msg.id);
            showAlert("Success!", `Successfully imported "${newDeck.title}" with ${cards.length} cards.`, 'success');
        } 
        else if (msg.message_type === 'note') {
             const { title, content, tags } = meta;
             const { data: newNote, error: noteError } = await supabase.from('notes').insert({
                 user_id: currentUserId, 
                 title: title || 'Imported Note', 
                 content: content || '', 
                 tags: Array.isArray(tags) ? tags : [],
                 updated_at: new Date().toISOString()
             }).select().single();
             
             if (noteError) {
                 console.error("Note insertion error", noteError);
                 throw new Error("Failed to save note to your collection.");
             }
             
             // SUCCESS
             setSuccessImportId(msg.id);
             showAlert("Success!", `Added "${newNote.title}" to your Smart Notes library.`, 'success');
        } else {
            throw new Error(`Message type "${msg.message_type}" cannot be imported.`);
        }
    } catch (e: any) {
        console.error("Import error details:", e);
        showAlert("Import Failed", e.message || "An unexpected database error occurred.", 'error');
    } finally {
        setImportingId(null);
    }
  };

  const renderMessageContent = useCallback((msg: Message, isMe: boolean) => {
     if (msg.message_type === 'text') return <p className="whitespace-pre-wrap break-words">{msg.content}</p>;
     if (msg.message_type === 'audio') return <div className="min-w-[150px] pt-1"><audio controls className="w-full h-8" src={msg.content} /><p className="text-[10px] mt-1 opacity-70 flex items-center gap-1"><Mic size={10}/> Voice Message</p></div>;
     if (msg.message_type === 'image') return <div className="rounded-lg overflow-hidden my-1"><img src={msg.content} className="max-w-[240px] max-h-[300px] object-cover rounded-lg cursor-pointer" onClick={() => window.open(msg.content, '_blank')} /></div>;

     // Deck or Note logic
     let meta = msg.metadata || {};
     if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch {} }
     const isDeck = msg.message_type === 'deck';
     const isImporting = importingId === msg.id;
     const isDone = successImportId === msg.id;

     return (
         <div className="min-w-[180px] p-1">
             <div className={`flex items-center gap-2 mb-1 pb-1 border-b ${isMe ? 'border-white/20' : 'border-purple-500/20'}`}>
                 {isDeck ? <Layers size={14}/> : <FileText size={14}/>}
                 <span className="font-bold text-[10px] uppercase tracking-wider">{isDeck ? 'Shared Deck' : 'Shared Note'}</span>
             </div>
             <p className="font-bold text-sm mb-1">{meta.title || 'Untitled'}</p>
             <p className="text-[10px] opacity-70 mb-3 line-clamp-2">{meta.description || meta.content?.substring(0,50) || 'No preview available'}</p>
             {!isMe && (
                 <button 
                    onClick={() => importSharedItem(msg)} 
                    disabled={isImporting || isDone} 
                    className={`w-full py-2.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 transition-all shadow-md relative overflow-hidden ${
                        isDone ? 'bg-green-600 text-white cursor-default' :
                        isImporting ? 'bg-purple-500/30 text-purple-400' : 
                        'bg-white/10 hover:bg-purple-600 text-white border border-white/10 hover:scale-[1.02] active:scale-95'
                    }`}
                 >
                    {isImporting && <div className="absolute inset-0 bg-white/10 animate-pulse"></div>}
                    {isDone ? <><CheckCircle2 size={12}/> ADDED TO LIBRARY</> : 
                     isImporting ? <><Loader2 size={12} className="animate-spin"/> WORKING...</> : 
                     <><Download size={12}/> IMPORT TO COLLECTION</>}
                 </button>
             )}
         </div>
     );
  }, [importingId, successImportId]);

  return (
    <div className="flex w-full h-screen bg-[#030712] relative overflow-hidden">
        
        {/* Alerts */}
        <AnimatePresence>
            {alertInfo.show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
                    <MotionDiv initial={{opacity:0, scale:0.9}} animate={{opacity:1, scale:1}} exit={{opacity:0}} className="bg-[#0f172a] border border-white/10 rounded-xl p-6 w-[90%] max-w-xs shadow-2xl pointer-events-auto text-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4 ${alertInfo.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{alertInfo.type === 'success' ? <Check size={20}/> : <AlertCircle size={20}/>}</div>
                        <h3 className="text-lg font-bold text-white mb-2">{alertInfo.title}</h3>
                        <p className="text-slate-400 text-xs mb-4 leading-relaxed">{alertInfo.message}</p>
                        <button onClick={() => setAlertInfo({...alertInfo, show: false})} className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white font-medium text-sm transition-colors">Close</button>
                    </MotionDiv>
                </div>
            )}
        </AnimatePresence>

        {/* Sidebar */}
        <div className={`w-full md:w-72 bg-[#0b101b] border-r border-white/5 flex flex-col ${activeChatId ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-3 border-b border-white/5">
                <div className="flex bg-white/5 rounded-lg p-1 mb-3 overflow-x-auto no-scrollbar">
                    {['friends','requests','search'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 min-w-[60px] py-1.5 text-xs font-medium rounded transition-all relative capitalize ${activeTab === tab ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                            {tab}
                            {tab === 'requests' && requests.length > 0 && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 text-[8px] text-white flex items-center justify-center animate-pulse">{requests.length}</span>}
                        </button>
                    ))}
                </div>
                {activeTab === 'search' && (
                    <div className="relative">
                        <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder="Email or Username..." className="w-full bg-black/30 border border-white/10 rounded-lg pl-3 pr-8 py-1.5 text-xs text-white focus:border-purple-500 outline-none transition-all"/>
                        <button onClick={handleSearch} className="absolute right-2 top-1.5 text-slate-400 hover:text-white"><Search size={14} /></button>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {activeTab === 'search' ? (
                    loading ? <div className="text-center py-4"><Loader2 className="animate-spin mx-auto text-purple-500" size={20}/></div> :
                    searchResults.length === 0 ? <div className="text-center text-slate-500 py-8 text-xs">No users found.</div> :
                    searchResults.map(profile => (
                        <div key={profile.id} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg border border-transparent hover:border-white/5">
                             <div className="flex items-center gap-2 overflow-hidden">
                                 <div className="w-8 h-8 rounded-full bg-slate-700 flex-shrink-0">{profile.avatar_url && <img src={profile.avatar_url} className="w-full h-full object-cover rounded-full"/>}</div>
                                 <div className="min-w-0"><p className="text-xs font-medium text-white truncate">{profile.name}</p><p className="text-[10px] text-slate-500 truncate">@{profile.username}</p></div>
                             </div>
                             {friends.some(f => f.id === profile.id) ? <UserCheck size={14} className="text-green-500 mr-2"/> : <button onClick={() => sendFriendRequest(profile.id)} className="text-[10px] bg-purple-600 px-2 py-1 rounded text-white hover:bg-purple-500 transition-colors"><UserPlus size={12}/></button>}
                        </div>
                    ))
                ) : activeTab === 'requests' ? (
                    <div className="flex flex-col h-full">
                        {requests.length === 0 ? <div className="text-center text-slate-500 py-8 text-xs"><Bell size={24} className="mx-auto mb-2 opacity-20"/><p>No pending requests.</p></div> :
                            requests.map(req => (
                                <div key={req.id} className="flex items-center justify-between p-2 bg-purple-500/10 rounded-lg border border-purple-500/20 mb-2">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <div className="w-8 h-8 rounded-full bg-slate-700 flex-shrink-0">{req.sender?.avatar_url && <img src={req.sender.avatar_url} className="w-full h-full object-cover rounded-full"/>}</div>
                                            <div className="min-w-0"><p className="text-xs font-bold text-white truncate">{req.sender?.name}</p></div>
                                        </div>
                                        <div className="flex gap-1"><button onClick={() => acceptRequest(req.id, req.sender)} className="p-1.5 bg-green-500 hover:bg-green-400 text-white rounded"><Check size={14}/></button><button onClick={() => rejectRequest(req.id)} className="p-1.5 bg-red-500/20 text-red-400 rounded"><X size={14}/></button></div>
                                </div>
                            ))
                        }
                    </div>
                ) : (
                    friends.map(friend => (
                             <div key={friend.id} onClick={() => { setActiveChatId(friend.id); setActiveChatDetails(friend); }} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${activeChatId === friend.id ? 'bg-purple-600 text-white shadow-lg' : 'hover:bg-white/5 text-slate-300'}`}>
                                 <div className="relative">
                                     <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden flex-shrink-0 border border-white/5">
                                        {friend.avatar_url ? <img src={friend.avatar_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center bg-slate-800 text-[10px]">{friend.name?.[0]}</div>}
                                     </div>
                                     {onlineUsers.has(friend.id) && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#0f172a]"></div>}
                                 </div>
                                 <div className="overflow-hidden flex-1"><p className="font-bold text-xs truncate">{friend.name}</p><p className="text-[10px] opacity-70 truncate">@{friend.username}</p></div>
                             </div>
                    ))
                )}
            </div>
        </div>

        {/* Chat Area */}
        {activeChatId && activeChatDetails ? (
            <div className={`flex-1 flex flex-col bg-[#030712] w-full ${activeChatId ? 'flex' : 'hidden md:flex'}`}>
                <div className="h-14 px-4 border-b border-white/5 flex items-center justify-between bg-black/40 backdrop-blur-sm z-20">
                    <div className="flex items-center gap-3">
                         <button onClick={() => { setActiveChatId(null); setActiveChatDetails(null); }} className="md:hidden text-slate-400"><X size={20}/></button>
                         <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden border border-white/10">
                            {activeChatDetails.avatar_url && <img src={activeChatDetails.avatar_url} className="w-full h-full object-cover"/>}
                         </div>
                         <div><h3 className="font-bold text-white text-sm">{activeChatDetails.name}</h3><span className={`text-[10px] ${onlineUsers.has(activeChatId) ? 'text-green-400' : 'text-slate-500'}`}>{onlineUsers.has(activeChatId) ? 'Online' : 'Offline'}</span></div>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar" ref={chatScrollRef}>
                    {messages.map((msg) => {
                        const isMe = msg.sender_id === currentUserId;
                        return (
                            <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`relative px-4 py-2.5 text-sm max-w-[85%] md:max-w-[70%] rounded-2xl shadow-sm ${isMe ? 'bg-purple-600 text-white rounded-tr-sm' : 'bg-[#1e293b] text-slate-200 border border-white/5 rounded-tl-sm'}`}>
                                    {renderMessageContent(msg, isMe)}
                                    <span className="text-[8px] opacity-40 block text-right mt-1 select-none">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                            </div>
                        );
                    })}
                    {friendTyping && <div className="text-[10px] text-slate-500 italic animate-pulse flex items-center gap-1"><div className="w-1 h-1 bg-slate-500 rounded-full animate-bounce"></div> Typing...</div>}
                </div>

                <div className="p-3 border-t border-white/5 bg-black/40">
                   <form onSubmit={sendMessage} className="flex gap-2 items-center">
                       <input value={newMessage} onChange={e => { setNewMessage(e.target.value); handleTyping(); }} placeholder="Type a message..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-purple-500 outline-none transition-all placeholder:text-slate-600" />
                       <button type="submit" disabled={!newMessage.trim()} className="bg-purple-600 p-2.5 rounded-xl text-white disabled:opacity-50 hover:bg-purple-500 transition-all hover:scale-105 active:scale-95"><Send size={18}/></button>
                   </form>
                </div>
            </div>
        ) : (
            <div className="flex-1 hidden md:flex flex-col items-center justify-center text-slate-500">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4"><Users size={32} className="opacity-30"/></div>
                <h3 className="text-lg font-bold text-white mb-1">Your Community</h3>
                <p className="text-sm">Select a friend to start chatting.</p>
            </div>
        )}
    </div>
  );
};

export default Social;
