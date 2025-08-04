import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Chip,
  List,
  Divider,
  ActivityIndicator,
  Text,
} from 'react-native-paper';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';

import { theme } from '../theme';
import apiService from '../services/apiService';

const screenWidth = Dimensions.get('window').width;

const BotDetailScreen = ({ route, navigation }) => {
  const { bot } = route.params;
  const [botDetail, setBotDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusHistory, setStatusHistory] = useState([]);

  useEffect(() => {
    loadBotDetail();
  }, []);

  const loadBotDetail = async () => {
    try {
      setLoading(true);
      const data = await apiService.getBotDetail(bot.id);
      setBotDetail(data.bot);
      setStatusHistory(data.history.slice(0, 20)); // Son 20 durum
    } catch (error) {
      console.error('Bot detay yükleme hatası:', error);
      Alert.alert('Hata', 'Bot detayları yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadBotDetail();
    setRefreshing(false);
  };

  const handleBotAction = async (action) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      Alert.alert(
        'Onay',
        `${bot.name} botunu ${action === 'start' ? 'başlatmak' : action === 'stop' ? 'durdurmak' : 'yeniden başlatmak'} istediğinizden emin misiniz?`,
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Evet',
            onPress: async () => {
              await apiService.controlBot(bot.id, action);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Başarılı', `${action} komutu gönderildi`);
              await loadBotDetail();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Bot kontrol hatası:', error);
      Alert.alert('Hata', 'Bot kontrol edilemedi');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return theme.colors.success;
      case 'offline': return theme.colors.error;
      case 'crashed': return theme.colors.warning;
      default: return theme.colors.outline;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'online': return 'Çevrimiçi';
      case 'offline': return 'Çevrimdışı';
      case 'crashed': return 'Çökmüş';
      case 'maintenance': return 'Bakım';
      default: return 'Bilinmiyor';
    }
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString('tr-TR');
  };

  const getUptimePercentage = () => {
    if (!statusHistory.length) return 0;
    const onlineCount = statusHistory.filter(h => h.status === 'online').length;
    return ((onlineCount / statusHistory.length) * 100).toFixed(1);
  };

  const prepareChartData = () => {
    if (!statusHistory.length) return null;

    const last24Hours = statusHistory.slice(-24);
    const labels = last24Hours.map((_, index) => `${index + 1}`);
    const data = last24Hours.map(h => h.status === 'online' ? 1 : 0);

    return {
      labels,
      datasets: [
        {
          data,
          color: (opacity = 1) => `rgba(46, 204, 113, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Bot detayları yükleniyor...</Text>
      </View>
    );
  }

  const chartData = prepareChartData();

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Bot Başlık Kartı */}
      <Card style={styles.headerCard}>
        <Card.Content>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Title style={styles.botName}>{botDetail?.name || bot.name}</Title>
              <Paragraph style={styles.botDescription}>
                {botDetail?.description || 'Açıklama yok'}
              </Paragraph>
            </View>
            <Chip 
              mode="flat"
              style={[styles.statusChip, { backgroundColor: getStatusColor(botDetail?.status || bot.status) }]}
              textStyle={{ color: 'white', fontWeight: 'bold' }}
            >
              {getStatusText(botDetail?.status || bot.status)}
            </Chip>
          </View>
        </Card.Content>
      </Card>

      {/* Bot Bilgileri */}
      <Card style={styles.infoCard}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Bot Bilgileri</Title>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Ana Dosya</Text>
              <Text style={styles.infoValue}>{botDetail?.main_file || 'Belirtilmemiş'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Son Ping</Text>
              <Text style={styles.infoValue}>
                {botDetail?.last_ping ? formatDate(botDetail.last_ping) : 'Hiç'}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Oluşturulma</Text>
              <Text style={styles.infoValue}>
                {botDetail?.created_at ? formatDate(botDetail.created_at) : 'Bilinmiyor'}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Uptime</Text>
              <Text style={styles.infoValue}>{getUptimePercentage()}%</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Uptime Grafiği */}
      {chartData && (
        <Card style={styles.chartCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Son 24 Saat Durum Grafiği</Title>
            <LineChart
              data={chartData}
              width={screenWidth - 60}
              height={220}
              chartConfig={{
                backgroundColor: theme.colors.surface,
                backgroundGradientFrom: theme.colors.surface,
                backgroundGradientTo: theme.colors.surface,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(102, 126, 234, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(44, 62, 80, ${opacity})`,
                style: { borderRadius: 16 },
                propsForDots: {
                  r: '4',
                  strokeWidth: '2',
                  stroke: theme.colors.primary,
                },
              }}
              bezier
              style={styles.chart}
            />
          </Card.Content>
        </Card>
      )}

      {/* Kontrol Butonları */}
      <Card style={styles.controlCard}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Bot Kontrolü</Title>
          <View style={styles.controlButtons}>
            {botDetail?.status === 'offline' ? (
              <Button
                mode="contained"
                onPress={() => handleBotAction('start')}
                style={[styles.controlButton, { backgroundColor: theme.colors.success }]}
                icon="play"
              >
                Başlat
              </Button>
            ) : (
              <Button
                mode="contained"
                onPress={() => handleBotAction('stop')}
                style={[styles.controlButton, { backgroundColor: theme.colors.error }]}
                icon="stop"
              >
                Durdur
              </Button>
            )}
            
            <Button
              mode="outlined"
              onPress={() => handleBotAction('restart')}
              style={styles.controlButton}
              icon="restart"
            >
              Yeniden Başlat
            </Button>
            
            <Button
              mode="outlined"
              onPress={() => navigation.navigate('BotEditor', { bot: botDetail || bot })}
              style={styles.controlButton}
              icon="pencil"
            >
              Düzenle
            </Button>
          </View>
        </Card.Content>
      </Card>

      {/* Durum Geçmişi */}
      <Card style={styles.historyCard}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Son Durum Değişiklikleri</Title>
          {statusHistory.map((history, index) => (
            <React.Fragment key={history.id || index}>
              <List.Item
                title={getStatusText(history.status)}
                description={formatDate(history.timestamp)}
                left={() => (
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(history.status) }]} />
                )}
                right={() => (
                  <Text style={styles.sourceText}>{history.source || 'sistem'}</Text>
                )}
              />
              {index < statusHistory.length - 1 && <Divider />}
            </React.Fragment>
          ))}
          
          {statusHistory.length === 0 && (
            <Text style={styles.emptyText}>Henüz durum geçmişi bulunmuyor</Text>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    color: theme.colors.onSurfaceVariant,
  },
  headerCard: {
    margin: theme.spacing.md,
    borderRadius: theme.borderRadius.medium,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  botName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  botDescription: {
    color: theme.colors.onSurfaceVariant,
    marginTop: theme.spacing.xs,
  },
  statusChip: {
    borderRadius: theme.borderRadius.medium,
  },
  infoCard: {
    margin: theme.spacing.md,
    marginTop: 0,
    borderRadius: theme.borderRadius.medium,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginBottom: theme.spacing.md,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  infoItem: {
    width: '48%',
    marginBottom: theme.spacing.md,
  },
  infoLabel: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginBottom: theme.spacing.xs,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.onSurface,
  },
  chartCard: {
    margin: theme.spacing.md,
    marginTop: 0,
    borderRadius: theme.borderRadius.medium,
    elevation: 3,
  },
  chart: {
    marginVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.medium,
  },
  controlCard: {
    margin: theme.spacing.md,
    marginTop: 0,
    borderRadius: theme.borderRadius.medium,
    elevation: 3,
  },
  controlButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  controlButton: {
    flex: 1,
    minWidth: '30%',
    borderRadius: theme.borderRadius.small,
  },
  historyCard: {
    margin: theme.spacing.md,
    marginTop: 0,
    marginBottom: theme.spacing.xl,
    borderRadius: theme.borderRadius.medium,
    elevation: 3,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    alignSelf: 'center',
    marginRight: theme.spacing.sm,
  },
  sourceText: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    alignSelf: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.onSurfaceVariant,
    fontStyle: 'italic',
    paddingVertical: theme.spacing.lg,
  },
});

export default BotDetailScreen;