import express from 'express';
import multer from 'multer';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();
const app = express();
const upload = multer({ storage: multer.memoryStorage() }); // 🚫 no disk storage
app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post('/generate-plan', upload.array('files'), async (req, res) => {
  try {
    const instruction = req.body.instruction || "List out the modules very briefly of the syllabus";
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
        model: "gemini-1.5-flash",
        contents: contents
      });

      // Access the generated text from the result object
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";

      results.push({
        filename: file.originalname,
        plan: text
      });
    }

    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to process PDFs" });
  }
});

app.listen(3000, () => console.log("Server started at port 3000"));
