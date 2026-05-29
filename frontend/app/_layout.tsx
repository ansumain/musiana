import { Stack } from 'expo-router';
import { AudioProvider } from '../src/context/AudioContext';

export default function RootLayout() {
  return (
    <AudioProvider>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Login' }} />
        <Stack.Screen name="register" options={{ title: 'Register' }} />
        <Stack.Screen name="forgot-password" options={{ title: 'Reset Password' }} />
        <Stack.Screen 
          name="home" 
          options={{ 
            title: 'Home',
            headerShown: false  // Hide default header, we have custom one
          }} 
        />
        <Stack.Screen 
          name="player" 
          options={{ 
            presentation: 'modal',
            headerShown: false
          }} 
        />
      </Stack>
    </AudioProvider>
  );
}