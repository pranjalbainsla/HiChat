import { useEffect } from "react";
import { useState, useRef} from "react";
import { Link, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { storage } from "../utils/storage";

function Chat(){
    const [message, setMessage] = useState(""); 
    const [messages, setMessages] = useState([]); //stores messages as per the message model
    const [room, setRoom] = useState(null); //stores the roomId, which is basically the _id of room documents
    const [user, setUser] = useState(null);
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
    const [lastBySender, setLastBySender] = useState(false);

    useEffect(()=>{
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

        if (messages.length > 0 && messages[messages.length - 1].sender === user._id) {
            setLastBySender(true);
        } else {
            setLastBySender(false);
        }
        if(!messages || messages.length === 0) return;
        socketRef.current?.emit("message_seen", {
            room,
            userId: user._id,
            lastSeenMessageId: messages[messages.length - 1]._id
        });
    }, [messages, senderTyping]);

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

        fetch(`http://localhost:3000/api/chat/users?search=${debouncedQuery}`, {
            headers: {'Authorization': `Bearer ${token}`}
        })
            .then(res => {
                if(!res.ok) throw new Error("invalid response")
                return res.json()
            })
            .then(data => setMatchingUsers(data));
    }, [debouncedQuery]);


    useEffect(()=>{
        const token = storage.getItem('token')
        //connect socket as chat page loads
        const socket = io("http://localhost:3000", {
            transports: ["websocket"],
            auth: {
                token: token
            }
        });
        socket.on("connect", () => {
            console.log("✅ Connected to socket:", socket.id);
            
        });

        socket.on("disconnect", () => {
            console.log("❌ Disconnected from socket");
        });
        //this socket contains the user because we sent the token with the handshake, and you can access it by socket.user
        socketRef.current = socket;

        socket.on('sendUser', (serveruser)=>{
            setUser(serveruser);
        })

        //fetch the previous messages, instead of doing this we'll be fetching rooms, make a get rooms endpoint in chat.js
        fetchAllUsers(token);
        // listen for messages (you can try shifting it to the second useEffect)
        socket.on("receive_message", (data) => {
            console.log("📩 Got from backend:", data);
            console.log("📍 Current room:", roomRef.current);
            fetchAllUsers(token);
            if(data.room === roomRef.current){
                setMessages((prev) => [...prev, data]); //data is the message document as a whole, we need to see if we can just send the message object
                setSenderTyping(false);
                clearTimeout(typingTimeoutRef.current);
            }
        });
        socket.on("room_updated", (update) => {
            setRooms(prevRooms =>
                prevRooms.map(r =>
                    r.roomId === update.roomId
                        ? { ...r, user: {
                            ...r.user,
                            unreadCount: update.unreadCount
                            }, lastMessage: update.lastMessage }
                        : r
                )
            );
        });

        socket.on("connect_error", (err) => {
            console.error("Socket connection error:", err.message);

            if (err.message === "Authentication failed" || err.message === "Token expired") {
                storage.removeItem("token");
                navigate('/');
            }
        });
        socket.on("auth-error", (err)=>{
            console.log(err.message);
            storage.removeItem('token');
            navigate('/');
        })
        
        return () => {
            socket.off("room-updated");
            socket.disconnect();
        };
    }, []);
    //fetch messages for a particular room when room changes 
    useEffect(()=>{
        roomRef.current = room;
        console.log(roomRef.current);
        if(room === null) return;
        const token = storage.getItem('token');
        const socket = socketRef.current;

        
        //tell the server side to join this room when the user clicks on a room
        socket.emit("join_room", roomRef.current);

        fetch(`http://localhost:3000/api/chat/messages/${roomRef.current}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
            .then(res => res.json())
            .then(data => setMessages(data));

        
        const handleTyping = (data) => {
            console.log("sender is typing", data, roomRef.current);
            if (data === roomRef.current) {
                console.log("setting it to true");
                setSenderTyping(true);

                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = setTimeout(() => {
                    console.log("setting it to false")
                    setSenderTyping(false);
                }, 2000);
            }
        };
        socket.on("sender-typing", handleTyping);
        socket.on("message_seen_update", ({ roomId, userId, lastSeenMessageId }) => {
            setRooms((prev) =>
            prev.map((r) =>
                r.roomId === roomId
                ? {
                    ...r,
                    otherUser: {
                        ...r.otherUser,
                        lastReadMessageId: lastSeenMessageId,
                    },
                    }
                : r
            )
            );
        });

        return()=>{
            socket.off("sender-typing", handleTyping);
            clearTimeout(typingTimeoutRef.current);
        };
    }, [room]);
    const fetchAllUsers = (token) => {
        fetch('http://localhost:3000/api/chat/rooms', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
            .then(res => res.json())
            .then(data => setRooms(data))
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
            const newMsg = {
                room, //this is _id of room (stored in the room state)
                sender: user._id, // we need to send _id of user
                text: message,
            };

            // send to server (and it will broadcast)
            socket.emit("send_message", newMsg);

            // update your own view instantly
            //setMessages((prev) => [...prev, newMsg]);
            setMessage("");
        }
    };
    function chatWithUser( otherUserId ){
        if(query !== "") setQuery("");
        const existing_chat = rooms.find(r => r.otherUser.userId._id === otherUserId);
        if(existing_chat){
            setRoom(existing_chat.roomId); //change this
        }
        else{
            const token = storage.getItem('token');
            fetch(`http://localhost:3000/api/chat/rooms`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ otherUserId })
            })
                .then(res => res.json())
                .then(data => {
                    const { roomId, otherUser, lastMessage } = data; //we're getting all these from the backend

                    setRoom(roomId);  // still update the current room
                    setRooms(prev => [
                        ...prev,
                        {
                            roomId,
                            otherUser,
                            lastMessage
                        }
                    ]);
                    //update the rooms list manually (because we dont have a rooms dependency useeffect)
                    fetchAllUsers(token);
                });
        }
        /// if yes, set room to existing_chat (im guesing rooms.some returns an object of the rooms array only?)
        ///if no, make this post request (start a new chat) -> set the room to this newly created room, what exactly does the backend send in this post method?

        setDisplay(0);
        console.log("display set to chat list")
    }

    /*
    const[user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()
    const [message, setMessage] = useState("")
    const [messages, setMessages] = useState([])
    const room = 'general';

    async function fetchMessages(){
        const res = await fetch(`http://localhost:3000/api/chat/messages/${room}`, {
            method: 'GET',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        })
        const data = await res.json();
        if(data.message) alert(data.message);
        setMessages(data.messages)
    }

    useEffect(()=>{
        //everytime chat page loads, fetch the user
        async function fetchUser(){
            const res = await fetch('http://localhost:3000/api/chat', {
                headers: {'Authorization': `Bearer ${localStorage.getItem('token')}`}
            })
            const data = await res.json()
            setUser(data.user)
            setLoading(false)
        }

        fetchUser();
        fetchMessages();
    },[])
    //login page when no user
    useEffect(()=>{
        if(!loading && !user){
            navigate('/')
        }
    }, [user, loading])
    //load messages when the room changes (for the time being, it's gonna be the same for everybody: general)
    useEffect(()=>{
        fetchMessages();
    }, [room])
    //save a new message
    async function handleSubmit(){
        if(message!==""){
            //setMessages(prev=>[...prev, message])
            //setMessage("")
            const res = await fetch('http://localhost:3000/api/chat/sendmessage', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    room: "general",
                    text: message
                })
            })
            const data = await res.json()
            if(data) console.log("response received")
            if(data.message) alert(data.message);
            if(data.newMessage) alert(data.newMessage);
            setMessage("")
        }
    }
*/
    return(
        <div>
            { user ? <h2>hellow {user.name}!</h2> : <h2>...loading</h2> }
            <div className="chat">
                <div className="chat-list" onClick={(e)=>{
                    if(e.target === e.currentTarget){
                        setRoom(null);
                    }
                }}>
                    <input
                        className="search-bar"
                        type="text"
                        placeholder="search..."
                        value={query}
                        onChange={(e)=>setQuery(e.target.value)}
                    />
    
                    <ul className={display===1? "search-list" : "friends"}>
                        { display === 1 ? matching.map((item)=>{
                            return <li key={item._id} className="search-items" onClick={()=>chatWithUser(item._id)} >{item.name}</li>
                        }) : rooms.map((item)=>{
                            const time = () => {
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

                            return <li key={item.roomId} className={item.roomId === room? 'current-chat' : 'normal-chat'} onClick={()=>chatWithUser(item.otherUser.userId._id)}>
                                    <div className="friend-name">
                                        <span>{item.otherUser.userId.name}</span>
                                        {item.user.unreadCount !== 0 ? (<span className="unread-count">{item.user.unreadCount}</span>) : (<span></span>)}
                                    </div>
                                    <div style={{ fontSize: '14px', whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display:"flex", justifyContent: "space-between", paddingRight: "10px" }}>
                                        <span>{item.lastMessage?.text}</span>
                                        <span style={{ color: item.user.unreadCount === 0 ? 'white' : 'green'}}>{time()}</span>
                                    </div>
                                </li>
                        })}
                    </ul>
                </div>
                
                <div className="chat-list">
                    {!room ? (<p>no room selected</p>) : (
                        <div className="chat-box">
                            <div>{}</div>
                            {/* scrollable area */}
                            <div className="chat-messages">
                                <ul className="chats">
                                    {messages.map((item, index)=>{
                                        const isMe = (typeof item.sender === "object" ? item.sender._id : item.sender) === user._id;
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
                                                            className={`chat-bubble ${isMe ? "my-text" : "friend-text"} ${activeMessageId === item._id ? 'active' : 'not-active'}`}
                                                            onMouseOver={()=>{
                                                                setActiveMessageId(item._id)
                                                            }}
                                                            onMouseLeave={()=>setActiveMessageId(null)}
                                                        >
                                                            {item.text}
                                                        </li>
                                                        <span>{time()}</span>
                                                    </div>

                                                </div>
                                            );
                                    })}
                                    <div ref={messagesEndRef} />
                                </ul>
                                {lastBySender && (
                                    <div>
                                        
                                        {(()=>{
                                            const currentRoomDoc = rooms.find(r => r.roomId === room);
                                            if(!currentRoomDoc){
                                                console.log("no current room doc");
                                                return null;
                                            }
                                            if(currentRoomDoc.otherUser.lastReadMessageId?.toString() >= messages[messages.length -1]._id.toString()){
                                                console.log("seen")
                                                return "Seen";
                                            }
                                            else return "delivered"
                                        })()}
                                    </div>
                                )}
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