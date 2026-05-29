import React, { createContext, useContext, useState, useEffect } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';

export interface Music {
  _id: string;
  title: string;
  duration: string;
  url: string;
  imageUrl?: string;
}

interface AudioContextProps {
  currentlyPlaying: Music | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  play: (song: Music) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
}

const AudioContext = createContext<AudioContextProps | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<Music | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  // Clean up sound on unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis);
      setDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying);
      
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
      }
    } else if (status.error) {
      console.error(`Playback error: ${status.error}`);
    }
  };

  const play = async (song: Music) => {
    try {
      console.log('🎵 Context: Playing song', song.title);
      
      // If there's an existing sound, stop and unload it first
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }

      // Configure audio to play in background and follow silent switch settings
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldRouteThroughEarpieceIOS: false,
      } as any);

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: song.url },
        { shouldPlay: true, progressUpdateIntervalMillis: 500 },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
      setCurrentlyPlaying(song);
      setIsPlaying(true);
    } catch (error) {
      console.error('❌ Context: Play error', error);
    }
  };

  const pause = async () => {
    try {
      if (sound && isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('❌ Context: Pause error', error);
    }
  };

  const resume = async () => {
    try {
      if (sound && !isPlaying) {
        await sound.playAsync();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('❌ Context: Resume error', error);
    }
  };

  const seek = async (positionMs: number) => {
    try {
      if (sound) {
        await sound.setPositionAsync(positionMs);
        setPosition(positionMs);
      }
    } catch (error) {
      console.error('❌ Context: Seek error', error);
    }
  };

  return (
    <AudioContext.Provider
      value={{
        currentlyPlaying,
        isPlaying,
        position,
        duration,
        play,
        pause,
        resume,
        seek,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};
