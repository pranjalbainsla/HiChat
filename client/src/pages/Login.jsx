import { useEffect } from "react"
import { useState } from "react"
import { Link, useNavigate } from 'react-router-dom'

function Login(){
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const navigate = useNavigate()

    useEffect(()=>{
        localStorage.removeItem('token')
        console.log("token discarded")
    }, [])
    async function handleLogin(){
        const res = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
        })
        const data = await res.json()
        if(data.message) alert(data.message)
        if(data.token){
            localStorage.setItem('token', data.token)
            console.log("token: ", data.token )
            setEmail("")
            setPassword("")
            navigate('/chat')
        }
        
    }
    return(
        <div>
            <h2>login page</h2>
            <input type='text' placeholder='email' name='email' value={email} onChange={(e)=>setEmail(e.target.value)} autoComplete="email" />
            <input type='password' placeholder='password' name='password' value={password} onChange={(e)=>setPassword(e.target.value)} autoComplete='current-password' />
            <button type='button' onClick={handleLogin}>Login</button>

            <Link to='/signup'>Go to Sign-up</Link>
        </div>
    );
}

export default Login