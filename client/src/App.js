import { useState, useRef, useEffect } from 'react';
import { 
  Message,
  MessageInput,
  TypingIndicator
} from '@chatscope/chat-ui-kit-react';
import axios from 'axios';
import './App.css';

function App() {
  const [messages, setMessages] = useState([
    {
      message: "👋 Hi! Ask me anything about your recent emails and attachments.",
      sentTime: new Date().toISOString(),
      sender: "bot",
      direction: "incoming",
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (message) => {
    const userMessage = { 
      message,
      sentTime: new Date().toISOString(),
      sender: "user",
      direction: "outgoing"
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const response = await axios.post('http://localhost:5000/api/query', { query: message });

      const botMessage = {
        message: response.data.answer,
        sentTime: new Date().toISOString(),
        sender: "bot",
        direction: "incoming"
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error("Error:", error);
      const errorMessage = {
        message: "Sorry, I couldn't process your request. Please try again.",
        sentTime: new Date().toISOString(),
        sender: "bot",
        direction: "incoming"
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        background: "linear-gradient(135deg, #f8fafc 0%, #e0e7ef 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "420px",
          height: "680px",
          borderRadius: "18px",
          boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.2)",
          background: "rgba(255,255,255,0.98)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: "linear-gradient(90deg, #6366f1 0%, #60a5fa 100%)",
            color: "#fff",
            padding: "18px",
            fontWeight: "bold",
            fontSize: "1.2rem",
            letterSpacing: "1px",
          }}
        >
          📧 Email RAG Chatbot
        </div>
        
        {/* Message Area with Fixed Height */}
        <div 
          style={{ 
            flex: 1, 
            display: "flex", 
            flexDirection: "column",
            minHeight: 0,
            overflow: "hidden"
          }}
        >
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "10px",
              maxHeight: "500px", // Explicit max height
            }}
          >
            {messages.map((msg, idx) => (
              <Message
                key={idx}
                model={{
                  message: msg.message,
                  sentTime: msg.sentTime,
                  sender: msg.sender,
                  direction: msg.direction,
                }}
                style={{
                  marginBottom: "10px"
                }}
              />
            ))}
            {isTyping && <TypingIndicator content="AI is typing..." />}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Input Area */}
          <div style={{ padding: "10px", borderTop: "1px solid #e5e7eb" }}>
            <MessageInput
              placeholder="Ask about your emails..."
              onSend={handleSend}
              attachButton={false}
              style={{
                borderRadius: "8px",
                background: "#f3f4f6",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
