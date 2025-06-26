import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding2" />
      <Stack.Screen name="onboarding3" />
      <Stack.Screen name="loginscreen" />
      <Stack.Screen name="signupscreen" />
      <Stack.Screen name="forgotpassword" />
      <Stack.Screen name="forgotpasswordconfirmation" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
