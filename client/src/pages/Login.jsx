import { useEffect } from "react"
import { storage } from "../utils/storage"

function Login(){
    useEffect(()=>{
        storage.removeItem('token')
        console.log("token discarded")
    }, [])

    function handleLogin(){

        window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/google`;
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