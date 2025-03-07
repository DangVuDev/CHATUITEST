import React, { useState, useEffect, useCallback, useRef } from "react";
import { HubConnectionBuilder } from "@microsoft/signalr";
import axios from "axios";
import "./App.css";

// Base API URL
const BASE_API_URL = "https://hubt-social-develop.onrender.com";

// Tạo axios instance
const createAxiosInstance = (token) =>
  axios.create({
    baseURL: BASE_API_URL,
    headers: { Authorization: token ? `Bearer ${token}` : undefined },
  });

// Component màn hình đăng nhập
const LoginScreen = ({ onLogin }) => {
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = useCallback(
    async (e) => {
      e.preventDefault();
      try {
        const { data } = await axios.post(`${BASE_API_URL}/api/auth/sign-in`, {
          username: userName,
          password,
        });
        const token = data?.userToken?.accessToken;
        if (!token) throw new Error("No token received");
        onLogin(token);
      } catch (error) {
        console.error("Login error:", error.message);
        alert("Login failed. Please check your credentials.");
      }
    },
    [userName, password, onLogin]
  );

  return (
    <div className="login-container">
      <h2>Login</h2>
      <form onSubmit={handleLogin} className="login-form">
        <input
          type="text"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder="Username"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
        />
        <button type="submit">Login</button>
      </form>
    </div>
  );
};

// Component danh sách nhóm
const GroupList = ({ groups, selectedGroup, onSelectGroup }) => (
  <div className="group-list">
    <h3>Chats</h3>
    {groups.map((group) => (
      <div
        key={group.id}
        className={`group-item ${selectedGroup === group.id ? "active" : ""}`}
        onClick={() => onSelectGroup(group.id)}
      >
        <img src={group.avatarUrl} alt={group.groupName} className="group-avatar" />
        <div className="group-info">
          <span className="group-name">{group.groupName}</span>
          <span className="last-message">
            {group.lastMessage} • {group.lastInteractionTime}
          </span>
        </div>
      </div>
    ))}
  </div>
);

// Component khu vực chat
const ChatArea = ({ groupData, selectedGroup, groups, onSendMessage, token, setGroupData }) => {
  const [message, setMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const fileInputRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, []);

  const handleSendMessage = useCallback(
    async (e) => {
      e.preventDefault();
      if (!message.trim()) return;

      const payload = {
        RequestId: crypto.randomUUID(),
        GroupId: selectedGroup,
        Content: message.trim(),
        Medias: [],
        Files: [],
        ReplyToMessageId: null,
      };

      try {
        await onSendMessage(payload);
        setMessage("");
        scrollToBottom();
      } catch (error) {
        console.error("Error sending message:", error.message);
      }
    },
    [message, onSendMessage, selectedGroup, scrollToBottom]
  );

  const handleFileChange = useCallback(
    async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async () => {
        const base64File = reader.result.split(",")[1];
        const payloadSizeMB = (base64File.length * 3) / 4 / 1024 / 1024;

        if (payloadSizeMB > 10) {
          console.error("File exceeds 10MB limit for SignalR.");
          alert("File too large (max 10MB). Please use a smaller file.");
          return;
        }

        const payload = {
          RequestId: crypto.randomUUID(),
          GroupId: selectedGroup,
          Content: null,
          Medias: [base64File],
          Files: [],
          ReplyToMessageId: null,
        };

        try {
          await onSendMessage(payload);
          scrollToBottom();
        } catch (error) {
          console.error("Error sending file:", error.message);
        }
      };
      reader.onerror = (error) => console.error("FileReader error:", error.message);
      reader.readAsDataURL(file);
    },
    [onSendMessage, selectedGroup, scrollToBottom]
  );

  const addEmoji = useCallback((emoji) => {
    setMessage((prev) => prev + emoji);
    setShowEmojiPicker(false);
  }, []);

  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current || isLoadingMore) return;

    const { scrollTop } = messagesContainerRef.current;
    if (scrollTop < 100) {
      setIsLoadingMore(true);
      onLoadMoreMessages();
    }
  }, [isLoadingMore]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  const onLoadMoreMessages = useCallback(async () => {
    if (!selectedGroup) {
      setIsLoadingMore(false);
      return;
    }

    const currentQuantity = groupData[selectedGroup]?.messages?.length || 0;
    const limit = 50;

    try {
      const { data } = await createAxiosInstance(token).get(
        `/api/chat/room/get-history?ChatRoomId=${selectedGroup}&CurrentQuantity=${currentQuantity}&Limit=${limit}`
      );

      const newMessages = data?.message || [];
      if (newMessages.length > 0) {
        setGroupData((prev) => ({
          ...prev,
          [selectedGroup]: {
            ...prev[selectedGroup],
            messages: [...newMessages, ...(prev[selectedGroup]?.messages || [])],
          },
        }));
      }
    } catch (error) {
      console.error("Error loading more messages:", error.message);
    } finally {
      setIsLoadingMore(false);
    }
  }, [selectedGroup, groupData, token, setGroupData]);

  useEffect(() => {
    scrollToBottom();
  }, [groupData[selectedGroup]?.messages, scrollToBottom]);

  if (!selectedGroup) {
    return (
      <div className="no-chat-selected">
        <p>Select a chat to start messaging</p>
      </div>
    );
  }

  const group = groups.find((g) => g.id === selectedGroup);
  const currentGroupData = groupData[selectedGroup] || { messages: [], users: [] };

  return (
    <div className="chat-area">
      <div className="chat-header">
        <h3>{group?.groupName || "Loading..."}</h3>
      </div>
      <div className="messages-container" ref={messagesContainerRef}>
        {isLoadingMore && <p>Loading more messages...</p>}
        {currentGroupData.isLoading ? (
          <p>Loading messages...</p>
        ) : currentGroupData.messages.length > 0 ? (
          currentGroupData.messages.map((msg) => {
            const sender = currentGroupData.users.find((u) => u.id === msg.sentBy) || {
              name: "Unknown",
              profilePhoto: "https://default.com/profile.jpg",
            };
            const isCurrentUser = msg.sentBy === currentGroupData.users[0]?.id;
            return (
              <div
                key={msg.id}
                className={`message ${isCurrentUser ? "current-user" : "other-user"}`}
              >
                <img src={sender.profilePhoto} alt={sender.name} />
                <div className="message-content">
                  <p className="sender-name">{sender.name}</p>
                  {msg.message && <p>{msg.message}</p>}
                  {msg.medias?.length > 0 && (
                    <img
                      src={`data:image/jpeg;base64,${msg.medias[0]}`}
                      alt="Uploaded"
                      className="message-media"
                      style={{ maxWidth: "200px", borderRadius: "8px" }}
                    />
                  )}
                  <span>{new Date(msg.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>
            );
          })
        ) : (
          <p>No messages yet.</p>
        )}
      </div>
      <form onSubmit={handleSendMessage} className="message-form">
        <div className="icon-buttons">
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            📁
          </button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileChange}
            accept="image/*,video/*,.pdf"
          />
        </div>
        <div className="input-wrapper">
          <span
            className="input-icon"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
          >
            😊
          </span>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Aa"
          />
          {showEmojiPicker && (
            <div className="emoji-picker">
              {["😊", "😂", "❤️", "👍", "😍", "😢", "😡", "🎉"].map((emoji) => (
                <span key={emoji} onClick={() => addEmoji(emoji)} className="emoji">
                  {emoji}
                </span>
              ))}
            </div>
          )}
        </div>
        <button type="submit" className="send-button">
          ➤
        </button>
      </form>
    </div>
  );
};

// Component chính
const ChatApp = () => {
  const [token, setToken] = useState("");
  const [connection, setConnection] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [groupData, setGroupData] = useState({});
  const loadedGroupsRef = useRef(new Set()); // Theo dõi nhóm đã load
  const connectionRef = useRef(null);
  const prevSelectedGroupRef = useRef(""); // Theo dõi nhóm trước đó

  const axiosInstance = createAxiosInstance(token);

  // Thiết lập kết nối SignalR
  useEffect(() => {
    if (!token || connectionRef.current) return;

    console.log("Initializing SignalR connection...");
    const connect = new HubConnectionBuilder()
      .withUrl(`${BASE_API_URL}/chathub`, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .build();

    connectionRef.current = connect;

    const startConnection = async () => {
      try {
        await connect.start();
        console.log("SignalR connected");
        setConnection(connect);
        setIsConnected(true);

        const { data } = await axiosInstance.get("/api/chat/load-rooms?page=1&limit=10");
        setGroups(data);
      } catch (err) {
        console.error("SignalR connection error:", err.message);
      }
    };

    startConnection();

    connect.on("ReceiveChat", (res) => {
      console.log("Received chat:", res);
      setGroupData((prev) => ({
        ...prev,
        [res.groupId]: {
          ...prev[res.groupId],
          messages: [...(prev[res.groupId]?.messages || []), res.message],
        },
      }));
    });

    return () => {
      if (connectionRef.current) {
        connectionRef.current.stop().catch((err) =>
          console.error("Error stopping SignalR:", err.message)
        );
        connectionRef.current = null;
      }
    };
  }, [token]);

  // Hàm tải dữ liệu nhóm
  const loadGroupData = useCallback(
    async (groupId) => {
      if (!groupId) {
        console.log("No groupId provided, skipping load...");
        return;
      }

      if (loadedGroupsRef.current.has(groupId)) {
        console.log(`Group ${groupId} already loaded, skipping...`);
        return;
      }

      console.log(`Loading data for group ${groupId} at ${new Date().toISOString()}`);
      setGroupData((prev) => ({ ...prev, [groupId]: { ...prev[groupId], isLoading: true } }));

      try {
        const [usersResponse, historyResponse] = await Promise.all([
          axiosInstance.get(`/api/chat/room/get-room-user?groupId=${groupId}`),
          axiosInstance.get(`/api/chat/room/get-history?ChatRoomId=${groupId}&CurrentQuantity=0&Limit=10`),
        ]);

        console.log(`Loaded users for ${groupId}:`, usersResponse.data);
        console.log(`Loaded history for ${groupId}:`, historyResponse.data);

        setGroupData((prev) => ({
          ...prev,
          [groupId]: {
            users: usersResponse.data || [],
            messages: historyResponse.data || [],
            isLoading: false,
          },
        }));
        loadedGroupsRef.current.add(groupId);
      } catch (error) {
        console.error(`Error loading group ${groupId}:`, error.message);
        setGroupData((prev) => ({ ...prev, [groupId]: { ...prev[groupId], isLoading: false } }));
      }
    },
    [axiosInstance]
  );

  // Theo dõi thay đổi selectedGroup và tải dữ liệu
  useEffect(() => {
    console.log(`selectedGroup changed to: ${selectedGroup}`);
    if (selectedGroup && selectedGroup !== prevSelectedGroupRef.current) {
      loadGroupData(selectedGroup);
      prevSelectedGroupRef.current = selectedGroup;
    }
  }, [selectedGroup, loadGroupData]);

  // Gửi tin nhắn qua SignalR
  const sendMessage = useCallback(
    async (payload) => {
      if (!connection || !selectedGroup) {
        console.error("Cannot send message: connection or selectedGroup is null");
        return;
      }

      const fullPayload = {
        RequestId: payload.RequestId || crypto.randomUUID(),
        GroupId: payload.GroupId || selectedGroup,
        Content: payload.Content ?? null,
        Medias: payload.Medias || [],
        Files: payload.Files || [],
        ReplyToMessageId: payload.ReplyToMessageId ?? null,
      };

      console.log("Sending payload:", fullPayload);
      try {
        await connection.invoke("SendItemChat", fullPayload);
      } catch (error) {
        console.error("SignalR invoke error:", error.message);
      }
    },
    [connection, selectedGroup]
  );

  return (
    <div className="chat-app">
      {!token ? (
        <LoginScreen onLogin={setToken} />
      ) : (
        <div className="messenger-layout">
          <GroupList
            groups={groups}
            selectedGroup={selectedGroup}
            onSelectGroup={setSelectedGroup}
          />
          {isConnected && (
            <ChatArea
              groupData={groupData}
              selectedGroup={selectedGroup}
              groups={groups}
              onSendMessage={sendMessage}
              token={token}
              setGroupData={setGroupData}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default ChatApp;
//const BASE_API_URL = "https://hubt-social-develop.onrender.com";
