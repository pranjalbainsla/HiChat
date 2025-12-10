import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { storage } from "../utils/storage";

function GoogleRedirectHandler(){
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    useEffect(()=>{
        const token = new URLSearchParams(window.location.search).get('token');
        console.log("token is-> " + token);
        if (token) {
        try {
            /* Optionally verify basic structure of token
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (payload?.id)*/
            storage.setItem('token', token);
            console.log('token:', token);
            setTimeout(() => navigate("/chat"), 100);
        } catch (err) {
            console.error("Error decoding token:", err);
            alert("Something went wrong.");
            navigate("/");
        }
        } else {
        alert("No token found in URL.");
        navigate("/");
        }

        setLoading(false);
    }, []);

    return (
        <p>Logging you in...</p>
    );
}

export default GoogleRedirectHandler;