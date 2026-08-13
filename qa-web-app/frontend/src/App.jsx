import React, { useState } from 'react';
import NewRunScreen from './screens/NewRunScreen.jsx';
import RegionsScreen from './screens/RegionsScreen.jsx';
import QuotasScreen from './screens/QuotasScreen.jsx';
import ReportsScreen from './screens/ReportsScreen.jsx';
import SettingsScreen from './screens/SettingsScreen.jsx';
import RunProgressScreen from './screens/RunProgressScreen.jsx';
import CleanupScreen from './screens/CleanupScreen.jsx';

const NAV_ITEMS = [
  {
    id: 'quotas',
    label: 'Quotas',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 1L2 4v4c0 3.31 2.55 6.41 6 7 3.45-.59 6-3.69 6-7V4L8 1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
        <path d="M5.5 8l1.5 1.5L10.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'regions',
    label: 'Regions',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
        <ellipse cx="8" cy="8" rx="2.5" ry="6.5" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="1.5" y1="8" x2="14.5" y2="8" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    id: 'new-run',
    label: 'New Run',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 2.5l9 5.5-9 5.5V2.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
      </svg>
    ),
  },
  {
    id: 'run-progress',
    label: 'Run Progress',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polyline points="1,11 5,7 8,9 12,4 15,6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2.5" y="1.5" width="11" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="5" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="5" y1="9" x2="11" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="5" y1="12" x2="8" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'cleanup',
    label: 'Cleanup',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polyline points="2,4 14,4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M5 4V2.5h6V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="3" y="4" width="10" height="9.5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="6.5" y1="7" x2="6.5" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="9.5" y1="7" x2="9.5" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M2.93 2.93l1.06 1.06M12.01 12.01l1.06 1.06M2.93 13.07l1.06-1.06M12.01 3.99l1.06-1.06" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
];

const styles = {
  layout: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
  },
  sidebar: {
    width: '220px',
    minWidth: '220px',
    background: '#1A1D23',
    display: 'flex',
    flexDirection: 'column',
    padding: '0',
  },
  sidebarHeader: {
    padding: '20px 16px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  sidebarTitle: {
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: '600',
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
    opacity: 0.7,
  },
  nav: {
    flex: 1,
    padding: '8px 0',
    overflowY: 'auto',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    background: '#F5F6F8',
  },
  comingSoon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#94A3B8',
    fontSize: '14px',
  },
};

function NavItem({ item, active, onClick }) {
  const [hovered, setHovered] = useState(false);

  const navItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '9px 16px',
    cursor: 'pointer',
    borderRadius: '0',
    color: active ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
    background: active
      ? 'rgba(0,102,255,0.18)'
      : hovered
      ? 'rgba(255,255,255,0.05)'
      : 'transparent',
    borderLeft: active ? '2px solid #0066FF' : '2px solid transparent',
    fontSize: '13px',
    fontWeight: active ? '500' : '400',
    userSelect: 'none',
    transition: 'background 0.1s, color 0.1s',
  };

  return (
    <div
      style={navItemStyle}
      onClick={() => onClick(item.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {item.icon}
      </span>
      {item.label}
    </div>
  );
}

export default function App() {
  const [activeScreen, setActiveScreen] = useState('regions');

  function renderScreen() {
    if (activeScreen === 'regions') {
      return <RegionsScreen />;
    }
    if (activeScreen === 'quotas') {
      return <QuotasScreen onNavigate={setActiveScreen} />;
    }
    if (activeScreen === 'new-run') {
      return <NewRunScreen onNavigate={setActiveScreen} />;
    }
    if (activeScreen === 'run-progress') {
      return <RunProgressScreen />;
    }
    if (activeScreen === 'reports') {
      return <ReportsScreen />;
    }
    if (activeScreen === 'cleanup') {
      return <CleanupScreen />;
    }
    if (activeScreen === 'settings') {
      return <SettingsScreen />;
    }
    return (
      <div style={styles.comingSoon}>
        Coming soon
      </div>
    );
  }

  return (
    <div style={styles.layout}>
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.sidebarTitle}>QA Tool</div>
        </div>
        <nav style={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              active={activeScreen === item.id}
              onClick={setActiveScreen}
            />
          ))}
        </nav>
      </aside>
      <main style={styles.content}>
        {renderScreen()}
      </main>
    </div>
  );
}
