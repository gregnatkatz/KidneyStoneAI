import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

export interface VoiceConfig {
  subscriptionKey: string;
  region: string;
}

export class VoiceService {
  private speechConfig: sdk.SpeechConfig;
  private audioConfig: sdk.AudioConfig;

  constructor(config: VoiceConfig) {
    this.speechConfig = sdk.SpeechConfig.fromSubscription(config.subscriptionKey, config.region);
    this.speechConfig.speechRecognitionLanguage = "en-US";
    this.speechConfig.speechSynthesisVoiceName = "en-US-DragonV2Neural";
    this.audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
  }

  async recognizeSpeech(): Promise<string> {
    return new Promise((resolve, reject) => {
      const recognizer = new sdk.SpeechRecognizer(this.speechConfig, this.audioConfig);
      
      recognizer.recognizeOnceAsync(
        (result) => {
          if (result.reason === sdk.ResultReason.RecognizedSpeech) {
            resolve(result.text);
          } else {
            reject(new Error(`Speech recognition failed: ${result.errorDetails}`));
          }
          recognizer.close();
        },
        (error) => {
          reject(new Error(`Speech recognition error: ${error}`));
          recognizer.close();
        }
      );
    });
  }

  async synthesizeSpeech(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const synthesizer = new sdk.SpeechSynthesizer(this.speechConfig);
      
      synthesizer.speakTextAsync(
        text,
        (result) => {
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            resolve();
          } else {
            reject(new Error(`Speech synthesis failed: ${result.errorDetails}`));
          }
          synthesizer.close();
        },
        (error) => {
          reject(new Error(`Speech synthesis error: ${error}`));
          synthesizer.close();
        }
      );
    });
  }
}
