import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  Dimensions, 
  Image, 
  Platform, 
  ActivityIndicator, 
  Alert 
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { useAudio } from '../src/context/AudioContext';
import { api } from '../src/services/api';

const { width } = Dimensions.get('window');
const COVER_SIZE = width * 0.35;

export default function TrimScreen() {
  const { currentlyPlaying, play } = useAudio();

  // Parsing initial duration
  const parseDuration = (dStr: string) => {
    if (!dStr) return 180;
    const parts = dStr.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
    return parseFloat(dStr) || 180;
  };

  const initialDuration = currentlyPlaying ? parseDuration(currentlyPlaying.duration) : 180;

  const [totalDuration, setTotalDuration] = useState(initialDuration);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(initialDuration);
  
  // Local playback engine states
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPos, setPlaybackPos] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isTrimming, setIsTrimming] = useState(false);

  // Refs to prevent stale closures in AV callbacks
  const soundRef = useRef<Audio.Sound | null>(null);
  const trimStartRef = useRef(0);
  const trimEndRef = useRef(initialDuration);

  useEffect(() => {
    trimStartRef.current = trimStart;
  }, [trimStart]);

  useEffect(() => {
    trimEndRef.current = trimEnd;
  }, [trimEnd]);

  // Load local track on mount
  useEffect(() => {
    if (!currentlyPlaying) return;

    let localSound: Audio.Sound | null = null;

    const loadTrack = async () => {
      try {
        setIsLoading(true);
        console.log('🔄 TrimScreen: Loading audio locally for range verification:', currentlyPlaying.url);

        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: currentlyPlaying.url },
          { shouldPlay: false, progressUpdateIntervalMillis: 100 },
          onPlaybackStatusUpdate
        );

        localSound = newSound;
        setSound(newSound);
        soundRef.current = newSound;

        // Try to query actual duration from loaded sound metadata
        const status = await newSound.getStatusAsync();
        if (status.isLoaded && status.durationMillis) {
          const actualSec = status.durationMillis / 1000;
          setTotalDuration(actualSec);
          setTrimEnd(actualSec);
          trimEndRef.current = actualSec;
        }
        setIsLoading(false);
      } catch (err) {
        console.log('❌ TrimScreen: Failed to load audio locally:', err);
        setIsLoading(false);
        Alert.alert('Error', 'Failed to load audio for editing. Please check your connection.');
      }
    };

    loadTrack();

    return () => {
      if (localSound) {
        console.log('🧹 TrimScreen: Unloading local playback sound instance');
        localSound.unloadAsync();
      }
    };
  }, [currentlyPlaying]);

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setPlaybackPos(status.positionMillis);
      
      // Auto limit / loop logic
      if (status.isPlaying) {
        if (status.positionMillis >= trimEndRef.current * 1000) {
          // Reached Point B -> pause and loop back to Point A
          console.log('🔁 Reached Point B. Looping back to Point A');
          soundRef.current?.pauseAsync();
          soundRef.current?.setPositionAsync(trimStartRef.current * 1000);
          setIsPlaying(false);
        }
      }
    }
  };

  const handlePlayPauseRange = async () => {
    if (!sound) return;

    if (isPlaying) {
      await sound.pauseAsync();
      setIsPlaying(false);
    } else {
      // Seek to Point A first to play the selected region
      await sound.setPositionAsync(trimStart * 1000);
      await sound.playAsync();
      setIsPlaying(true);
    }
  };

  const formatTime = (secondsVal: number) => {
    const minutes = Math.floor(secondsVal / 60);
    const seconds = Math.floor(secondsVal % 60);
    const ms = Math.floor((secondsVal % 1) * 100);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}.${ms < 10 ? '0' : ''}${ms}`;
  };

  // Fine-tuning handlers
  const adjustStart = (delta: number) => {
    const newVal = Math.max(0, Math.min(trimStart + delta, trimEnd - 1));
    // Round to 2 decimal places to prevent float inaccuracies
    setTrimStart(Math.round(newVal * 100) / 100);
  };

  const adjustEnd = (delta: number) => {
    const newVal = Math.max(trimStart + 1, Math.min(trimEnd + delta, totalDuration));
    // Round to 2 decimal places to prevent float inaccuracies
    setTrimEnd(Math.round(newVal * 100) / 100);
  };

  const handleConfirmTrim = async () => {
    if (!currentlyPlaying) return;

    Alert.alert(
      '⚠ WARNING: Destructive Overwrite',
      `This will permanently trim "${currentlyPlaying.title}" to [${formatTime(trimStart)} - ${formatTime(trimEnd)}]. The original track will be overwritten on the database and Cloudinary. This action is irreversible.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Overwrite',
          style: 'destructive',
          onPress: async () => {
            setIsTrimming(true);
            try {
              const response = await api.trimMusic(currentlyPlaying._id, trimStart, trimEnd);
              if (response.success) {
                Alert.alert('Success', 'Audio track trimmed successfully!');
                const newSong = response.data;
                
                // Unload local sound
                if (sound) {
                  await sound.unloadAsync();
                }
                
                // Play new song in context
                await play(newSong, true);
                router.back();
              }
            } catch (err: any) {
              console.log('Trimming error:', err);
              Alert.alert('Error', err.response?.data?.message || 'Failed to trim audio track');
            } finally {
              setIsTrimming(false);
            }
          }
        }
      ]
    );
  };

  if (!currentlyPlaying) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No song selected for trimming</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Selection percentages for the visual timeline highlight
  const selectionStartPct = (trimStart / totalDuration) * 100;
  const selectionEndPct = (trimEnd / totalDuration) * 100;
  const selectionWidthPct = selectionEndPct - selectionStartPct;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trim Audio</Text>
        <View style={styles.headerButtonPlaceholder} />
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Loading audio stream...</Text>
        </View>
      ) : (
        <View style={styles.content}>
          {/* Song Card */}
          <View style={styles.songCard}>
            {currentlyPlaying.imageUrl ? (
              <Image source={{ uri: currentlyPlaying.imageUrl }} style={styles.coverImage} />
            ) : (
              <View style={styles.coverPlaceholder}>
                <Ionicons name="musical-notes" size={40} color="#fff" />
              </View>
            )}
            <View style={styles.songDetails}>
              <Text style={styles.songTitle} numberOfLines={1}>{currentlyPlaying.title}</Text>
              <Text style={styles.artistText}>Musiana Library</Text>
            </View>
          </View>

          {/* Visual Timeline Bar */}
          <View style={styles.timelineWrapper}>
            <Text style={styles.sectionLabel}>VISUAL TIMELINE</Text>
            <View style={styles.timelineTrack}>
              {/* Highlight selected range */}
              <View 
                style={[
                  styles.timelineSelection, 
                  { left: `${selectionStartPct}%`, width: `${selectionWidthPct}%` }
                ]} 
              />
              {/* Playback progress cursor indicator */}
              {isPlaying && (
                <View 
                  style={[
                    styles.playbackCursor,
                    { left: `${(playbackPos / (totalDuration * 1000)) * 100}%` }
                  ]}
                />
              )}
            </View>
            <View style={styles.timelineLabels}>
              <Text style={styles.timelineLimitLabel}>0:00.00</Text>
              <Text style={styles.timelineLimitLabel}>{formatTime(totalDuration)}</Text>
            </View>
          </View>

          {/* Adjustments Container */}
          <View style={styles.controlsContainer}>
            
            {/* START TRIM (Point A) */}
            <View style={styles.controlSection}>
              <View style={styles.labelRow}>
                <Text style={styles.controlTitle}>Point A (Start Cutting Point)</Text>
                <Text style={styles.timeValueText}>{formatTime(trimStart)}</Text>
              </View>
              
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={totalDuration}
                value={trimStart}
                onValueChange={(val) => setTrimStart(Math.min(val, trimEnd - 1))}
                minimumTrackTintColor="#332354"
                maximumTrackTintColor="#8B5CF6"
                thumbTintColor="#BDB4FF"
              />

              {/* Fine Tuning Start */}
              <View style={styles.fineTuneRow}>
                <TouchableOpacity style={styles.fineBtn} onPress={() => adjustStart(-1.0)}>
                  <Text style={styles.fineBtnText}>-1.0s</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.fineBtn} onPress={() => adjustStart(-0.1)}>
                  <Text style={styles.fineBtnText}>-0.1s</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.fineBtn} onPress={() => adjustStart(0.1)}>
                  <Text style={styles.fineBtnText}>+0.1s</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.fineBtn} onPress={() => adjustStart(1.0)}>
                  <Text style={styles.fineBtnText}>+1.0s</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* END TRIM (Point B) */}
            <View style={styles.controlSection}>
              <View style={styles.labelRow}>
                <Text style={styles.controlTitle}>Point B (End Cutting Point)</Text>
                <Text style={styles.timeValueText}>{formatTime(trimEnd)}</Text>
              </View>
              
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={totalDuration}
                value={trimEnd}
                onValueChange={(val) => setTrimEnd(Math.max(val, trimStart + 1))}
                minimumTrackTintColor="#8B5CF6"
                maximumTrackTintColor="#332354"
                thumbTintColor="#BDB4FF"
              />

              {/* Fine Tuning End */}
              <View style={styles.fineTuneRow}>
                <TouchableOpacity style={styles.fineBtn} onPress={() => adjustEnd(-1.0)}>
                  <Text style={styles.fineBtnText}>-1.0s</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.fineBtn} onPress={() => adjustEnd(-0.1)}>
                  <Text style={styles.fineBtnText}>-0.1s</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.fineBtn} onPress={() => adjustEnd(0.1)}>
                  <Text style={styles.fineBtnText}>+0.1s</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.fineBtn} onPress={() => adjustEnd(1.0)}>
                  <Text style={styles.fineBtnText}>+1.0s</Text>
                </TouchableOpacity>
              </View>
            </View>

          </View>

          {/* Local Range Verification Player */}
          <View style={styles.previewSection}>
            <TouchableOpacity 
              style={[styles.previewPlayBtn, isPlaying && styles.previewPlayingBtn]} 
              onPress={handlePlayPauseRange}
            >
              <Ionicons 
                name={isPlaying ? "pause" : "play"} 
                size={22} 
                color="#fff" 
                style={{ marginRight: 6 }} 
              />
              <Text style={styles.previewPlayText}>
                {isPlaying ? "Pause Range Preview" : "Play Selected Range"}
              </Text>
            </TouchableOpacity>
            <Text style={styles.previewMeta}>
              Selected Segment: {formatTime(trimEnd - trimStart)}
            </Text>
          </View>

          {/* Action Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={styles.cancelBtn} 
              onPress={() => router.back()}
              disabled={isTrimming}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.saveBtn} 
              onPress={handleConfirmTrim}
              disabled={isTrimming}
            >
              {isTrimming ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="cut" size={18} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.saveBtnText}>Confirm & Trim</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#130D22',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#130D22',
  },
  loadingText: {
    color: '#7C7899',
    fontSize: 15,
    marginTop: 15,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#7C7899',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: Platform.OS === 'ios' ? 15 : 45,
    paddingBottom: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#332354',
  },
  headerButton: {
    padding: 5,
  },
  headerButtonPlaceholder: {
    width: 32,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  songCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1330',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#332354',
  },
  coverImage: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: 8,
  },
  coverPlaceholder: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: 8,
    backgroundColor: '#332354',
    justifyContent: 'center',
    alignItems: 'center',
  },
  songDetails: {
    flex: 1,
    marginLeft: 15,
  },
  songTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  artistText: {
    fontSize: 14,
    color: '#BDB4FF',
  },
  timelineWrapper: {
    marginVertical: 15,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#7C7899',
    marginBottom: 8,
    letterSpacing: 1,
  },
  timelineTrack: {
    height: 12,
    backgroundColor: '#1C1330',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#332354',
    position: 'relative',
    overflow: 'hidden',
  },
  timelineSelection: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#8B5CF6',
    borderRadius: 4,
  },
  playbackCursor: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
  },
  timelineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  timelineLimitLabel: {
    fontSize: 12,
    color: '#7C7899',
    fontWeight: '500',
  },
  controlsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  controlSection: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  controlTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#BDB4FF',
  },
  timeValueText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  slider: {
    width: '100%',
    height: 30,
  },
  fineTuneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  fineBtn: {
    backgroundColor: '#251842',
    borderWidth: 1,
    borderColor: '#332354',
    borderRadius: 6,
    paddingVertical: 6,
    flex: 0.23,
    alignItems: 'center',
  },
  fineBtnText: {
    color: '#BDB4FF',
    fontSize: 12,
    fontWeight: '600',
  },
  previewSection: {
    alignItems: 'center',
    backgroundColor: '#1C1330',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#332354',
    padding: 15,
    marginVertical: 15,
  },
  previewPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  previewPlayingBtn: {
    backgroundColor: '#FF3B30',
    shadowColor: '#FF3B30',
  },
  previewPlayText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  previewMeta: {
    fontSize: 12,
    color: '#7C7899',
    marginTop: 10,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelBtn: {
    flex: 0.45,
    backgroundColor: '#251842',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#332354',
  },
  cancelBtnText: {
    color: '#7C7899',
    fontSize: 15,
    fontWeight: 'bold',
  },
  saveBtn: {
    flex: 0.5,
    flexDirection: 'row',
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
