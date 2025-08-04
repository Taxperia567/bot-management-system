import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Chip,
  FAB,
  Searchbar,
  Text,
} from 'react-native-paper';
import * as Haptics from 'expo-haptics';

import { SocketContext } from '../context/SocketContext';
import { theme } from '../theme';
import apiService from '../services/apiService';

const BotListScreen = ({ navigation }) => {
  const [bots, setBots] = useState([]);
  const [filteredBots, setFilteredBots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { socket } = useContext(SocketContext);

  useEffect(() => {
    loadBots();
    
    if (socket) {
      socket.on('botStatusUpdate', handleBotStatusUpdate);
      return () => socket.off('botStatusUpdate', handleBotStatusUpdate);
    }
  }, [socket]);

  useEffect(() => {
    filterBots();
  }, [bots, searchQuery, statusFilter]);

  const loadBots = async () => {
    try {
      setLoading(true);
      const data = await apiService.getBots();
      setBots(data);
    } catch (error) {
      console.error('Bot listesi yükleme hatası:', error);
      Alert.alert('Hata', 'Bot listesi yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleBotStatusUpdate = (statusUpdate) => {
    setBots(prevBots =>
      prevBots.map(bot =>
        bot.id === statusUpdate.botId || bot.name === statusUpdate.botName
          ? { ...bot, status: statusUpdate.status, last_ping: statusUpdate.timestamp }
          : bot
      )
    );
  };

  const filterBots = () => {
    let filtered = bots;

    if (searchQuery) {
      filtered = filtered.filter(bot =>
        bot.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(bot => bot.status === statusFilter);
    }

    setFilteredBots(filtered);
  };

  const handleBotAction = async (bot, action) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await apiService.controlBot(bot.id, action);
      Alert.alert('Başarılı', `${bot.name} için ${action} komutu gönderildi`);
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

  const formatLastPing = (timestamp) => {
    if (!timestamp) return 'Hiç';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Az önce';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} dk önce`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} sa önce`;
    return date.toLocaleDateString('tr-TR');
  };

  const renderBotCard = ({ item: bot }) => (
    <Card style={styles.botCard} onPress={() => navigation.navigate('BotDetail', { bot })}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <Title style={styles.botName}>{bot.name}</Title>
          <Chip 
            mode="outlined"
            style={[styles.statusChip, { borderColor: getStatusColor(bot.status) }]}
            textStyle={{ color: getStatusColor(bot.status) }}
          >
            {getStatusText(bot.status)}
          </Chip>
        </View>

        <Paragraph style={styles.botInfo}>
          Son ping: {formatLastPing(bot.last_ping)}
        </Paragraph>

        {bot.description && (
          <Paragraph style={styles.botDescription}>{bot.description}</Paragraph>
        )}

        <View style={styles.cardActions}>
          {bot.status === 'offline' ? (
            <Button
              mode="contained"
              onPress={() => handleBotAction(bot, 'start')}
              style={[styles.actionButton, { backgroundColor: theme.colors.success }]}
              compact
            >
              Başlat
            </Button>
          ) : (
            <Button
              mode="contained"
              onPress={() => handleBotAction(bot, 'stop')}
              style={[styles.actionButton, { backgroundColor: theme.colors.error }]}
              compact
            >
              Durdur
            </Button>
          )}
          
          <Button
            mode="outlined"
            onPress={() => handleBotAction(bot, 'restart')}
            style={styles.actionButton}
            compact
          >
            Yeniden Başlat
          </Button>
        </View>
      </Card.Content>
    </Card>
  );

  const StatusFilterChips = () => (
    <View style={styles.filterContainer}>
      {['all', 'online', 'offline', 'crashed'].map(status => (
        <Chip
          key={status}
          selected={statusFilter === status}
          onPress={() => setStatusFilter(status)}
          style={styles.filterChip}
        >
          {status === 'all' ? 'Hepsi' : getStatusText(status)}
        </Chip>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Title style={styles.headerTitle}>Botlarım ({filteredBots.length})</Title>
        
        <Searchbar
          placeholder="Bot ara..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />
        
        <StatusFilterChips />
      </View>

      <FlatList
        data={filteredBots}
        renderItem={renderBotCard}
        keyExtractor={(item) => item.id?.toString() || item.name}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadBots} />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Bot bulunamadı</Text>
            <Paragraph style={styles.emptySubtext}>
              Arama kriterlerinize uygun bot bulunamadı
            </Paragraph>
          </View>
        }
      />

      <FAB
        icon="refresh"
        style={styles.fab}
        onPress={loadBots}
        disabled={loading}
      />
    </View>
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
    marginBottom: theme.spacing.sm,
  },
  searchBar: {
    marginBottom: theme.spacing.sm,
  },
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  filterChip: {
    marginRight: theme.spacing.xs,
  },
  listContainer: {
    padding: theme.spacing.md,
  },
  botCard: {
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.medium,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  botName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
  },
  statusChip: {
    borderWidth: 2,
  },
  botInfo: {
    color: theme.colors.onSurfaceVariant,
    fontSize: 14,
    marginBottom: theme.spacing.xs,
  },
  botDescription: {
    color: theme.colors.onSurfaceVariant,
    fontSize: 14,
    marginBottom: theme.spacing.md,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
  },
  actionButton: {
    borderRadius: theme.borderRadius.small,
  },
  fab: {
    position: 'absolute',
    margin: theme.spacing.md,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl * 2,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.onSurfaceVariant,
    marginBottom: theme.spacing.sm,
  },
  emptySubtext: {
    textAlign: 'center',
    color: theme.colors.onSurfaceVariant,
  },
});

export default BotListScreen;