import React, { useState, useContext } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Card,
  Title,
  Paragraph,
  ActivityIndicator,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { AuthContext } from '../context/AuthContext';
import { theme } from '../theme';
import apiService from '../services/apiService';

const LoginScreen = () => {
  const [accessKey, setAccessKey] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);

  const handleLogin = async () => {
    if (!accessKey.trim()) {
      Alert.alert('Hata', 'Lütfen access key\'i girin');
      return;
    }

    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const response = await apiService.verifyKey(accessKey.trim());
      
      if (response.success) {
        const success = await login(accessKey.trim());
        if (success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(
            'Başarılı!', 
            `Hoş geldiniz, ${response.profile.name}!\n${response.bots.length} bot erişiminize açıldı.`
          );
        }
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error('Login hatası:', error);
      Alert.alert(
        'Giriş Hatası', 
        error.response?.data?.error || 'Geçersiz access key'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.secondary]}
          style={styles.gradient}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Title style={styles.title}>Bot Manager</Title>
              <Paragraph style={styles.subtitle}>
                Botlarınızı yönetmek için access key'inizi girin
              </Paragraph>
            </View>

            <Card style={styles.card}>
              <Card.Content>
                <TextInput
                  label="Access Key"
                  value={accessKey}
                  onChangeText={setAccessKey}
                  mode="outlined"
                  secureTextEntry
                  style={styles.input}
                  placeholder="64 karakter uzunluğunda key..."
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />

                <Button
                  mode="contained"
                  onPress={handleLogin}
                  loading={loading}
                  disabled={loading || !accessKey.trim()}
                  style={styles.button}
                  contentStyle={styles.buttonContent}
                >
                  {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                </Button>
              </Card.Content>
            </Card>

            <View style={styles.footer}>
              <Paragraph style={styles.footerText}>
                Access key'inizi masaüstü uygulamasından alabilirsiniz
              </Paragraph>
            </View>
          </View>
        </LinearGradient>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  card: {
    borderRadius: theme.borderRadius.large,
    elevation: 8,
  },
  input: {
    marginBottom: theme.spacing.lg,
  },
  button: {
    borderRadius: theme.borderRadius.medium,
  },
  buttonContent: {
    paddingVertical: theme.spacing.sm,
  },
  footer: {
    alignItems: 'center',
    marginTop: theme.spacing.xl,
  },
  footerText: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    fontSize: 14,
  },
});

export default LoginScreen;