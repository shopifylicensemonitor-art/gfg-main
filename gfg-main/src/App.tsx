import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense, useEffect, useState, useCallback } from "react";
import Index from "./pages/Index";
import { initCapacitor, isNativePlatform } from "./lib/capacitor";
import clarity from "@microsoft/clarity";
import PinModal from "./components/PinModal";

// Lazy-load non-critical routes for faster initial load
const Help = lazy(() => import("./pages/Help"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Tracker = lazy(() => import("./pages/Tracker"));
const NotFound = lazy(() => import("./pages/NotFound"));

// MailFlow Integrated Pages
const Accounts = lazy(() => import("./pages/Accounts"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const Templates = lazy(() => import("./pages/Templates"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Logs = lazy(() => import("./pages/Logs"));

// Use HashRouter in native apps (no server to handle URL paths),
// BrowserRouter on web where Netlify handles routing.
const Router = isNativePlatform() ? HashRouter : BrowserRouter;

const CLARITY_PROJECT_ID = "q6srfz9g0o";

// ---------------------------------------------------------------------------
// Security PIN Protected Route Wrapper
// ---------------------------------------------------------------------------
interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [verified, setVerified] = useState<boolean>(() => {
    return !!sessionStorage.getItem("access_pin");
  });

  const handleSuccess = (pin: string) => {
    sessionStorage.setItem("access_pin", pin);
    setVerified(true);
  };

  const handleCancel = () => {
    // Redirect back to home page if they cancel authentication
    window.location.href = "/";
  };

  if (!verified) {
    return (
      <PinModal 
        onSuccess={handleSuccess} 
        onCancel={handleCancel} 
        actionLabel="access secure administration dashboards" 
      />
    );
  }

  return <>{children}</>;
};

// ---------------------------------------------------------------------------
// App Entry Component
// ---------------------------------------------------------------------------
const App = () => {
  // Global PinModal overrides for inline actions
  const [showActionPinModal, setShowActionPinModal] = useState<boolean>(false);
  const [actionLabel, setActionLabel] = useState<string>("");
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const requirePin = useCallback((label: string, action: () => void) => {
    if (sessionStorage.getItem("access_pin")) {
      action();
      return;
    }
    setActionLabel(label);
    setPendingAction(() => action);
    setShowActionPinModal(true);
  }, []);

  const handleActionSuccess = (pin: string) => {
    sessionStorage.setItem("access_pin", pin);
    setShowActionPinModal(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const handleActionCancel = () => {
    setShowActionPinModal(false);
    setPendingAction(null);
  };

  useEffect(() => {
    initCapacitor();
    
    // Initialize Microsoft Clarity tracking in production environments
    if (import.meta.env.PROD) {
      clarity.init(CLARITY_PROJECT_ID);
    }
  }, []);

  return (
    <TooltipProvider>
      <Toaster />
      
      {/* Action-level PIN Gate */}
      {showActionPinModal && (
        <PinModal
          onSuccess={handleActionSuccess}
          onCancel={handleActionCancel}
          actionLabel={actionLabel}
        />
      )}

      <Router>
        <Suspense fallback={<div className="flex items-center justify-center h-screen text-muted-foreground bg-background">Loading...</div>}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/tracker" element={<Tracker />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/help" element={<Help />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            
            {/* Protected MailFlow routes */}
            <Route 
              path="/accounts" 
              element={
                <ProtectedRoute>
                  <Accounts requirePin={requirePin} />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/campaigns" 
              element={
                <ProtectedRoute>
                  <Campaigns requirePin={requirePin} />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/templates" 
              element={
                <ProtectedRoute>
                  <Templates requirePin={requirePin} />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/contacts" 
              element={
                <ProtectedRoute>
                  <Contacts requirePin={requirePin} />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/logs" 
              element={
                <ProtectedRoute>
                  <Logs />
                </ProtectedRoute>
              } 
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Router>
    </TooltipProvider>
  );
};

export default App;
