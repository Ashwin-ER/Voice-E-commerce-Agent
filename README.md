# Real-Time Voice-Powered E-commerce Agent (Browser Speech API Version)

This project demonstrates a voice-powered E-commerce agent.
This version uses:

1. The **Browser's Web Speech API** for real-time voice capture and live transcription directly in the frontend.
2. A Python FastAPI backend that receives the transcribed text.
3. The backend then calls **OpenAI's Chat Completions API** (e.g., `gpt-4o`) with the text and a defined `filter_products` tool to simulate an E-commerce agent's function calling capability.
4. The frontend displays the function call results (e.g., arguments for `filter_products`) if the AI decides to use the tool.

**Note:** This version does *not* use OpenAI's Realtime API with WebRTC for transcription due to encountered difficulties with the preview state of that API (e.g., missing `iceServers`, unclear signaling endpoints). This adapted solution focuses on demonstrating the core voice-to-function-call flow.

## Features:

- Captures voice from the user in real-time (via Browser Web Speech API).
- Streams live transcription in the browser.
- Calls OpenAI's Chat Completions API via a backend to perform function calling based on transcribed voice commands (using the `filter_products` tool).
- Displays the function call arguments in the UI.

## Tech Stack:

- **Backend:** Python (FastAPI)
- **Frontend:** Vanilla JavaScript, HTML, CSS
- **AI for Transcription:** Browser's Web Speech API (e.g., Chrome, Edge)
- **AI for Function Calling:** OpenAI Chat Completions API (e.g., `gpt-4o`, `gpt-3.5-turbo`)


## Setup

### Prerequisites

- Python 3.8+
- An OpenAI API Key (Standard User API Key, e.g., `sk-...`) with access to Chat Completions models like `gpt-4o` or `gpt-3.5-turbo`.
- A modern web browser that supports the Web Speech API (Google Chrome or Microsoft Edge are recommended for best compatibility).
- `pip` for Python package installation.
- (Optional) Node.js if you prefer to use `npx serve` for the frontend.

### Backend Setup

1. **Navigate to the `backend` directory:**
   ```bash
   cd backend
   ```
2. **Create and activate a virtual environment (recommended):**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
4. **Create a `.env` file** in the `backend` directory.
   Add your OpenAI API key to this file:
   ```env
   # backend/.env
   OPENAI_API_KEY="sk-YOUR_OPENAI_API_KEY_HERE"
   ```

   Replace `sk-YOUR_OPENAI_API_KEY_HERE` with your actual OpenAI Standard User API Key.
5. **Run the FastAPI server:**
   ```bash
   uvicorn main:app --reload
   ```

   The backend will be accessible at `http://localhost:8000`. Check the console output to ensure the OpenAI client initializes correctly.

### Frontend Setup

1. **Navigate to the `frontend` directory:**

   ```bash
   cd frontend
   ```
2. **Serve the `index.html` file.** You can use Python's built-in HTTP server:

   ```bash
   python -m http.server 8080
   ```

   (This will typically serve on `http://localhost:8080`)

   Alternatively, if you have Node.js and `npx` installed:

   ```bash
   npx serve .
   ```

   (This might serve on `http://localhost:5000` or another port; check the command's output.)
3. **Open the frontend URL** (e.g., `http://localhost:8080`) in your compatible web browser (Chrome or Edge recommended).

## Usage

1. Ensure the backend server is running and has successfully initialized the OpenAI client (check backend console logs).
2. Open the frontend page in your browser.
3. Click the **"Start Listening"** button.
4. Your browser will likely prompt you for **microphone access**. Grant permission.
5. Speak a command related to e-commerce filtering, for example:
   * "Show me red shoes under 50 dollars."
   * "I'm looking for blue shirts."
   * "Find electronics with the keyword wireless."
6. You will see a live transcription appear in the "Live Transcript (from Browser)" section.
7. When you pause speaking, the browser's speech recognition will finalize the utterance. This finalized text is then sent to the backend.
8. The backend sends this text to OpenAI's Chat Completions API, asking it to use the `filter_products` tool if appropriate.
9. If the AI decides to call the `filter_products` function, the extracted arguments (e.g., category, color, max_price) will be displayed in the "Function Call Results" section on the frontend. If no function call is triggered, a message indicating this will be shown.
10. Click the **"Stop Listening"** button (the same button as "Start Listening") to manually stop the voice recognition.
11. Use the **"Reset"** button to clear the transcript and function call results.
12. Use the **"Copy Transcript"** button to copy the displayed transcript.

## How It Works

* **Frontend (Browser Speech API):**

  * Uses `window.SpeechRecognition` to capture audio and convert it to text in real-time.
  * Displays interim and final transcriptions.
  * When an utterance is finalized, it makes a `POST` request to the backend's `/process-text` endpoint, sending the transcribed text.
  * Receives function call information (if any) from the backend and displays it.
* **Backend (FastAPI + OpenAI Chat Completions):**

  * The `/process-text` endpoint receives the transcribed text.
  * It initializes an OpenAI client using the API key from the `.env` file.
  * It calls the OpenAI Chat Completions API (e.g., `gpt-4o`) with:
    * A system message guiding the AI to act as an e-commerce assistant.
    * The user's transcribed text.
    * A `tools` definition for the `filter_products` function, describing its purpose and parameters (`category`, `color`, `max_price`, `keywords`).
  * If OpenAI's response includes `tool_calls` for `filter_products`, the backend extracts the function name and the arguments (which are provided by the AI as a JSON string and then parsed).
  * This function call information is sent back to the frontend.
  * **Note:** This backend does not *execute* the `filter_products` function with mock data. It only demonstrates extracting the arguments as if a real e-commerce API were to be called next.

## Example Voice Flow

1. User: "Show me blue t-shirts under 30 dollars."
2. Frontend (Web Speech API): Transcribes "Show me blue t-shirts under 30 dollars."
3. Frontend: Sends this text to the backend `/process-text`.
4. Backend: Calls OpenAI Chat Completions API.
5. OpenAI: Responds with a tool call for `filter_products` with arguments like:
   ```json
   {
     "category": "t-shirts",
     "color": "blue",
     "max_price": 30
   }
   ```
6. Backend: Sends these arguments back to the frontend.
7. Frontend: Displays:
   ```
   Function: filter_products
   Arguments:
   {
     "category": "t-shirts",
     "color": "blue",
     "max_price": 30
   }
   ```
