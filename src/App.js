import React, { useState, useEffect } from 'react';
import { HubConnectionBuilder } from '@microsoft/signalr';
import './App.css';
import axios from 'axios';


const ChatApp = () => {
  const [connection, setConnection] = useState(null);
  const [token, setToken] = useState('');
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [groupId, setGroupId] = useState('');
  const [chatpRequestId, setchatpRequestId] = useState([]);
  const [dataLogin, setDataLogin] = useState(null);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [groupMessages, setGroupMessages] = useState({});

  const loginEffect = async () => {
    try {
      const response = await axios.post("https://hubt-social-develop.onrender.com/api/auth/sign-in", {
        username: userName,
        password: password
      });
  
      const loginData = response.data;
      setDataLogin(loginData);
  
      if (loginData?.userToken?.accessToken) {
        setToken(loginData.userToken.accessToken);
      }
    } catch (error) {
      console.error("Lỗi khi gọi API :", error);
    }
  };

// Kết nối SignalR và lấy danh sách nhóm
useEffect(() => {
  if (!token) return;

  const newConnection = new HubConnectionBuilder()
    .withUrl('https://hubt-social-develop.onrender.com/chathub', {
      accessTokenFactory: () => token,
    })
    .build();

  newConnection.start()
    .then(() => {
      console.log('SignalR connected.');
      setIsConnected(true);
      setConnection(newConnection);

      // Gọi API lấy danh sách nhóm sau khi kết nối thành công
      axios.get("https://hubt-social-develop.onrender.com/api/chat/load-rooms", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      .then(response => {
        setGroups(response.data); // Cập nhật danh sách nhóm
        console.log(groups)
      })
      .catch(error => {
        console.error("Lỗi khi tải danh sách group:", error);
      });
    })
    .catch(err => console.error('Connection error:', err));

  newConnection.on('ReceiveChat', (groupId,chatItemResponse) => {
    console.log("Nhận tin nhắn từ server:", chatItemResponse);
    //setMessages(prevMessages => [...prevMessages, JSON.stringify(chatItemResponse)]);
    setGroupMessages((prev) =>(
      {
        ...prev,
        [groupId]: [...(prev[groupId] || []),chatItemResponse]
      }
    ))
  });

  newConnection.on('ReceiveProcess', (id, status) => {
    console.log("Process ID:", id, "Status:", status);
  });

  return () => {
    if (newConnection) {
      newConnection.stop();
    }
  };
}, [token]);
 // Khi `token` thay đổi, kết nối lại với SignalR
  

  // Xử lý gửi tin nhắn
  const handleSendMessage = (e) => {
    e.preventDefault();

    if (!connection) {
      alert('You are not connected.');
      return;
    }

    if (message.trim() && selectedGroup.trim()) {
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


      {/* login */}
      <div id="login" style={{ marginBottom: '20px' }}>
        <input
          type="text"
          id="username"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder="Enter your username here..."
          style={{
            width: 'calc(100% - 20px)',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '5px',
            outline: 'none',
          }}
        />
        <input
          type="text"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password here..."
          style={{
            width: 'calc(100% - 20px)',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '5px',
            outline: 'none',
          }}
        />
        <button
          onClick={loginEffect} // Chỉ cần gọi `loginEffect`, không cần kiểm tra null
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
          Login
        </button>
      </div>

      {/* UserName and GroupId Input */}
      {isConnected && (
        <>
          <div>
            <label>Chọn nhóm:</label>
            <select value={selectedGroup} onChange={(e) => {
              setSelectedGroup(e.target.value);
              setGroupId(e.target.value); // Cập nhật luôn ô nhập GroupId nếu muốn
            }}>
              <option value="">-- Chọn nhóm --</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.groupName}</option>
              ))}
            </select>

            <br />

            {/* <label>Nhập GroupId:</label>
            <input type="text" value={selectedGroup} readOnly />  */}
          </div>
          
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
        {groupMessages[selectedGroup]?.map((message, index) => (
          <div key={index} 
            style={{ marginBottom: "15px", padding: "10px", borderBottom: "1px solid #ddd" }}>
            <p>{JSON.stringify(message)}</p> {/* Hiển thị tin nhắn của nhóm được chọn */}
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
