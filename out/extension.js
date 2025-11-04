"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
// Server configuration - using speaches-ai/speaches API
const DEFAULT_SPEECHES_API_BASE_URL = 'http://speaches.lan:8000'; // Default to speaches.lan
// Helper function to make HTTP requests
async function makeRequest(options, data) {
    return new Promise((resolve, reject) => {
        const client = options.protocol === 'https:' ? https : http;
        const req = client.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(responseData);
                    resolve(parsedData);
                }
                catch (e) {
                    resolve(responseData);
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
async function getTextFromEditor() {
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
    }
    catch (err) {
        // Ignore clipboard errors
    }
    // If nothing selected or clipboard is empty, return empty string
    return '';
}
// Helper function to get audio file path
function getAudioFilePath(fileName) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        return path.join(workspaceFolders[0].uri.fsPath, fileName);
    }
    return fileName;
}
function activate(context) {
    console.log('Cline Speech extension is now active!');
    // Get API endpoint from settings, with default fallback
    function getApiEndpoint() {
        const config = vscode.workspace.getConfiguration('clineSpeech');
        const endpoint = config.get('apiEndpoint', DEFAULT_SPEECHES_API_BASE_URL);
        return endpoint;
    }
    // Helper function to get API URL parts
    function getApiUrlParts(endpoint) {
        try {
            const url = new URL(endpoint);
            return {
                hostname: url.hostname,
                port: parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80),
                protocol: url.protocol
            };
        }
        catch (error) {
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
                    const options = {
                        hostname,
                        port,
                        path: '/tts',
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(JSON.stringify({ text }))
                        },
                        protocol
                    };
                    const result = await makeRequest(options, JSON.stringify({ text }));
                    if (result && result.audio_url) {
                        // Play the audio file
                        const audioUri = vscode.Uri.parse(result.audio_url);
                        await vscode.env.openExternal(audioUri);
                        vscode.window.showInformationMessage('Text converted to speech and playing!');
                    }
                    else {
                        vscode.window.showErrorMessage('Failed to convert text to speech');
                    }
                }
                catch (error) {
                    console.error('TTS Error:', error);
                    vscode.window.showErrorMessage(`TTS Error: ${error}`);
                }
            });
        }
        catch (error) {
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
                    const options = {
                        hostname,
                        port,
                        path: '/stt',
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
                            }
                            else {
                                vscode.window.showInformationMessage('Speech converted to text: ' + result.text);
                            }
                        }
                        else {
                            vscode.window.showErrorMessage('Failed to convert speech to text');
                        }
                    }
                    else {
                        vscode.window.showErrorMessage('No audio file selected');
                    }
                }
                catch (error) {
                    console.error('STT Error:', error);
                    vscode.window.showErrorMessage(`STT Error: ${error}`);
                }
            });
        }
        catch (error) {
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
                    const options = {
                        hostname,
                        port,
                        path: '/tts',
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(JSON.stringify({ text, output_file: fileName }))
                        },
                        protocol
                    };
                    const result = await makeRequest(options, JSON.stringify({ text, output_file: fileName }));
                    if (result && result.audio_url) {
                        vscode.window.showInformationMessage(`Text converted to speech and saved to ${audioFilePath}`);
                    }
                    else {
                        vscode.window.showErrorMessage('Failed to convert text to speech');
                    }
                }
                catch (error) {
                    console.error('TTS with File Error:', error);
                    vscode.window.showErrorMessage(`TTS with File Error: ${error}`);
                }
            });
        }
        catch (error) {
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
                        const options = {
                            hostname,
                            port,
                            path: '/stt',
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
                            }
                            else {
                                vscode.window.showInformationMessage('Speech converted to text: ' + result.text);
                            }
                        }
                        else {
                            vscode.window.showErrorMessage('Failed to convert speech to text');
                        }
                    }
                    else {
                        vscode.window.showErrorMessage('No audio file selected');
                    }
                }
                catch (error) {
                    console.error('STT from File Error:', error);
                    vscode.window.showErrorMessage(`STT from File Error: ${error}`);
                }
            });
        }
        catch (error) {
            console.error('STT from File Command Error:', error);
            vscode.window.showErrorMessage(`STT from File Command Error: ${error}`);
        }
    });
    // Add commands to context
    context.subscriptions.push(ttsCommand);
    context.subscriptions.push(sttCommand);
    context.subscriptions.push(ttsWithFileCommand);
    context.subscriptions.push(sttFromFileCommand);
}
exports.activate = activate;
function deactivate() {
    console.log('Cline Speech extension is now deactivated');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map