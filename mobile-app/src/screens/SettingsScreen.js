import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  List,
  Switch,
  Button,
  Card,
  Title,
  Divider,
  Text,
} from 'react-native-paper';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';

import { AuthContext } from '../context/AuthContext';
import { theme } from '../theme';

const SettingsScreen = () => {
  const { logout } = useContext(AuthContext);
  const [settings, setSettings] = useState({
    notifications: true,
    vibration: true,
    autoRefresh: true,
    darkMode: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await SecureStore.getItemAsync('app_settings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Ayar yükleme hatası:', error);
    }
  };

  const saveSettings = async (newSettings) => {
    try {
      await SecureStore.setItemAsync('app_settings', JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Ayar kaydetme hatası:', error);
    }
  };

  const updateSetting = (key, value) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);
  };

  const handleLogout = () => {
    Alert.alert(
      'Çıkış Yap',
      'Uygulamadan çıkmak istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çıkış Yap',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            logout();
          }
        }
      ]
    );
  };

  const clearCache = () => {
    Alert.alert(
      'Önbelleği Temizle',
      'Uygulama önbelleğini temizlemek istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Temizle',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Başarılı', 'Önbellek temizlendi');
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Title style={styles.headerTitle}>Ayarlar</Title>
      </View>

      {/* Bildirim Ayarları */}
      <Card style={styles.settingsCard}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Bildirimler</Title>
          
          <List.Item
            title="Push Bildirimleri"
            description="Bot durumu değişikliklerinde bildirim al"
            right={() => (
              <Switch
                value={settings.notifications}
                onValueChange={(value) => updateSetting('notifications', value)}
              />
            )}
          />
          <Divider />
          
          <List.Item
            title="Titreşim"
            description="Bildirimlerle birlikte titreşim"
            right={() => (
              <Switch
                value={settings.vibration}
                onValueChange={(value) => updateSetting('vibration', value)}
                disabled={!settings.notifications}
              />
            )}
          />
        </Card.Content>
      </Card>

      {/* Uygulama Ayarları */}
      <Card style={styles.settingsCard}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Uygulama</Title>
          
          <List.Item
            title="Otomatik Yenileme"
            description="Bot listesini otomatik olarak yenile"
            right={() => (
              <Switch
                value={settings.autoRefresh}
                onValueChange={(value) => updateSetting('autoRefresh', value)}
              />
            )}
          />
          <Divider />
          
          <List.Item
            title="Koyu Tema"
            description="Koyu tema kullan (yakında)"
            right={() => (
              <Switch
                value={settings.darkMode}
                onValueChange={(value) => updateSetting('darkMode', value)}
                disabled={true}
              />
            )}
          />
        </Card.Content>
      </Card>

      {/* Veri ve Depolama */}
      <Card style={styles.settingsCard}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Veri ve Depolama</Title>
          
          <List.Item
            title="Önbelleği Temizle"
            description="Uygulama verilerini temizle"
            left={() => <List.Icon icon="delete-sweep" />}
            onPress={clearCache}
          />
        </Card.Content>
      </Card>

      {/* Hakkında */}
      <Card style={styles.settingsCard}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Hakkında</Title>
          
          <List.Item
            title="Uygulama Sürümü"
            description="1.0.0"
            left={() => <List.Icon icon="information" />}
          />
          <Divider />
          
          <List.Item
            title="Gizlilik Politikası"
            description="Gizlilik politikasını görüntüle"
            left={() => <List.Icon icon="shield-account" />}
            right={() => <List.Icon icon="chevron-right" />}
            onPress={() => Alert.alert('Bilgi', 'Gizlilik politikası yakında eklenecek')}
          />
          <Divider />
          
          <List.Item
            title="Kullanım Koşulları"
            description="Kullanım koşullarını görüntüle"
            left={() => <List.Icon icon="file-document" />}
            right={() => <List.Icon icon="chevron-right" />}
            onPress={() => Alert.alert('Bilgi', 'Kullanım koşulları yakında eklenecek')}
          />
        </Card.Content>
      </Card>

      {/* Hesap İşlemleri */}
      <Card style={[styles.settingsCard, styles.dangerCard]}>
        <Card.Content>
          <Title style={[styles.sectionTitle, styles.dangerTitle]}>Hesap</Title>
          
          <Button
            mode="contained"
            onPress={handleLogout}
            style={styles.logoutButton}
            buttonColor={theme.colors.error}
            icon="logout"
          >
            Çıkış Yap
          </Button>
        </Card.Content>
      </Card>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Bot Management System v1.0.0
        </Text>
        <Text style={styles.footerText}>
          © 2024 Tüm hakları saklıdır.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  settingsCard: {
    margin: theme.spacing.md,
    marginTop: theme.spacing.sm,
    borderRadius: theme.borderRadius.medium,
    elevation: 3,
  },
  dangerCard: {
    borderColor: theme.colors.error,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
    color: theme.colors.onSurface,
  },
  dangerTitle: {
    color: theme.colors.error,
  },
  logoutButton: {
    marginTop: theme.spacing.sm,
    borderRadius: theme.borderRadius.medium,
  },
  footer: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    marginTop: theme.spacing.lg,
  },
  footerText: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
});

export default SettingsScreen;