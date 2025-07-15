import { useState } from "react"
import { Link, useNavigate } from 'react-router-dom'

function Signup(){
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const navigate = useNavigate()
    
    async function handleSignup(){
        const res = await fetch('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
        })
        const data = await res.json()
        alert(data.message)
        if(data.message === 'User created'){
            navigate('/')
        }
        setName("")
        setEmail("")
        setPassword("")
    }
    return(
        <div>
            <h2>Sign-up page</h2>
            <input type='text' placeholder='name' name='name' value={name} onChange={(e)=>setName(e.target.value)} autoComplete="name" />
            <input type='text' placeholder='email' name='email' value={email} onChange={(e)=>setEmail(e.target.value)} autoComplete="email" />
            <input type='password' placeholder='password' name='password' value={password} onChange={(e)=>setPassword(e.target.value)} autoComplete='current-password' />
            <button type='button' onClick={handleSignup}>Sign-up</button>
            <Link to='/'>Login instead?</Link>
        </div>
    );
}

export default Signup