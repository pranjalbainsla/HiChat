import { useEffect } from "react"
import { storage } from "../utils/storage"

function Login(){
    useEffect(()=>{
        storage.removeItem('token')
        console.log("token discarded")
    }, [])

    function handleLogin(){
        window.location.href = "http://localhost:3000/api/auth/google";
        /*
        const res = await fetch('http://localhost:3000/api/auth/google')
        const data = await res.json()
        if(data.message) alert(data.message)
        if(data.token){
            localStorage.setItem('token', data.token)
            console.log("token: ", data.token )
            setEmail("")
            setPassword("")
            navigate('/chat')
        }
        */
    }
    return(
        <div className="login-bg">
            <div className="glass-box">
                <h2>Welcome!</h2>
                <button type='button' className='google-button' onClick={handleLogin}>
                    <img src='/images/google.png' className="google-icon" />
                    Sign in with Google
                </button>
            </div>    
        </div>
    );
}

export default Login