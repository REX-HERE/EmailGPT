require('dotenv').config();
const express = require('express');
const { Pinecone, ServerlessSpec } = require('@pinecone-database/pinecone');
const pdfParse = require('pdf-parse');
const mammoth = require("mammoth");
const OpenAI = require('openai');
const { encode, decode } = require('gpt-tokenizer');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 5000;

// Initialize services
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Pinecone Index Setup
const setupPinecone = async () => {
  const indexName = 'email-attachments';
  console.log(`Checking Pinecone index '${indexName}'...`);

  const indexList = await pc.listIndexes();
  const indexNames = indexList.indexes.map(index => index.name);
  
  if (!indexNames.includes(indexName)) {
    console.log(`Creating new index '${indexName}'...`);
    await pc.createIndex({
      name: indexName,
      dimension: 3072,
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1'
        }
      }
    });
  }
  
  return pc.index(indexName);
};

const chunkText = (text, maxTokens = 8000) => {
  const tokens = encode(text);
  const chunks = [];
  
  let start = 0;
  while (start < tokens.length) {
    let end = Math.min(start + maxTokens, tokens.length);
    
    // Try to split at sentence boundaries
    const slice = tokens.slice(start, end);
    const lastPeriodIndex = slice.lastIndexOf(encode('.')[0]);
    
    if (lastPeriodIndex !== -1 && (end - start - lastPeriodIndex) < 100) {
      end = start + lastPeriodIndex + 1;
    }
    
    chunks.push({
      text: decode(tokens.slice(start, end)),
      tokens: end - start
    });
    
    start = end;
  }
  console.log(`Chunked text into ${chunks.length} parts`);
  return chunks;
};

// Process Attachments
const processAttachment = async (attachment) => {
  try {
    console.log(`Processing attachment: ${attachment.name || 'unnamed'} (${attachment.contentType})`);
    const contentBuffer = Buffer.from(attachment.contentBytes, 'base64');
    
    // Handle PDF
    if (attachment.contentType === 'application/pdf') {
      const data = await pdfParse(contentBuffer);
      return data.text;
    }
    // Handle Word DOCX
    else if (attachment.contentType === 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      
      const result = await mammoth.extractRawText({ buffer: contentBuffer });
      return result.value;
    }
    // Handle plain text
    else if (attachment.contentType === 'text/plain') {
      return contentBuffer.toString('utf8');
    }
    
    // Throw error for unsupported formats
    throw new Error(`Unsupported attachment format: ${attachment.contentType}`);
  } catch (error) {
    console.error('Attachment processing error:', error);
    throw error;
  }
};

// API Endpoints

// Email Processing Endpoint (Called by Power Automate)
app.post('/api/emails', async (req, res) => {
  try {
    console.log('\n=== New Email Received ===');
    console.log(`From: ${req.body.sender}`);
    console.log(`Subject: ${req.body.subject}`);
    console.log(`Attachments: ${req.body.attachments?.length || 0}`);
    // Authentication Check
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${process.env.SECRET_KEY}`) {
      return res.status(401).send('Unauthorized');
    }

    const index = await setupPinecone();
    const { subject, sender, attachments } = req.body;

    // Validate attachments array
    if (!Array.isArray(attachments)) {
      return res.status(400).json({ error: "Invalid attachments format" });
    }

    for (const attachment of attachments) {
        try {
            const textContent = await processAttachment(attachment);
            
            // Split into token-limited chunks
            const chunks = chunkText(textContent);
            console.log(`Split into ${chunks.length} chunks (${chunks.reduce((a,c) => a + c.tokens, 0)} total tokens)`);

            for (const [chunkIndex, chunk] of chunks.entries()) {
                console.log(`Processing chunk ${chunkIndex+1}/${chunks.length} (${chunk.tokens} tokens)`);
            
                const embedding = await openai.embeddings.create({
                    model: "text-embedding-3-large",
                    input: chunk.text
                });

                const truncatedContent = chunk.text.length > 30000 ? chunk.text.slice(0, 30000) : chunk.text;

                await index.upsert([{
                    id: `${(attachment.name || 'unnamed').replace(/\s+/g, '_')}-${attachment.id}-chunk-${chunkIndex}`,
                    values: embedding.data[0].embedding,
                    metadata: {
                        content: truncatedContent,
                        sender,
                        subject,
                        chunk_index: chunkIndex,
                        total_chunks: chunks.length,
                        file_name: attachment.name || 'unnamed'
                    }
                }]);
            }
        } catch (error) {
            console.error(`Failed to process attachment: ${error.message}`);
        }
    }


    res.status(200).json({ success: true });
    console.log('Upsert completed successfully');
  } catch (error) {
    console.error('Email processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Chat Query Endpoint (Called by React Frontend)
app.post('/api/query', async (req, res) => {
  try {
    const { query } = req.body;
    const index = await setupPinecone();

    // Generate query embedding
    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: query
    });

    // Query Pinecone
    const results = await index.query({
      vector: embedding.data[0].embedding,
      topK: 5,
      includeMetadata: true
    });

    // Generate response
    const context = results.matches.map(match => 
      `From: ${match.metadata.sender}\nSubject: ${match.metadata.subject}\nContent: ${match.metadata.content}`
    ).join('\n\n');

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-2024-08-06",
      messages: [{
        role: "system",
        content: `Answer using email context:\n${context}`
      }, {
        role: "user",
        content: query
      }]
    });

    res.json({ answer: completion.choices[0].message.content });
  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({ error: 'Failed to process query' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
