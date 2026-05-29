import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, TouchableOpacity, TextInput, Dimensions, Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/services/api';
import { useAudio, Music } from '../src/context/AudioContext';

const { width } = Dimensions.get('window');
const GRID_ITEM_WIDTH = (width - 30) / 2;

type TabType = 'songs' | 'search' | 'profile';

export default function HomeScreen() {
  const [musicList, setMusicList] = useState<Music[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Navigation & UI States
  const [activeTab, setActiveTab] = useState<TabType>('songs');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Profile & User States
  const [user, setUser] = useState<{ username: string; email: string } | null>(null);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showProfilePassword, setShowProfilePassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Consume audio playback controls and states from global context
  const { 
    currentlyPlaying, 
    isPlaying, 
    play, 
    pause, 
    resume 
  } = useAudio();

  useEffect(() => {
    fetchMusic();
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await api.getUser();
      console.log('👤 Loaded user data in home.tsx:', userData);
      setUser(userData);
    } catch (err) {
      console.log('Error loading user:', err);
    }
  };

  const fetchMusic = async () => {
    try {
      const token = await api.getToken();
      
      if (!token) {
        Alert.alert('Error', 'Please login first');
        router.replace('/');
        return;
      }

      const response = await api.fetchMusic();
      console.log('✅ Music fetched:', response);
      setMusicList(response.data || []);
      
    } catch (error: any) {
      console.log('❌ Fetch error:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to fetch music');
      
      // If unauthorized, redirect to login
      if (error.response?.status === 401) {
        await api.clearAuth();
        router.replace('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (isPlaying) {
      await pause();
    }
    
    await api.clearAuth();
    Alert.alert('Success', 'Logged out successfully');
    router.replace('/');
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmNewPassword) {
      Alert.alert('Error', 'Please fill all password fields');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    setUpdatingPassword(true);
    try {
      const response = await api.changePassword(oldPassword, newPassword);
      Alert.alert('Success', response.message || 'Password changed successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error: any) {
      console.log('❌ Change Password Error:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to change password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  // When clicking the row, load/play the song and open the full modal player
  const handleRowPress = async (item: Music) => {
    if (currentlyPlaying?._id !== item._id) {
      await play(item);
    }
    router.push('/player');
  };

  // When clicking the play/pause icon, toggle playback inline without showing modal
  const handlePlayIconPress = async (item: Music) => {
    if (currentlyPlaying?._id === item._id) {
      if (isPlaying) {
        await pause();
      } else {
        await resume();
      }
    } else {
      await play(item);
    }
  };

  // Main Item Renderer (Grid card)
  const renderMusicItem = ({ item }: { item: Music }) => {
    const isCurrentTrack = currentlyPlaying?._id === item._id;
    const isCurrentPlaying = isCurrentTrack && isPlaying;
    
    return (
      <TouchableOpacity 
        style={[
          styles.gridBox,
          isCurrentTrack && styles.musicBoxPlaying
        ]} 
        onPress={() => handleRowPress(item)}
      >
        <View style={styles.gridCover}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.gridCoverImage} />
          ) : (
            <Ionicons name="musical-notes-outline" size={40} color="#fff" />
          )}
          <TouchableOpacity 
            style={styles.gridPlayButton}
            onPress={() => handlePlayIconPress(item)}
          >
            <Ionicons 
              name={isCurrentPlaying ? 'pause' : 'play'} 
              size={18} 
              color="#007AFF" 
              style={isCurrentPlaying ? null : { marginLeft: 2 }}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.gridInfo}>
          <Text style={styles.gridTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.gridDuration}>⏱ {item.duration}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // --- SUB TAB RENDERS ---

  const renderSongsTab = () => {
    return (
      <View style={styles.tabContentContainer}>
        {/* Songs Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Musiana Library</Text>
        </View>

        {musicList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No music available</Text>
          </View>
        ) : (
          <FlatList
            key="grid"
            numColumns={2}
            data={musicList}
            renderItem={renderMusicItem}
            keyExtractor={(item) => item._id}
            extraData={{ currentlyPlaying, isPlaying }}
            contentContainerStyle={[
              styles.listContainer,
              currentlyPlaying ? { paddingBottom: 160 } : { paddingBottom: 80 }
            ]}
            columnWrapperStyle={styles.gridRow}
          />
        )}
      </View>
    );
  };

  const renderSearchTab = () => {
    const filteredMusic = musicList.filter(song =>
      song.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <View style={styles.tabContentContainer}>
        {/* Search Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Search Music</Text>
        </View>

        {/* Search Input Bar */}
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search songs by title..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
            autoCapitalize="none"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
              <Ionicons name="close-circle" size={18} color="#666" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Results Grid */}
        {filteredMusic.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No matching songs found</Text>
          </View>
        ) : (
          <FlatList
            key="search-grid"
            numColumns={2}
            data={filteredMusic}
            renderItem={renderMusicItem}
            keyExtractor={(item) => item._id}
            extraData={{ currentlyPlaying, isPlaying }}
            contentContainerStyle={[
              styles.listContainer,
              currentlyPlaying ? { paddingBottom: 160 } : { paddingBottom: 80 }
            ]}
            columnWrapperStyle={styles.gridRow}
          />
        )}
      </View>
    );
  };

  const renderProfileTab = () => {
    return (
      <View style={styles.tabContentContainer}>
        {/* Profile Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>User Profile</Text>
        </View>

        <FlatList
          data={[1]} // Wrap in FlatList so page remains scrollable
          keyExtractor={(item) => item.toString()}
          contentContainerStyle={[
            styles.profileScrollContainer,
            currentlyPlaying ? { paddingBottom: 160 } : { paddingBottom: 80 }
          ]}
          renderItem={() => (
            <View style={styles.profileContent}>
              {/* User details card */}
              <View style={styles.profileCard}>
                <View style={styles.avatarCircle}>
                  <Ionicons name="person" size={32} color="#fff" />
                </View>
                <View style={styles.profileDetails}>
                  <Text style={styles.profileUsername}>{user?.username || 'Username'}</Text>
                  <Text style={styles.profileEmail}>{user?.email || 'email@example.com'}</Text>
                </View>
              </View>

              {/* Password update form */}
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>Change Password</Text>

                <View style={styles.formInputContainer}>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Old Password"
                    value={oldPassword}
                    onChangeText={setOldPassword}
                    secureTextEntry={!showProfilePassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity 
                    style={styles.formEyeButton}
                    onPress={() => setShowProfilePassword(!showProfilePassword)}
                  >
                    <Ionicons 
                      name={showProfilePassword ? 'eye-off-outline' : 'eye-outline'} 
                      size={20} 
                      color="#666" 
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.formInputContainer}>
                  <TextInput
                    style={styles.formInput}
                    placeholder="New Password"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showProfilePassword}
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.formInputContainer}>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Confirm New Password"
                    value={confirmNewPassword}
                    onChangeText={setConfirmNewPassword}
                    secureTextEntry={!showProfilePassword}
                    autoCapitalize="none"
                  />
                </View>

                <TouchableOpacity 
                  style={styles.formSubmitButton}
                  onPress={handleChangePassword}
                  disabled={updatingPassword}
                >
                  <Text style={styles.formSubmitText}>
                    {updatingPassword ? 'Updating...' : 'Update Password'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Logout button */}
              <TouchableOpacity style={styles.profileLogoutButton} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={20} color="#fff" style={styles.logoutIcon} />
                <Text style={styles.profileLogoutText}>Log Out</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading music...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab Switcher Body */}
      {activeTab === 'songs' && renderSongsTab()}
      {activeTab === 'search' && renderSearchTab()}
      {activeTab === 'profile' && renderProfileTab()}

      {/* Floating Mini Player Bar (Above bottom tab bar) */}
      {currentlyPlaying && (
        <TouchableOpacity 
          style={styles.miniPlayerContainer}
          onPress={() => router.push('/player')}
        >
          <View style={styles.miniPlayerArt}>
            <Ionicons name="musical-notes" size={20} color="#fff" />
          </View>
          <View style={styles.miniPlayerInfo}>
            <Text style={styles.miniPlayerTitle} numberOfLines={1}>
              {currentlyPlaying.title}
            </Text>
            <Text style={styles.miniPlayerSubtitle}>
              {isPlaying ? 'Playing Now' : 'Paused'}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.miniPlayerPlayButton}
            onPress={() => isPlaying ? pause() : resume()}
          >
            <Ionicons 
              name={isPlaying ? 'pause' : 'play'} 
              size={22} 
              color="#007AFF" 
              style={isPlaying ? null : { marginLeft: 2 }}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* Fixed Bottom Tab Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'songs' && styles.tabItemActive]}
          onPress={() => setActiveTab('songs')}
        >
          <Ionicons 
            name={activeTab === 'songs' ? 'musical-notes' : 'musical-notes-outline'} 
            size={22} 
            color={activeTab === 'songs' ? '#007AFF' : '#666'} 
          />
          <Text style={[styles.tabLabel, activeTab === 'songs' && styles.tabLabelActive]}>
            Songs
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'search' && styles.tabItemActive]}
          onPress={() => setActiveTab('search')}
        >
          <Ionicons 
            name={activeTab === 'search' ? 'search' : 'search-outline'} 
            size={22} 
            color={activeTab === 'search' ? '#007AFF' : '#666'} 
          />
          <Text style={[styles.tabLabel, activeTab === 'search' && styles.tabLabelActive]}>
            Search
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'profile' && styles.tabItemActive]}
          onPress={() => setActiveTab('profile')}
        >
          <Ionicons 
            name={activeTab === 'profile' ? 'person' : 'person-outline'} 
            size={22} 
            color={activeTab === 'profile' ? '#007AFF' : '#666'} 
          />
          <Text style={[styles.tabLabel, activeTab === 'profile' && styles.tabLabelActive]}>
            Profile
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  tabContentContainer: {
    flex: 1,
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  listContainer: {
    paddingHorizontal: 10,
    paddingTop: 15,
  },
  gridRow: {
    justifyContent: 'space-between',
  },
  musicBoxPlaying: {
    backgroundColor: '#E8F4FF',
    borderColor: '#007AFF',
  },
  gridBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: GRID_ITEM_WIDTH,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gridCover: {
    height: 120,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  gridCoverImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  gridPlayButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  gridInfo: {
    padding: 10,
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  gridDuration: {
    fontSize: 12,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  miniPlayerContainer: {
    position: 'absolute',
    bottom: 80, // Sit directly above bottom tab bar
    left: 15,
    right: 15,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#eee',
  },
  miniPlayerArt: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  miniPlayerInfo: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 10,
  },
  miniPlayerTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  miniPlayerSubtitle: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2,
  },
  miniPlayerPlayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F7FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 65,
    backgroundColor: '#fff',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingBottom: 10,
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  tabItemActive: {
    backgroundColor: '#FAFDFE',
  },
  tabLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 3,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 15,
    borderRadius: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 45,
    fontSize: 16,
    color: '#333',
  },
  clearSearchButton: {
    padding: 5,
  },
  profileScrollContainer: {
    flexGrow: 1,
  },
  profileContent: {
    padding: 20,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  profileDetails: {
    flex: 1,
  },
  profileUsername: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  formCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  formInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  formInput: {
    flex: 1,
    padding: 12,
    fontSize: 15,
    color: '#333',
  },
  formEyeButton: {
    padding: 12,
  },
  formSubmitButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 5,
  },
  formSubmitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  profileLogoutButton: {
    flexDirection: 'row',
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  profileLogoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutIcon: {
    marginRight: 8,
  },
});
