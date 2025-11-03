// Form component with multiple vulnerabilities
import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface FormData {
  name: string;
  email: string;
  message: string;
  file?: File;
}

export function VulnerableForm() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    message: '',
  });
  const [results, setResults] = useState<any[]>([]);

  // ISSUE: Memory leak - event listener never removed
  useEffect(() => {
    window.addEventListener('scroll', () => {
      console.log('Scrolling...');
    });
  }, []);

  // ISSUE: No input validation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ISSUE: Sending sensitive data in URL
    const response = await axios.get(
      `http://api.example.com/submit?name=${formData.name}&email=${formData.email}&message=${formData.message}`
    );
    
    // ISSUE: eval on response data
    eval(`var result = ${JSON.stringify(response.data)}`);
    
    setResults([...results, response.data]);
  };

  // ISSUE: No file type validation
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // ISSUE: No size limit check
      const reader = new FileReader();
      reader.onload = (event) => {
        // ISSUE: Executing file content
        const script = document.createElement('script');
        script.textContent = event.target?.result as string;
        document.body.appendChild(script);
      };
      reader.readAsText(file);
    }
  };

  // ISSUE: SQL injection in search
  const handleSearch = async (searchTerm: string) => {
    const query = `SELECT * FROM users WHERE name LIKE '%${searchTerm}%'`;
    // Would send this to backend
    console.log(query);
  };

  // ISSUE: Direct innerHTML usage
  const renderResults = () => {
    return (
      <div>
        {results.map((result, index) => (
          <div 
            key={index}
            dangerouslySetInnerHTML={{ __html: result.content }}
          />
        ))}
      </div>
    );
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Name"
        />
        <input
          type="text" // ISSUE: Email field as text
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="Email"
        />
        <textarea
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          placeholder="Message"
        />
        
        {/* ISSUE: File input without validation */}
        <input
          type="file"
          onChange={handleFileUpload}
          accept="*/*" // Accepts all file types
        />
        
        <button type="submit">Submit</button>
      </form>

      {/* ISSUE: Search without debouncing or validation */}
      <input
        type="text"
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search users"
      />

      {renderResults()}

      {/* ISSUE: Inline event handler with user data */}
      <button onClick={() => eval(formData.message)}>
        Execute Message
      </button>
    </div>
  );
}

// ISSUE: Exposing API endpoint
export const API_ENDPOINT = 'http://insecure-api.example.com';
export const API_KEY = 'hardcoded-api-key-12345';

