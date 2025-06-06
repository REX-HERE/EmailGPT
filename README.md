# Email RAG System

This project is a Node.js application designed to manage email responses using a RAG system for personalised work basewd on GPT 40

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)

## Installation & Usage

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/email-rag-system.git
   ```

2. Navigate to the project directory:
   ```
   cd email-rag-system
   ```

3. Backend Setup

cd server
npm install

- **Create a `.env` file** in the `server` directory (see `.env.example` for required variables).
- Make sure to set up your `.env` file in the `server` directory with all required keys:

OPENAI_API_KEY=your-openai-key
PINECONE_API_KEY=your-pinecone-key
SECRET_KEY=your-secret
- **Start the backend:**
npm install (ONE TIME)
npx nodemon index.js  
- The backend will run on [http://localhost:5000]

4. Frontend Setup

cd client
npm install
npm start

The frontend will run on [http://localhost:3000]

5. ngrok Setup (for Webhooks/Power Automate)

- **Install ngrok:**  
  [Download from ngrok.com](https://ngrok.com/download) or install via Homebrew:
   brew install ngrok/ngrok/ngrok

- **Authenticate ngrok** (first time only):
ngrok config add-authtoken <YOUR_NGROK_AUTH_TOKEN>

- **Run Ngrok**
ngrok http 5000

- **Copy the HTTPS URL** ngrok gives you (e.g., `https://abcd1234.ngrok-free.app`)with api endpoint mentioned in backend code and use it as the webhook endpoint in Power Automate or other external services.

