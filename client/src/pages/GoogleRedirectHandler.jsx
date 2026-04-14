import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { storage } from "../utils/storage";

const GoogleRedirectHandler = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      console.error("No token found");
      navigate("/");
      return;
    }

    try {
      storage.setItem("token", token);
      navigate("/chat");
    } catch (err) {
      console.error("Error handling token:", err);
      navigate("/");
    }
  }, [navigate, searchParams]);

  return <p>Logging you in...</p>;
};

export default GoogleRedirectHandler;