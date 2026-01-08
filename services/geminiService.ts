
import { GoogleGenAI, Type } from "@google/genai";
import { GEMINI_API_KEY } from "../constants";

const getAI = () => {
  const apiKey = GEMINI_API_KEY;
  if (!apiKey) {
    console.error("VITE_GEMINI_API_KEY is missing from environment variables. Please add it to your .env file.");
    throw new Error("API Key configuration missing. Please check your .env file and add VITE_GEMINI_API_KEY.");
  }
  return new GoogleGenAI({ apiKey });
};

const cleanJSON = (text: string) => {
  if (!text) return "{}";
  let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return clean;
};

const handleGeminiError = (error: any, context: string) => {
  console.error(`${context} Error Debug:`, JSON.stringify(error, null, 2));
  let msg = "AI Service Error";
  
  if (error instanceof Error) {
    msg = error.message;
  } else if (typeof error === 'object' && error !== null) {
    if (error.error && error.error.message) {
      msg = error.error.message;
    } else if (error.message) {
      msg = error.message;
    } else {
      try {
        msg = JSON.stringify(error);
      } catch {
        msg = "Unknown error object";
      }
    }
  }

  if (msg.includes("xhr error") || msg.includes("Rpc failed") || msg.includes("fetch failed")) {
    throw new Error("Network connection to AI failed. Please disable ad-blockers or check your internet.");
  }
  
  throw new Error(`AI Generation Failed: ${msg.substring(0, 100)}...`);
};

export const generateStudyPlan = async (
  subjects: string[],
  topics: string,
  hoursPerDay: number,
  difficulty: string,
  gradeLevel: string,
  learningStyle: string,
  durationValue: number,
  durationUnit: string,
  contextText: string = ""
) => {
  const durationString = `${durationValue} ${durationUnit}`;
  const prompt = `
    Create a highly detailed study plan spanning exactly ${durationString}.
    Subjects: ${subjects.join(", ")}
    Focus Topic: ${topics}
    Daily Time: ${hoursPerDay} hours
    Intensity: ${difficulty}
    Grade Level: ${gradeLevel}
    Learning Style: ${learningStyle}
    
    ${contextText ? `IMPORTANT - BASE THE PLAN ON THIS SPECIFIC BOOK/NOTE CONTENT: "${contextText.substring(0, 20000)}"` : ''}

    Output ONLY valid JSON matching this structure exactly:
    {
      "weekGoal": "Specific measurable goal for this period",
      "schedule": [
        {
          "day": "Day 1",
          "tasks": [
            { 
              "subject": "Math", 
              "topic": "Calculus - Limits", 
              "duration": "45m", 
              "difficulty": "Hard",
              "subtasks": ["Read Chapter 2", "Practice Problems 1-10", "Review Theorems"],
              "resources": ["Limit Laws Explained - Khan Academy", "Calculus 1 Full Course"] 
            }
          ]
        }
      ]
    }
    
    IMPORTANT: 
    - "subtasks" must be a list of 3 specific small steps.
    - "resources" must be a list of 2 specific YouTube Video Titles that would be good for this topic. Do not provide URLs, just specific searchable titles.
    - Generate entries for exactly ${durationValue} days if unit is 'Days', or ${durationValue * 7} days if unit is 'Weeks'.
  `;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    
    if (!response.text) throw new Error("No text returned from AI");
    return JSON.parse(cleanJSON(response.text));
  } catch (error) {
    handleGeminiError(error, "Study Plan");
  }
};

export const generateFlashcards = async (subject: string, topic: string, count: number = 10) => {
  const prompt = `
    Act as an expert professor. Generate exactly ${count} high-quality flashcards for ${subject} on the topic of "${topic}".
    
    Requirements:
    1. Questions must be specific and test understanding, not just recognition.
    2. Answers should be concise but complete.
    3. Do NOT use markdown in the output values.
  `;
  
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              answer: { type: Type.STRING },
            },
            required: ["question", "answer"],
          },
        },
      }
    });
    
    if (!response.text) throw new Error("No text returned from AI");
    return JSON.parse(response.text);
  } catch (error) {
    handleGeminiError(error, "Flashcards");
  }
};

export const generateFlashcardsFromText = async (text: string, count: number = 10, contextInstructions: string = "") => {
  // Truncate to avoid token limits, but keep a large chunk (approx 30k chars is safe for flash)
  const safeText = text.substring(0, 30000); 

  const prompt = `
    Act as an expert professor creating a strict exam prep deck.
    Analyze the provided source text and extract exactly ${count} flashcards.
    
    STRICT RULES FOR QUESTIONS:
    1. EXTRACT KNOWLEDGE, DO NOT REFERENCE THE TEXT.
    2. NEVER use phrases like "According to the text", "In this section", "As mentioned in Unit 3", "The author states".
    3. Questions must be universal facts based on the content.
       BAD: "What does the section on mitochondria say about energy?"
       GOOD: "What is the primary function of mitochondria regarding energy?"
    4. Questions must be SELF-CONTAINED. Do not use "it", "they", "this process" without naming the subject.
    
    ${contextInstructions ? `USER FOCUS INSTRUCTIONS: "${contextInstructions}"` : ''}
    
    SOURCE TEXT START:
    "${safeText}"
    SOURCE TEXT END.
  `;
  
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              answer: { type: Type.STRING },
            },
            required: ["question", "answer"],
          },
        },
      }
    });

    if (!response.text) throw new Error("No text returned from AI");
    return JSON.parse(response.text);
  } catch (error) {
    handleGeminiError(error, "Notes Analysis");
  }
};

export const chatWithTutor = async (
  subject: string,
  contextDescription: string,
  history: { role: string; content: string }[],
  newMessage: string
) => {
  try {
    const ai = getAI();
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: `You are an expert ${subject} tutor. 
        Context for this specific session: ${contextDescription}.
        Be helpful, concise, and educational. Use Markdown for formatting.`
      },
      history: history.map(h => ({
        role: h.role,
        parts: [{ text: h.content }]
      }))
    });

    const result = await chat.sendMessage({ message: newMessage });
    return result.text;
  } catch (error) {
    console.error("Chat Error:", error);
    return "I'm having trouble connecting to the network. Please try again later.";
  }
};

export const chatWithTutorStream = async (
  subject: string,
  contextDescription: string,
  history: { role: string; content: string }[],
  newMessage: string,
  onChunk: (text: string) => void
) => {
  try {
    const ai = getAI();
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: `You are an expert ${subject} tutor. 
        Context for this specific session: ${contextDescription}.
        Be helpful, concise, and educational. Use Markdown for formatting.`
      },
      history: history.map(h => ({
        role: h.role,
        parts: [{ text: h.content }]
      }))
    });

    const result = await chat.sendMessageStream({ message: newMessage });
    for await (const chunk of result) {
        if (chunk.text) {
            onChunk(chunk.text);
        }
    }
  } catch (error) {
    console.error("Chat Stream Error:", error);
    onChunk("\n[Connection Error: Please check your internet]");
  }
};

export const continueWriting = async (currentText: string, context?: string) => {
  const prompt = `
    You are a helpful AI study assistant co-authoring a note with a student.
    
    TASK: Continue the text naturally based on what is currently written.
    - Maintain the same tone, formatting style, and subject matter.
    - If the text ends abruptly, finish the sentence or thought.
    - If the text asks a question, answer it.
    - Keep the continuation concise (approx 1-3 paragraphs or a list if appropriate).
    - Do NOT repeat the last sentence provided in the input. Just append new content.
    
    CURRENT NOTE CONTENT:
    "${currentText.substring(Math.max(0, currentText.length - 3000))}"
    
    ${context ? `USER INSTRUCTIONS: ${context}` : ''}
    
    Output ONLY the new text to append.
  `;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });
    
    return response.text;
  } catch (error) {
    handleGeminiError(error, "Continue Writing");
    return "";
  }
};

export const explainText = async (text: string, mode: 'explain' | 'summarize' | 'quiz') => {
  let prompt = "";
  
  if (mode === 'explain') {
    prompt = `Explain the following concept simply and clearly, like I am 5 years old. Provide an analogy if helpful.\n\nTEXT: "${text}"`;
  } else if (mode === 'summarize') {
    prompt = `Summarize the following text into 3 key bullet points.\n\nTEXT: "${text}"`;
  } else if (mode === 'quiz') {
    prompt = `Create a single multiple-choice question based on this text with the correct answer hidden at the end.\n\nTEXT: "${text}"`;
  }

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });
    return response.text;
  } catch (error) {
    handleGeminiError(error, "Smart Actions");
    return "Could not process request.";
  }
};
