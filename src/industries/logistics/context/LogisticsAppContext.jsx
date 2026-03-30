import { createContext, useContext, useEffect, useState } from "react";
import { getUploadConfig } from "@/industries/logistics/api/logisticsApi";

const logger = console;

// Create the context
const LogisticsAppContext = createContext();

// Custom hook to use the Logistics App Context
export const useLogisticsContext = () => {
  const context = useContext(LogisticsAppContext);
  if (!context) {
    throw new Error("useLogisticsContext must be used within LogisticsAppProvider");
  }
  return context;
};

// Logistics App Provider component
export const LogisticsAppProvider = ({ children }) => {
  // Chat history for AI Assistant page
  const [chatHistory, setChatHistory] = useState([]);

  // Resolved alerts (Set of alert IDs)
  const [resolvedAlerts, setResolvedAlerts] = useState(() => {
    try {
      const saved = localStorage.getItem("resolvedAlerts");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Database connection status
  const [dbConnected, setDbConnected] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadHealth = async () => {
      try {
        await getUploadConfig();
        if (isMounted) {
          setDbConnected(true);
        }
      } catch {
        if (isMounted) {
          setDbConnected(false);
        }
      }
    };

    loadHealth();

    return () => {
      isMounted = false;
    };
  }, []);

  // Add a message to chat history
  const addChatMessage = (message) => {
    setChatHistory((prev) => [...prev, message]);
  };

  // Clear chat history
  const clearChatHistory = () => {
    setChatHistory([]);
  };

  // Mark an alert as resolved
  const markAlertResolved = (alertId) => {
    setResolvedAlerts((prev) => {
      const newSet = new Set([...prev, alertId]);
      try {
        localStorage.setItem("resolvedAlerts", JSON.stringify([...newSet]));
      } catch {
        logger.warn("localStorage not available");
      }
      return newSet;
    });
  };

  // Mark an alert as unresolved
  const markAlertUnresolved = (alertId) => {
    setResolvedAlerts((prev) => {
      const newSet = new Set(prev);
      newSet.delete(alertId);
      try {
        localStorage.setItem("resolvedAlerts", JSON.stringify([...newSet]));
      } catch {}
      return newSet;
    });
  };

  // Check if an alert is resolved
  const isAlertResolved = (alertId) => {
    return resolvedAlerts.has(alertId);
  };

  const value = {
    chatHistory,
    setChatHistory,
    addChatMessage,
    clearChatHistory,
    resolvedAlerts,
    markAlertResolved,
    markAlertUnresolved,
    isAlertResolved,
    dbConnected,
    setDbConnected,
  };

  return <LogisticsAppContext.Provider value={value}>{children}</LogisticsAppContext.Provider>;
};

export default LogisticsAppContext;
