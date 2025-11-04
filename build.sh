#!/bin/bash

echo "Building Cline Speech Extension..."

# Navigate to the extension directory
cd /opt/cline-speech

# Install dependencies
echo "Installing dependencies..."
npm install

# Compile TypeScript to JavaScript
echo "Compiling TypeScript..."
npm run compile

# Check if vsce is installed, if not install it
if ! command -v vsce &> /dev/null; then
    echo "Installing vsce..."
    npm install -g @vscode/vsce
fi

# Package the extension
echo "Packaging extension..."
vsce package

echo "Extension packaged as cline-speech-0.0.1.vsix"
echo "Extension is ready for installation in VS Code"
