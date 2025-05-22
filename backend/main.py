import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
# from dotenv import load_dotenv # .env loading REMOVED for hardcoding
# from pathlib import Path       # .env loading REMOVED for hardcoding
from openai import OpenAI

# FastAPI App
app = FastAPI()

origins = [
    "http://localhost", "http://localhost:8080", "http://localhost:5000",
    "http://127.0.0.1:8080", "http://127.0.0.1:5000",
]
app.add_middleware(
    CORSMiddleware, allow_origins=origins, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# --- API Key HARDCODED ---
OPENAI_API_KEY = "open-ai-api-key" # Replace with your actual OpenAI API key
# --- Make sure this is your correct, working, STANDARD USER API KEY ---

OPENAI_CHAT_MODEL = "gpt-4o" # Or "gpt-3.5-turbo", or other capable model

client = None # Initialize client as None

if not OPENAI_API_KEY:
    print("CRITICAL ERROR: Hardcoded OPENAI_API_KEY is empty or not set!")
elif OPENAI_API_KEY.startswith("sk-proj-"):
    print(f"CRITICAL WARNING: The HARDCODED API Key is a PROJECT KEY: {OPENAI_API_KEY[:15]}... This will likely fail. Use a standard User API Key.")
else:
    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        print(f"OpenAI client initialized successfully with HARDCODED key: {OPENAI_API_KEY[:10]}... Using model: {OPENAI_CHAT_MODEL}")
    except Exception as e:
        print(f"Error initializing OpenAI client with hardcoded key: {e}")

# Function Definition
FUNCTION_NAME = "filter_products"
FUNCTION_DESCRIPTION = "Filters products in an online store based on user criteria."
FUNCTION_PARAMETERS = {
    "type": "object",
    "properties": {
        "category": {"type": "string", "description": "Product category, e.g. shoes, shirts, electronics, books"},
        "color": {"type": "string", "description": "Color of the product, e.g. red, blue, black"},
        "max_price": {"type": "number", "description": "Maximum price in USD, e.g. 50, 100.50"},
        "keywords": {"type": "string", "description": "Any other keywords or specific features mentioned by the user, e.g. 'leather', 'for running', 'wireless'"}
    },
    "required": ["category"]
}

OPENAI_TOOLS_FOR_CHAT_COMPLETIONS = [
    {
        "type": "function",
        "function": {
            "name": FUNCTION_NAME,
            "description": FUNCTION_DESCRIPTION,
            "parameters": FUNCTION_PARAMETERS
        }
    }
]

# Pydantic Models
class ProcessTextRequest(BaseModel):
    text: str

class FunctionCallInfo(BaseModel):
    tool_call_id: str | None = None
    function_name: str
    arguments: dict

@app.post("/process-text", response_model=list[FunctionCallInfo] | None)
async def process_text_for_function_call(request: ProcessTextRequest):
    if not client: # Check if client was initialized
        print("ERROR in /process-text: OpenAI client is not available. Check API key and server startup logs.")
        raise HTTPException(status_code=503, detail="OpenAI client not properly initialized. Server configuration issue.")
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Input text cannot be empty.")

    print(f"Backend received text for processing: '{request.text}' (using hardcoded API key)")

    try:
        chat_completion = client.chat.completions.create(
            model=OPENAI_CHAT_MODEL,
            messages=[
                {"role": "system", "content": "You are an e-commerce assistant. If the user's query can be mapped to a product filter, call the 'filter_products' function. Otherwise, respond naturally."},
                {"role": "user", "content": request.text}
            ],
            tools=OPENAI_TOOLS_FOR_CHAT_COMPLETIONS,
            tool_choice="auto"
        )

        response_message = chat_completion.choices[0].message
        tool_calls = response_message.tool_calls
        
        function_calls_to_return = []

        if tool_calls:
            print(f"OpenAI response included tool_calls: {tool_calls}")
            for tool_call in tool_calls:
                if tool_call.type == "function":
                    function_name = tool_call.function.name
                    try:
                        arguments = json.loads(tool_call.function.arguments)
                        print(f"Extracted function call: {function_name}, Arguments: {arguments}")
                        function_calls_to_return.append(
                            FunctionCallInfo(
                                tool_call_id=tool_call.id,
                                function_name=function_name,
                                arguments=arguments
                            )
                        )
                    except json.JSONDecodeError as jde:
                        print(f"Error decoding arguments for function {function_name}: {tool_call.function.arguments}. Error: {jde}")
            
            if function_calls_to_return:
                return function_calls_to_return
            else:
                print("Tool_calls received from OpenAI, but no valid function calls were parsed/extracted.")
                return None
        else:
            print(f"OpenAI did not call any function. AI response: {response_message.content}")
            return None

    except Exception as e:
        print(f"Error calling OpenAI Chat Completions API (with hardcoded key): {type(e).__name__} - {e}")
        import traceback
        traceback.print_exc()
        # Check if the exception is from OpenAI due to auth
        if "authentication" in str(e).lower() or "api key" in str(e).lower() or hasattr(e, 'status_code') and getattr(e, 'status_code', None) == 401:
             raise HTTPException(status_code=401, detail=f"OpenAI Authentication Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing text with OpenAI: {str(e)}")


# The original /session endpoint for WebRTC is not needed for this specific "anyhow"
# solution that uses client-side speech recognition. You can remove it or leave it.
# If you leave it, ensure it doesn't interfere or also try to use the hardcoded key
# if that's not intended for that part. For clarity, I'll comment it out here.
"""
OPENAI_REALTIME_SESSIONS_URL = "https://api.openai.com/v1/realtime/sessions"
OPENAI_REALTIME_MODEL = "gpt-4o-realtime-preview-2024-12-17"

class ClientSecret(BaseModel):
    value: str
    expires_at: int

class OriginalSessionResponse(BaseModel): # Renamed to avoid conflict
    session_id: str = Field(alias="id")
    client_secret_data: ClientSecret = Field(alias="client_secret")
    expires_at: int
    ice_servers: list | None = None

    @property
    def ephemeral_key_secret(self) -> str:
        return self.client_secret_data.value

class FrontendSessionResponse(BaseModel):
    session_id: str
    ephemeral_key_secret: str
    expires_at: int
    ice_servers: list | None

@app.post("/session", response_model=FrontendSessionResponse)
async def create_webrtc_session():
    # This endpoint would use the hardcoded OPENAI_API_KEY for the
    # OPENAI_REALTIME_SESSIONS_URL. If the key is not valid for that API,
    # it will fail.
    print(f"--- Original /session endpoint called (using hardcoded key: {OPENAI_API_KEY[:10]}) ---")
    # ... (rest of your previous /session logic that calls OPENAI_REALTIME_SESSIONS_URL)
    # This part had issues with OpenAI's preview API response (missing ice_servers etc.)
    raise HTTPException(status_code=501, detail="Original WebRTC /session endpoint is for testing and may not be fully functional.")
"""

if __name__ == "__main__":
    import uvicorn
    # Note: --reload is passed via CLI, not usually in uvicorn.run() for programmatic start
    uvicorn.run(app, host="0.0.0.0", port=8000)
