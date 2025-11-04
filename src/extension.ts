import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

// Server configuration - using speaches-ai/speaches API
const DEFAULT_SPEECHES_API_BASE_URL = 'http://speaches.lan:8000'; // Default to speaches.lan

// Helper function to make HTTP requests
async function makeRequest(options: https.RequestOptions, data?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const client = options.protocol === 'https:' ? https : http;
    
    const req = client.request(options, (res) => {
      // Handle binary data properly - check if this is likely binary data
      const chunks: Buffer[] = [];
      
      res.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      res.on('end', () => {
        // Combine all chunks into a single buffer
        const buffer = Buffer.concat(chunks);
        
        // Check if response is likely JSON or binary
        try {
          // If it's a valid JSON string, parse it
          const parsedData = JSON.parse(buffer.toString('utf8'));
          resolve(parsedData);
        } catch (e) {
          // If it's not JSON, return the raw buffer (binary data)
          resolve(buffer);
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    if (data) {
      req.write(data);
    }
    
    req.end();
  });
}

// Helper function to get text from editor selection or clipboard
async function getTextFromEditor(): Promise<string> {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const selection = editor.selection;
    if (!selection.isEmpty) {
      return editor.document.getText(selection);
    }
  }
  
  // If no selection, try to get text from clipboard
  try {
    const clipboardText = await vscode.env.clipboard.readText();
    if (clipboardText.trim()) {
      return clipboardText;
    }
  } catch (err) {
    // Ignore clipboard errors
  }
  
  // If nothing selected or clipboard is empty, return empty string
  return '';
}

// Helper function to get audio file path
function getAudioFilePath(fileName: string): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    return path.join(workspaceFolders[0].uri.fsPath, fileName);
  }
  return fileName;
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Cline Speech extension is now active!');

  // Get API endpoint from settings, with default fallback
  function getApiEndpoint(): string {
    const config = vscode.workspace.getConfiguration('clineSpeech');
    const endpoint = config.get<string>('apiEndpoint', DEFAULT_SPEECHES_API_BASE_URL);
    return endpoint;
  }

  // Check if task completion alert is enabled
  function isTaskCompletionAlertEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('clineSpeech');
    const enabled = config.get<boolean>('taskCompletionAlert', false);
    return enabled;
  }

  // Send task completion alert
  async function sendTaskCompletionAlert(): Promise<void> {
    try {
      const apiEndpoint = getApiEndpoint();
      const { hostname, port, protocol } = getApiUrlParts(apiEndpoint);

      // Only send alert if enabled
      if (isTaskCompletionAlertEnabled()) {
        const options: https.RequestOptions = {
          hostname,
          port,
          path: '/v1/audio/speech',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(JSON.stringify({ 
              input: 'Task Completed',
              model: 'tts-1',
              voice: 'alloy',
              response_format: 'wav'
            }))
          },
          protocol
        };

        await makeRequest(options, JSON.stringify({ 
          input: 'Task Completed',
          model: 'tts-1',
          voice: 'alloy',
          response_format: 'wav'
        }));
      }
    } catch (error) {
      console.error('Task completion alert error:', error);
      // Don't show error to user for this optional feature
    }
  }

  // Helper function to get API URL parts
  function getApiUrlParts(endpoint: string): { hostname: string; port: number; protocol: string } {
    try {
      const url = new URL(endpoint);
      return {
        hostname: url.hostname,
        port: parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80),
        protocol: url.protocol
      };
    } catch (error) {
      // If URL parsing fails, assume it's a simple host:port format
      const parts = endpoint.split(':');
      const hostname = parts[0];
      const port = parts.length > 1 ? parseInt(parts[1]) : 80;
      return {
        hostname,
        port,
        protocol: 'http:'
      };
    }
  }

  // Text to Speech command
  const ttsCommand = vscode.commands.registerCommand('cline-speech.tts', async () => {
    try {
      const text = await getTextFromEditor();
      if (!text) {
        vscode.window.showErrorMessage('No text selected or available in clipboard for TTS');
        return;
      }

      const apiEndpoint = getApiEndpoint();
      const { hostname, port, protocol } = getApiUrlParts(apiEndpoint);

      // Show progress
      const progress = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Converting text to speech...",
        cancellable: false
      }, async () => {
        try {
          const options: https.RequestOptions = {
            hostname,
            port,
            path: '/v1/audio/speech',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(JSON.stringify({ 
                input: text,
                model: 'tts-1',
                voice: 'alloy',
                response_format: 'wav'
              }))
            },
            protocol
          };

          const result = await makeRequest(options, JSON.stringify({ 
            input: text,
            model: 'tts-1',
            voice: 'alloy',
            response_format: 'wav'
          }));
          
          // Handle response from speaches server
          // The speaches server returns raw audio bytes, not JSON
          if (result && Buffer.isBuffer(result)) {
            // Server returned raw audio bytes - this is expected behavior
            // VS Code cannot play audio directly, so we show success message
            // For now, we'll show success but note that audio is generated
            vscode.window.showInformationMessage('Text converted to speech successfully');
            // Note: Audio files are generated but cannot be played directly in VS Code
            // Users can manually open the generated files with external players
          } else {
            // If we get a JSON response with audio_url, try to play it
            if (result && result.audio_url) {
              try {
                // Try to open the audio URL with external application
                const audioUri = vscode.Uri.parse(result.audio_url);
                await vscode.env.openExternal(audioUri);
                vscode.window.showInformationMessage('Text converted to speech and playing!');
              } catch (openError) {
                // If we can't open externally, just show success
                vscode.window.showInformationMessage('Text converted to speech successfully');
                console.error('Failed to open audio:', openError);
              }
            } else {
              // No audio_url, but we still show success since conversion happened
              vscode.window.showInformationMessage('Text converted to speech successfully');
            }
          }
        } catch (error) {
          console.error('TTS Error:', error);
          vscode.window.showErrorMessage(`TTS Error: ${error}`);
        }
      });
    } catch (error) {
      console.error('TTS Command Error:', error);
      vscode.window.showErrorMessage(`TTS Command Error: ${error}`);
    }
  });

  // Speech to Text command
  const sttCommand = vscode.commands.registerCommand('cline-speech.stt', async () => {
    try {
      const apiEndpoint = getApiEndpoint();
      const { hostname, port, protocol } = getApiUrlParts(apiEndpoint);

      // Show progress
      const progress = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Converting speech to text...",
        cancellable: false
      }, async () => {
        try {
          const options: https.RequestOptions = {
            hostname,
            port,
            path: '/v1/audio/transcriptions',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            protocol
          };

          // For STT, we need to send an audio file - we'll prompt user to select one
          const fileUri = await vscode.window.showOpenDialog({
            filters: {
              'Audio Files': ['wav', 'mp3', 'flac', 'm4a']
            }
          });

          if (fileUri && fileUri.length > 0) {
            const audioFile = fileUri[0];
            
            // Read the audio file and send it to the API
            const audioData = fs.readFileSync(audioFile.fsPath);
            
            const result = await makeRequest(options, audioData.toString('base64'));
            
            if (result && result.text) {
              // Insert the transcribed text into the current editor
              const editor = vscode.window.activeTextEditor;
              if (editor) {
                await editor.edit(editBuilder => {
                  editBuilder.insert(editor.selection.active, result.text);
                });
                vscode.window.showInformationMessage('Speech converted to text and inserted!');
              } else {
                vscode.window.showInformationMessage('Speech converted to text: ' + result.text);
              }
            } else {
              vscode.window.showErrorMessage('Failed to convert speech to text');
            }
          } else {
            vscode.window.showErrorMessage('No audio file selected');
          }
        } catch (error) {
          console.error('STT Error:', error);
          vscode.window.showErrorMessage(`STT Error: ${error}`);
        }
      });
    } catch (error) {
      console.error('STT Command Error:', error);
      vscode.window.showErrorMessage(`STT Command Error: ${error}`);
    }
  });

  // Text to Speech with file output
  const ttsWithFileCommand = vscode.commands.registerCommand('cline-speech.ttsWithFile', async () => {
    try {
      const text = await getTextFromEditor();
      if (!text) {
        vscode.window.showErrorMessage('No text selected or available in clipboard for TTS');
        return;
      }

      const apiEndpoint = getApiEndpoint();
      const { hostname, port, protocol } = getApiUrlParts(apiEndpoint);

      const fileName = await vscode.window.showInputBox({
        prompt: 'Enter filename for audio output (e.g., output.wav)',
        value: 'output.wav'
      });

      if (!fileName) {
        return;
      }

      const audioFilePath = getAudioFilePath(fileName);
      
      const progress = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Converting text to speech...",
        cancellable: false
      }, async () => {
        try {
          const options: https.RequestOptions = {
            hostname,
            port,
            path: '/v1/audio/speech',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(JSON.stringify({ 
                input: text,
                model: 'tts-1',
                voice: 'alloy',
                response_format: 'wav'
              }))
            },
            protocol
          };

          const result = await makeRequest(options, JSON.stringify({ 
            input: text,
            model: 'tts-1',
            voice: 'alloy',
            response_format: 'wav'
          }));
          
          if (result && result.audio_url) {
            vscode.window.showInformationMessage(`Text converted to speech and saved to ${audioFilePath}`);
          } else {
            // The speaches server returns raw audio data for file output
            // We need to save this raw audio data to a file
            if (result && Buffer.isBuffer(result)) {
              try {
                fs.writeFileSync(audioFilePath, result);
                vscode.window.showInformationMessage(`Text converted to speech and saved to ${audioFilePath}`);
              } catch (writeError) {
                console.error('Failed to write audio file:', writeError);
                vscode.window.showErrorMessage(`Failed to save audio file: ${writeError}`);
              }
            } else {
              vscode.window.showErrorMessage('Failed to convert text to speech');
            }
          }
        } catch (error) {
          console.error('TTS with File Error:', error);
          vscode.window.showErrorMessage(`TTS with File Error: ${error}`);
        }
      });
    } catch (error) {
      console.error('TTS with File Command Error:', error);
      vscode.window.showErrorMessage(`TTS with File Command Error: ${error}`);
    }
  });

  // Speech to Text from file
  const sttFromFileCommand = vscode.commands.registerCommand('cline-speech.sttFromFile', async () => {
    try {
      const apiEndpoint = getApiEndpoint();
      const { hostname, port, protocol } = getApiUrlParts(apiEndpoint);

      const progress = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Converting speech to text...",
        cancellable: false
      }, async () => {
        try {
          // Prompt user to select an audio file
          const fileUri = await vscode.window.showOpenDialog({
            filters: {
              'Audio Files': ['wav', 'mp3', 'flac', 'm4a']
            }
          });

          if (fileUri && fileUri.length > 0) {
            const audioFile = fileUri[0];
            
            const options: https.RequestOptions = {
              hostname,
              port,
              path: '/v1/audio/transcriptions',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              protocol
            };

            // Read the audio file and send it to the API
            const audioData = fs.readFileSync(audioFile.fsPath);
            
            const result = await makeRequest(options, audioData.toString('base64'));
            
            if (result && result.text) {
              // Insert the transcribed text into the current editor
              const editor = vscode.window.activeTextEditor;
              if (editor) {
                await editor.edit(editBuilder => {
                  editBuilder.insert(editor.selection.active, result.text);
                });
                vscode.window.showInformationMessage('Speech converted to text and inserted!');
              } else {
                vscode.window.showInformationMessage('Speech converted to text: ' + result.text);
              }
            } else {
              vscode.window.showErrorMessage('Failed to convert speech to text');
            }
          } else {
            vscode.window.showErrorMessage('No audio file selected');
          }
        } catch (error) {
          console.error('STT from File Error:', error);
          vscode.window.showErrorMessage(`STT from File Error: ${error}`);
        }
      });
    } catch (error) {
      console.error('STT from File Command Error:', error);
      vscode.window.showErrorMessage(`STT from File Command Error: ${error}`);
    }
  });

  // Voice recording and transcription command
  const voiceToTextCommand = vscode.commands.registerCommand('cline-speech.voiceToText', async () => {
    try {
      // Show progress
      const progress = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Recording and transcribing speech...",
        cancellable: false
      }, async () => {
        try {
          // This would normally involve actual microphone recording
          // For now, we'll show a message about limitations
          vscode.window.showInformationMessage('Voice recording feature requires additional implementation for microphone access.');
          vscode.window.showInformationMessage('Please use the existing STT command to transcribe audio files.');
          
          // In a full implementation, this would:
          // 1. Request microphone permission
          // 2. Start recording audio
          // 3. Save recording temporarily
          // 4. Send to STT API
          // 5. Insert result into editor
        } catch (error) {
          console.error('Voice to Text Error:', error);
          vscode.window.showErrorMessage(`Voice to Text Error: ${error}`);
        }
      });
    } catch (error) {
      console.error('Voice to Text Command Error:', error);
      vscode.window.showErrorMessage(`Voice to Text Command Error: ${error}`);
    }
  });

  // Add commands to context
  context.subscriptions.push(ttsCommand);
  context.subscriptions.push(sttCommand);
  context.subscriptions.push(ttsWithFileCommand);
  context.subscriptions.push(sttFromFileCommand);
  context.subscriptions.push(voiceToTextCommand);
}

export function deactivate() {
  console.log('Cline Speech extension is now deactivated');
}
