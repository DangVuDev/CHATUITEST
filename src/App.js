import React, { useState, useEffect } from "react";
import { HubConnectionBuilder } from "@microsoft/signalr";
import axios from "axios";
import "./App.css";

const ChatApp = () => {
  const [connection, setConnection] = useState(null);
  const [token, setToken] = useState("");
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [groupId, setGroupId] = useState("");
  const [chatRequestIds, setChatRequestIds] = useState([]);
  const [dataLogin, setDataLogin] = useState(null);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [groupMessages, setGroupMessages] = useState({});
  const [users, setUsers] = useState({}); // { [groupId]: { currentUser, otherUsers } }

  // Đăng nhập
  const loginEffect = async () => {
    try {
      const response = await axios.post("http://localhost:5176/api/auth/sign-in", {
        username: userName,
        password: password,
      });
      const loginData = response.data;
      setDataLogin(loginData);
      if (loginData?.userToken?.accessToken) {
        setToken(loginData.userToken.accessToken);
      }
    } catch (error) {
      console.error("Lỗi khi đăng nhập:", error);
    }
  };

  // Kết nối SignalR và lấy danh sách nhóm
  useEffect(() => {
    if (!token) return;

    const newConnection = new HubConnectionBuilder()
      .withUrl("http://localhost:5176/chathub", {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect()
      .build();

    newConnection
      .start()
      .then(() => {
        console.log("SignalR kết nối thành công.");
        setIsConnected(true);
        setConnection(newConnection);

        axios
          .get("http://localhost:5176/api/chat/load-rooms", {
            headers: { Authorization: `Bearer ${token}` },
          })
          .then((response) => setGroups(response.data))
          .catch((error) => console.error("Lỗi khi tải danh sách nhóm:", error));
      })
      .catch((err) => console.error("Lỗi kết nối SignalR:", err));

    newConnection.on("ReceiveChat", (res) => {
      setGroupMessages((prev) => ({
        ...prev,
        [res.groupId]: [...(prev[res.groupId] || []), res.message],
      }));
    });

    newConnection.on("ReceiveProcess", (id, status) => {
      console.log("Process ID:", id, "Status:", status);
    });

    return () => {
      newConnection.stop();
    };
  }, [token]);

  // Lấy danh sách người dùng trong phòng khi chọn nhóm
  useEffect(() => {
    if (selectedGroup && token) {
      console.log("GroupId: ",selectedGroup);
      axios
        .get(`http://localhost:5176/api/chat/room/get-room-user?groupId=${selectedGroup}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((response) => {
          console.log("userS: ",response);
          setUsers((prev) => ({
            ...prev,
            [selectedGroup]: {
              currentUser: response.data.currentUser,
              otherUsers: response.data.otherUsers,
            },
          }));
        })
        .catch((error) => console.error("Lỗi khi tải người dùng trong phòng:", error));
    }
  }, [selectedGroup, token]);

  // Gửi tin nhắn
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!connection || !message.trim() || !selectedGroup.trim()) {
      alert("Vui lòng kết nối và điền đầy đủ thông tin (tin nhắn và nhóm).");
      return;
    }

    const requestId = crypto.randomUUID();
    setChatRequestIds((prev) => [...prev, requestId]);

    const payload = {
      RequestId: requestId,
      GroupId: selectedGroup,
      Content: message,
      Medias: [],
      Files: [],
    };

    connection
      .invoke("SendItemChat", payload)
      .then(() => setMessage(""))
      .catch((err) => console.error("Lỗi gửi tin nhắn:", err));
  };

  // Hiển thị giao diện
  return (
    <div
      style={{
        maxWidth: "600px",
        margin: "20px auto",
        padding: "20px",
        background: "white",
        borderRadius: "8px",
        boxShadow: "0 0 10px rgba(0, 0, 0, 0.1)",
      }}
    >
      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Chat Thời Gian Thực</h2>

      {/* Đăng nhập */}
      {!token && (
        <div style={{ marginBottom: "20px" }}>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Tên đăng nhập..."
            style={{ width: "100%", padding: "10px", marginBottom: "10px", borderRadius: "5px", border: "1px solid #ddd" }}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mật khẩu..."
            style={{ width: "100%", padding: "10px", marginBottom: "10px", borderRadius: "5px", border: "1px solid #ddd" }}
          />
          <button
            onClick={loginEffect}
            style={{ width: "100%", padding: "10px", background: "#007bff", color: "white", border: "none", borderRadius: "5px" }}
          >
            Đăng nhập
          </button>
        </div>
      )}

      {/* Chọn nhóm và hiển thị tin nhắn */}
      {isConnected && (
        <>
          <div style={{ marginBottom: "20px" }}>
            <label style={{ fontWeight: "bold" }}>Chọn nhóm chat:</label>
            <select
              value={selectedGroup}
              onChange={(e) => {
                setSelectedGroup(e.target.value);
                setGroupId(e.target.value);
              }}
              style={{ width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #ddd" }}
            >
              <option value="">-- Chọn nhóm --</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.groupName}
                </option>
              ))}
            </select>
          </div>

          {/* Hiển thị tin nhắn */}
          <div
            style={{
              border: "1px solid #e0e0e0",
              padding: "15px",
              marginBottom: "20px",
              height: "300px",
              overflowY: "auto",
              background: "#f5f7fa",
              borderRadius: "8px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
            }}
          >
            {groupMessages[selectedGroup]?.length > 0 ? (
              groupMessages[selectedGroup].map((msg, index) => {
                const currentGroupUsers = users[selectedGroup] || { currentUser: null, otherUsers: [] };
                const isCurrentUser = msg.sentBy === currentGroupUsers.currentUser?.id;
                const sender =
                  isCurrentUser
                    ? currentGroupUsers.currentUser
                    : currentGroupUsers.otherUsers.find((user) => user.id === msg.sentBy) || {
                        name: "Unknown",
                        profilePhoto: "https://default.com/profile.jpg",
                      };

                return (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      marginBottom: "15px",
                      flexDirection: isCurrentUser ? "row-reverse" : "row",
                    }}
                  >
                    <img
                      src={sender.profilePhoto}
                      alt={sender.name}
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        margin: isCurrentUser ? "0 0 0 10px" : "0 10px 0 0",
                        objectFit: "cover",
                      }}
                    />
                    <div
                      style={{
                        maxWidth: "70%",
                        padding: "10px 15px",
                        background: isCurrentUser ? "#007bff" : "#ffffff",
                        color: isCurrentUser ? "#ffffff" : "#333",
                        borderRadius: "12px",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                      }}
                    >
                      <p style={{ fontWeight: "bold", fontSize: "14px", margin: "0 0 5px 0" }}>{sender.name}</p>
                      <p style={{ margin: 0, fontSize: "15px", wordBreak: "break-word" }}>{msg.message}</p>
                      <span
                        style={{
                          fontSize: "12px",
                          color: isCurrentUser ? "rgba(255,255,255,0.7)" : "#888",
                          display: "block",
                          marginTop: "5px",
                        }}
                      >
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p style={{ color: "#888", textAlign: "center", marginTop: "20px" }}>Chưa có tin nhắn nào.</p>
            )}
          </div>

          {/* Gửi tin nhắn */}
          <form onSubmit={handleSendMessage} style={{ display: "flex" }}>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Nhập tin nhắn..."
              style={{
                flex: 1,
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "5px 0 0 5px",
              }}
            />
            <button
              type="submit"
              style={{
                padding: "10px",
                background: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "0 5px 5px 0",
              }}
            >
              Gửi
            </button>
          </form>
        </>
      )}
    </div>
  );
};

export default ChatApp;
