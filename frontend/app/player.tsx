import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Dimensions, Image, Platform, Modal, TextInput, Alert, ActivityIndicator, FlatList } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudio } from '../src/context/AudioContext';
import { api } from '../src/services/api';

const { width } = Dimensions.get('window');
const ALBUM_ART_SIZE = width * 0.75;

export default function PlayerScreen() {
  const { 
    currentlyPlaying, 
    isPlaying, 
    position, 
    duration, 
    play,
    pause, 
    resume, 
    seek,
    isShuffle,
    isLoop,
    toggleShuffle,
    toggleLoop,
    playNext,
    playPrevious,
    queue,
    currentIndex,
    removeFromQueue,
    reorderQueue,
    clearQueue
  } = useAudio();

  // Local state to track sliding position, so it doesn't stutter while dragging
  const [isSliding, setIsSliding] = useState(false);
  const [slidingValue, setSlidingValue] = useState(0);

  // Queue drawer state
  const [showQueueModal, setShowQueueModal] = useState(false);

  // Admin states
  const [isAdmin, setIsAdmin] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);

  // If we are not sliding, sync the sliding value with the actual position
  useEffect(() => {
    if (!isSliding) {
      setSlidingValue(position);
    }
  }, [position, isSliding]);

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const user = await AsyncStorage.getItem('user');
        if (user) {
          const parsed = JSON.parse(user);
          setIsAdmin(parsed.role === 'admin');
        }
      } catch (err) {
        console.log('Error checking role:', err);
      }
    };
    checkUserRole();
  }, []);

  if (!currentlyPlaying) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No song is currently playing</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const formatTime = (millis: number) => {
    if (isNaN(millis) || millis === null) return '0:00';
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleSlidingStart = () => {
    setIsSliding(true);
  };

  const handleSlidingComplete = async (value: number) => {
    await seek(value);
    setIsSliding(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="chevron-down" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Now Playing</Text>
        {isAdmin ? (
          <TouchableOpacity onPress={() => setShowOptionsModal(true)} style={styles.headerButton}>
            <Ionicons name="ellipsis-horizontal" size={26} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerButtonPlaceholder} />
        )}
      </View>

      {/* Album Art Cover */}
      <View style={styles.content}>
        <View style={styles.albumArtContainer}>
          <View style={styles.albumArtCircle}>
            {currentlyPlaying.imageUrl ? (
              <Image source={{ uri: currentlyPlaying.imageUrl }} style={styles.playerCoverImage} />
            ) : (
              <Ionicons name="musical-notes" size={80} color="#fff" />
            )}
          </View>
        </View>

        {/* Song Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.songTitle} numberOfLines={1}>{currentlyPlaying.title}</Text>
          <Text style={styles.artistName}>Musiana Library</Text>
        </View>

        {/* Timeline Slider */}
        <View style={styles.sliderContainer}>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={duration || 1000} // prevent division by zero in UI
            value={slidingValue}
            minimumTrackTintColor="#8B5CF6"
            maximumTrackTintColor="#332354"
            thumbTintColor="#8B5CF6"
            onSlidingStart={handleSlidingStart}
            onSlidingComplete={handleSlidingComplete}
            onValueChange={(val) => setSlidingValue(val)}
          />
          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>{formatTime(slidingValue)}</Text>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>
        </View>

        {/* Playback Controls */}
        <View style={styles.controlsContainer}>
          <TouchableOpacity style={styles.secondaryControl} onPress={playPrevious}>
            <Ionicons name="play-back-outline" size={32} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.playPauseButton} 
            onPress={isPlaying ? pause : resume}
          >
            <Ionicons 
              name={isPlaying ? 'pause' : 'play'} 
              size={40} 
              color="#fff" 
              style={isPlaying ? null : { marginLeft: 4 }} 
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryControl} onPress={playNext}>
            <Ionicons name="play-forward-outline" size={32} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Extra buttons (Shuffle, Repeat, Trim control) */}
        <View style={styles.extraControls}>
          <TouchableOpacity onPress={toggleShuffle}>
            <Ionicons 
              name="shuffle" 
              size={24} 
              color={isShuffle ? '#BDB4FF' : '#7C7899'} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => setShowQueueModal(true)}>
            <Ionicons name="list" size={24} color="#BDB4FF" />
          </TouchableOpacity>

          <TouchableOpacity onPress={toggleLoop}>
            <Ionicons 
              name="repeat" 
              size={24} 
              color={isLoop ? '#BDB4FF' : '#7C7899'} 
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Options Modal (Admin only) */}
      <Modal
        visible={showOptionsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <TouchableOpacity 
          style={styles.optionsOverlay} 
          activeOpacity={1} 
          onPress={() => setShowOptionsModal(false)}
        >
          <View style={styles.optionsContainer}>
            <Text style={styles.optionsTitle}>Track Actions</Text>
            
            <TouchableOpacity 
              style={styles.optionRow} 
              onPress={() => {
                setShowOptionsModal(false);
                router.push('/trim');
              }}
            >
              <Ionicons name="cut-outline" size={20} color="#FF3B30" style={{ marginRight: 10 }} />
              <Text style={styles.optionText}>Trim this audio</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.optionCancelRow} 
              onPress={() => setShowOptionsModal(false)}
            >
              <Text style={styles.optionCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Queue List Drawer Modal */}
      <Modal
        visible={showQueueModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowQueueModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.queueModalContainer}>
            <View style={styles.queueHeaderRow}>
              <Text style={styles.queueModalTitle}>Play Queue</Text>
              <TouchableOpacity onPress={clearQueue} style={styles.clearQueueBtn}>
                <Text style={styles.clearQueueBtnText}>Clear All</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={queue}
              keyExtractor={(item, idx) => `${item._id}-${idx}`}
              contentContainerStyle={{ paddingBottom: 20 }}
              style={{ width: '100%', maxHeight: Dimensions.get('window').height * 0.45 }}
              renderItem={({ item, index }) => {
                const isCurrent = index === currentIndex;
                const isUpcoming = index > currentIndex;

                if (!isCurrent && !isUpcoming) return null; // hide past songs

                return (
                  <View style={[styles.queueItem, isCurrent && styles.queueItemCurrent]}>
                    <View style={styles.queueItemInfo}>
                      <Text style={styles.queueItemTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {isCurrent && <Text style={styles.nowPlayingBadge}>NOW PLAYING</Text>}
                    </View>

                    {isUpcoming && (
                      <View style={styles.queueItemActions}>
                        {/* Move Up */}
                        {index > currentIndex + 1 && (
                          <TouchableOpacity 
                            style={styles.queueActionBtn}
                            onPress={() => reorderQueue(index, index - 1)}
                          >
                            <Ionicons name="arrow-up" size={18} color="#BDB4FF" />
                          </TouchableOpacity>
                        )}
                        
                        {/* Move Down */}
                        {index < queue.length - 1 && (
                          <TouchableOpacity 
                            style={styles.queueActionBtn}
                            onPress={() => reorderQueue(index, index + 1)}
                          >
                            <Ionicons name="arrow-down" size={18} color="#BDB4FF" />
                          </TouchableOpacity>
                        )}

                        {/* Remove */}
                        <TouchableOpacity 
                          style={styles.queueActionBtn}
                          onPress={() => removeFromQueue(index)}
                        >
                          <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyQueueText}>Queue is empty</Text>
              }
            />

            <TouchableOpacity 
              style={styles.closeQueueBtn} 
              onPress={() => setShowQueueModal(false)}
            >
              <Text style={styles.closeQueueBtnText}>Close Queue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#130D22',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#130D22',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
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
    width: 38,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingBottom: 40,
  },
  albumArtContainer: {
    width: ALBUM_ART_SIZE,
    height: ALBUM_ART_SIZE,
    borderRadius: ALBUM_ART_SIZE / 2,
    backgroundColor: '#1C1330',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#332354',
  },
  albumArtCircle: {
    width: ALBUM_ART_SIZE - 20,
    height: ALBUM_ART_SIZE - 20,
    borderRadius: (ALBUM_ART_SIZE - 20) / 2,
    backgroundColor: '#130D22', // Sleek slate color for cover
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  playerCoverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  infoContainer: {
    alignItems: 'center',
    marginVertical: 10,
    width: '100%',
  },
  songTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    width: '100%',
  },
  artistName: {
    fontSize: 16,
    color: '#BDB4FF',
    fontWeight: '500',
  },
  sliderContainer: {
    width: '100%',
    alignItems: 'center',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '95%',
  },
  timeText: {
    fontSize: 13,
    color: '#7C7899',
    fontWeight: '500',
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '80%',
  },
  playPauseButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  secondaryControl: {
    padding: 10,
  },
  extraControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '45%',
    marginTop: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Removed old trim styles
  queueModalContainer: {
    width: '90%',
    backgroundColor: '#1C1330',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#332354',
    maxHeight: '80%',
    alignItems: 'center',
  },
  queueHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#332354',
    paddingBottom: 10,
  },
  queueModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  clearQueueBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#251842',
    borderRadius: 4,
  },
  clearQueueBtnText: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: 'bold',
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#251842',
    width: '100%',
  },
  queueItemCurrent: {
    backgroundColor: '#251842',
    borderRadius: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 0,
  },
  queueItemInfo: {
    flex: 1,
    marginRight: 10,
  },
  queueItemTitle: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  nowPlayingBadge: {
    fontSize: 9,
    color: '#8B5CF6',
    fontWeight: 'bold',
    marginTop: 4,
  },
  queueItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  queueActionBtn: {
    padding: 6,
    marginLeft: 6,
  },
  emptyQueueText: {
    fontSize: 14,
    color: '#7C7899',
    textAlign: 'center',
    marginTop: 20,
  },
  closeQueueBtn: {
    paddingVertical: 10,
  },
  closeQueueBtnText: {
    color: '#7C7899',
    fontSize: 14,
    fontWeight: '500',
  },
  // Removed old trimBtnSaveFull style
  optionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  optionsContainer: {
    backgroundColor: '#1C1330',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#332354',
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#7C7899',
    marginBottom: 15,
    textAlign: 'center',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#251842',
  },
  optionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  optionCancelRow: {
    alignItems: 'center',
    paddingVertical: 15,
    marginTop: 5,
  },
  optionCancelText: {
    color: '#7C7899',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
