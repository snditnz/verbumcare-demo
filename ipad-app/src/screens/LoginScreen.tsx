import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, Image, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '@stores/authStore';
import { useAssessmentStore } from '@stores/assessmentStore';
import { LanguageToggle } from '@components';
import { Button, Card } from '@components/ui';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '@constants/theme';

const logoMark = require('../../VerbumCare-Logo-Mark.png');

type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuthStore();
  const { language } = useAssessmentStore();
  const t = translations[language];

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert(
        language === 'ja' ? 'エラー' : 'Error',
        language === 'ja' ? 'ユーザー名とパスワードを入力してください' : 'Please enter username and password'
      );
      return;
    }

    setIsLoggingIn(true);

    try {
      const success = await login(username, password);

      if (success) {
        // Navigate to Dashboard
        navigation.replace('Dashboard' as any);
      } else {
        Alert.alert(
          language === 'ja' ? 'ログイン失敗' : 'Login Failed',
          language === 'ja'
            ? 'ユーザー名またはパスワードが正しくありません'
            : 'Invalid username or password'
        );
      }
    } catch (error) {
      Alert.alert(
        language === 'ja' ? 'エラー' : 'Error',
        language === 'ja' ? 'ログインに失敗しました' : 'Login failed. Please try again.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Language Toggle */}
      <View style={styles.header}>
        <View style={{ flex: 1 }} />
        <View style={styles.headerCenter}>
          <Image source={logoMark} style={styles.logoImage} resizeMode="contain" />
          <Text style={styles.logo}>VerbumCare</Text>
        </View>
        <View style={styles.headerRight}>
          <LanguageToggle />
        </View>
      </View>

      {/* Login Card */}
      <View style={styles.content}>
        <Card style={styles.loginCard}>
          <Text style={styles.welcomeText}>
            {language === 'ja' ? 'ようこそ' : 'Welcome'}
          </Text>
          <Text style={styles.subtitleText}>
            {language === 'ja' ? 'ケア記録システムにログイン' : 'Sign in to VerbumCare'}
          </Text>

          {/* Username Field */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              {language === 'ja' ? 'ユーザー名' : 'Username'}
            </Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color={COLORS.text.secondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={language === 'ja' ? 'ユーザー名を入力' : 'Enter username'}
                placeholderTextColor={COLORS.text.disabled}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                editable={!isLoggingIn}
              />
            </View>
          </View>

          {/* Password Field */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              {language === 'ja' ? 'パスワード' : 'Password'}
            </Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.text.secondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={language === 'ja' ? 'パスワードを入力' : 'Enter password'}
                placeholderTextColor={COLORS.text.disabled}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={handleLogin}
                editable={!isLoggingIn}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.showPasswordButton}
                disabled={isLoggingIn}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={COLORS.text.secondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Remember Me */}
          <TouchableOpacity
            style={styles.rememberMeContainer}
            onPress={() => setRememberMe(!rememberMe)}
            disabled={isLoggingIn}
          >
            <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
              {rememberMe && <Ionicons name="checkmark" size={16} color={COLORS.white} />}
            </View>
            <Text style={styles.rememberMeText}>
              {language === 'ja' ? 'ログイン状態を保持' : 'Remember me'}
            </Text>
          </TouchableOpacity>

          {/* Login Button */}
          <Button
            variant="primary"
            onPress={handleLogin}
            disabled={isLoggingIn}
            style={{ marginTop: SPACING.xl }}
          >
            {isLoggingIn ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={COLORS.white} size="small" />
                <Text style={styles.buttonText}>
                  {language === 'ja' ? 'ログイン中...' : 'Signing in...'}
                </Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>
                {language === 'ja' ? 'ログイン' : 'Sign In'}
              </Text>
            )}
          </Button>
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  headerCenter: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  logoImage: {
    width: 48,
    height: 48,
  },
  logo: {
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.white,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  loginCard: {
    width: '100%',
    maxWidth: 500,
    padding: SPACING['2xl'],
  },
  welcomeText: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  subtitleText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: SPACING['2xl'],
  },
  inputContainer: {
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  inputIcon: {
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    paddingVertical: SPACING.md,
  },
  showPasswordButton: {
    padding: SPACING.sm,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    marginRight: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  rememberMeText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  buttonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.white,
  },
});
