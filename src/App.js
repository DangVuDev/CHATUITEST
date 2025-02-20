import React, { useState, useEffect } from 'react';
import { HubConnectionBuilder } from '@microsoft/signalr';
import './App.css';

const ChatApp = () => {
  const [connection, setConnection] = useState(null);
  const [messages, setMessages] = useState([]);
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [groupId, setGroupId] = useState('');
  const [chatpRequestId, setchatpRequestId] = useState([]);

  // Kết nối SignalR
  useEffect(() => {
    if (token) {
      const newConnection = new HubConnectionBuilder()
        .withUrl('https://hubt-social-develop.onrender.com/chathub', {
          accessTokenFactory: () => token,
        })
        .build();

      newConnection.start()
        .then(() => {
          console.log('SignalR connected.');
          setIsConnected(true);
        })
        .catch(err => console.error('Connection error:', err));

      // Lắng nghe tin nhắn từ server
      // Lắng nghe tin nhắn từ server
        newConnection.on('ReceiveChat', (chatItemResponse) => {
          // Chuyển đổi đối tượng chatItemResponse thành chuỗi JSON
          const chatItemString = JSON.stringify(chatItemResponse);
          
          console.log("chatItemResponse:", chatItemString);
          // Cập nhật state với chuỗi JSON
          setMessages(prevMessages => {
            const updatedMessages = [
              ...prevMessages,  // Duy trì các tin nhắn cũ
              chatItemString,   // Thêm chuỗi JSON vào danh sách tin nhắn
            ];
            return updatedMessages;  // Trả về danh sách tin nhắn đã cập nhật

          });
          console.log(messages.length);
        });

      setConnection(newConnection);
    }

    // Cleanup when component unmounts
    return () => {
      if (connection) {
        connection.stop();
      }
    };
  }, [token]);

  // Xử lý gửi tin nhắn
  const handleSendMessage = (e) => {
    e.preventDefault();

    if (!connection) {
      alert('You are not connected.');
      return;
    }

    if (message.trim() && groupId.trim()) {
      const MessageRequestId = crypto.randomUUID();
      setchatpRequestId(
        MessageRequestId =>
        {
          const updatedMessageRequestId = [
            ...MessageRequestId,MessageRequestId,
          ]
          return updatedMessageRequestId;
        }
      );

      const payload = {
        RequestId: MessageRequestId,
        GroupId: groupId,
        Content: message,
        Medias: [],  // Hiện tại chưa có xử lý ảnh, có thể bổ sung sau
        Files: [], // Chuyển file vào danh sách
      };
    
      console.log("Payload being sent to backend:", payload);
    
      connection.invoke('SendItemChat', payload)
        .then(() => {
          setMessage(''); // Clear input
        })
        .catch(err => console.error(err));
    } else {
      alert('Please fill in all fields (Message, UserName, and GroupId).');
    }
  };

  return (
    <div
      id="chatContainer"
      style={{
        maxWidth: '600px',
        margin: '20px auto',
        padding: '20px',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)',
      }}
    >
      <h2>SignalR Chat with Token</h2>

      {/* Token Input */}
      <div id="tokenContainer" style={{ marginBottom: '20px' }}>
        <input
          type="text"
          id="tokenInput"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Enter your token here..."
          style={{
            width: 'calc(100% - 20px)',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '5px',
            outline: 'none',
          }}
        />
        <button
          onClick={() => { if (token) setIsConnected(true); }}
          style={{
            padding: '10px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            marginTop: '10px',
          }}
        >
          Connect
        </button>
      </div>

      {/* UserName and GroupId Input */}
      {isConnected && (
        <>
          <div style={{ marginBottom: '20px' }}>
            <input
              type="text"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              placeholder="Enter your Group ID..."
              style={{
                width: 'calc(100% - 20px)',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '5px',
                outline: 'none',
              }}
            />
          </div>
        </>
      )}

      {/* Messages */}
      <div
        id="messages"
        style={{
          border: "1px solid #ddd",
          padding: "10px",
          marginBottom: "20px",
          height: "300px",
          overflowY: "scroll",
          background: "#f9f9f9",
          borderRadius: "5px",
        }}
      >
        {messages.map((message, index) => (
          <div
            key={index}
            style={{
              marginBottom: "15px",
              padding: "10px",
              borderBottom: "1px solid #ddd",
            }}
          >
            <p>{message}</p> {/* Hiển thị chuỗi JSON nguyên bản */}
          </div>
        ))}
      </div>  

      {/* Send Message Form */}
      {isConnected && (
        <form id="sendForm" onSubmit={handleSendMessage} style={{ display: 'flex' }}>
          <input
            type="text"
            id="messageInput"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter your message..."
            style={{
              flex: 1,
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '5px 0 0 5px',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '10px',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '0 5px 5px 0',
              cursor: 'pointer',
            }}
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
};

export default ChatApp;
