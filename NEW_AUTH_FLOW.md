# New Modern Authentication Flow

This document describes the new unified authentication flow implemented for the blii app, which provides a seamless sign-in and sign-up experience for users.

## Overview

The new authentication flow follows modern UX patterns where users don't need to choose between "Sign In" and "Sign Up" upfront. Instead, the app intelligently determines whether a user is new or existing based on their email address.

## Flow Description

### 1. Initial Authentication Screen (`/`)
- **App Branding**: Displays "blii" logo and tagline "Smart recall for a busy mind"
- **Social Authentication**: Google and Apple Sign-In buttons
- **Email Input**: Single email field with real-time validation
- **Continue Button**: Enabled only when email is valid

### 2. User Detection
When a user enters their email and taps "Continue":
- **Existing User**: Redirected to password screen
- **New User**: Redirected to email verification flow

### 3. Password Screen (`/password-screen`) - For Existing Users
- **Email Display**: Shows the entered email address
- **Password Input**: Secure password field with show/hide toggle
- **Forgot Password**: Link to password reset flow
- **Sign In Button**: Authenticates user with Supabase

### 4. Email Verification (`/email-verification`) - For New Users
- **Email Sent**: Automatic sending of verification email
- **4-Digit Code**: Interactive code input with auto-focus
- **Manual Entry**: Option to enter code manually
- **Resend**: Ability to resend verification email
- **Error Handling**: Clear error messages for incorrect codes

### 5. Complete Signup (`/complete-signup`) - For New Users
- **Name Input**: User enters their full name
- **Password Creation**: Secure password and confirmation fields
- **Validation**: Real-time form validation
- **Account Creation**: Creates user account in Supabase

## Key Features

### Smart User Detection
- Automatically detects if email exists in the system
- Seamlessly routes users to appropriate flow
- No manual "Sign In" vs "Sign Up" selection required

### Modern UI/UX
- Clean, minimalist design following iOS/Android guidelines
- Real-time validation with visual feedback
- Smooth transitions between screens
- Keyboard-aware layouts

### Security
- Secure password handling with show/hide toggles
- Email verification for new accounts
- OTP-based verification using Supabase
- Proper error handling and user feedback

### Social Authentication
- Google Sign-In integration
- Apple Sign-In integration (iOS only)
- Direct navigation to main app after social auth

## Technical Implementation

### Screens
- `app/index.tsx` - Main authentication screen
- `app/password-screen.tsx` - Password entry for existing users
- `app/email-verification.tsx` - Email verification for new users
- `app/complete-signup.tsx` - Account completion for new users

### Authentication Service
- Enhanced `services/supabase-auth.ts` with new methods:
  - `sendMagicLink()` - Sends OTP verification emails
  - `verifyOtp()` - Verifies OTP codes
  - Updated error handling for user detection

### Navigation
- Updated `app/_layout.tsx` to include new screens
- Proper screen transitions and back navigation
- Parameter passing between screens

## User Experience Flow

```
User opens app
    ↓
Onboarding screens (optional)
    ↓
Main Auth Screen (/)
    ↓
User enters email
    ↓
[System checks if user exists]
    ↓
Existing User? → Password Screen → Main App
    ↓
New User? → Email Verification → Complete Signup → Main App
```

## Benefits

1. **Simplified Onboarding**: Users don't need to choose between sign-in/sign-up
2. **Reduced Friction**: Fewer steps to get started
3. **Better UX**: Modern, intuitive interface
4. **Security**: Proper email verification and password handling
5. **Flexibility**: Supports both social and email authentication

## Future Enhancements

- Phone number authentication
- Biometric authentication
- Multi-factor authentication
- Account linking (merge social and email accounts)
- Passwordless authentication with magic links
