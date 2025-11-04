# Cline Speech Extension

A VS Code extension that provides Text-to-Speech (TTS) and Speech-to-Text (STT) functionality for Cline AI, using the speaches-ai/speaches API server.

## Features

- **Text to Speech**: Convert selected text or clipboard text to speech
- **Speech to Text**: Transcribe audio files to text
- **File Output**: Save TTS output as audio files
- **Context Menu Integration**: Right-click context menu options
- **Editor Integration**: Direct text insertion for STT results

## Commands

1. **Cline: Text to Speech** (`cline-speech.tts`)
   - Converts selected text or clipboard text to speech
   - Plays the audio directly in your default media player

2. **Cline: Speech to Text** (`cline-speech.stt`)
   - Transcribes audio files to text
   - Inserts the transcribed text at cursor position

3. **Cline: Text to Speech with File** (`cline-speech.ttsWithFile`)
   - Converts text to speech and saves as audio file
   - Prompts for filename

4. **Cline: Speech to Text from File** (`cline-speech.sttFromFile`)
   - Transcribes audio files to text and inserts result
   - Prompts for audio file selection

5. **Cline: Voice to Text (Record)** (`cline-speech.voiceToText`)
   - Records voice from microphone and transcribes to text
   - Note: Microphone access requires proper permissions and may have platform limitations
   - Inserts the transcribed text at cursor position

## Setup

### Prerequisites

1. Install the speaches-ai/speaches server:
   ```bash
   git clone https://github.com/speaches-ai/speaches.git
   cd speaches
   docker-compose up -d
   ```

2. Make sure the server is running on `http://speaches.lan:8000` (default)

### Important Note about Server Compatibility

The speaches-ai/speaches server is a Gradio web application and may not expose direct REST API endpoints that this extension expects. If you encounter "404 Not Found" errors, please verify that:

- The server is properly running
- You're using the correct version of the speaches server that supports the required API endpoints
- The server is configured to expose the necessary TTS/STT endpoints

### Installation

1. Install the extension in VS Code:
   - Download the `.vsix` file or build from source
   - In VS Code: `Extensions` → `Install from VSIX` → select the file

2. Restart VS Code

### Configuration

The extension can be configured through VS Code settings:

1. Open VS Code Settings (Ctrl+,)
2. Search for "cline speech"
3. Set the `Cline Speech: Api Endpoint` to your speaches server address

Default endpoint: `http://speaches.lan:8000`

## Usage

1. Select text in your editor or copy text to clipboard
2. Use one of the commands from the Command Palette (`Ctrl+Shift+P`) or context menu
3. For STT commands, select an audio file when prompted

## API Endpoints

The extension communicates with the speaches server using these endpoints:
- `POST /tts` - Text to Speech conversion
- `POST /stt` - Speech to Text conversion

## Contributing

Contributions are welcome! Please fork the repository and submit pull requests.

## License

MIT License
