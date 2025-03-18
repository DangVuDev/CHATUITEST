import React, { useState, useEffect, useCallback, useRef } from "react";
import { HubConnectionBuilder } from "@microsoft/signalr";
import axios from "axios";
import "./App.css";

// Base API URL
const BASE_API_URL = "https://hubt-microserivce-2.onrender.com";

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
        const { data } = await axios.post(`https://hubt-microserivce-25mh.onrender.com/api/auth/sign-in`, {
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
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
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
      if (!message.trim() || !selectedGroup) return;

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
        alert("Failed to send message. Please try again.");
      }
    },
    [message, onSendMessage, selectedGroup, scrollToBottom]
  );

  const handleFileChange = useCallback(
    async (e) => {
      const file = e.target.files[0];
      if (!file || !selectedGroup) return;

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
          alert("Failed to send file. Please try again.");
        }
      };
      reader.onerror = (error) => {
        console.error("FileReader error:", error.message);
        alert("Error reading file. Please try again.");
      };
      reader.readAsDataURL(file);
    },
    [onSendMessage, selectedGroup, scrollToBottom]
  );

  const addEmoji = useCallback((emoji) => {
    setMessage((prev) => prev + emoji);
    setShowEmojiPicker(false);
  }, []);

  const loadMoreMessages = useCallback(async () => {
    if (!selectedGroup) return;

    const currentQuantity = groupData[selectedGroup]?.messages?.length || 0;
    const limit = 50;

    try {
      console.log(`Loading more messages for group ${selectedGroup}...`);
      const { data } = await createAxiosInstance(token).get(
        `/api/chat/room/get-history?ChatRoomId=${selectedGroup}&CurrentQuantity=${currentQuantity}&Limit=${limit}`
      );
      console.log("Load more messages response:", data);

      const newMessages = Array.isArray(data) ? data : []; // Trực tiếp lấy mảng
      if (newMessages.length > 0) {
        setGroupData((prev) => {
          const updatedGroup = {
            ...prev[selectedGroup],
            messages: [...newMessages, ...(prev[selectedGroup]?.messages || [])],
          };
          console.log("Updated groupData after load more:", { ...prev, [selectedGroup]: updatedGroup });
          return { ...prev, [selectedGroup]: updatedGroup };
        });
        setHasMoreMessages(newMessages.length === limit);
      } else {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error("Error loading more messages:", error.response?.data || error.message);
      alert("Failed to load more messages. Please try again.");
    }
  }, [selectedGroup, groupData, token, setGroupData]);

  useEffect(() => {
    console.log("Current groupData in ChatArea:", groupData);
    console.log("Selected group:", selectedGroup);
    console.log("Messages for selected group:", groupData[selectedGroup]?.messages);
    scrollToBottom();
  }, [groupData, selectedGroup, scrollToBottom]);

  if (!selectedGroup) {
    return (
      <div className="no-chat-selected">
        <p>Select a chat to start messaging</p>
      </div>
    );
  }

  const group = groups.find((g) => g.id === selectedGroup);
  const currentGroupData = groupData[selectedGroup] || { messages: [], users: [], error: null };

  if (currentGroupData.error) {
    return (
      <div className="chat-area">
        <div className="chat-header">
          <h3>{group?.groupName || "Loading..."}</h3>
        </div>
        <div className="error-message">
          <p>Error: {currentGroupData.error}</p>
          <button onClick={() => loadMoreMessages(selectedGroup)}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-area">
      <div className="chat-header">
        <h3>{group?.groupName || "Loading..."}</h3>
      </div>
      <div className="messages-container" ref={messagesContainerRef}>
        {currentGroupData.isLoading ? (
          <p>Loading messages...</p>
        ) : (
          <>
            {hasMoreMessages && currentGroupData.messages.length > 0 && (
              <button className="load-more-button" onClick={loadMoreMessages}>
                Load More Messages
              </button>
            )}
            {currentGroupData.messages.length > 0 ? (
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
                    <img src={sender.profilePhoto} alt={sender.name} className="avatar" />
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
                      <span className="timestamp">
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p>No messages yet.</p>
            )}
          </>
        )}
      </div>
      <form onSubmit={handleSendMessage} className="message-form">
        <div className="icon-buttons">
          <button type="button" onClick={() => fileInputRef.current?.click()} title="Attach file">
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
            title="Add emoji"
          >
            😊
          </span>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={!selectedGroup}
          />
          {showEmojiPicker && (
            <div className="emoji-picker">
              {["😊", "😂", "❤️", "👍", "😍", "😢", "😡", "🎉"].map((emoji) => (
                <span
                  key={emoji}
                  onClick={() => addEmoji(emoji)}
                  className="emoji"
                  title={`Add ${emoji}`}
                >
                  {emoji}
                </span>
              ))}
            </div>
          )}
        </div>
        <button type="submit" className="send-button" disabled={!message.trim()}>
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
  const loadedGroupsRef = useRef(new Set());
  const connectionRef = useRef(null);
  const prevSelectedGroupRef = useRef("");

  const axiosInstance = createAxiosInstance(token);

  useEffect(() => {
    if (!token || connectionRef.current) return;

    console.log("Initializing SignalR connection...");
    const connect = new HubConnectionBuilder()
      .withUrl(`https://hubt-microserivce-chatdata-exl7.onrender.com/chathub`, { accessTokenFactory: () => token })
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
        console.log("Loaded groups:", data);
        setGroups(data);
      } catch (err) {
        console.error("SignalR connection error:", err.message);
      }
    };

    startConnection();

    connect.on("ReceiveChat", (res) => {
      console.log("Received chat:", res);
      setGroupData((prev) => {
        const updatedGroup = {
          ...prev[res.groupId],
          messages: [...(prev[res.groupId]?.messages || []), res.message],
        };
        console.log("Updated groupData after receiving chat:", { ...prev, [res.groupId]: updatedGroup });
        return { ...prev, [res.groupId]: updatedGroup };
      });
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

  const loadGroupData = useCallback(
    async (groupId) => {
      if (!groupId || loadedGroupsRef.current.has(groupId)) {
        console.log(`Skipping load for group ${groupId}`);
        return;
      }

      console.log(`Starting load for group ${groupId} at ${new Date().toISOString()}`);
      setGroupData((prev) => ({
        ...prev,
        [groupId]: { ...prev[groupId], isLoading: true, error: null },
      }));

      try {
        const [usersResponse, historyResponse] = await Promise.all([
          axiosInstance.get(`/api/chat/room/get-room-user?groupId=${groupId}`),
          axiosInstance.get(`/api/chat/room/get-history?ChatRoomId=${groupId}&CurrentQuantity=0&Limit=10`),
        ]);

        console.log(`API response for users (${groupId}):`, usersResponse.data);
        console.log(`API response for history (${groupId}):`, historyResponse.data);

        const usersData = usersResponse.data;
        const historyData = Array.isArray(historyResponse.data) ? historyResponse.data : []; // Trực tiếp lấy mảng

        if (!usersData || !Array.isArray(historyData)) {
          throw new Error("Invalid response data from API");
        }

        setGroupData((prev) => {
          const updatedGroup = {
            users: usersData,
            messages: historyData,
            isLoading: false,
            error: null,
          };
          console.log("Updated groupData after load:", { ...prev, [groupId]: updatedGroup });
          return { ...prev, [groupId]: updatedGroup };
        });
        loadedGroupsRef.current.add(groupId);
      } catch (error) {
        console.error(`Failed to load group ${groupId}:`, error.response?.data || error.message);
        setGroupData((prev) => ({
          ...prev,
          [groupId]: {
            ...prev[groupId],
            isLoading: false,
            error: error.message || "Failed to load group data",
          },
        }));
      }
    },
    [axiosInstance]
  );

  useEffect(() => {
    console.log(`selectedGroup changed to: ${selectedGroup}`);
    if (selectedGroup && selectedGroup !== prevSelectedGroupRef.current) {
      loadGroupData(selectedGroup);
      prevSelectedGroupRef.current = selectedGroup;
    }
  }, [selectedGroup, loadGroupData]);

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
