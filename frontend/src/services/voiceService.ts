/**
 * Kidney Stone Research Platform - Voice Service
 * Developed by Greg Katz
 * 
 * Purpose: Voice recognition and text-to-speech service for medical interface
 * Dependencies: Web Speech API, Azure Speech Services (when configured)
 * Last Updated: September 25, 2025
 */

export class VoiceService {
  private recognition: SpeechRecognition | null = null
  private synthesis: SpeechSynthesis | null = null
  private isListening: boolean = false
  private isSupported: boolean = false

  constructor() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      this.recognition = new SpeechRecognition()
      this.recognition.continuous = false
      this.recognition.interimResults = false
      this.recognition.lang = 'en-US'
      this.isSupported = true
    }

    if ('speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis
    }
  }

  isVoiceSupported(): boolean {
    return this.isSupported
  }

  startListening(onResult: (transcript: string) => void, onError?: (error: string) => void): void {
    if (!this.recognition || this.isListening) {
      onError?.('Voice recognition not available or already listening')
      return
    }

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      onResult(transcript)
      this.isListening = false
    }

    this.recognition.onerror = (event) => {
      onError?.(event.error)
      this.isListening = false
    }

    this.recognition.onend = () => {
      this.isListening = false
    }

    try {
      this.recognition.start()
      this.isListening = true
    } catch (error) {
      onError?.('Failed to start voice recognition')
      this.isListening = false
    }
  }

  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop()
      this.isListening = false
    }
  }

  getIsListening(): boolean {
    return this.isListening
  }

  speak(text: string, onEnd?: () => void): void {
    if (!this.synthesis) {
      console.warn('Speech synthesis not available')
      onEnd?.()
      return
    }

    this.synthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.9
    utterance.pitch = 1.0
    utterance.volume = 0.8
    utterance.lang = 'en-US'

    utterance.onend = () => {
      onEnd?.()
    }

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event.error)
      onEnd?.()
    }

    this.synthesis.speak(utterance)
  }

  stopSpeaking(): void {
    if (this.synthesis) {
      this.synthesis.cancel()
    }
  }

  isSpeaking(): boolean {
    return this.synthesis ? this.synthesis.speaking : false
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.synthesis ? this.synthesis.getVoices() : []
  }

  processVoiceCommand(transcript: string): { action: string; parameter?: string } {
    const command = transcript.toLowerCase().trim()

    if (command.includes('show patient') || command.includes('select patient')) {
      const patientMatch = command.match(/patient\s+(\d+|[a-z]+)/i)
      return { action: 'selectPatient', parameter: patientMatch?.[1] }
    }

    if (command.includes('next image') || command.includes('next scan')) {
      return { action: 'nextImage' }
    }

    if (command.includes('previous image') || command.includes('previous scan')) {
      return { action: 'previousImage' }
    }

    if (command.includes('zoom in')) {
      return { action: 'zoomIn' }
    }

    if (command.includes('zoom out')) {
      return { action: 'zoomOut' }
    }

    if (command.includes('analyze') || command.includes('run analysis')) {
      return { action: 'runAnalysis' }
    }

    if (command.includes('dashboard')) {
      return { action: 'navigateTab', parameter: 'dashboard' }
    }

    if (command.includes('emr') || command.includes('demographics')) {
      return { action: 'navigateTab', parameter: 'emr' }
    }

    if (command.includes('testing') || command.includes('test interface')) {
      return { action: 'navigateTab', parameter: 'testing' }
    }

    return { action: 'unknown', parameter: transcript }
  }
}

export const voiceService = new VoiceService()
