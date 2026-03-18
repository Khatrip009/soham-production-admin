import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiAlertCircle, FiHome } from "react-icons/fi";
import logo from "../assets/sohom_logo.png";
import "./NotFound.css"; // optional – you can also embed styles

export default function NotFound() {
  const navigate = useNavigate();

  // Optional: redirect after 10 seconds? Not needed, but could be added.

  return (
    <div className="not-found">
      <div className="not-found-card premium-card slide-up">
        <div className="not-found-icon">
          <FiAlertCircle />
        </div>
        <h1 className="not-found-code">404</h1>
        <h2 className="not-found-title">Page Not Found</h2>
        <p className="not-found-message">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <button
          className="not-found-btn btn-primary"
          onClick={() => navigate("/dashboard")}
        >
          <FiHome /> Back to Dashboard
        </button>
        <div className="not-found-logo">
          <img src={logo} alt="Soham Logo" />
        </div>
      </div>

      {/* STYLES */}
      <style>{`
        .not-found {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-main);
          font-family: "Nunito", sans-serif;
          padding: 1.5rem;
        }

        .not-found-card {
          max-width: 500px;
          width: 100%;
          text-align: center;
          padding: 3rem 2rem;
          background: white;
          border-radius: 32px;
          box-shadow: var(--shadow-soft);
          border: 1px solid var(--border);
          animation: fadeInUp 0.6s ease;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .not-found-icon {
          font-size: 5rem;
          color: var(--primary);
          margin-bottom: 1rem;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }

        .not-found-code {
          font-size: 6rem;
          font-weight: 800;
          color: var(--primary);
          line-height: 1;
          margin-bottom: 0.5rem;
          text-shadow: 0 4px 10px rgba(200, 159, 114, 0.3);
        }

        .not-found-title {
          font-size: 2rem;
          font-weight: 700;
          color: var(--text-main);
          margin-bottom: 1rem;
        }

        .not-found-message {
          color: var(--text-light);
          margin-bottom: 2rem;
          font-size: 1.1rem;
        }

        .not-found-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.9rem 2rem;
          font-size: 1.1rem;
          font-weight: 600;
          border-radius: 40px;
          background: var(--primary);
          color: white;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-bottom: 2rem;
          box-shadow: 0 4px 15px rgba(200, 159, 114, 0.3);
        }

        .not-found-btn:hover {
          background: var(--primary-dark);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(200, 159, 114, 0.4);
        }

        .not-found-btn:active {
          transform: translateY(0);
        }

        .not-found-logo img {
          max-width: 120px;
          opacity: 0.7;
        }

        /* Responsive */
        @media (max-width: 480px) {
          .not-found-code {
            font-size: 4rem;
          }
          .not-found-title {
            font-size: 1.5rem;
          }
          .not-found-message {
            font-size: 1rem;
          }
        }
      `}</style>
    </div>
  );
}