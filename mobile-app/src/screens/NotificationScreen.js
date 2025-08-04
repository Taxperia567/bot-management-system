import React, { useContext, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Chip,
  IconButton,
  Text,
  Divider,
  FAB,
} from 'react-native-paper';
import * as Haptics from 'expo-haptics';

import { NotificationContext } from '../context/NotificationContext';
import { theme } from '../theme';

const NotificationsScreen = ({ navigation }) => {
  const { notifications, setNotifications } = useContext(NotificationContext);
  const [filter, setFilter] = useState('all'); // all, unread, read

  const markAsRead = (notificationId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNotifications(prevNotifications =>
      prevNotifications.map(notification =>
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      )
    );
  };

  const markAllAsRead = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNotifications(prevNotifications =>
      prevNotifications.map(notification => ({ ...notification, read: true }))
    );
  };

  const deleteNotification = (notificationId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNotifications(prevNotifications =>
      prevNotifications.filter(notification => notification.id !== notificationId)
    );
  };

  const clearAllNotifications = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setNotifications([]);
  };

  const getFilteredNotifications = () => {
    switch (filter) {
      case 'unread':
        return notifications.filter(n => !n.read);
      case 'read':
        return notifications.filter(n => n.read);
      default:
        return notifications;
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'bot_crash': return 'alert-circle';
      case 'bot_offline': return 'wifi-off';
      case 'system_error': return 'alert-octagon';
      default: return 'information';
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'bot_crash': return theme.colors.error;
      case 'bot_offline': return theme.colors.warning;
      case 'system_error': return theme.colors.error;
      default: return theme.colors.primary;
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Az önce';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} dakika önce`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} saat önce`;
    return date.toLocaleDateString('tr-TR');
  };

  const renderNotificationCard = ({ item: notification }) => (
    <Card 
      style={[
        styles.notificationCard,
        !notification.read && styles.unreadCard
      ]}
      onPress={() => markAsRead(notification.id)}
    >
      <Card.Content>
        <View style={styles.notificationHeader}>
          <View style={styles.notificationIcon}>
            <IconButton
              icon={getNotificationIcon(notification.type)}
              iconColor={getNotificationColor(notification.type)}
              size={20}
              style={styles.iconButton}
            />
          </View>
          <View style={styles.notificationContent}>
            <Title style={styles.notificationTitle}>
              {notification.title || 'Bildirim'}
            </Title>
            <Paragraph style={styles.notificationMessage}>
              {notification.message}
            </Paragraph>
            <View style={styles.notificationMeta}>
              <Text style={styles.timestamp}>
                {formatTimestamp(notification.timestamp)}
              </Text>
              {notification.botName && (
                <Chip mode="outlined" compact style={styles.botChip}>
                  {notification.botName}
                </Chip>
              )}
            </View>
          </View>
          <View style={styles.notificationActions}>
            {!notification.read && (
              <View style={styles.unreadDot} />
            )}
            <IconButton
              icon="close"
              size={16}
              onPress={() => deleteNotification(notification.id)}
              style={styles.deleteButton}
            />
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  const filteredNotifications = getFilteredNotifications();
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Title style={styles.headerTitle}>
          Bildirimler ({filteredNotifications.length})
        </Title>
        
        {unreadCount > 0 && (
          <Chip mode="flat" style={styles.unreadCountChip}>
            {unreadCount} okunmamış
          </Chip>
        )}
      </View>

      {/* Filtre Butonları */}
      <View style={styles.filterContainer}>
        {['all', 'unread', 'read'].map(filterType => (
          <Chip
            key={filterType}
            selected={filter === filterType}
            onPress={() => setFilter(filterType)}
            style={styles.filterChip}
          >
            {filterType === 'all' ? 'Hepsi' : 
             filterType === 'unread' ? 'Okunmamış' : 'Okunmuş'}
          </Chip>
        ))}
      </View>

      {/* Bildirim Listesi */}
      <FlatList
        data={filteredNotifications}
        renderItem={renderNotificationCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Bildirim yok</Text>
            <Paragraph style={styles.emptyText}>
              {filter === 'all' ? 'Henüz hiç bildirim almadınız' :
               filter === 'unread' ? 'Okunmamış bildiriminiz yok' : 
               'Okunmuş bildiriminiz yok'}
            </Paragraph>
          </View>
        }
      />

      {/* Aksiyon Butonları */}
      {notifications.length > 0 && (
        <View style={styles.actionButtons}>
          {unreadCount > 0 && (
            <Button
              mode="outlined"
              onPress={markAllAsRead}
              style={styles.actionButton}
            >
              Tümünü Okundu İşaretle
            </Button>
          )}
          <Button
            mode="outlined"
            onPress={clearAllNotifications}
            style={[styles.actionButton, styles.dangerButton]}
            textColor={theme.colors.error}
          >
            Tümünü Temizle
          </Button>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  unreadCountChip: {
    backgroundColor: theme.colors.errorContainer,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
  },
  filterChip: {
    marginRight: theme.spacing.xs,
  },
  listContainer: {
    padding: theme.spacing.md,
  },
  notificationCard: {
    borderRadius: theme.borderRadius.medium,
    elevation: 2,
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationIcon: {
    marginRight: theme.spacing.sm,
  },
  iconButton: {
    margin: 0,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  notificationMessage: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginBottom: theme.spacing.sm,
  },
  notificationMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
  },
  botChip: {
    height: 24,
  },
  notificationActions: {
    alignItems: 'center',
    marginLeft: theme.spacing.sm,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  deleteButton: {
    margin: 0,
  },
  separator: {
    height: theme.spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl * 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.onSurfaceVariant,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.onSurfaceVariant,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    elevation: 2,
  },
  actionButton: {
    flex: 1,
    borderRadius: theme.borderRadius.small,
  },
  dangerButton: {
    borderColor: theme.colors.error,
  },
});

export default NotificationsScreen;