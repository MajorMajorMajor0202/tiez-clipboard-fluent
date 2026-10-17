import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import type { ToastItem } from "../types";

interface ToastContainerProps {
  toasts: ToastItem[];
}

const ToastContainer = ({ toasts }: ToastContainerProps) => (
  <div className="toast-container">
    <AnimatePresence>
      {toasts.map((toast) => (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95, transition: { duration: 0.15 } }}
          transition={{ type: "spring", stiffness: 450, damping: 30 }}
          className="toast-item"
        >
          <Check size={13} strokeWidth={2.6} className="toast-icon" />
          <span className="toast-msg">{toast.msg}</span>
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

export default ToastContainer;
