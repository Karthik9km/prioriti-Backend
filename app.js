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
app.use(express.urlencoded({ extended: true }));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post('/extract', upload.array('files'), async (req, res) => {
  try {
    const instruction = req.body.instruction ||
      `Extract the course name, then list each module in the course, and for each module, list its topics, and a boolean array with same size as array of topics with every value set as false.
       Name the modules as 'Module 1', 'Module 2', etc., according to their order in the syllabus. Respond in JSON with the structure: 
       [{ courseName, modules: [{ moduleName, topics: [topic1, topic2, ...] }] }].`;
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
                      },
                      done: {
                        type: "array",
                        items: { type: "boolean"}
                      }
                    },
                    propertyOrdering: ["moduleName", "topics", "done"]
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

app.post('/submit',upload.none(),async (req,res) =>{
  try{
    // syllabus is the extracted data from /extract in json format
    const {weekdayHrs,weekendHrs,startDate,endDate,preference,syllabus}=req.body;  
    const instruction = `Generate a study plan for the first day. It should look like a list of to-do tasks with the mentioned schema.
    Generate the plan based on the following data given by the user/student:
    Weekday study hours: ${weekdayHrs}
    Weekend study hours: ${weekendHrs}
    Start date: ${startDate}
    End date: ${endDate}
    Additional instructions or preferences: ${preference}
    Syllabus of the subjects: ${JSON.stringify(syllabus)}
    All the topics which correspond to false value in done list must be covered within the start and end date.
    the plan should have tasks and their curresponding minutes spend for the day.
    The study plan for the day must be realistic enough.
    Do your research and break tough topics into manageable study sessions. The topics may span over different days if needed and can be further broken
    down into sub topics.
    Create the plan while trying to have a similar progress across the different courses.
    Make sure you are only giving the plan for the first day, while keeping in mind that the course should be enitrely completed while keeping a somewhat consistent pase.
    `;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{text:instruction},],
      config:{
        responseMimeType: 'application/json',s
        responseSchema: {
          type: 'array',
          items:{
            type:'object',
            properties:{
              task: {type: "string"},
              minutes: {type: "integer"},
            },
            propertyOrdering:['task','minutes']
          }
        }
      }
    });

    const json = result.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    res.json(JSON.parse(json));

  }
  catch(err){
    console.log(err);
    res.status(500).json({ error: "Failed to generate study plan" });
  }
})

app.listen(3000, () => console.log("Server started at port 3000"));
