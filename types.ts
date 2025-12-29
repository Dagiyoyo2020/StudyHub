
export interface UserProfile {
  id: string;
  name: string | null;
  avatar_url: string | null;
  theme: 'dark' | 'cosmic' | 'neon';
  username?: string;
  email?: string;
}

export interface FlashcardDeck {
  id: string;
  user_id: string;
  title: string;
  description: string;
  created_at: string;
  status?: 'active' | 'mastered';
}

export interface Flashcard {
  id: string;
  deck_id: string;
  question: string;
  answer: string;
  created_at: string;
}

export interface Task {
  id?: string;
  subject: string;
  topic: string;
  duration: string;
  difficulty: string;
  completed?: boolean;
  subtasks?: string[];
  resources?: string[];
}

export interface StudyPlan {
  id: string;
  user_id: string;
  plan: {
    weekGoal: string;
    schedule: Array<{
      day: string;
      tasks: Array<Task>
    }>
  };
  created_at: string;
}

export interface TutorChat {
  id: string;
  user_id: string;
  title: string;
  subject: string;
  description: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  role: 'user' | 'model';
  content: string;
  created_at: string;
}

export interface StudyStat {
  id: string;
  user_id: string;
  subject: string;
  minutes: number;
  accuracy: number;
  category?: 'flashcard' | 'task' | 'chat';
  date: string;
}

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  tags?: string[];
  is_favorite?: boolean;
  updated_at: string;
  created_at: string;
}

// Updated for Social Features
export interface Message {
  id: string;
  sender_id: string;
  receiver_id?: string; // Optional for group messages
  group_id?: string;    // Optional for DMs
  content: string;
  message_type: 'text' | 'deck' | 'note' | 'stats' | 'audio' | 'image';
  metadata?: any; 
  created_at: string;
  sender?: UserProfile; // Joined sender info for groups
}

export interface Group {
  id: string;
  name: string;
  created_by: string;
}

export interface ScheduleItem {
  id: string;
  user_id: string;
  title: string;
  scheduled_at: string;
  links: string[];
  programs: string[];
  completed: boolean;
  created_at: string;
}