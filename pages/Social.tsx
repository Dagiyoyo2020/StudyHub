import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { Users, UserPlus, MessageCircle, Search, X, Check, Loader2, Send, Clock, UserCheck, AlertCircle, Bell, RefreshCw, Layers, FileText, Download, Activity, Mic, Square, CornerUpLeft, Forward, Quote, Hash, Image as ImageIcon, Trash2 } from 'lucide-react';
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
  const [importingId, setImportingId] = useState<string | null>(null);

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

            // A. Realtime Data Updates (Friends/Requests)
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
            if (newMsg.sender_id === currentUserId) return; // Prevent duplicate from optimistic update

            if ((newMsg.sender_id === activeChatId && newMsg.receiver_id === currentUserId) || 
                (newMsg.sender_id === currentUserId && newMsg.receiver_id === activeChatId)) {
                setMessages(prev => {
                    if(prev.some(m => m.id === newMsg.id)) return prev;
                    return [...prev, newMsg];
                });
            }
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'direct_messages' }, (payload) => {
             // Handle deletions in real-time
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

  // Auto-scroll
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

    // 2.5MB Limit
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

      // Optimistic delete
      setMessages(prev => prev.filter(m => m.id !== messageToDelete));
      const idToDelete = messageToDelete;
      setMessageToDelete(null); // Close modal immediately
      
      const { error } = await supabase.from('direct_messages').delete().eq('id', idToDelete);
      if (error) {
          showAlert("Error", "Failed to delete message", "error");
          // Re-fetch if failed
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
         showAlert("Error", "Voice upload failed. Please ensure 'chat_attachments' bucket exists in Supabase.", "error");
      }
  };

  const showAlert = (title: string, message: string, type: 'success' | 'error' = 'success') => {
      setAlertInfo({ show: true, title, message, type });
      // Keep error alerts visible longer
      if (type === 'success') {
          setTimeout(() => setAlertInfo(prev => ({...prev, show: false})), 3000);
      }
  };

  // Optimized Fetching
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
        
        // Batch fetch all unique profiles needed
        const allProfileIds = Array.from(new Set([...friendIds, ...requestSenderIds]));
        
        let profilesMap = new Map();
        if (allProfileIds.length > 0) {
            const { data: profiles } = await supabase.from('profiles').select('*').in('id', allProfileIds);
            profiles?.forEach(p => profilesMap.set(p.id, p));
        }

        // Map Incoming Requests
        if (requestsRes.data && requestsRes.data.length > 0) {
            const combinedRequests = requestsRes.data.map(r => ({
                id: r.id,
                sender: profilesMap.get(r.sender_id) || { id: r.sender_id, name: 'Unknown', username: 'unknown', avatar_url: null }
            }));
            setRequests(combinedRequests as any);
        } else {
            setRequests([]);
        }

        // Map Friends
        if (friendIds.size > 0) {
            const friendsList = Array.from(friendIds).map(id => profilesMap.get(id)).filter(Boolean);
            setFriends(friendsList);
        } else {
            setFriends([]);
        }

        // Process Outgoing
        if (outgoingRes.data) setOutgoingRequests(outgoingRes.data.map(r => r.receiver_id));

    } catch (e) { console.error(e); }
  }, []);

  const getActionButton = (userId: string) => {
    const isFriend = friends.some(f => f.id === userId);
    if (isFriend) {
        return <span className="text-xs text-green-400 font-bold px-2 py-1 bg-green-500/10 rounded flex items-center gap-1"><UserCheck size={12}/> Friend</span>;
    }

    const hasIncoming = requests.some(r => r.sender.id === userId);
    if (hasIncoming) {
        return <span className="text-xs text-blue-400 font-bold px-2 py-1 bg-blue-500/10 rounded">Check Req</span>;
    }

    const isPending = outgoingRequests.includes(userId);
    if (isPending) {
        return <span className="text-xs text-slate-400 font-bold px-2 py-1 bg-white/5 rounded flex items-center gap-1"><Clock size={12}/> Pending</span>;
    }

    return (
        <button onClick={() => sendFriendRequest(userId)} className="text-xs bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded font-bold flex items-center gap-1 transition-colors">
            <UserPlus size={14}/> Add
        </button>
    );
  };

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
    // Optimization: Fetch only latest 50 messages, desc order, then reverse
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
        replyTo: {
            id: replyTo.id,
            content: replyTo.content,
            type: replyTo.message_type
        }
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
          metadata: {
              ...messageToForward.metadata,
              forwarded: true
          }
      });

      setMessageToForward(null);
      showAlert("Success", "Message forwarded!");
  };
  
  const importSharedItem = async (msg: Message) => {
    if (!currentUserId || importingId) return;
    setImportingId(msg.id);
    
    try {
        let meta = msg.metadata;
        // In Supabase, jsonb columns might return as objects already or as strings.
        if (typeof meta === 'string') {
            try { meta = JSON.parse(meta); } catch (e) { throw new Error("Could not parse shared data."); }
        }
        
        if (!meta) throw new Error("This message contains no data to import.");

        if (msg.message_type === 'deck') {
            const { title, description, cards } = meta;
            
            // Validate deck content
            if (!Array.isArray(cards) || cards.length === 0) {
                throw new Error("This shared deck is empty.");
            }

            const { data: newDeck, error: deckError } = await supabase.from('flashcard_decks').insert({
                user_id: currentUserId, 
                title: title || 'Imported Deck', 
                description: description || 'Imported from chat', 
                status: 'active'
            }).select().single();

            if (deckError || !newDeck) {
                console.error("Deck insertion error:", deckError);
                throw new Error("Failed to create deck entry.");
            }

            const formattedCards = cards.map((c: any) => ({ 
                deck_id: newDeck.id, 
                question: c.question || 'Empty Question', 
                answer: c.answer || 'Empty Answer' 
            }));

            const { error: cardsError } = await supabase.from('flashcards').insert(formattedCards);
            if (cardsError) {
                console.error("Cards insertion error:", cardsError);
                throw new Error("Deck created, but cards failed to import.");
            }

            showAlert("Import Success", `Successfully added "${newDeck.title}" with ${cards.length} cards to your library!`, 'success');
        } 
        else if (msg.message_type === 'note') {
             const { title, content, tags } = meta;
             const cleanTags = Array.isArray(tags) ? tags : [];

             const { data: newNote, error: noteError } = await supabase.from('notes').insert({
                 user_id: currentUserId, 
                 title: title || 'Imported Note', 
                 content: content || '', 
                 tags: cleanTags
             }).select().single();
             
             if (noteError) {
                 console.error("Note insertion error:", noteError);
                 throw new Error("Failed to save note to your library.");
             }
             
             showAlert("Import Success", `Successfully added "${newNote.title}" to your Smart Notes!`, 'success');
        } else {
            throw new Error(`Item type "${msg.message_type}" is not supported for automatic import.`);
        }
    } catch (e: any) {
        console.error("Detailed Import Error:", e);
        showAlert("Import Failed", e.message || "An unexpected error occurred during import.", 'error');
    } finally {
        setImportingId(null);
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const renderMessageContent = useCallback((msg: Message, isMe: boolean) => {
     if (msg.message_type === 'text') {
         return <p className="whitespace-pre-wrap break-words">{msg.content}</p>;
     } 
     
     if (msg.message_type === 'audio') {
         return (
             <div className="min-w-[150px] pt-1">
                 <audio controls className="w-full h-8" src={msg.content} />
                 <p className="text-[10px] mt-1 opacity-70 flex items-center gap-1"><Mic size={10}/> Voice Message</p>
             </div>
         );
     }

     if (msg.message_type === 'image') {
         return (
            <div className="rounded-lg overflow-hidden my-1">
                <img src={msg.content} alt="Shared" className="max-w-[240px] max-h-[300px] object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(msg.content, '_blank')} />
            </div>
         );
     }

     // Deck or Note
     let meta = msg.metadata || {};
     if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch {} }

     const isDeck = msg.message_type === 'deck';
     return (
         <div className="min-w-[180px]">
             <div className={`flex items-center gap-2 mb-1 pb-1 border-b ${isMe ? 'border-white/20' : 'border-purple-500/20'}`}>
                 {isDeck ? <Layers size={14}/> : <FileText size={14}/>}
                 <span className="font-bold text-[10px] uppercase tracking-wider">{isDeck ? 'Shared Deck' : 'Shared Note'}</span>
             </div>
             <p className="font-bold text-sm mb-1">{meta.title || 'Untitled'}</p>
             <p className="text-[10px] opacity-70 mb-2 line-clamp-2">{meta.description || meta.content?.substring(0,50) || 'No preview available'}</p>
             {!isMe && (
                 <button 
                    onClick={() => importSharedItem(msg)} 
                    disabled={importingId === msg.id} 
                    className={`w-full py-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${
                        importingId === msg.id 
                        ? 'bg-purple-500/20 text-purple-400 animate-pulse' 
                        : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                    }`}
                 >
                    {importingId === msg.id ? <Loader2 size={12} className="animate-spin"/> : <Download size={12}/>} 
                    {importingId === msg.id ? 'IMPORTING...' : 'IMPORT TO COLLECTION'}
                 </button>
             )}
         </div>
     );
  }, [importingId]);

  return (
    <div className="flex w-full h-screen bg-[#030712] relative overflow-hidden">
        
        {/* Alerts */}
        <AnimatePresence>
            {alertInfo.show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
                    <MotionDiv initial={{opacity:0, scale:0.9}} animate={{opacity:1, scale:1}} exit={{opacity:0}} className="bg-[#0f172a] border border-white/10 rounded-xl p-6 w-[90%] max-w-xs shadow-2xl pointer-events-auto text-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4 ${alertInfo.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{alertInfo.type === 'success' ? <Check size={20}/> : <AlertCircle size={20}/>}</div>
                        <h3 className="text-lg font-bold text-white mb-2">{alertInfo.title}</h3>
                        <p className="text-slate-400 text-xs mb-4 break-words leading-relaxed">{alertInfo.message}</p>
                        <button onClick={() => setAlertInfo({...alertInfo, show: false})} className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white font-medium text-sm">Okay</button>
                    </MotionDiv>
                </div>
            )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
            {messageToDelete && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <MotionDiv 
                        initial={{ opacity: 0, scale: 0.9 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        exit={{ opacity: 0, scale: 0.9 }} 
                        className="bg-[#0f172a] border border-white/10 rounded-2xl p-6 w-[90%] max-w-sm shadow-2xl text-center"
                    >
                        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400">
                            <Trash2 size={24}/>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Delete Message?</h3>
                        <p className="text-slate-400 text-sm mb-6">Are you sure you want to delete this message? This action cannot be undone.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setMessageToDelete(null)} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium">Cancel</button>
                            <button onClick={confirmDeleteMessage} className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold">Delete</button>
                        </div>
                    </MotionDiv>
                </div>
            )}
        </AnimatePresence>
        
        {/* Forward Modal */}
        <ShareModal 
            isOpen={!!messageToForward}
            onClose={() => setMessageToForward(null)}
            onShare={handleForwardMessage}
            title="Forward Message"
            itemTitle={messageToForward?.content || "Audio/Attachment"}
        />

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
                        <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder="Email or Username..." className="w-full bg-black/30 border border-white/10 rounded-lg pl-3 pr-8 py-1.5 text-xs text-white focus:border-purple-500 outline-none"/>
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
                                 <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden flex-shrink-0">{profile.avatar_url && <img src={profile.avatar_url} loading="lazy" className="w-full h-full object-cover"/>}</div>
                                 <div className="min-w-0"><p className="text-xs font-medium text-white truncate">{profile.name}</p><p className="text-[10px] text-slate-500 truncate">@{profile.username}</p></div>
                             </div>
                             {getActionButton(profile.id)}
                        </div>
                    ))
                ) : activeTab === 'requests' ? (
                    <div className="flex flex-col h-full">
                         <div className="flex justify-end px-2 mb-2"><button onClick={() => { setLoading(true); if(currentUserId) fetchSocialData(currentUserId).then(() => setLoading(false)); }} className="text-[10px] text-slate-500 hover:text-white flex items-center gap-1"><RefreshCw size={10}/> Refresh</button></div>
                        {requests.length === 0 ? <div className="text-center text-slate-500 py-8 text-xs"><Bell size={24} className="mx-auto mb-2 opacity-20"/><p>No pending requests.</p></div> :
                            requests.map(req => (
                                <div key={req.id} className="flex items-center justify-between p-2 bg-purple-500/10 rounded-lg border border-purple-500/20 mb-2">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden flex-shrink-0">{req.sender?.avatar_url && <img src={req.sender.avatar_url} loading="lazy" className="w-full h-full object-cover"/>}</div>
                                            <div className="min-w-0"><p className="text-xs font-bold text-white truncate">{req.sender?.name}</p></div>
                                        </div>
                                        <div className="flex gap-1"><button onClick={() => acceptRequest(req.id, req.sender)} className="p-1.5 bg-green-500 hover:bg-green-400 text-white rounded shadow"><Check size={14}/></button><button onClick={() => rejectRequest(req.id)} className="p-1.5 bg-red-500/20 text-red-400 rounded"><X size={14}/></button></div>
                                </div>
                            ))
                        }
                    </div> 
                ) : (
                    <>
                        <div className="flex justify-between items-center px-2 mb-2">
                            <h3 className="text-[10px] font-bold text-slate-500 uppercase">My Friends ({friends.length})</h3>
                            <button onClick={() => { setLoading(true); if(currentUserId) fetchSocialData(currentUserId).then(() => setLoading(false)); }} className="text-[10px] text-slate-500 hover:text-white flex items-center gap-1"><RefreshCw size={10}/> Refresh</button>
                        </div>
                        {loading && friends.length === 0 ? <div className="text-center py-4"><Loader2 className="animate-spin mx-auto text-purple-500" size={20}/></div> : null}
                        {friends.length === 0 && !loading && (
                            <div className="text-center py-8 px-4">
                                <p className="text-xs text-slate-500 mb-2">No friends found.</p>
                                <button onClick={() => { setLoading(true); if(currentUserId) fetchSocialData(currentUserId).then(() => setLoading(false)); }} className="px-3 py-1 bg-white/5 hover:bg-white/10 text-white text-[10px] rounded border border-white/10">Force Refresh</button>
                            </div>
                        )}
                        {friends.map(friend => (
                             <div key={friend.id} onClick={() => { setActiveChatId(friend.id); setActiveChatDetails(friend); }} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${activeChatId === friend.id ? 'bg-purple-600 text-white shadow-lg' : 'hover:bg-white/5 text-slate-300'}`}>
                                 <div className="relative">
                                     <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden border border-white/10 flex-shrink-0">
                                        {friend.avatar_url ? <img src={friend.avatar_url} loading="lazy" className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center bg-slate-800 text-[10px]">{friend.name?.[0]}</div>}
                                     </div>
                                     {onlineUsers.has(friend.id) && (
                                         <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#0f172a]"></div>
                                     )}
                                 </div>
                                 <div className="overflow-hidden flex-1">
                                    <div className="flex justify-between items-center">
                                        <p className="font-bold text-xs truncate">{friend.name}</p>
                                        {onlineUsers.has(friend.id) && <span className="text-[8px] text-green-400 font-bold">Online</span>}
                                    </div>
                                    <p className="text-[10px] opacity-70 truncate">@{friend.username}</p>
                                 </div>
                             </div>
                        ))}
                    </>
                )}
            </div>
        </div>

        {/* Chat Area */}
        {activeChatId && activeChatDetails ? (
            <div className={`flex-1 flex flex-col bg-[#030712] w-full ${activeChatId ? 'flex' : 'hidden md:flex'}`}>
                <div className="h-14 px-4 border-b border-white/5 flex items-center justify-between bg-black/40 backdrop-blur-sm z-20">
                    <div className="flex items-center gap-3">
                         <button onClick={() => { setActiveChatId(null); setActiveChatDetails(null); }} className="md:hidden text-slate-400"><X size={20}/></button>
                         <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden border border-white/10">
                                {activeChatDetails.avatar_url && <img src={activeChatDetails.avatar_url || ''} className="w-full h-full object-cover"/>}
                            </div>
                            {onlineUsers.has(activeChatId) && <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-black"></div>}
                         </div>
                         <div>
                            <h3 className="font-bold text-white text-sm">{activeChatDetails.name}</h3>
                            <span className={`text-[10px] ${onlineUsers.has(activeChatId) ? 'text-green-400 font-medium' : 'text-slate-500'}`}>
                                {onlineUsers.has(activeChatId) ? 'Online' : 'Offline'}
                            </span>
                         </div>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-1" ref={chatScrollRef}>
                    {chatLoading && messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-slate-500">
                             <Loader2 size={32} className="animate-spin text-purple-500 mb-2"/>
                             <p className="text-xs">Loading conversation...</p>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="text-center text-slate-500 py-10"><MessageCircle size={32} className="mx-auto mb-2 opacity-20"/><p className="text-sm">Start the conversation!</p></div>
                    ) : (
                        <AnimatePresence mode="popLayout">
                            {messages.map((msg, idx) => {
                                const isMe = msg.sender_id === currentUserId;
                                const prevMsg = messages[idx - 1];
                                const isFirstInSequence = idx === 0 || prevMsg.sender_id !== msg.sender_id;
                                
                                const senderInfo = isMe ? { name: 'Me', avatar_url: null } : activeChatDetails;

                                return (
                                    <MotionDiv 
                                        layout
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }} 
                                        animate={{ opacity: 1, y: 0, scale: 1 }} 
                                        exit={{ opacity: 0, scale: 0.5, filter: 'blur(10px)', transition: { duration: 0.4, ease: "backIn" } }}
                                        key={msg.id} 
                                        className={`flex w-full mb-0.5 group hover:bg-white/[0.02] px-2 py-0.5 rounded transition-colors ${isMe ? 'justify-end' : 'justify-start'}`}
                                    >
                                        {!isMe && (
                                            <div className="w-8 flex-shrink-0 mr-2 flex flex-col items-center">
                                                {isFirstInSequence ? (
                                                    <div className="w-7 h-7 rounded-full bg-slate-700 overflow-hidden border border-white/10 mt-1 shadow-md cursor-pointer hover:border-purple-500/50 transition-colors">
                                                        {senderInfo?.avatar_url ? (
                                                            <img src={senderInfo.avatar_url} className="w-full h-full object-cover" alt={senderInfo?.name || 'User'}/>
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-slate-300 bg-gradient-to-br from-slate-600 to-slate-800">
                                                                {senderInfo?.name?.[0] || '?'}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="w-7" /> 
                                                )}
                                            </div>
                                        )}

                                        <div className={`flex flex-col max-w-[85%] md:max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                                            {!isMe && isFirstInSequence && (
                                                <div className="flex items-baseline gap-2 mb-0.5">
                                                    <span className="text-xs font-bold text-white hover:underline cursor-pointer">{senderInfo?.name || 'Unknown'}</span>
                                                    <span className="text-[9px] text-slate-500">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                </div>
                                            )}

                                            <div className={`
                                                relative px-3 py-1.5 text-sm leading-relaxed shadow-sm
                                                ${isMe 
                                                    ? 'bg-purple-600 text-white rounded-2xl rounded-tr-sm' 
                                                    : 'bg-[#1e293b] text-slate-200 rounded-2xl rounded-tl-sm border border-white/5'}
                                                ${!isFirstInSequence && !isMe ? 'rounded-tl-2xl' : ''}
                                                ${!isFirstInSequence && isMe ? 'rounded-tr-2xl' : ''}
                                            `}>
                                                <div className={`absolute top-0 ${isMe ? 'left-0 -translate-x-full pr-1' : 'right-0 translate-x-full pl-1'} opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity h-full items-center z-10`}>
                                                    <button onClick={() => setReplyTo(msg)} className="p-1 bg-black/50 hover:bg-black/80 rounded-full text-slate-300 backdrop-blur-sm" title="Reply"><CornerUpLeft size={12}/></button>
                                                    <button onClick={() => setMessageToForward(msg)} className="p-1 bg-black/50 hover:bg-black/80 rounded-full text-slate-300 backdrop-blur-sm" title="Forward"><Forward size={12}/></button>
                                                    {isMe && (
                                                        <button onClick={() => setMessageToDelete(msg.id)} className="p-1 bg-red-500/80 hover:bg-red-600 rounded-full text-white backdrop-blur-sm ml-1" title="Delete"><Trash2 size={12}/></button>
                                                    )}
                                                </div>

                                                {renderMessageContent(msg, isMe)}
                                                
                                                {isMe && (
                                                    <span className="text-[8px] text-purple-200/60 block text-right mt-0.5 select-none">
                                                        {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </MotionDiv>
                                );
                            })}
                        </AnimatePresence>
                    )}
                    
                    <AnimatePresence>
                        {friendTyping && (
                            <MotionDiv initial={{opacity: 0, y: 5}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, scale: 0.9}} className="flex justify-start px-2 mt-1">
                                <div className="w-8 flex-shrink-0 mr-2">
                                     <div className="w-7 h-7 rounded-full bg-slate-700 overflow-hidden border border-white/10">
                                        {activeChatDetails?.avatar_url ? <img src={activeChatDetails.avatar_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-[8px]">...</div>}
                                     </div>
                                </div>
                                <div className="bg-[#1e293b] border border-white/5 px-3 py-2 rounded-2xl rounded-tl-sm flex items-center gap-1">
                                    <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce"></div>
                                </div>
                            </MotionDiv>
                        )}
                    </AnimatePresence>
                </div>

                <div className="p-3 border-t border-white/5 bg-black/40">
                   <AnimatePresence>
                        {replyTo && (
                            <MotionDiv initial={{height: 0, opacity: 0}} animate={{height: 'auto', opacity: 1}} exit={{height: 0, opacity: 0}} className="overflow-hidden">
                                <div className="bg-white/5 border-l-2 border-purple-500 p-1.5 mb-2 rounded flex justify-between items-center">
                                    <div className="text-[10px] text-slate-300 overflow-hidden">
                                        <p className="font-bold text-purple-400">Replying to message</p>
                                        <p className="truncate opacity-80">{replyTo.content || 'Attachment'}</p>
                                    </div>
                                    <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-white/10 rounded-full text-slate-400"><X size={12}/></button>
                                </div>
                            </MotionDiv>
                        )}
                   </AnimatePresence>

                   {isRecording ? (
                       <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 animate-pulse">
                           <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                           <span className="text-red-400 font-mono font-bold flex-1 text-sm">{formatRecordingTime(recordingTime)}</span>
                           <span className="text-[10px] text-red-400 mr-2">Recording...</span>
                           <button onClick={stopRecording} className="p-1.5 bg-red-500 hover:bg-red-400 text-white rounded-full transition-colors"><Square size={12} fill="currentColor"/></button>
                       </div>
                   ) : (
                       <form onSubmit={sendMessage} className="flex gap-2 items-center">
                           <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                           <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-purple-400 rounded-lg transition-colors" disabled={isUploading}>
                                {isUploading ? <Loader2 size={18} className="animate-spin" /> : <ImageIcon size={18} />}
                           </button>
                           <button type="button" onClick={startRecording} className="p-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-red-400 rounded-lg transition-colors">
                              <Mic size={18} />
                           </button>
                           <input 
                               value={newMessage}
                               onChange={e => { setNewMessage(e.target.value); handleTyping(); }}
                               placeholder="Type a message..."
                               className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-purple-500 focus:bg-white/10 transition-all"
                           />
                           <button type="submit" disabled={!newMessage.trim()} className="bg-purple-600 p-2.5 rounded-lg text-white disabled:opacity-50 hover:scale-105 transition-transform"><Send size={18}/></button>
                       </form>
                   )}
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