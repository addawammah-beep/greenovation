import { useEffect, useState } from "react";
import './GreenovationChatPot.css';
import chatpot_image from "./photo/chatpot_image.png";

const GreenovationChatPot = () => {
  const [visible, setVisible] = useState(false);

  const toggleChat = () => setVisible(!visible);

  // Load Chatbase embed script
  useEffect(() => {
    if (!window.chatbase) {
      const script = document.createElement("script");
      script.src = "https://www.chatbase.co/embed.min.js";
      script.id = "VCc5OLUBbYGECKi5B0Ewj";
      script.domain = "www.chatbase.co";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  return (
    <>
      <button
        className={`chat-toggle-btn fixed ${visible ? 'open' : ''}`}
        onClick={toggleChat}
        type="button"
      >
        <img
          src={chatpot_image}
          alt="Chat"
          className="chat-toggle-icon"
        />
      </button>

      <div className={`chatpot ${visible ? 'open' : ''}`}>
        <iframe
          src="https://www.chatbase.co/chatbot-iframe/VCc5OLUBbYGECKi5B0Ewj"
          width="100%"
          style={{ height: "100%", minHeight: "600px" }}
          title="Chatbot"
        />
      </div>
    </>
  );
};

export default GreenovationChatPot;
