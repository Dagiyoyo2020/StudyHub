
// Environment variables - Load from .env file
// Make sure to create a .env file with VITE_GEMINI_API_KEY

export const SUPABASE_URL = "https://utdgtmvdwyzzoaurugmu.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0ZGd0bXZkd3l6em9hdXJ1Z211Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNjU5MzksImV4cCI6MjA3OTc0MTkzOX0.mQsyTJNnztdTtSeRh9tgEtIJtkYjD2837JsU9udFAQw";
export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

export enum AppRoutes {
  HOME = "/",
  AUTH = "/auth",
  DASHBOARD = "/dashboard",
  PLANNER = "/planner",
  FLASHCARDS = "/flashcards",
  CHAT = "/chat",
  NOTES = "/notes",
  ANALYTICS = "/analytics",
  PROFILE = "/profile",
  SCHEDULER = "/scheduler",
  SOCIAL = "/social"
}

export const SUBJECTS = [
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "History",
  "English Literature",
  "Computer Science"
];
