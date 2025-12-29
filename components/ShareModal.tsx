
import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Send, User, Check, Share2 } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShare: (friendId: string) => Promise<void>;
  title: string;
  itemTitle: string;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, onShare, title, itemTitle }) => {
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) fetchFriends();
  }, [isOpen]);

  const fetchFriends = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Manual friend fetch to match Social.tsx logic
    const { data: f1 } = await supabase.from('friends').select('user_id_2').eq('user_id_1', user.id);
    const { data: f2 } = await supabase.from('friends').select('user_id_1').eq('user_id_2', user.id);
    
    const friendIds = new Set<string>();
    f1?.forEach((r: any) => friendIds.add(r.user_id_2));
    f2?.forEach((r: any) => friendIds.add(r.user_id_1));
    
    if (friendIds.size > 0) {
        const { data } = await supabase.from('profiles').select('*').in('id', Array.from(friendIds));
        setFriends(data || []);
    }
  };

  const handleSend = async (friendId: string) => {
    setSendingTo(friendId);
    await onShare(friendId);
    setSendingTo(null);
  };

  const filteredFriends = friends.filter(f => 
    f.name?.toLowerCase().includes(search.toLowerCase()) || 
    f.id.includes(search)
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
          >
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/20">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Share2 size={18} className="text-purple-400"/> {title}
                </h3>
                <p className="text-xs text-slate-400 mt-1 truncate max-w-[200px]">"{itemTitle}"</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
            </div>
            
            <div className="p-4 border-b border-white/5">
                <div className="relative">
                    <Search className="absolute left-3 top-3 text-slate-500" size={16}/>
                    <input 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search friends..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:border-purple-500 outline-none"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {friends.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                        <User size={32} className="mx-auto mb-2 opacity-30"/>
                        <p className="text-sm">No friends added yet.</p>
                        <p className="text-xs">Go to Community to add friends.</p>
                    </div>
                ) : filteredFriends.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-sm">No match found.</div>
                ) : (
                    filteredFriends.map(friend => (
                        <div key={friend.id} className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors group">
                             <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden">
                                     {friend.avatar_url ? <img src={friend.avatar_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xs">{friend.name?.[0]}</div>}
                                 </div>
                                 <div>
                                     <p className="text-sm font-bold text-white">{friend.name}</p>
                                     <p className="text-xs text-slate-500">@{friend.username || 'user'}</p>
                                 </div>
                             </div>
                             <button 
                                onClick={() => handleSend(friend.id)}
                                disabled={sendingTo === friend.id}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${sendingTo === friend.id ? 'bg-green-500/20 text-green-400' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}
                             >
                                {sendingTo === friend.id ? <Check size={16}/> : 'Send'}
                             </button>
                        </div>
                    ))
                )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ShareModal;
