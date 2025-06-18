import express from 'express';
import multer from 'multer';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();
const app = express();
const upload = multer({ storage: multer.memoryStorage() }); 
app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post('/submit', upload.array('files'), async (req, res) => {
  try {
    const instruction =
      req.body.instruction ||
      "Extract the course name, then list each module in the course, and for each module, list its topics. Name the modules as 'Module 1', 'Module 2', etc., according to their order in the syllabus. Respond in JSON with the structure: [{ courseName, modules: [{ moduleName, topics: [topic1, topic2, ...] }] }].";
    const results = [];

    for (const file of req.files) {
      const base64Data = file.buffer.toString('base64');

      const contents = [
        { text: instruction },
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: base64Data
          }
        }
      ];

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: contents,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "array",
            items: {
              type: "object",
              properties: {
                courseName: { type: "string" },
                modules: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      moduleName: { type: "string" },
                      topics: {
                        type: "array",
                        items: { type: "string" }
                      }
                    },
                    propertyOrdering: ["moduleName", "topics"]
                  }
                }
              },
              propertyOrdering: ["courseName", "modules"]
            }
          }
        }
      });

      const json = result.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
      results.push(...JSON.parse(json));
    }

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to process PDFs" });
  }
});

app.listen(3000, () => console.log("Server started at port 3000"));
