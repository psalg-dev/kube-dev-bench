import React from 'react';
import FooterBar from './FooterBar.jsx';
import SidebarSections from './SidebarSections.jsx';

/**
 * AppLayout replicates the previously imperative HTML structure so existing logic
 * that queries by id (#kubecontext-root, #namespace-root, #sidebar-sections, etc.) continues to work.
 * Future phases will replace these id-based mutations with declarative React state.
 */
export function AppLayout({ contextSelectEl, namespaceSelectEl, selectedSection, onSelectSection }) {
  return (
    <div id="layout">
      <aside id="sidebar">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
          <span style={{fontSize:14, color:'var(--gh-text-secondary, #ccc)'}}>Connection</span>
          <button id="show-wizard-btn" style={{background:'transparent', border:'1px solid var(--gh-border, #444)', color:'var(--gh-text-secondary, #ccc)', padding:'4px 8px', borderRadius:0, cursor:'pointer', fontSize:12}} title="Show Connection Wizard">⚙️</button>
        </div>
        <label htmlFor="kubecontext-root">Context:</label>
        <div className="input" id="kubecontext-root">{contextSelectEl}</div>
        <label htmlFor="namespace-root">Namespaces:</label>
        <div className="input" id="namespace-root">{namespaceSelectEl}</div>
        <hr className="sidebar-separator" />
        <div id="sidebar-sections" style={{flex:1}}>
          <SidebarSections selected={selectedSection} onSelect={onSelectSection} />
        </div>
        <button id="sidebar-toggle" title="Collapse Sidebar">
          <span>◀</span>
          <span>Hide Sidebar</span>
        </button>
      </aside>
      <main id="maincontent">
        <div id="error-container" />
        <div id="main-panels" />
      </main>
      <footer id="footer">
        <FooterBar />
      </footer>
    </div>
  );
}

export default AppLayout;
