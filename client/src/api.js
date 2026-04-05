const API_URL = import.meta.env.VITE_API_URL;


// helper that makes calling our backend easier, i just have to call api() now instead of 
export const api = async (endpoint, options = {}) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
        headers: {
            "Content-Type": "application/json",
            ...options.headers,
        },
        ...options,
    });

    if (!res.ok) {
        throw new Error(`API Error: ${res.status}`);
    }

    return res.json();
};
