import { useEffect } from "react";
import { useState, useRef} from "react";
import { Link, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { storage } from "../utils/storage";
import { api } from '../api';
import Search from './Search'

function Chat(){
    const [message, setMessage] = useState(""); 
    const [messages, setMessages] = useState([]); //stores message docs
    const [room, setRoom] = useState(null); //stores the roomId
    const [user, setUser] = useState(null); //has id and name
    const navigate = useNavigate();
    const socketRef = useRef(null);
    const [rooms, setRooms] = useState([]); /// array of room objects ( each room object has roomId, otherUser, lastMessage)
    const [query, setQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [matching, setMatchingUsers] = useState([]);
    const [display, setDisplay] = useState(0); /// 0 for chat list and 1 for search list
    const messagesEndRef = useRef(null);
    const [senderTyping, setSenderTyping] = useState(false);
    const roomRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const [activeMessageId, setActiveMessageId] = useState(null);
    const [lastBySender, setLastBySender] = useState(true);
    const userRef = useRef(null);
   
    
    const getMessageStatus = (message, isMe) => {
        if (!isMe) return null;
        
        if (message.status === 'sending') return 'sending';
        
        // Find the recipient user from the current room
        const currentRoom = rooms.find(r => r.roomId === room);
        if (!currentRoom) return 'sent';
        
        const recipientId = currentRoom.otherUser.id;
        const readByIds = message.readBy?.map(u => u.id || u._id || u) || [];
        const deliveredToIds = message.deliveredTo?.map(u => u.id || u._id || u) || [];
        
        if (readByIds.some(id => id.toString() === recipientId)) {
            return 'seen';
        } else if (deliveredToIds.some(id => id.toString() === recipientId)) {
            return 'delivered';
        }
        return 'sent';
    };
   
    useEffect(()=>{
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

        if (messages.length > 0 && messages[messages.length - 1].sender.id === user.id) {
            setLastBySender(true);
        } else {
            setLastBySender(false);
        }
        if(!messages || messages.length === 0) return;
        
    }, [messages]);

    useEffect(()=>{
        const socket = socketRef.current;

        let typingEmitTimeout;

        if(message !== ""){
            clearTimeout(typingEmitTimeout);
            socket.emit("user-typing", roomRef.current);

            typingEmitTimeout = setTimeout(()=>{}, 300);
        }
        return ()=>{
            clearTimeout(typingEmitTimeout);
        }
    }, [message]);

    useEffect(()=>{
        if(query.trim()===""){
            setDisplay(0);
        }
        else setDisplay(1);

        console.log("display set to search mode")
        const timeout = setTimeout(() => {
            setDebouncedQuery(query);
        }, 300);

        return () => clearTimeout(timeout);
    }, [query]);

    useEffect(()=>{
        if(debouncedQuery === ""){
            setMatchingUsers([]);
            return;
        }
        const token = storage.getItem('token');

        api(`/api/chat/users?search=${debouncedQuery}`, {
            headers: {'Authorization': `Bearer ${token}`}
        }).then(data => setMatchingUsers(data));
    }, [debouncedQuery]);

useEffect(() => {
  const token = storage.getItem('token');

  const socket = io(import.meta.env.VITE_API_URL, {
    transports: ["websocket"],
    auth: { token }
  });

  socketRef.current = socket;

  socket.on("connect", () => console.log("Connected:", socket.id));
  socket.on("disconnect", () => console.log("Disconnected"));

  socket.on("sendUser", (serverUser) => {
    setUser(serverUser);
    userRef.current = serverUser; // ✅ keep ref updated
  });

  socket.on("connect_error", (err) => {
    storage.removeItem("token");
    navigate('/');
  });

  socket.on("auth-error", () => {
    storage.removeItem("token");
    navigate('/');
  });

fetchAllUsers(token);
const handleReceiveMessage = (msg) => {
    const user = userRef.current;
    const currentRoom = roomRef.current;
    const socket = socketRef.current;

    if (!user) return;

    const isSender = msg.sender._id === user._id;
    const isCurrentRoom = msg.room === currentRoom;

    // 1. Update messages (only if relevant)
    setMessages(prev => {
        const existing = prev.find(m => m.id === msg.tempId);

        // sender case (replace temp)
        if (existing) {
        return prev.map(m =>
            m.id === msg.tempId
            ? { ...msg, id: msg._id, status: "sent" }
            : m
        );
        }

        // receiver + current room → append
        if (isCurrentRoom) {
        return [...prev, { ...msg, id: msg._id }];
        }

        return prev;
    });

    // 2. Update rooms (chat list)
    setRooms(prev => {
        const exists = prev.find(r => r.roomId === msg.room);

        const updatedRoom = {
            roomId: msg.room,
            myUnreadCount: (!isSender && !isCurrentRoom )? exists.myUnreadCount+1 : exists.myUnreadCount,
            lastMessage: {
                _id: msg._id,
                text: msg.text,
                sender: msg.sender._id,
                createdAt: msg.createdAt
            }
        };

        if (exists) {
            return prev.map(r =>
                r.roomId === msg.room ? { ...r, ...updatedRoom } : r
            );
        } else {
            return [...prev, updatedRoom];
        }
    });

    // 3. Delivery / Read logic
    if (!isSender) {
        if (!isCurrentRoom) {
        socket.emit("delivered", {
            msgId: msg._id,
            userId: user.id
        });
        } else {
            //update unreadCount to 0 and (emit to backend also?)

            socket.emit("read", {
                lastMessageId: msg._id,
                userId: user.id,
                roomId: currentRoom
            });
        }
    }
};
  socket.on("receive_message", handleReceiveMessage);

  return () => {
    socket.off("receive_message", handleReceiveMessage);
    socket.disconnect();
  };
}, []);
    //fetch messages for a particular room when room changes 
    useEffect(() => {
        const token = storage.getItem('token');
    
        roomRef.current = room;
        console.log("roomref set to:", roomRef.current);
        if (!room) return;
        
        //should i update unread count to 0 here

        const socket = socketRef.current;
        if (!socket) return;

        socket.emit("join_room", room);

        api(`/api/chat/messages/${room}`, {
            headers: { Authorization: `Bearer ${token}` }
        }).then(data => {
        
                setMessages(data);
                if (!data.length) return;
                setRooms(prev =>
                    prev.map(r =>
                        r.roomId === room
                        ? { ...r, myUnreadCount: 0 }
                        : r
                    )
                );
                const lastMessage = data[data.length - 1];
                //or here
                if (lastMessage.sender._id !== user.id) {
                    console.log("read getting triggered from fetch messages")
                    socket.emit('read', {
                        userId: user.id,
                        lastMessageId: lastMessage._id,
                        roomId: room
                    });
                }
            
        });
        
        const handleTyping = (data) => {
            if (data === roomRef.current) {
            setSenderTyping(true);
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                setSenderTyping(false);
            }, 2000);
            }
        };
        const handleMessageDelivered = ({ msgId, userId }) => {
            setMessages(prev =>
                prev.map(msg =>
                    msg._id === msgId || msg.id === msgId
                        ? { ...msg, deliveredTo: [...(msg.deliveredTo || []), ...(msg.deliveredTo?.find(u => (u._id || u).toString() === userId.toString()) ? [] : [{ _id: userId }])] }
                        : msg
                )
            );
        };
        const handleMessagesRead = ({ lastMessageId, userId, roomId }) => {
            if (roomId !== room){
                //update the rooms state, if this room is in the chatlist, update lastMessageId and all, and maybe also just the unread count
                //
                setRooms(prev => 
                    prev.map(room =>
                        room.roomId === roomId ? {...room, myUnreadCount : count } : room
                    )
                )
            }
            
            setMessages(prev =>
                prev.map(msg =>
                    (msg.id?.toString() <= lastMessageId?.toString())
                        ? {
                            ...msg,
                            readBy: [...(msg.readBy || []), ...(msg.readBy?.find(u => (u._id || u).toString() === userId.toString()) ? [] : [{ _id: userId }])]
                        }
                        : msg
                )
            );
        };
        
        socket.on("sender-typing", handleTyping);
        socket.on("message_delivered", handleMessageDelivered);
        socket.on("messages_read", handleMessagesRead);

        return () => {
            socket.off("sender-typing", handleTyping);
            socket.off("message_delivered", handleMessageDelivered);
            socket.off("messages_read", handleMessagesRead);
            clearTimeout(typingTimeoutRef.current);
        };
    }, [room]);
    const fetchAllUsers = (token) => {
        api('/api/chat/rooms', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })  .then(data => setRooms(data))
            .catch(err=>{
                console.error("cant fetch rooms: ", err.message);
            });
    }
    const handleSubmit = (e) => {
        e.preventDefault();

        const socket = socketRef.current
        if(!socket || !socket.connected){
            console.log("socket not connected")
            return;
        }
        if (message !== "") {
            const tempId = Date.now();

            const tempMessage = {
                id: tempId,
                text: message,
                room: room,
                sender: {
                    _id: user.id,
                    name: user.name
                },
                status: "sending",
                createdAt: Date.now()
            };

            setMessages((prev) => [...prev, tempMessage]);

            socket.emit("send_message", tempMessage);
            setMessage("");
        }
    };
    function chatWithUser( otherUserId ){
        if(query !== "") setQuery("");
        const existing_chat = rooms.find(r => r.otherUser.id === otherUserId);
        if(existing_chat){
            setRoom(existing_chat.roomId); //change 
        }
        else{
            const token = storage.getItem('token');
            api(`/api/chat/rooms`, {
                method: 'POST',
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": 'application/json'
                },
                body: JSON.stringify({ otherUserId })
            })
                .then(data => {
                    const { roomId, myUnreadCount, otherUser, lastMessage } = data; //we're getting all these from the backend

                    setRoom(roomId);  // still update the current room
                    setRooms(prev => [
                        ...prev,
                        {
                            roomId,
                            myUnreadCount,
                            otherUser,
                            lastMessage
                        }
                    ]);
                });
        }

        setDisplay(0);
        console.log("display set to chat list")
    }

    return(
        <div>
            { user ? <h2>hello {user.name}!</h2> : <h2>...loading</h2> }
            <div className="chat">
                <div className="chat-list" onClick={(e)=>{
                    if(e.target === e.currentTarget){
                        setRoom(null);
                        //remove from activeRooms
                        //make the client join null
                        const socket = socketRef.current;
                        socket.emit('join_room', null);
                    }
                }}>
                    <Search query={query} setQuery={setQuery} />
                    <ul className={display===1? "search-list" : "friends"}>
                        { display === 1 ? ( 
                            matching.length === 0 ? (
                                <li className="no-users">No matching users found</li>
                            ) : ( 
                                matching.map((item)=>(
                                    <li key={item.id} className="search-items" onClick={()=>chatWithUser(item.id)} >{item.name}</li>
                            ))
                        ))
                             : ( rooms.map((item)=>{
                            const time = () => {
                                if(!item.lastMessage || !item.lastMessage.createdAt) return "";
                                const date = new Date(item.lastMessage.createdAt);
                                const now = new Date();

                                const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                                if(date >= startOfToday){
                                    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
                                }else{
                                    const day = String(date.getDate()).padStart(2, '0');
                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                    const year = String(date.getFullYear()).slice(-2);
                                    return `${day}/${month}/${year}`;
                                }
                                
                            };

                            return <li key={item.roomId} className={item.roomId === room? 'current-chat' : 'normal-chat'} onClick={()=>chatWithUser(item.otherUser.id)}>
                                    <div className="friend-name">
                                        <span>{item.otherUser.name}</span>
                                        {item.myUnreadCount !== 0 ? (<span className="unread-count">{item.myUnreadCount}</span>) : (<span></span>)}
                                    </div>
                                    <div style={{ fontSize: '14px', whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display:"flex", justifyContent: "space-between", paddingRight: "10px" }}>
                                        <span style={{
                                            flex: "1",
                                            overflow: "hidden",
                                            whiteSpace: "nowrap",
                                            textOverflow: "ellipsis",
                                            minWidth: 0   // IMPORTANT: allows shrinking
                                        }}>{item.lastMessage.sender === user?.id ? "You: " : ""}{item.lastMessage?.text}</span>
                                        <span style={{ color: item.myUnreadCount === 0 ? 'white' : 'green'}}>{time()}</span>
                                    </div>
                                </li>
}))}
                    </ul>
                </div>
                
                <div className="chat-list">
                    {room && (
                        <div className="chat-box">
                            <div>{}</div>
                            {/* scrollable area */}
                            <div className="chat-messages">
                                <ul className="chats">
                                    {messages.map((item, index)=>{
                                        const isMe = item.sender._id?.toString() === user.id.toString();
                                        const time = () => {
                                            const date = new Date(item.createdAt);
                                            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                                        };
                                        const currentDate = new Date(item.createdAt).toLocaleDateString("en-GB", {
                                            day: "numeric",
                                            month: "short",
                                        });
                                        let showDivider = false;

                                        if(index===0){
                                            showDivider = true;
                                        }else {
                                            const prevDate = new Date(messages[index-1].createdAt).toLocaleDateString('en-GB', {
                                                day: "numeric",
                                                month: "short",
                                            });
                                            showDivider = currentDate !== prevDate;
                                        }
                                            return (
                                                <div key={index}>
                                                    {showDivider && (
                                                        <div className="date-divider">
                                                            <hr />
                                                            <span>{currentDate}</span>
                                                            <hr />
                                                        </div>
                                                    )}
                                                    <div className="message-container">
                                                        <li
                                                            key={index}
                                                            className={`chat-bubble ${isMe ? "my-text" : "friend-text"} ${activeMessageId === item.id ? 'active' : 'not-active'}`}
                                                            onMouseOver={()=>{
                                                                setActiveMessageId(item.id)
                                                            }}
                                                            onMouseLeave={()=>setActiveMessageId(null)}
                                                        >
                                                            {item.text}
                                                        </li>
                                                        <span>{time()}</span>
                                                        {isMe && <p>{getMessageStatus(item, isMe)}</p>}
                                                    </div>
                                                </div>
                                            );
                                    })}
                                    <div ref={messagesEndRef} />
                                </ul>
                                {senderTyping && (
                                    <div className="typing-indicator">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                )}
                            </div>
                            <div className="input-field">
                                <form style={{ display: 'flex', gap: '8px', paddingTop: '8px'}} onSubmit={handleSubmit}>
                                    <input 
                                        type="text"
                                        placeholder="send a message"
                                        value={message}
                                        onChange={(e)=>setMessage(e.target.value)}
                                        className="send-message"
                                    />
                                    <button type="submit" className="send-button">↑</button>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <Link to='/' className="logout-link">Logout</Link>
        </div>
    );
}

export default Chat;