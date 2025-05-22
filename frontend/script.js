const startButton = document.getElementById('startButton');
const resetButton = document.getElementById('resetButton');
const transcriptArea = document.getElementById('transcriptArea');
const functionCallArea = document.getElementById('functionCallArea');
const statusArea = document.getElementById('statusArea');
const copyTranscriptButton = document.getElementById('copyTranscriptButton');

// Hide unused buttons from original WebRTC attempt
const originalStopButton = document.getElementById('stopButton');
const pauseButton = document.getElementById('pauseButton');
const resumeButton = document.getElementById('resumeButton');
if (originalStopButton) originalStopButton.style.display = 'none';
if (pauseButton) pauseButton.style.display = 'none';
if (resumeButton) resumeButton.style.display = 'none';

const BACKEND_URL = 'http://localhost:8000';
let recognition;
let final_transcript = '';
let isRecognizing = false;

function logStatus(message) {
    console.log(message);
    statusArea.textContent = `Status: ${message}`;
}

function setupWebSpeechAPI() {
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!window.SpeechRecognition) {
        logStatus("Speech Recognition API not supported. Try Chrome or Edge.");
        startButton.disabled = true;
        return false;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US'; // Or your preferred language

    recognition.onstart = () => {
        isRecognizing = true;
        logStatus("Listening... Speak now.");
        startButton.textContent = 'Stop Listening';
        updateUIForRecognitionState(true);
    };

    recognition.onresult = (event) => {
        let interim_transcript = '';
        let justFinalizedUtterance = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcriptPart = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                final_transcript += transcriptPart.trim() + '. '; // Add a period and space for sentence separation
                justFinalizedUtterance = transcriptPart.trim();
            } else {
                interim_transcript += transcriptPart;
            }
        }
        transcriptArea.innerHTML = `<p>${final_transcript}${interim_transcript}</p>`;
        transcriptArea.scrollTop = transcriptArea.scrollHeight;
        
        copyTranscriptButton.disabled = !(final_transcript || interim_transcript);

        if (justFinalizedUtterance) {
            triggerFunctionCallProcessing(justFinalizedUtterance);
        }
    };

    recognition.onerror = (event) => {
        logStatus(`Speech recognition error: ${event.error}`);
        console.error("Speech recognition error details:", event);
        if (event.error === 'no-speech') logStatus("No speech detected. Try speaking louder or closer.");
        else if (event.error === 'audio-capture') logStatus("Microphone problem. Ensure it's working.");
        else if (event.error === 'not-allowed') logStatus("Microphone access denied by user.");
        stopRecognition(); // Stop on error
    };

    recognition.onend = () => {
        isRecognizing = false;
        // Only update status if it wasn't an intentional stop that will immediately restart
        if (startButton.textContent === 'Stop Listening') { // Check if we were expecting it to stop
             logStatus("Listening stopped.");
        }
        updateUIForRecognitionState(false);
    };
    return true;
}

function startOrStopRecognition() {
    if (!recognition) { // First time setup
        if (!setupWebSpeechAPI()) return;
    }

    if (isRecognizing) {
        stopRecognition();
    } else {
        // Clear previous results for a new session
        final_transcript = '';
        transcriptArea.innerHTML = '';
        functionCallArea.innerHTML = '<p><em>Function calls will appear here...</em></p>';
        copyTranscriptButton.disabled = true;

        // Check for microphone permission before starting
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                // We have permission. Stop the temporary stream as Web Speech API handles its own.
                stream.getTracks().forEach(track => track.stop());
                recognition.start();
            })
            .catch(err => {
                console.error("Mic permission error before starting recognition:", err);
                logStatus("Microphone permission denied. Please enable it in browser settings.");
                updateUIForRecognitionState(false);
            });
    }
}

function stopRecognition() {
    if (recognition && isRecognizing) {
        recognition.stop(); // This will trigger recognition.onend
    }
    // State update will happen in recognition.onend
}

function updateUIForRecognitionState(isCurrentlyRecognizing) {
    isRecognizing = isCurrentlyRecognizing; // Ensure global state is consistent
    startButton.textContent = isRecognizing ? 'Stop Listening' : 'Start Listening';
    startButton.disabled = false; // Always enable the toggle button
    resetButton.disabled = isRecognizing; // Disable reset while listening
    copyTranscriptButton.disabled = isRecognizing || transcriptArea.textContent.trim() === "";
}


async function triggerFunctionCallProcessing(text) {
    if (!text.trim()) return;
    console.log("Finalized text to send to backend:", text);
    
    // Display processing message immediately in function call area
    const currentFunctionCallContent = functionCallArea.innerHTML;
    if (currentFunctionCallContent.includes("<em>Function calls will appear here...</em>")) {
        functionCallArea.innerHTML = ''; // Clear initial placeholder
    }
    const processingP = document.createElement('p');
    processingP.innerHTML = `<em>Processing: "${text}" for function call...</em>`;
    functionCallArea.appendChild(processingP);
    functionCallArea.scrollTop = functionCallArea.scrollHeight;

    try {
        const response = await fetch(`${BACKEND_URL}/process-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify({ text: text }),
        });

        // Remove processing message
        functionCallArea.removeChild(processingP);

        if (!response.ok) {
            let errorDetail = `Backend error: ${response.status}`;
            try { const errorData = await response.json(); errorDetail = errorData.detail || errorDetail; }
            catch (e) { /* ignore if not json */ }
            throw new Error(errorDetail);
        }

        const functionCallResults = await response.json();

        if (functionCallResults && functionCallResults.length > 0) {
            logStatus("Function call(s) received from backend.");
            functionCallResults.forEach(result => {
                displayFunctionCallData(result.function_name, result.arguments);
            });
        } else {
            logStatus("No function call identified by AI.");
            const noCallP = document.createElement('p');
            noCallP.innerHTML = `<em>AI analysis for "${text}": No function call.</em>`;
            functionCallArea.appendChild(noCallP);
            functionCallArea.scrollTop = functionCallArea.scrollHeight;
        }

    } catch (error) {
        console.error("Error processing text with backend:", error);
        logStatus(`Function call error: ${error.message}`);
        if (functionCallArea.contains(processingP)) { // Ensure processingP exists before trying to remove
            functionCallArea.removeChild(processingP);
        }
        const errorP = document.createElement('p');
        errorP.innerHTML = `<em>Error during function call processing: ${error.message}</em>`;
        functionCallArea.appendChild(errorP);
        functionCallArea.scrollTop = functionCallArea.scrollHeight;
    }
}

function displayFunctionCallData(functionName, argumentsObject) {
    const callDiv = document.createElement('div');
    callDiv.style.borderBottom = "1px solid #eee"; // Add separator
    callDiv.style.marginBottom = "10px";
    callDiv.style.paddingBottom = "10px";
    callDiv.innerHTML = `
        <p><strong>Function:</strong> ${functionName}</p>
        <p><strong>Arguments:</strong></p>
        <code>${JSON.stringify(argumentsObject, null, 2)}</code>
    `;
    functionCallArea.appendChild(callDiv);
    functionCallArea.scrollTop = functionCallArea.scrollHeight;
}

// Initial Setup
logStatus("Ready. Click 'Start Listening' to begin.");
if (!setupWebSpeechAPI()) {
    // Error is logged by setupWebSpeechAPI
}
updateUIForRecognitionState(false);

// Event Listeners
startButton.addEventListener('click', startOrStopRecognition);

resetButton.addEventListener('click', () => {
    if (isRecognizing) stopRecognition(); // Stop if listening
    final_transcript = '';
    transcriptArea.innerHTML = '';
    functionCallArea.innerHTML = '<p><em>Function calls will appear here...</em></p>';
    logStatus('Transcript and results cleared.');
    updateUIForRecognitionState(false); // Reset button states
    copyTranscriptButton.disabled = true;
});

copyTranscriptButton.addEventListener('click', () => {
    const textToCopy = transcriptArea.textContent;
    if (textToCopy && textToCopy.trim() !== "") {
        navigator.clipboard.writeText(textToCopy.trim())
            .then(() => logStatus('Transcript copied to clipboard!'))
            .catch(err => { console.error('Failed to copy transcript: ', err); logStatus('Failed to copy.'); });
    } else {
        logStatus('Nothing in transcript to copy.');
    }
});