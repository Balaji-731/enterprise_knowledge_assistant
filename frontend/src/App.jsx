import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardPage from './components/DashboardPage';
import ChatInterface from './components/ChatInterface';
import HybridSearchTab from './components/HybridSearchTab';
import DocumentManager from './components/DocumentManager';
import UserManagementPage from './components/UserManagementPage';
import AuditDashboard from './components/AuditDashboard';
import PolicyExplorer from './components/PolicyExplorer';
import ConfirmDialog from './components/ui/ConfirmDialog';
import { Shield, Loader2 } from 'lucide-react';

function AuthenticatedApp() {
  const { logout } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [pendingAssistantPrompt, setPendingAssistantPrompt] = useState(null);

  function handleAskAboutDocument(docTitle) {
    setPendingAssistantPrompt(`Summarize the key policies and requirements in ${docTitle}.`);
    setActiveTab('chat');
  }

  function confirmSignOut() {
    setSignOutConfirmOpen(false);
    logout();
    showToast('Signed out of TechNova session', 'info');
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex font-sans antialiased text-slate-900">
      {/* Dark Navy Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
      />

      {/* Right Main Layout */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          onRequestSignOut={() => setSignOutConfirmOpen(true)}
        />

        <main className="flex-1 overflow-y-auto flex flex-col">
          {activeTab === 'dashboard' && (
            <DashboardPage
              onNavigate={setActiveTab}
              onAskAboutDocument={handleAskAboutDocument}
            />
          )}
          {activeTab === 'chat' && (
            <ChatInterface
              initialPrompt={pendingAssistantPrompt}
              onConsumeInitialPrompt={() => setPendingAssistantPrompt(null)}
            />
          )}
          {activeTab === 'search' && <HybridSearchTab />}
          {activeTab === 'documents' && (
            <DocumentManager onAskAboutDocument={handleAskAboutDocument} />
          )}
          {activeTab === 'users' && (
            <UserManagementPage onRequestSignOut={() => setSignOutConfirmOpen(true)} />
          )}
          {activeTab === 'audit' && (
            <AuditDashboard onRequestSignOut={() => setSignOutConfirmOpen(true)} />
          )}
          {activeTab === 'policy' && <PolicyExplorer />}
        </main>
      </div>

      {/* Sign Out Confirm Dialog */}
      <ConfirmDialog
        isOpen={signOutConfirmOpen}
        title="Sign Out"
        message="Are you sure you want to end your authenticated TechNova session? To access another role or account, you must sign in again."
        confirmLabel="Sign Out"
        variant="danger"
        onConfirm={confirmSignOut}
        onCancel={() => setSignOutConfirmOpen(false)}
      />
    </div>
  );
}

function RootApp() {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center space-y-3 text-slate-500 font-sans">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div className="flex items-center space-x-2 text-xs text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span>Verifying authentication session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <AuthenticatedApp />;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <RootApp />
      </AuthProvider>
    </ToastProvider>
  );
}
