import { LogIn, UserPlus, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AuthGateModal({ open, onClose }: Props) {
  const { login, signup } = useAuth();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-5"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full flex flex-col items-center gap-5 p-7"
        style={{ maxWidth: 340, animation: "ag-in 0.22s cubic-bezier(0.34,1.26,0.64,1) both" }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full text-[#9CA3AF] hover:text-[#1A1A1A] hover:bg-[#F4F6FA] transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon badge */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1E90FF] to-[#0055cc] flex items-center justify-center shadow-lg shadow-[#1E90FF]/30">
          <LogIn className="w-8 h-8 text-white" />
        </div>

        {/* Copy */}
        <div className="text-center space-y-1.5">
          <h3 className="text-lg font-bold text-[#1A1A1A]">Ready to trade?</h3>
          <p className="text-sm text-[#6B7280] leading-snug">
            Log in or sign up to trade with us
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-3 w-full">
          <button
            data-testid="auth-gate-login"
            onClick={() => { onClose(); login(); }}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-white bg-[#1E90FF] hover:bg-[#1a7fe0] active:scale-[0.98] rounded-xl transition-all shadow-md shadow-[#1E90FF]/25"
          >
            <LogIn className="w-4 h-4" />
            Log In
          </button>

          <button
            data-testid="auth-gate-signup"
            onClick={() => { onClose(); signup(); }}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-[#1E90FF] border-2 border-[#1E90FF] hover:bg-[#EFF6FF] active:scale-[0.98] rounded-xl transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Sign Up
          </button>
        </div>

        <button
          onClick={onClose}
          className="text-xs text-[#9CA3AF] hover:text-[#6B7280] transition-colors mt-1"
        >
          Maybe later
        </button>
      </div>

      <style>{`
        @keyframes ag-in {
          from { opacity: 0; transform: scale(0.88) translateY(10px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
      `}</style>
    </div>
  );
}
