import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Card,
  Title,
  Button,
  List,
  TextInput,
  Chip,
  ActivityIndicator,
  Text,
  Divider,
} from 'react-native-paper';
import * as Haptics from 'expo-haptics';

import { theme } from '../theme';
import apiService from '../services/apiService';

const BotEditorScreen = ({ route, navigation }) => {
  const { bot } = route.params;
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadBotFiles();
  }, []);

  useEffect(() => {
    setHasChanges(fileContent !== originalContent);
  }, [fileContent, originalContent]);

  const loadBotFiles = async () => {
    try {
      setLoading(true);
      const data = await apiService.getBotDetail(bot.id);
      
      if (data.files && data.files.length > 0) {
        setFiles(data.files);
        // Ana dosyayı otomatik seç
        const mainFile = data.files.find(f => 
          f.file_name === bot.main_file || 
          f.file_name.includes('index') || 
          f.file_name.includes('main')
        ) || data.files[0];
        
        selectFile(mainFile);
      }
    } catch (error) {
      console.error('Bot dosyaları yükleme hatası:', error);
      Alert.alert('Hata', 'Bot dosyaları yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const selectFile = (file) => {
    if (hasChanges) {
      Alert.alert(
        'Kaydedilmemiş Değişiklikler',
        'Dosyayı değiştirmeden önce değişiklikleri kaydetmek istiyor musunuz?',
        [
          {
            text: 'Vazgeç',
            style: 'cancel',
          },
          {
            text: 'Kaydetme',
            onPress: () => {
              setSelectedFile(file);
              setFileContent(file.file_content || '');
              setOriginalContent(file.file_content || '');
            },
          },
          {
            text: 'Kaydet',
            onPress: async () => {
              await saveFile();
              setSelectedFile(file);
              setFileContent(file.file_content || '');
              setOriginalContent(file.file_content || '');
            },
          },
        ]
      );
    } else {
      setSelectedFile(file);
      setFileContent(file.file_content || '');
      setOriginalContent(file.file_content || '');
    }
  };

  const saveFile = async () => {
    if (!selectedFile || !hasChanges) return;

    try {
      setSaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const filesToSave = [{
        name: selectedFile.file_name,
        path: selectedFile.file_path,
        content: fileContent
      }];

      await apiService.updateBotFiles(bot.id, filesToSave);
      
      setOriginalContent(fileContent);
      setHasChanges(false);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Başarılı', 'Dosya kaydedildi');

      // Dosya listesini güncelle
      setFiles(prevFiles =>
        prevFiles.map(f =>
          f.id === selectedFile.id
            ? { ...f, file_content: fileContent }
            : f
        )
      );

    } catch (error) {
      console.error('Dosya kaydetme hatası:', error);
      Alert.alert('Hata', 'Dosya kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const validateCode = () => {
    if (!selectedFile || !fileContent) {
      Alert.alert('Hata', 'Doğrulanacak kod bulunamadı');
      return;
    }

    try {
      if (selectedFile.file_name.endsWith('.js')) {
        // Basit JavaScript syntax kontrolü
        new Function(fileContent);
        Alert.alert('Başarılı', 'Kod syntax açısından geçerli görünüyor!');
      } else if (selectedFile.file_name.endsWith('.json')) {
        JSON.parse(fileContent);
        Alert.alert('Başarılı', 'JSON formatı geçerli!');
      } else {
        Alert.alert('Bilgi', 'Bu dosya türü için syntax kontrolü desteklenmiyor');
      }
    } catch (error) {
      Alert.alert('Syntax Hatası', error.message);
    }
  };

  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    switch (ext) {
      case 'js': return '📄';
      case 'json': return '📋';
      case 'md': return '📝';
      case 'txt': return '📄';
      default: return '📄';
    }
  };

  const getFileLanguage = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    switch (ext) {
      case 'js': return 'JavaScript';
      case 'json': return 'JSON';
      case 'md': return 'Markdown';
      case 'txt': return 'Text';
      default: return 'Text';
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Dosyalar yükleniyor...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Title style={styles.headerTitle}>{bot.name} - Editör</Title>
        <View style={styles.headerActions}>
          <Button
            mode="outlined"
            onPress={validateCode}
            disabled={!selectedFile}
            style={styles.headerButton}
            compact
          >
            Doğrula
          </Button>
          <Button
            mode="contained"
            onPress={saveFile}
            disabled={!hasChanges || saving}
            loading={saving}
            style={styles.headerButton}
            compact
          >
            Kaydet
          </Button>
        </View>
      </View>

      <View style={styles.content}>
        {/* Dosya Listesi */}
        <Card style={styles.fileListCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>
              Dosyalar ({files.length})
            </Title>
            <ScrollView style={styles.fileList} showsVerticalScrollIndicator={false}>
              {files.map((file, index) => (
                <React.Fragment key={file.id || index}>
                  <List.Item
                    title={file.file_name}
                    description={getFileLanguage(file.file_name)}
                    left={() => (
                      <Text style={styles.fileIcon}>{getFileIcon(file.file_name)}</Text>
                    )}
                    right={() => (
                      selectedFile?.id === file.id && (
                        <Chip mode="flat" compact style={styles.activeChip}>
                          Aktif
                        </Chip>
                      )
                    )}
                    onPress={() => selectFile(file)}
                    style={[
                      styles.fileItem,
                      selectedFile?.id === file.id && styles.selectedFileItem
                    ]}
                  />
                  {index < files.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </ScrollView>
          </Card.Content>
        </Card>

        {/* Kod Editörü */}
        {selectedFile ? (
          <Card style={styles.editorCard}>
            <Card.Content>
              <View style={styles.editorHeader}>
                <Title style={styles.editorTitle}>
                  {getFileIcon(selectedFile.file_name)} {selectedFile.file_name}
                </Title>
                {hasChanges && (
                  <Chip mode="outlined" compact style={styles.changedChip}>
                    Değişiklik var
                  </Chip>
                )}
              </View>
              
              <TextInput
                mode="outlined"
                multiline
                value={fileContent}
                onChangeText={setFileContent}
                style={styles.codeInput}
                contentStyle={styles.codeInputContent}
                placeholder="Kod buraya yazın..."
                scrollEnabled={true}
              />
            </Card.Content>
          </Card>
        ) : (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <Text style={styles.emptyTitle}>Dosya Seçin</Text>
              <Text style={styles.emptyText}>
                Düzenlemek için sol panelden bir dosya seçin
              </Text>
            </Card.Content>
          </Card>
        )}
      </View>
    </KeyboardAvoidingView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    elevation: 2,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    color: theme.colors.primary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  headerButton: {
    borderRadius: theme.borderRadius.small,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  fileListCard: {
    width: '35%',
    borderRadius: theme.borderRadius.medium,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
  },
  fileList: {
    maxHeight: 400,
  },
  fileIcon: {
    fontSize: 20,
    alignSelf: 'center',
    marginRight: theme.spacing.sm,
  },
  fileItem: {
    paddingHorizontal: 0,
  },
  selectedFileItem: {
    backgroundColor: theme.colors.primaryContainer,
  },
  activeChip: {
    backgroundColor: theme.colors.primary,
  },
  editorCard: {
    flex: 1,
    borderRadius: theme.borderRadius.medium,
    elevation: 3,
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  editorTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  changedChip: {
    borderColor: theme.colors.warning,
  },
  codeInput: {
    flex: 1,
    minHeight: 400,
    maxHeight: 500,
  },
  codeInputContent: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
    lineHeight: 20,
  },
  emptyCard: {
    flex: 1,
    borderRadius: theme.borderRadius.medium,
    elevation: 3,
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.onSurfaceVariant,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
  },
});

export default BotEditorScreen;