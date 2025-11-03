// Component with multiple XSS vulnerabilities and bad practices
import React, { useState, useEffect } from 'react';

interface UserProfileProps {
  userId: string;
}

export function InsecureUserProfile({ userId }: UserProfileProps) {
  const [userData, setUserData] = useState<any>(null);
  const [htmlContent, setHtmlContent] = useState('');
  
  useEffect(() => {
    // ISSUE: No cleanup, potential memory leak
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(data => setUserData(data));
    
    // ISSUE: Interval never cleared
    setInterval(() => {
      console.log('Checking user status');
    }, 1000);
  }, [userId]);
  
  // ISSUE: XSS vulnerability - dangerouslySetInnerHTML
  const renderUserBio = () => {
    return <div dangerouslySetInnerHTML={{ __html: userData?.bio }} />;
  };
  
  // ISSUE: Direct DOM manipulation with user input
  const updateTitle = (title: string) => {
    document.getElementById('user-title')!.innerHTML = title;
  };
  
  // ISSUE: eval usage
  const executeUserScript = (script: string) => {
    eval(script);
  };
  
  // ISSUE: No input validation
  const handleCommentSubmit = (comment: string) => {
    const commentDiv = document.createElement('div');
    commentDiv.innerHTML = comment; // XSS vulnerability
    document.getElementById('comments')?.appendChild(commentDiv);
  };
  
  // ISSUE: Insecure cookie handling
  const saveUserPreferences = (prefs: string) => {
    document.cookie = `prefs=${prefs}; path=/`;
  };
  
  if (!userData) return <div>Loading...</div>;
  
  return (
    <div>
      <div id="user-title"></div>
      {/* ISSUE: Rendering unsanitized user input */}
      <h1>{userData.name}</h1>
      <div>{renderUserBio()}</div>
      
      {/* ISSUE: onClick with inline eval */}
      <button onClick={() => eval(userData.customAction)}>
        Custom Action
      </button>
      
      {/* ISSUE: href with javascript: protocol */}
      <a href={`javascript:${userData.link}`}>Click me</a>
      
      {/* ISSUE: Unsanitized HTML */}
      <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
      
      <div id="comments"></div>
      
      <input 
        type="text" 
        onChange={(e) => updateTitle(e.target.value)}
        placeholder="Update title"
      />
      
      <input 
        type="text"
        onChange={(e) => executeUserScript(e.target.value)}
        placeholder="Run script"
      />
    </div>
  );
}

// ISSUE: Exposing sensitive data in global scope
(window as any).userData = null;
(window as any).apiKey = 'exposed-api-key-12345';

