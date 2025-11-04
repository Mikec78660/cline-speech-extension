# Setting up speaches-ai/speaches Server

This extension requires the speaches-ai/speaches server to be running. Here's how to set it up:

## Installation

```bash
# Clone the repository
git clone https://github.com/speaches-ai/speaches.git
cd speaches

# Start the server with Docker Compose
docker-compose up -d
```

## Server Configuration

The server should be accessible at `http://speaches.lan:8000` (default endpoint).

If you need to change the endpoint, you can configure it in VS Code settings:
1. Open VS Code Settings (Ctrl+,)
2. Search for "cline speech"
3. Set the `Cline Speech: Api Endpoint` to your speaches server address

## API Endpoints

The extension communicates with these endpoints:

### Text to Speech
- **Endpoint**: `POST /tts`
- **Request Body**: 
  ```json
  {
    "text": "Hello world",
    "output_file": "output.wav"
  }
  ```
- **Response**: 
  ```json
  {
    "audio_url": "http://localhost:8000/audio/output.wav"
  }
  ```

### Speech to Text
- **Endpoint**: `POST /stt`
- **Request Body**: Base64 encoded audio file
- **Response**: 
  ```json
  {
    "text": "Transcribed text from audio"
  }
  ```

## Testing the Server

You can test if the server is running by visiting:
```
http://localhost:8000
```

Or using curl:
```bash
# Test TTS endpoint
curl -X POST http://localhost:8000/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, world!"}'

# Test STT endpoint would require an audio file
```

## Troubleshooting

If you encounter issues:

1. Make sure Docker is running
2. Check that the server is accessible at `http://localhost:8000`
3. Verify the server logs: `docker-compose logs`
4. Ensure port 8000 is not being used by another application
