import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense, useEffect, useState, useCallback } from "react";
import Landing from "./pages/Landing";
import { initCapacitor, isNativePlatform } from "./lib/capacitor";
import { navigateToRoute } from "./lib/router";
import clarity from "@microsoft/clarity";

// Lazy-load non-critical routes for faster initial load
const Index = lazy(() => import("./pages/Index"));
const Help = lazy(() => import("./pages/Help"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Tracker = lazy(() => import("./pages/Tracker"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/Login"));

// Peak Xender Integrated Pages
const Accounts = lazy(() => import("./pages/Accounts"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const Templates = lazy(() => import("./pages/Templates"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Logs = lazy(() => import("./pages/Logs"));
const AISettings = lazy(() => import("./pages/AISettings"));
const Inbox = lazy(() => import("./pages/Inbox"));

const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));

// Use HashRouter in native apps (no server to handle URL paths),
// BrowserRouter on web where Netlify handles routing.
const Router = isNativePlatform() ? HashRouter : BrowserRouter;

const CLARITY_PROJECT_ID = "q6srfz9g0o";

// ---------------------------------------------------------------------------
// Security Protected Route Wrapper (JWT or PIN)
// ---------------------------------------------------------------------------
interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const token = localStorage.getItem("auth_token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// ---------------------------------------------------------------------------
// App Entry Component
// ---------------------------------------------------------------------------
const App = () => {
  const requirePin = useCallback((label: string, action: () => void) => {
    action();
  }, []);

  useEffect(() => {
    initCapacitor();
    
    // Initialize Microsoft Clarity tracking in production environments
    if (import.meta.env.PROD) {
      clarity.init(CLARITY_PROJECT_ID);
    }

    // Capture JWT token from OAuth callback redirect
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      localStorage.setItem("auth_token", token);
      const cleanUrl = `${window.location.pathname}${window.location.hash}`;
      window.history.replaceState({}, "", cleanUrl);
      navigateToRoute(window.location.pathname + window.location.hash, { replace: true });
    }
  }, []);

  return (
    <TooltipProvider>
      <Toaster />

      <Router>
        <Suspense fallback={<div className="flex items-center justify-center h-screen text-muted-foreground bg-background">Loading...</div>}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/help" element={<Help />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            
            {/* Protected Peak Xender routes */}
            <Route 
              path="/send" 
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/tracker" 
              element={
                <ProtectedRoute>
                  <Tracker />
                </ProtectedRoute>
              } 
            />
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
            <Route 
              path="/ai-settings" 
              element={
                <ProtectedRoute>
                  <AISettings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/inbox" 
              element={
                <ProtectedRoute>
                  <Inbox />
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
