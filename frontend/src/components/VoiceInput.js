import React, { useState } from 'react';

const VoiceInput = ({ onResult }) => {
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

  const startListening = () => {
    if (!supported) {
      alert('Voice input is not supported in your browser. Please use Chrome.');
      return;
    }

    // Use browser's built-in speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = 'en-IN'; // Indian English
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onresult = (event) => {
      // Get the spoken text
      const spokenText = event.results[0][0].transcript;
      onResult(spokenText); // Send text back to parent form
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      alert('Could not hear you. Please try again.');
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.start();
  };

  return (
    <div style={styles.container}>
      <button
        type="button"
        onClick={startListening}
        style={listening ? styles.btnListening : styles.btn}
        title="Click to speak your job description"
      >
        {listening ? '🔴 Listening...' : '🎤 Speak Description'}
      </button>
      {!supported && (
        <p style={styles.warning}>
          ⚠️ Voice input requires Chrome browser.
        </p>
      )}
    </div>
  );
};

const styles = {
  container: {
    marginBottom: '14px',
  },
  btn: {
    backgroundColor: '#4f46e5',
    color: '#fff',
    border: 'none',
    padding: '10px 18px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    width: '100%',
  },
  btnListening: {
    backgroundColor: '#ef4444',
    color: '#fff',
    border: 'none',
    padding: '10px 18px',
    borderRadius: '8px',
    cursor: 'not-allowed',
    fontSize: '14px',
    width: '100%',
    animation: 'pulse 1s infinite',
  },
  warning: {
    color: '#ef4444',
    fontSize: '12px',
    marginTop: '6px',
  },
};

export default VoiceInput;