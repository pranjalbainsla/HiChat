import { useEffect } from "react";
import { useState, useRef} from "react";
import { Link, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'

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

    useEffect(()=>{
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

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
        const token = localStorage.getItem('token');

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
        console.log("comp mounted")
        const token = localStorage.getItem('token')
        //connect socket as chat page loads
        const socket = io("http://localhost:3000", {
            transports: ["websocket"],
            auth: {
                token: token
            }
        });
        //this socket contains the user because we sent the token with the handshake, and you can access it by socket.user
        socketRef.current = socket;

        socket.on('sendUser', (serveruser)=>{
            setUser(serveruser);
        })

        //fetch the previous messages, instead of doing this we'll be fetching rooms, make a get rooms endpoint in chat.js
        fetchAllUsers(token);

        socket.on("connect_error", (err) => {
            console.error("Socket connection error:", err.message);

            if (err.message === "Authentication failed" || err.message === "Token expired") {
                localStorage.removeItem("token");
                navigate('/');
            }
        });
        
        /// socket.emit("join_room", room);

        // listen for messages (you can try shifting it to the second useEffect)
        socket.on("receive_message", (data) => {
            if(data.room === room){
                setMessages((prev) => [...prev, data]); //data is the message document as a whole, we need to see if we can just send the message object
            }
        });

        return () => {
            console.log("comp unmounted");
            socket.disconnect();
            console.log("socket disconnected");
        };
    }, []);
    //fetch messages for a particular room when room changes 
    useEffect(()=>{
        if(room === null) return;
        const token = localStorage.getItem('token');
        fetch(`http://localhost:3000/api/chat/messages/${room}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
            .then(res => res.json())
            .then(data => setMessages(data));

        const socket = socketRef.current;
        //tell the server side to join this room when the user clicks on a room
        socket.emit("join_room", room);


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
            setMessages((prev) => [...prev, newMsg]);
            setMessage("");
        }
    };
    function chatWithUser( otherUserId ){
        if(query !== "") setQuery("");
        const existing_chat = rooms.find(r => r.otherUser._id === otherUserId);
        if(existing_chat){
            setRoom(existing_chat.roomId); //change this
        }
        else{
            const token = localStorage.getItem('token');
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
                <div className="chat-list">
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
                            return <li key={item.roomId} className={item.roomId === room? 'current-chat' : 'normal-chat'} onClick={()=>chatWithUser(item.otherUser._id)}>
                                    <div className="friend-name">{item.otherUser.name}</div>
                                    <div style={{ fontSize: '14px', whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.lastMessage?.text}</div>
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
                                    {messages.map((item)=>{
                                        const isMe = (typeof item.sender === "object" ? item.sender._id : item.sender) === user._id;
                                            return (
                                            <li
                                                key={item._id}
                                                className={`chat-bubble ${isMe ? "my-text" : "friend-text"}`}
                                                
                                            >
                                                {item.text}
                                            </li>
                                            
                                            );
                                    })}
                                    <div ref={messagesEndRef} />
                                </ul>
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