/**
 * Kidney Stone Research Platform - Voice-Enabled Image Display Component
 * Developed by Gregory Katz (@gregorykatz_microsoft)
 * 
 * Purpose: Voice-activated CT scan analysis with Azure AI Speech integration
 * Dependencies: React, UI components, Voice service
 * Last Updated: September 26, 2025
 */


import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { voiceService } from '../services/voiceService';

interface VoiceEnabledImageDisplayProps {
  imageId: string;
  diagnosis: string;
  findings: string[];
  radiologistNotes?: string;
  measurements: Record<string, number>;
}

export const VoiceEnabledImageDisplay: React.FC<VoiceEnabledImageDisplayProps> = ({
  imageId,
  diagnosis,
  findings,
  radiologistNotes,
  measurements
}) => {
  const [imageData, setImageData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceServiceReady, setVoiceServiceReady] = useState<boolean>(false);

  useEffect(() => {
    setVoiceServiceReady(voiceService.isVoiceSupported());
  }, []);

  useEffect(() => {
    const fetchImage = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8002'}/images/${imageId}/file`);
        if (!response.ok) throw new Error('Failed to fetch image');
        const data = await response.json();
        setImageData(data.image_data);
        
        if (data.is_placeholder) {
          setError('Using placeholder image - original not available');
        }
      } catch (err) {
        const fallbackSvg = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzc0MTUxIi8+PHRleHQgeD0iNTAlIiB5PSI0MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzlDQTNBRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPktpZG5leSBDVCBTY2FuPC90ZXh0Pjx0ZXh0IHg9IjUwJSIgeT0iNjAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM2QjcyODAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBOb3QgQXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==";
        setImageData(fallbackSvg);
        setError('Medical image temporarily unavailable');
      } finally {
        setLoading(false);
      }
    };

    fetchImage();
  }, [imageId]);

  const handleVoiceCommand = async () => {
    if (!voiceServiceReady) return;

    setIsListening(true);
    
    voiceService.startListening(
      (transcript) => {
        processVoiceCommand(transcript.toLowerCase());
        setIsListening(false);
      },
      (error) => {
        console.error('Voice recognition error:', error);
        setIsListening(false);
      }
    );
  };

  const processVoiceCommand = (command: string) => {
    if (!voiceServiceReady) return;

    let responseText = '';

    if (command.includes('describe') || command.includes('findings')) {
      responseText = `CT scan shows ${diagnosis.toLowerCase()} condition. Key findings include: ${findings.join(', ')}.`;
    } else if (command.includes('measurements')) {
      const measurementText = Object.entries(measurements)
        .map(([key, value]) => `${key.replace('_', ' ')}: ${value}`)
        .join(', ');
      responseText = `Measurements: ${measurementText}`;
    } else if (command.includes('radiologist') || command.includes('notes')) {
      responseText = radiologistNotes || 'No radiologist notes available.';
    } else {
      responseText = `This is a ${diagnosis.toLowerCase()} kidney CT scan. Say "describe findings", "read measurements", or "radiologist notes" for specific information.`;
    }

    speakText(responseText);
  };

  const speakText = (text: string) => {
    if (!voiceServiceReady) return;

    setIsSpeaking(true);
    voiceService.speak(text, () => {
      setIsSpeaking(false);
    });
  };

  const speakFindings = () => {
    const text = `CT scan findings for ${diagnosis.toLowerCase()} condition: ${findings.join(', ')}.`;
    speakText(text);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 bg-gray-800 rounded">
        <div className="text-white">Loading kidney image...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-48 bg-red-900 rounded">
        <div className="text-red-200">{error}</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-3">
      <img 
        src={imageData || ''}
        alt={`Kidney CT scan - ${diagnosis}`}
        className="w-full h-auto rounded border border-gray-600"
        style={{ maxHeight: '300px', objectFit: 'contain' }}
      />
      
      <div className="flex gap-2 justify-center">
        <Button
          onClick={handleVoiceCommand}
          disabled={isListening || isSpeaking}
          variant={isListening ? "default" : "outline"}
          size="sm"
        >
          {isListening ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          {isListening ? 'Listening...' : 'Voice Command'}
        </Button>
        
        <Button
          onClick={speakFindings}
          disabled={isSpeaking}
          variant="outline"
          size="sm"
        >
          {isSpeaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          Speak Findings
        </Button>
      </div>
      
      <div className="text-center text-xs text-gray-400 space-y-1">
        CT Kidney Scan - {diagnosis} Condition
        {isSpeaking && <div className="text-blue-400">🔊 Speaking...</div>}
        <div className="text-xs text-muted-foreground">
          Voice commands: "describe findings", "read measurements", "radiologist notes"
        </div>
      </div>
    </div>
  );
};
